const { db } = require('../db');

async function create({ studentNo, fullName, email, passwordHash }) {
  const [r] = await db.query(
    'INSERT INTO users (student_no, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
    [studentNo, fullName, email, passwordHash]);
  return r.insertId;
}

async function findByStudentNo(studentNo) {
  const [rows] = await db.query(
    'SELECT id, student_no, full_name, email, role, password_hash FROM users WHERE student_no = ?',
    [studentNo]);
  return rows[0];
}

module.exports = { create, findByStudentNo };
