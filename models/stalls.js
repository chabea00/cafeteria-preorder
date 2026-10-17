const { db } = require('../db');

// Creates the owner account and the stall together, or neither.
async function register({ fullName, email, passwordHash, name, location, description, logo }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [u] = await conn.query(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'stall')",
      [fullName, email, passwordHash]);
    await conn.query(
      'INSERT INTO stalls (user_id, name, location, description, logo) VALUES (?, ?, ?, ?, ?)',
      [u.insertId, name, location, description, logo || null]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listWithCounts() {
  const [rows] = await db.query(
    'SELECT s.id, s.name, s.location, s.description, s.logo, COUNT(m.id) AS item_count ' +
    'FROM stalls s LEFT JOIN menu_items m ON m.stall_id = s.id AND m.deleted = 0 AND m.available = 1 ' +
    'GROUP BY s.id ORDER BY s.name');
  return rows;
}

async function findById(id) {
  const [rows] = await db.query('SELECT id, name, location, description, logo FROM stalls WHERE id = ?', [id]);
  return rows[0];
}

async function findByUserId(userId) {
  const [rows] = await db.query('SELECT id, name, location, description, logo FROM stalls WHERE user_id = ?', [userId]);
  return rows[0];
}

// d.logo: undefined = keep the current logo, null = remove it, string = new file name
async function update(id, d) {
  const sets = ['name = ?', 'location = ?', 'description = ?'];
  const params = [d.name, d.location, d.description];
  if (d.logo !== undefined) { sets.push('logo = ?'); params.push(d.logo); }
  params.push(id);
  await db.query('UPDATE stalls SET ' + sets.join(', ') + ' WHERE id = ?', params);
}

module.exports = { register, listWithCounts, findById, findByUserId, update };
