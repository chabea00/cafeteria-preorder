const { Router } = require('express');
const bcrypt = require('bcryptjs');
const Users = require('../models/users');
const Stalls = require('../models/stalls');
const router = Router();

const str = (v) => String(v ?? '').trim();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function checkPerson({ fullName, email, password }) {
  const errors = [];
  if (fullName.length < 2 || fullName.length > 120) errors.push('Enter your full name (up to 120 characters).');
  if (!EMAIL.test(email) || email.length > 160) errors.push('Enter a valid e-mail address.');
  if (password.length < 8 || password.length > 72) errors.push('Password must be 8\u201372 characters.');
  return errors;
}

/* ---------- student registration ---------- */
router.get('/register', (req, res) =>
  res.render('auth/register', { title: 'Create account', errors: [], old: {} }));

router.post('/register', async (req, res, next) => {
  try {
    const studentNo = str(req.body.student_no);
    const fullName = str(req.body.full_name);
    const email = str(req.body.email).toLowerCase();
    const password = String(req.body.password ?? '');
    const errors = checkPerson({ fullName, email, password });
    if (!/^[A-Za-z0-9-]{4,20}$/.test(studentNo)) errors.unshift('Student number must be 4\u201320 letters, digits, or hyphens.');
    const old = { studentNo, fullName, email };
    if (errors.length) return res.status(422).render('auth/register', { title: 'Create account', errors, old });
    const passwordHash = await bcrypt.hash(password, 10); // NFR: bcrypt cost >= 10
    try {
      await Users.create({ studentNo, fullName, email, passwordHash });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(422).render('auth/register', {
          title: 'Create account', errors: ['That student number or e-mail is already registered.'], old });
      }
      throw err;
    }
    req.session.flash = 'Account created. Please log in.';
    res.redirect(303, '/login');
  } catch (err) { next(err); }
});

/* ---------- stall registration ---------- */
router.get('/register/stall', (req, res) =>
  res.render('auth/register-stall', { title: 'Register your stall', errors: [], old: {} }));

router.post('/register/stall', async (req, res, next) => {
  try {
    const name = str(req.body.stall_name);
    const location = str(req.body.location);
    const description = str(req.body.description);
    const fullName = str(req.body.full_name);
    const email = str(req.body.email).toLowerCase();
    const password = String(req.body.password ?? '');
    const errors = checkPerson({ fullName, email, password });
    if (name.length < 2 || name.length > 80) errors.unshift('Stall name must be 2\u201380 characters.');
    if (location.length > 80) errors.push('Location must be 80 characters or fewer.');
    if (description.length > 200) errors.push('Description must be 200 characters or fewer.');
    const old = { name, location, description, fullName, email };
    if (errors.length) return res.status(422).render('auth/register-stall', { title: 'Register your stall', errors, old });
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await Stalls.register({ fullName, email, passwordHash, name, location, description });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(422).render('auth/register-stall', {
          title: 'Register your stall', errors: ['That stall name or e-mail is already registered.'], old });
      }
      throw err;
    }
    req.session.flash = 'Stall registered. Log in with your e-mail to add your menu.';
    res.redirect(303, '/login');
  } catch (err) { next(err); }
});

/* ---------- login / logout ---------- */
router.get('/login', (req, res) =>
  res.render('auth/login', { title: 'Log in', errors: [], old: {} }));

router.post('/login', async (req, res, next) => {
  try {
    const login = str(req.body.login);
    const password = String(req.body.password ?? '');
    const u = login ? await Users.findByLogin(login) : null;
    const ok = u && await bcrypt.compare(password, u.password_hash);
    if (!ok) { // same message either way: do not reveal which part was wrong
      return res.status(401).render('auth/login', {
        title: 'Log in', errors: ['Student number / e-mail or password is incorrect.'], old: { login } });
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: u.id, name: u.full_name, role: u.role };
      res.redirect(303, u.role === 'stall' ? '/dashboard' : u.role === 'student' ? '/stalls' : '/');
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect(303, '/login'));
});

module.exports = router;
