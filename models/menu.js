const { db } = require('../db');

async function listAvailable() {
  const [rows] = await db.query(
    'SELECT id, name, category, price FROM menu_items WHERE available = 1 ORDER BY category, name');
  return rows;
}

async function listAll() {
  const [rows] = await db.query(
    'SELECT id, name, category, price, available FROM menu_items ORDER BY category, name');
  return rows;
}

// Prices always come from the database, never from the form.
async function findAvailableByIds(ids) {
  if (!ids.length) return [];
  const [rows] = await db.query(
    'SELECT id, name, price FROM menu_items WHERE available = 1 AND id IN (?)', [ids]);
  return rows;
}

async function setAvailable(id, available) {
  const [r] = await db.query('UPDATE menu_items SET available = ? WHERE id = ?', [available ? 1 : 0, id]);
  return r.affectedRows === 1;
}

module.exports = { listAvailable, listAll, findAvailableByIds, setAvailable };
