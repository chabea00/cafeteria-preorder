const { Router } = require('express');
const Menu = require('../models/menu');
const Orders = require('../models/orders');
const { requireRole } = require('../middleware/auth');
const router = Router();
router.use('/staff', requireRole('staff', 'admin'));

router.get('/staff', async (req, res, next) => {
  try {
    const status = String(req.query.status ?? '');
    if (status && !Orders.STATUSES.includes(status)) {
      return res.status(400).render('error', { title: 'Bad request', message: 'Unknown status filter.' });
    }
    res.render('staff/queue', {
      title: 'Order queue', orders: await Orders.queue(status || null),
      statuses: Orders.STATUSES, current: status });
  } catch (err) { next(err); }
});

router.post('/staff/orders/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status ?? '');
    if (!Orders.STATUSES.includes(status)) {
      return res.status(400).render('error', { title: 'Bad request', message: 'Unknown status.' });
    }
    if (!(await Orders.updateStatus(Number(req.params.id), status))) {
      return res.status(404).render('error', { title: 'Not found', message: 'Order not found.' });
    }
    req.session.flash = 'Status updated.';
    res.redirect(303, '/staff' + (req.body.back ? '?status=' + encodeURIComponent(String(req.body.back)) : ''));
  } catch (err) { next(err); }
});

router.get('/staff/menu', async (req, res, next) => {
  try { res.render('staff/menu', { title: 'Menu availability', menu: await Menu.listAll() }); }
  catch (err) { next(err); }
});

router.post('/staff/menu/:id/toggle', async (req, res, next) => {
  try {
    const available = req.body.available === '1';
    if (!(await Menu.setAvailable(Number(req.params.id), available))) {
      return res.status(404).render('error', { title: 'Not found', message: 'Item not found.' });
    }
    res.redirect(303, '/staff/menu');
  } catch (err) { next(err); }
});

module.exports = router;
