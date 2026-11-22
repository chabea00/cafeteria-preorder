const { db } = require('../db');

async function create({ studentNo, fullName, email, passwordHash }) {
  const [r] = await db.query(
    "INSERT INTO users (student_no, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'student')",
    [studentNo, fullName, email, passwordHash]);
  return r.insertId;
}

async function findByLogin(identifier) {
  const [rows] = await db.query(
    'SELECT id, student_no, full_name, email, role, password_hash FROM users ' +
    'WHERE student_no = ? OR email = ? LIMIT 1',
    [identifier, identifier.toLowerCase()]);
  return rows[0];
}

// NEW FUNCTION FOR STAFF
async function createStaff({ fullName, email, passwordHash }) {
  const [r] = await db.query(
    "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'staff')",
    [fullName, email, passwordHash]);
  return r.insertId;
}

// NEW FUNCTIONS FOR PASSWORD RESET
async function createResetToken(email, token, expiresAt) {
  await db.query('DELETE FROM password_resets WHERE email = ?', [email]);
  await db.query('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)', [email, token, expiresAt]);
}

async function findResetToken(token) {
  const [rows] = await db.query('SELECT email FROM password_resets WHERE token = ? AND expires_at > NOW()', [token]);
  return rows[0];
}

async function updatePassword(email, passwordHash) {
  await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [email, passwordHash]);
  await db.query('DELETE FROM password_resets WHERE email = ?', [email]); 
}

module.exports = { 
  create, 
  findByLogin, 
  createStaff,      
  createResetToken, 
  findResetToken, 
  updatePassword 
};