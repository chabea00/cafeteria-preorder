const { db } = require('../db');

async function create({ studentNo, fullName, email, passwordHash }) {
  const [r] = await db.query(
    "INSERT INTO users (student_no, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'student')",
    [studentNo, fullName, email, passwordHash]);
  return r.insertId;
}

// Students log in with their student number, stall owners with their e-mail.
async function findByLogin(identifier) {
  const [rows] = await db.query(
    'SELECT id, student_no, full_name, email, role, password_hash FROM users ' +
    'WHERE student_no = ? OR email = ? LIMIT 1',
    [identifier, identifier.toLowerCase()]);
  return rows[0];
}

module.exports = { create, findByLogin };
