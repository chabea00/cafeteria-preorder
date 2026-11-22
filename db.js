const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5, // CHANGED: Reduced for free tiers
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined // ADDED: TLS for cloud
});

module.exports = { db };