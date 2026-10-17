# Cafeteria Pre-order System

CCIT 106 midterm project. Stack: Node.js 20/22 LTS, Express, EJS (server-side rendering), MySQL 8, express-session, bcryptjs.

## Setup (clone to running)
```bash
git clone <url> && cd cafeteria-preorder
npm install
cp .env.example .env          # fill in DB_PASSWORD and SESSION_SECRET
mysql -u root -p < sql/schema.sql
npm run dev                   # http://localhost:3000
npm test
```
Create a MySQL user matching `.env` (e.g. `CREATE USER 'campus_app'@'localhost' IDENTIFIED BY '...'; GRANT ALL ON cafeteria_preorder.* TO 'campus_app'@'localhost';`).
To make a staff account: register normally, then `UPDATE users SET role='staff' WHERE student_no='...';`

## Features
- Student: register/log in, browse available menu, pre-order with pickup time (8:00–17:00, ≥15 min ahead), view/cancel pending orders, download own data (`/me/data`).
- Staff: order queue sorted by pickup time with status filter, status updates, mark items sold out.
