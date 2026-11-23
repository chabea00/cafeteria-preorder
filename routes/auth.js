const { Router } = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // ADDED FOR PASSWORD RESET
const Users = require('../models/users');
const Stalls = require('../models/stalls');
const Images = require('../lib/images');
const router = Router();

const str = (v) => String(v ?? '').trim();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// UPDATED: Stronger password validation
function checkPerson({ fullName, email, password }) {
  const errors = [];
  if (fullName.length < 2 || fullName.length > 120) errors.push('Enter your full name (up to 120 characters).');
  if (!EMAIL.test(email) || email.length > 160) errors.push('Enter a valid e-mail address.');
  
  if (password.length < 8 || password.length > 72) {
    errors.push('Password must be 8\u201372 characters.');
  } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
  }
  
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
    const up = errors.length ? {} : await Images.saveUpload(req.file);
    if (up.error) errors.push(up.error);
    const old = { name, location, description, fullName, email };
    if (errors.length) return res.status(422).render('auth/register-stall', { title: 'Register your stall', errors, old });
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await Stalls.register({ fullName, email, passwordHash, name, location, description, logo: up.filename || null });
    } catch (err) {
      Images.remove(up.filename); // nothing was created, so do not keep the file
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

/* ---------- staff registration ---------- */
router.get('/register/staff', (req, res) =>
  res.render('auth/register-staff', { title: 'Staff Registration', errors: [], old: {} }));

router.post('/register/staff', async (req, res, next) => {
  try {
    const fullName = str(req.body.full_name);
    const email = str(req.body.email).toLowerCase();
    const password = String(req.body.password ?? '');
    const errors = checkPerson({ fullName, email, password });
    const old = { fullName, email };
    
    if (errors.length) return res.status(422).render('auth/register-staff', { title: 'Staff Registration', errors, old });
    
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await Users.createStaff({ fullName, email, passwordHash });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(422).render('auth/register-staff', { title: 'Staff Registration', errors: ['That e-mail is already registered.'], old });
      }
      throw err;
    }
    req.session.flash = 'Staff account created. Please log in.';
    res.redirect(303, '/login?as=staff');
  } catch (err) { next(err); }
});

/* ---------- login / logout ---------- */
const asRole = (v) => (['stall', 'staff'].includes(v) ? v : 'student');

router.get('/login', (req, res) =>
  res.render('auth/login', { title: 'Log in', errors: [], old: {}, as: asRole(req.query.as) }));

router.post('/login', async (req, res, next) => {
  try {
    const login = str(req.body.login);
    const password = String(req.body.password ?? '');
    const as = asRole(req.body.as);
    const u = login ? await Users.findByLogin(login) : null;
    const ok = u && await bcrypt.compare(password, u.password_hash);
    if (!ok) { // same message either way: do not reveal which part was wrong
      return res.status(401).render('auth/login', {
        title: 'Log in', errors: ['Login details or password are incorrect.'], old: { login }, as });
    }
    
    // the password was right, so it is safe to say which kind of account this is
    if (as !== u.role && !(as === 'student' && u.role === 'admin')) {
      const msg = `This is a ${u.role} account. Please choose the correct role above.`;
      return res.status(422).render('auth/login', { title: 'Log in', errors: [msg], old: { login }, as });
    }
    
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: u.id, name: u.full_name, role: u.role };
      // UPDATED: Redirect everyone except stall owners to /stalls
      res.redirect(303, u.role === 'stall' ? '/dashboard' : '/stalls');
    });
  } catch (err) { next(err); }
});

// Change POST to GET
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect(303, '/'));
});

/* ---------- forgot password ---------- */
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password', errors: [], old: {} });
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = str(req.body.email).toLowerCase();
    const u = await Users.findByLogin(email);
    
    if (!u) {
      return res.status(422).render('auth/forgot-password', { title: 'Forgot Password', errors: ['If that email exists, a reset link was sent.'], old: {} });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 
    
    await Users.createResetToken(email, token, expiresAt);

    req.session.flash = 'Your password reset link is ready. Use the link below to reset your password.';
    req.session.resetLink = '/reset-password/' + token;
    res.redirect(303, '/login');
  } catch (err) { next(err); }
});

router.get('/reset-password/:token', async (req, res, next) => {
  try {
    const tokenRow = await Users.findResetToken(req.params.token);
    if (!tokenRow) {
      return res.status(400).render('error', { title: 'Invalid Link', message: 'This password reset link is invalid or has expired.' });
    }
    res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token, errors: [] });
  } catch (err) { next(err); }
});

router.post('/reset-password/:token', async (req, res, next) => {
  try {
    const tokenRow = await Users.findResetToken(req.params.token);
    const password = String(req.body.password ?? '');
    
    if (!tokenRow) {
      return res.status(400).render('error', { title: 'Invalid Link', message: 'This password reset link is invalid or has expired.' });
    }

    const errors = checkPerson({ fullName: 'Valid Name', email: tokenRow.email, password });
    if (errors.length) {
      return res.status(422).render('auth/reset-password', { title: 'Reset Password', token: req.params.token, errors });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await Users.updatePassword(tokenRow.email, passwordHash);

    req.session.flash = 'Your password has been reset. Please log in.';
    res.redirect(303, '/login');
  } catch (err) { next(err); }
});

module.exports = router;