require('dotenv').config(); // must be first
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const crypto = require('crypto');
const multer = require('multer');
const { db, sslOptions, port: dbPort } = require('./db'); // adjust path if needed

const isProd = process.env.NODE_ENV === 'production';

// Fail fast instead of silently using a weak fallback secret
if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the proxy (Render/Railway) so secure cookies work
if (isProd) app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 30, fieldSize: 20 * 1024 }
}).single('image');
app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ---- Routes that must NOT create sessions (placed BEFORE session middleware) ----
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Uploaded photos are stored in the database so they survive redeploys
app.get('/uploads/:filename', async (req, res, next) => {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(req.params.filename)) return next();
  try {
    const [rows] = await db.execute(
      'SELECT mime, data FROM images WHERE filename = ?', [req.params.filename]);
    if (!rows.length) return next();
    res.set({
      'Content-Type': rows[0].mime,
      'Cache-Control': 'public, max-age=31536000, immutable', // filenames are random, never reused
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(rows[0].data);
  } catch (e) { next(e); }
});

// ---- Sessions ----
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: dbPort,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true, // needs CREATE privilege; otherwise create the table once as admin
  connectionLimit: 2,        // keeps total connections low (app pool uses up to 5)
  ssl: sslOptions
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-me', // dev only; production throws above
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 2 * 60 * 60 * 1000
  }
}));

// request logger
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => console.log(req.method, req.originalUrl, res.statusCode, (Date.now() - t) + 'ms'));
  next();
});

// shared template variables + flash (shown once) + CSRF token
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.resetLink = req.session.resetLink || null; // simulated password-reset e-mail link
  delete req.session.resetLink;
  next();
});

// forms that upload a photo arrive as multipart; read them before the token check
app.use((req, res, next) => {
  const multipart = req.method === 'POST' && (req.headers['content-type'] || '').startsWith('multipart/form-data');
  if (!multipart) return next();
  upload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'That photo is larger than 2 MB. Please choose a smaller one.'
      : 'The upload could not be read. Please try again.';
    res.status(422).render('error', { title: 'Upload problem', message });
  });
});

// every state-changing request is a POST and must carry the token
app.use((req, res, next) => {
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', { title: 'Form expired', message: 'Your form expired. Go back, refresh, and try again.' });
  }
  next();
});

app.use(require('./routes/home'));
app.use(require('./routes/auth'));
app.use(require('./routes/stalls'));
app.use(require('./routes/orders'));
app.use(require('./routes/dashboard'));

// these two must be LAST, in this order
app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'That page does not exist.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'Please try again in a moment.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log('Listening on port ' + PORT));
}
module.exports = app;