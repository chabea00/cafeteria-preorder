const { Router } = require('express');
const Orders = require('../models/orders');
const { db } = require('../db');
const { requireLogin } = require('../middleware/auth');
const router = Router();
router.use(['/orders', '/me'], requireLogin); // scoped, so unknown URLs still reach the 404 handler

router.get('/orders', async (req, res, next) => {
  try {
    res.render('orders/list', { title: 'My orders', orders: await Orders.listByUser(req.session.user.id) });
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
