const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const multer = require('multer');
require('./lib/images'); // makes sure public/uploads exists
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

// Photos are held in memory first and only written to disk by a route after login and validation.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 30, fieldSize: 20 * 1024 }
}).single('image');
app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 }
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
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use(require('./routes/auth'));
app.use(require('./routes/stalls'));
app.use(require('./routes/orders'));
app.use(require('./routes/dashboard'));

// these two must be LAST, in this order
app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'That page does not exist.' }));
app.use((err, req, res, next) => {
  console.error(err); // details stay in the log; the user sees nothing technical
  res.status(500).render('error', { title: 'Something went wrong', message: 'Please try again in a moment.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log('Listening on http://localhost:' + PORT));
}
module.exports = app;
