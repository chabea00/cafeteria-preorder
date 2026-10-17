const { Router } = require('express');
const Stalls = require('../models/stalls');
const Menu = require('../models/menu');
const Orders = require('../models/orders');
const { requireRole } = require('../middleware/auth');
const router = Router();

// Everything under /dashboard is for stall owners, and only for their own stall.
router.use('/dashboard', requireRole('stall'), async (req, res, next) => {
  try {
    const stall = await Stalls.findByUserId(req.session.user.id);
    if (!stall) return res.status(403).render('error', { title: 'No stall', message: 'This account has no stall attached.' });
    req.stall = stall;
    res.locals.stall = stall;
    next();
  } catch (err) { next(err); }
});

const notFound = (res, message) => res.status(404).render('error', { title: 'Not found', message });

/* ---------- orders ---------- */
router.get('/dashboard', async (req, res, next) => {
  try {
    const status = String(req.query.status ?? '');
    if (status && !Orders.STATUSES.includes(status)) {
      return res.status(400).render('error', { title: 'Bad request', message: 'Unknown status filter.' });
    }
    res.render('dashboard/queue', {
      title: 'Order queue', orders: await Orders.queue(req.stall.id, status || null),
      statuses: Orders.STATUSES, current: status });
  } catch (err) { next(err); }
});

router.post('/dashboard/orders/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status ?? '');
    if (!Orders.STATUSES.includes(status)) {
      return res.status(400).render('error', { title: 'Bad request', message: 'Unknown status.' });
    }
    if (!(await Orders.updateStatus(Number(req.params.id), req.stall.id, status))) return notFound(res, 'Order not found.');
    req.session.flash = 'Status updated.';
    const back = Orders.STATUSES.includes(String(req.body.back)) ? '?status=' + req.body.back : '';
    res.redirect(303, '/dashboard' + back);
  } catch (err) { next(err); }
});

/* ---------- menu CRUD ---------- */
function parseItem(body) {
  const errors = [];
  const name = String(body.name ?? '').trim();
  const category = String(body.category ?? '');
  const priceRaw = String(body.price ?? '').trim();
  const price = Number(priceRaw);
  const maxRaw = String(body.max_per_student ?? '').trim();
  const limRaw = String(body.daily_limit ?? '').trim();
  const available = body.available === '1';

  if (name.length < 1 || name.length > 80) errors.push('Item name is required (up to 80 characters).');
  if (!Menu.CATEGORIES.includes(category)) errors.push('Choose a category.');
  if (priceRaw === '' || !Number.isFinite(price) || price < 0 || price > 9999.99) errors.push('Enter a price between 0 and 9999.99.');
  let max = null;
  if (maxRaw !== '') {
    max = Number(maxRaw);
    if (!Number.isInteger(max) || max < 1 || max > 10) { errors.push('Limit per order must be a whole number from 1 to 10.'); max = null; }
  }
  let lim = null;
  if (limRaw !== '') {
    lim = Number(limRaw);
    if (!Number.isInteger(lim) || lim < 1 || lim > 1000) { errors.push('Daily pre-order limit must be a whole number from 1 to 1000.'); lim = null; }
  }
  return {
    errors,
    data: { name, category, price: Math.round(price * 100) / 100, max_per_student: max, daily_limit: lim, available },
    old: { name, category, price: priceRaw, max_per_student: maxRaw, daily_limit: limRaw, available }
  };
}

const formView = (extra) => ({ categories: Menu.CATEGORIES, errors: [], ...extra });

router.get('/dashboard/menu', async (req, res, next) => {
  try {
    const groups = Menu.groupByCategory(await Menu.listForStall(req.stall.id));
    res.render('dashboard/menu', { title: 'My menu', groups });
  } catch (err) { next(err); }
});

router.get('/dashboard/menu/new', (req, res) =>
  res.render('dashboard/item-form', formView({
    title: 'Add menu item', action: '/dashboard/menu', old: { available: true } })));

router.post('/dashboard/menu', async (req, res, next) => {
  try {
    const { errors, data, old } = parseItem(req.body);
    if (errors.length) {
      return res.status(422).render('dashboard/item-form', formView({
        title: 'Add menu item', action: '/dashboard/menu', errors, old }));
    }
    await Menu.create(req.stall.id, data);
    req.session.flash = data.name + ' added to your menu.';
    res.redirect(303, '/dashboard/menu');
  } catch (err) { next(err); }
});

router.get('/dashboard/menu/:id/edit', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const item = Number.isInteger(id) ? await Menu.findOwned(id, req.stall.id) : null;
    if (!item) return notFound(res, 'Menu item not found.');
    res.render('dashboard/item-form', formView({
      title: 'Edit menu item', action: '/dashboard/menu/' + item.id,
      old: { name: item.name, category: item.category, price: item.price,
             max_per_student: item.max_per_student ?? '', daily_limit: item.daily_limit ?? '',
             available: !!item.available } }));
  } catch (err) { next(err); }
});

router.post('/dashboard/menu/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { errors, data, old } = parseItem(req.body);
    if (errors.length) {
      return res.status(422).render('dashboard/item-form', formView({
        title: 'Edit menu item', action: '/dashboard/menu/' + id, errors, old }));
    }
    if (!(await Menu.update(id, req.stall.id, data))) return notFound(res, 'Menu item not found.');
    req.session.flash = data.name + ' updated.';
    res.redirect(303, '/dashboard/menu');
  } catch (err) { next(err); }
});

router.post('/dashboard/menu/:id/availability', async (req, res, next) => {
  try {
    if (!(await Menu.setAvailable(Number(req.params.id), req.stall.id, req.body.available === '1'))) {
      return notFound(res, 'Menu item not found.');
    }
    res.redirect(303, '/dashboard/menu');
  } catch (err) { next(err); }
});

router.post('/dashboard/menu/:id/delete', async (req, res, next) => {
  try {
    if (!(await Menu.softDelete(Number(req.params.id), req.stall.id))) return notFound(res, 'Menu item not found.');
    req.session.flash = 'Item deleted.';
    res.redirect(303, '/dashboard/menu');
  } catch (err) { next(err); }
});

module.exports = router;
