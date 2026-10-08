# TrayAhead — Cafeteria Pre-order System

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

## Where the course lessons show up
| Lesson | Where |
|---|---|
| Week 3 data minimisation, notice, access/portability | `sql/schema.sql`, `views/auth/register.ejs`, `/me/data` |
| Week 4 FR/NFR, exception paths | Pickup-time, quantity, sold-out and duplicate-account checks in `routes/` |
| Week 5 Express, middleware order | `app.js` (logger, parsers, static, 404, 4-arg error handler last) |
| Week 6 EJS partials, forms, PRG, 422 | `views/`, `routes/orders.js` |
| Week 6 parameterised SQL, ownership in SQL | `models/orders.js` (`findOwned`, `cancelOwned`) |
| Accessibility | labels bound to inputs, skip link, `role=alert`, text status labels, `:focus-visible` |
| Week 7 / 8 | `docs/AI-LOG.md`, LICENSE, `.gitignore`, conventional commits |

## Suggested requirements (extend in your own document)
- FR: place order, unique reference, staff status change, cancel while pending, export own data
- NFR: pages < 2 s for 500 orders; bcrypt cost ≥ 10; WCAG 2.2 AA forms; retain data 1 academic year
- Won't (this round): online payment, e-mail notifications, order edits after placement
