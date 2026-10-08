const { Router } = require('express');
const bcrypt = require('bcryptjs');
const Users = require('../models/users');
const router = Router();

const str = (v) => String(v ?? '').trim();

router.get('/register', (req, res) =>
  res.render('auth/register', { title: 'Create account', errors: [], old: {} }));

router.post('/register', async (req, res, next) => {
  try {
    const studentNo = str(req.body.student_no);
    const fullName = str(req.body.full_name);
    const email = str(req.body.email).toLowerCase();
    const password = String(req.body.password ?? '');
    const errors = [];
    if (!/^[A-Za-z0-9-]{4,20}$/.test(studentNo)) errors.push('Student number must be 4–20 letters, digits, or hyphens.');
    if (fullName.length < 2 || fullName.length > 120) errors.push('Enter your full name (up to 120 characters).');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) errors.push('Enter a valid e-mail address.');
    if (password.length < 8 || password.length > 72) errors.push('Password must be 8–72 characters.');
    if (errors.length) {
      return res.status(422).render('auth/register', { title: 'Create account', errors, old: { studentNo, fullName, email } });
    }
    const passwordHash = await bcrypt.hash(password, 10); // NFR: bcrypt cost >= 10
    try {
      await Users.create({ studentNo, fullName, email, passwordHash });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(422).render('auth/register', {
          title: 'Create account', errors: ['That student number or e-mail is already registered.'],
          old: { studentNo, fullName, email } });
      }
      throw err;
    }
    req.session.flash = 'Account created. Please log in.';
    res.redirect(303, '/login');
  } catch (err) { next(err); }
});

router.get('/login', (req, res) =>
  res.render('auth/login', { title: 'Log in', errors: [], old: {} }));

router.post('/login', async (req, res, next) => {
  try {
    const studentNo = str(req.body.student_no);
    const password = String(req.body.password ?? '');
    const u = await Users.findByStudentNo(studentNo);
    const ok = u && await bcrypt.compare(password, u.password_hash);
    if (!ok) { // same message either way: do not reveal which part was wrong
      return res.status(401).render('auth/login', {
        title: 'Log in', errors: ['Student number or password is incorrect.'], old: { studentNo } });
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: u.id, name: u.full_name, role: u.role };
      res.redirect(303, u.role === 'student' ? '/orders' : '/staff');
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect(303, '/login'));
});

module.exports = router;
