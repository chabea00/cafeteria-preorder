const { db } = require('../db');

const CATEGORIES = ['Viands', 'Rice meals', 'Snacks', 'Drinks', 'Desserts', 'Others'];
const DEFAULT_MAX_PER_ORDER = 10;

// Current time in Manila as minutes since midnight, independent of the server's time zone
// (Render/Railway run in UTC).
const MANILA_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
function manilaMinutes() {
  const parts = MANILA_CLOCK.formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

// Convert "HH:MM[:SS]" to "h:MM AM/PM"
function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  let displayH = h > 12 ? h - 12 : h;
  if (displayH === 0) displayH = 12; // midnight
  return displayH + ':' + String(m).padStart(2, '0') + ' ' + suffix;
}

// Works out what a student should see for one item.
function decorate(r) {
  const sold = Number(r.sold_today);
  const remaining = r.daily_limit == null ? null : Math.max(0, r.daily_limit - sold);
  const perOrder = r.max_per_student || DEFAULT_MAX_PER_ORDER;
  let state = 'ok';
  let reason = '';

  const currentTimeInMinutes = manilaMinutes();
  let isAvailableNow = true;

  if (r.order_start && r.order_end) {
    const [startH, startM] = r.order_start.split(':').map(Number);
    const [endH, endM] = r.order_end.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    // >= so the end minute is closed, matching the order check in routes/stalls.js
    if (currentTimeInMinutes < startTotal || currentTimeInMinutes >= endTotal) {
      isAvailableNow = false;
      state = 'off';
      reason = `Ordering closed. Available from ${formatTime(r.order_start)} to ${formatTime(r.order_end)}.`;
    }
  }

  if (!r.available) { state = 'off'; reason = 'Item will be coming back soon'; }
  else if (remaining === 0) { state = 'off'; reason = 'Item has reached the limit of pre-orders'; }

  return {
    ...r, price: Number(r.price), sold_today: sold, remaining, state, reason, isAvailableNow,
    maxQty: remaining == null ? perOrder : Math.min(perOrder, remaining)
  };
}

// Every non-deleted item of one stall, with how many were pre-ordered today.
async function listForStall(stallId) {
  const [rows] = await db.query(
    'SELECT m.id, m.name, m.category, m.price, m.available, m.max_per_student, m.daily_limit, m.image, m.description, m.order_start, m.order_end, ' +
    "COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity END), 0) AS sold_today " +
    'FROM menu_items m ' +
    'LEFT JOIN order_items oi ON oi.menu_item_id = m.id ' +
    "LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled' AND DATE(o.created_at) = CURDATE() " +
    'WHERE m.stall_id = ? AND m.deleted = 0 GROUP BY m.id ORDER BY m.name', [stallId]);
  return rows.map(decorate);
}

function groupByCategory(items) {
  const map = new Map(CATEGORIES.map((c) => [c, []]));
  items.forEach((i) => {
    if (!map.has(i.category)) map.set(i.category, []);
    map.get(i.category).push(i);
  });
  return [...map]
    .filter(([, list]) => list.length)
    .map(([category, list]) => ({
      category, items: list, slug: category.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    }));
}

// For the landing page
async function listPublic() {
  const [rows] = await db.query(
    'SELECT m.id, m.name, s.name AS stall_name FROM menu_items m JOIN stalls s ON s.id = m.stall_id ' +
    'WHERE m.deleted = 0 AND m.available = 1 ORDER BY s.name, m.name LIMIT 60');
  return rows;
}

// Ownership is checked inside the SQL: a stall can never touch another stall's item.
async function findOwned(id, stallId) {
  const [rows] = await db.query(
    'SELECT id, name, category, price, available, max_per_student, daily_limit, image, description, order_start, order_end ' +
    'FROM menu_items WHERE id = ? AND stall_id = ? AND deleted = 0', [id, stallId]);
  return rows[0];
}

async function create(stallId, d) {
  const [r] = await db.query(
    'INSERT INTO menu_items (stall_id, name, category, description, price, available, max_per_student, daily_limit, image, order_start, order_end) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [stallId, d.name, d.category, d.description, d.price, d.available ? 1 : 0, d.max_per_student, d.daily_limit, d.image || null, d.order_start || null, d.order_end || null]);
  return r.insertId;
}

// d.image: undefined = keep the current photo, null = remove it, string = new file name
async function update(id, stallId, d) {
  const sets = ['name = ?', 'category = ?', 'description = ?', 'price = ?', 'available = ?', 'max_per_student = ?', 'daily_limit = ?', 'order_start = ?', 'order_end = ?'];
  const params = [d.name, d.category, d.description, d.price, d.available ? 1 : 0, d.max_per_student, d.daily_limit, d.order_start || null, d.order_end || null];
  if (d.image !== undefined) { sets.push('image = ?'); params.push(d.image); }
  params.push(id, stallId);
  const [r] = await db.query(
    'UPDATE menu_items SET ' + sets.join(', ') + ' WHERE id = ? AND stall_id = ? AND deleted = 0', params);
  return r.affectedRows === 1;
}

async function setAvailable(id, stallId, available) {
  const [r] = await db.query(
    'UPDATE menu_items SET available = ? WHERE id = ? AND stall_id = ? AND deleted = 0',
    [available ? 1 : 0, id, stallId]);
  return r.affectedRows === 1;
}

// Soft delete: old orders keep their item names and prices.
async function softDelete(id, stallId) {
  const [r] = await db.query(
    'UPDATE menu_items SET deleted = 1 WHERE id = ? AND stall_id = ? AND deleted = 0', [id, stallId]);
  return r.affectedRows === 1;
}

module.exports = {
  CATEGORIES, listForStall, groupByCategory, listPublic, findOwned, create, update, setAvailable, softDelete
};