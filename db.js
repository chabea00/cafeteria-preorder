require('dotenv').config();
const mysql = require('mysql2/promise');

const ca = process.env.DB_CA_CERT
  ? process.env.DB_CA_CERT.replace(/\\n/g, '\n')
  : undefined;

// Force SSL to always be on for TiDB Cloud
const sslOptions = {
  rejectUnauthorized: false,
  ...(ca ? { ca } : {})
};

const port = Number(process.env.DB_PORT) || 4000;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: port,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5, // Required by lab
  maxIdle: 1,
  idleTimeout: 300000,
  enableKeepAlive: true,
  ssl: sslOptions,    // Ensure SSL is passed here
  timezone: '+08:00' 
});

// Make MySQL's own clock Manila time
db.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+08:00'");
});

module.exports = { db, sslOptions, port };