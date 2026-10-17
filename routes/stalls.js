const { Router } = require('express');
const Stalls = require('../models/stalls');
const Menu = require('../models/menu');
const Orders = require('../models/orders');
const { requireRole } = require('../middleware/auth');
const router = Router();

const OPEN = 8 * 60, CLOSE = 17 * 60, LEAD_MIN = 15;

async function showStall(req, res, stall, extra = {}, status = 200) {
  const items = await Menu.listForStall(stall.id);
  const user = req.session.user;
  res.status(status).render('stalls/show', {
    title: stall.name, stall, hasItems: items.length > 0, groups: Menu.groupByCategory(items),
    canOrder: !user || user.role === 'student', errors: [], old: { qty: {} }, ...extra });
}

async function loadStall(req, res) {
  const id = Number(req.params.id);
  const stall = Number.isInteger(id) ? await Stalls.findById(id) : null;
  if (!stall) res.status(404).render('error', { title: 'Not found', message: 'That stall was not found.' });
  return stall;
}

router.get('/orders/new', (req, res) => res.redirect('/stalls'));

router.get('/stalls', async (req, res, next) => {
  try { res.render('stalls/list', { title: 'Stalls', stalls: await Stalls.listWithCounts() }); }
  catch (err) { next(err); }
});

router.get('/stalls/:id', async (req, res, next) => {
  try {
    const stall = await loadStall(req, res);
    if (stall) await showStall(req, res, stall);
  } catch (err) { next(err); }
});

router.post('/stalls/:id/order', requireRole('student'), async (req, res, next) => {
  try {
    const stall = await loadStall(req, res);
    if (!stall) return;
    const pickupTime = String(req.body.pickup_time ?? '').trim();
    const note = String(req.body.note ?? '').trim();
    // fields are named qty_<itemId>; bracket names like qty[3] would be re-indexed into an array by the parser
    const rawQty = {};
    for (const [k, v] of Object.entries(req.body)) {
      const mm = /^qty_(\d{1,9})$/.exec(k);
      if (mm) rawQty[mm[1]] = String(v);
    }
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

    // 3. the model re-checks availability and limits inside a transaction
    if (!errors.length) {
      try {
        const { reference } = await Orders.create({
          userId: req.session.user.id, stallId: stall.id, pickupTime, note, wanted });
        req.session.flash = 'Order ' + reference + ' placed at ' + stall.name + '. Pay at pickup.';
        return res.redirect(303, '/orders'); // Post/Redirect/Get
      } catch (err) {
        if (!(err instanceof Orders.UserError)) throw err;
        errors.push(err.message);
      }
    }
    await showStall(req, res, stall, { errors, old: { qty: rawQty, pickup_time: pickupTime, note } }, 422);
  } catch (err) { next(err); }
});

module.exports = router;
