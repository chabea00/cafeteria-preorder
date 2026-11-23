require('dotenv').config();
const mysql = require('mysql2/promise');

const isProd = process.env.NODE_ENV === 'production';

// Some providers (e.g. Aiven) use their own CA. Paste the PEM into DB_CA_CERT.
// TiDB Cloud and others with public CAs can leave DB_CA_CERT empty.
const ca = process.env.DB_CA_CERT
  ? process.env.DB_CA_CERT.replace(/\\n/g, '\n')
  : undefined;

const sslOptions = isProd
  ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
  : undefined;

const port = Number(process.env.DB_PORT) || 3306;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: sslOptions,
  timezone: '+08:00' // how mysql2 converts DATE/TIMESTAMP values to JS Dates (Manila)
});

// Make MySQL's own clock Manila time for every connection, so NOW(), CURDATE()
// and "today's orders" roll over at Manila midnight, not UTC midnight.
db.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+08:00'");
});

module.exports = { db, sslOptions, port };
