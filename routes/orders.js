const { Router } = require('express');
const Menu = require('../models/menu');
const Orders = require('../models/orders');
const { db } = require('../db');
const { requireLogin } = require('../middleware/auth');
const router = Router();
router.use(['/orders', '/me'], requireLogin); // scoped, so unknown URLs still reach the 404 handler

const OPEN = 8 * 60, CLOSE = 17 * 60, LEAD_MIN = 15;

router.get('/orders', async (req, res, next) => {
  try {
    const orders = await Orders.listByUser(req.session.user.id);
    res.render('orders/list', { title: 'My orders', orders });
  } catch (err) { next(err); }
});

router.get('/orders/new', async (req, res, next) => {
  try {
    res.render('orders/new', { title: 'New pre-order', menu: await Menu.listAvailable(), errors: [], old: { qty: {} } });
  } catch (err) { next(err); }
});

router.post('/orders', async (req, res, next) => {
  try {
    const pickupTime = String(req.body.pickup_time ?? '').trim();
    const note = String(req.body.note ?? '').trim();
    const rawQty = (req.body.qty && typeof req.body.qty === 'object') ? req.body.qty : {};
    const errors = [];

    // 1. quantities: ignore blanks/zero, reject anything else that is not 1-10
    const wanted = [];
    for (const [k, v] of Object.entries(rawQty)) {
      const id = Number(k), q = Number(v);
      if (v === '' || q === 0) continue;
      if (!Number.isInteger(id) || !Number.isInteger(q) || q < 1 || q > 10) {
        errors.push('Quantities must be whole numbers from 1 to 10.'); break;
      }
      wanted.push({ id, q });
    }
    if (!wanted.length && !errors.length) errors.push('Choose at least one item.');

    // 2. pickup time: today, within opening hours, with lead time
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(pickupTime);
    if (!m) errors.push('Choose a pickup time.');
    else {
      const mins = Number(m[1]) * 60 + Number(m[2]);
      const now = new Date(); const nowMins = now.getHours() * 60 + now.getMinutes();
      if (mins < OPEN || mins > CLOSE) errors.push('Pickup must be between 8:00 and 17:00.');
      else if (mins < nowMins + LEAD_MIN) errors.push('Pickup must be at least 15 minutes from now.');
    }
    if (note.length > 200) errors.push('Note must be 200 characters or fewer.');

    // 3. look up real prices; any unavailable item is an error
    let lines = [];
    if (!errors.length) {
      const found = await Menu.findAvailableByIds(wanted.map((w) => w.id));
      if (found.length !== wanted.length) errors.push('One or more items are no longer available.');
      else lines = wanted.map((w) => {
        const item = found.find((f) => f.id === w.id);
        return { menuItemId: w.id, quantity: w.q, unitPrice: Number(item.price) };
      });
    }

    if (errors.length) {
      return res.status(422).render('orders/new', {
        title: 'New pre-order', menu: await Menu.listAvailable(), errors,
        old: { qty: rawQty, pickup_time: pickupTime, note } });
    }
    const { reference } = await Orders.create({ userId: req.session.user.id, pickupTime, note, lines });
    req.session.flash = 'Order ' + reference + ' placed. Pay at pickup.';
    res.redirect(303, '/orders'); // Post/Redirect/Get
  } catch (err) { next(err); }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const order = Number.isInteger(id) ? await Orders.findOwned(id, req.session.user.id) : null;
    if (!order) return res.status(404).render('error', { title: 'Not found', message: 'That order was not found.' });
    res.render('orders/detail', { title: 'Order ' + order.reference_no, order, items: await Orders.itemsOf(order.id) });
  } catch (err) { next(err); }
});

router.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    const ok = await Orders.cancelOwned(Number(req.params.id), req.session.user.id);
    if (!ok) return res.status(404).render('error', { title: 'Not found', message: 'That order cannot be cancelled.' });
    req.session.flash = 'Order cancelled.';
    res.redirect(303, '/orders');
  } catch (err) { next(err); }
});

// RA 10173: right to access + portability
router.get('/me/data', async (req, res, next) => {
  try {
    const uid = req.session.user.id;
    const [[profile]] = await db.query(
      'SELECT student_no, full_name, email, created_at FROM users WHERE id = ?', [uid]);
    const orders = await Orders.listByUser(uid);
    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
    res.json({ profile, orders });
  } catch (err) { next(err); }
});

module.exports = router;
