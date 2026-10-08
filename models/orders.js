const crypto = require('crypto');
const { db } = require('../db');

const STATUSES = ['pending', 'preparing', 'ready', 'picked_up', 'cancelled'];

// lines: [{ menuItemId, quantity, unitPrice }] — one transaction, all or nothing
async function create({ userId, pickupTime, note, lines }) {
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const reference = 'CAF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO orders (reference_no, user_id, pickup_time, note, total) VALUES (?, ?, ?, ?, ?)',
      [reference, userId, pickupTime, note, total.toFixed(2)]);
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
    'SELECT id, reference_no, pickup_time, total, status, created_at ' +
    'FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [userId]);
  return rows;
}

// Ownership is checked inside the SQL
async function findOwned(id, userId) {
  const [rows] = await db.query(
    'SELECT id, reference_no, pickup_time, note, total, status, created_at ' +
    'FROM orders WHERE id = ? AND user_id = ?', [id, userId]);
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

async function queue(status = null) {
  let sql =
    "SELECT o.id, o.reference_no, o.pickup_time, o.note, o.total, o.status, u.full_name, " +
    "GROUP_CONCAT(CONCAT(oi.quantity, ' x ', m.name) ORDER BY m.name SEPARATOR ', ') AS items " +
    'FROM orders o JOIN users u ON u.id = o.user_id ' +
    'JOIN order_items oi ON oi.order_id = o.id JOIN menu_items m ON m.id = oi.menu_item_id';
  const params = [];
  if (status) { sql += ' WHERE o.status = ?'; params.push(status); }
  sql += ' GROUP BY o.id ORDER BY o.pickup_time ASC, o.id ASC LIMIT 100';
  const [rows] = await db.query(sql, params);
  return rows;
}

async function updateStatus(id, status) {
  const [r] = await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  return r.affectedRows === 1;
}

module.exports = { STATUSES, create, listByUser, findOwned, itemsOf, cancelOwned, queue, updateStatus };
