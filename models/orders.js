const crypto = require('crypto');
const { db } = require('../db');

const STATUSES = ['pending', 'preparing', 'ready', 'picked_up', 'cancelled'];
const DEFAULT_MAX_PER_ORDER = 10;

// An error whose message is safe to show to the student.
class UserError extends Error {}

// wanted: [{ id, q }] — all items must belong to this stall.
// Limits are checked inside the transaction, with the item rows locked, so two
// students ordering the last portion at the same time cannot both succeed.
async function create({ userId, stallId, pickupTime, note, wanted }) {
  const ids = wanted.map((w) => w.id);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query(
      'SELECT id, name, price, available, max_per_student, daily_limit FROM menu_items ' +
      'WHERE stall_id = ? AND deleted = 0 AND id IN (?) FOR UPDATE', [stallId, ids]);
    if (items.length !== ids.length) throw new UserError('One or more items are not on this stall\u2019s menu.');

    const [soldRows] = await conn.query(
      'SELECT oi.menu_item_id AS id, SUM(oi.quantity) AS sold FROM order_items oi ' +
      "JOIN orders o ON o.id = oi.order_id WHERE o.status <> 'cancelled' AND DATE(o.created_at) = CURDATE() " +
      'AND oi.menu_item_id IN (?) GROUP BY oi.menu_item_id', [ids]);
    const sold = new Map(soldRows.map((r) => [r.id, Number(r.sold)]));

    const lines = [];
    let total = 0;
    for (const w of wanted) {
      const it = items.find((i) => i.id === w.id);
      if (!it.available) throw new UserError(it.name + ' is not available right now.');
      const perOrder = it.max_per_student || DEFAULT_MAX_PER_ORDER;
      if (w.q > perOrder) throw new UserError('You can order at most ' + perOrder + ' of ' + it.name + ' at a time.');
      if (it.daily_limit != null) {
        const left = it.daily_limit - (sold.get(it.id) || 0);
        if (left <= 0) throw new UserError(it.name + ' has reached the limit of pre-orders.');
        if (w.q > left) throw new UserError('Only ' + left + ' of ' + it.name + ' left for pre-order today.');
      }
      lines.push({ menuItemId: it.id, quantity: w.q, unitPrice: Number(it.price) });
      total += Number(it.price) * w.q;
    }

    const reference = 'CAF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const [r] = await conn.query(
      'INSERT INTO orders (reference_no, user_id, stall_id, pickup_time, note, total) VALUES (?, ?, ?, ?, ?, ?)',
      [reference, userId, stallId, pickupTime, note, total.toFixed(2)]);
    for (const l of lines) {
      await conn.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [r.insertId, l.menuItemId, l.quantity, l.unitPrice]);
    }
    await conn.commit();
    return { id: r.insertId, reference };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listByUser(userId) {
  const [rows] = await db.query(
    'SELECT o.id, o.reference_no, o.pickup_time, o.total, o.status, o.created_at, s.name AS stall_name ' +
    'FROM orders o JOIN stalls s ON s.id = o.stall_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 100',
    [userId]);
  return rows;
}

// Ownership is checked inside the SQL
async function findOwned(id, userId) {
  const [rows] = await db.query(
    'SELECT o.id, o.reference_no, o.pickup_time, o.note, o.total, o.status, o.created_at, s.name AS stall_name ' +
    'FROM orders o JOIN stalls s ON s.id = o.stall_id WHERE o.id = ? AND o.user_id = ?', [id, userId]);
  return rows[0];
}

async function itemsOf(orderId) {
  const [rows] = await db.query(
    'SELECT m.name, oi.quantity, oi.unit_price FROM order_items oi ' +
    'JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id = ? ORDER BY m.name', [orderId]);
  return rows;
}

async function cancelOwned(id, userId) {
  const [r] = await db.query(
    "UPDATE orders SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'",
    [id, userId]);
  return r.affectedRows === 1;
}

// A stall only ever sees its own orders.
async function queue(stallId, status = null) {
  let sql =
    "SELECT o.id, o.reference_no, o.pickup_time, o.note, o.total, o.status, u.full_name, " +
    "GROUP_CONCAT(CONCAT(oi.quantity, ' x ', m.name) ORDER BY m.name SEPARATOR ', ') AS items " +
    'FROM orders o JOIN users u ON u.id = o.user_id ' +
    'JOIN order_items oi ON oi.order_id = o.id JOIN menu_items m ON m.id = oi.menu_item_id ' +
    'WHERE o.stall_id = ?';
  const params = [stallId];
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  sql += ' GROUP BY o.id ORDER BY o.pickup_time ASC, o.id ASC LIMIT 100';
  const [rows] = await db.query(sql, params);
  return rows;
}

async function updateStatus(id, stallId, status) {
  const [r] = await db.query('UPDATE orders SET status = ? WHERE id = ? AND stall_id = ?', [status, id, stallId]);
  return r.affectedRows === 1;
}

module.exports = {
  STATUSES, UserError, create, listByUser, findOwned, itemsOf, cancelOwned, queue, updateStatus
};
