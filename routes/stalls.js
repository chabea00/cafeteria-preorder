const { Router } = require('express');
const Stalls = require('../models/stalls');
const Menu = require('../models/menu');
const Orders = require('../models/orders');
const { requireRole } = require('../middleware/auth');
const router = Router();

async function showStall(req, res, stall, extra = {}, status = 200) {
  const items = await Menu.listForStall(stall.id);
  const user = req.session.user;

  // Check the current time against global hours
  const now = new Date();
  // Force the timezone to Asia/Manila
  const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const currentTimeInMinutes = phTime.getHours() * 60 + phTime.getMinutes();
  
  const OPEN_TIME = 6 * 60;  // 6:00 AM
  const CLOSE_TIME = 17 * 60; // 5:00 PM
  
  // Using >= so 5:00 PM exactly is closed
  const isCanteenOpen = !(currentTimeInMinutes < OPEN_TIME || currentTimeInMinutes >= CLOSE_TIME);

  res.status(status).render('stalls/show', {
    title: stall.name, 
    wide: true, 
    scripts: ['/js/stall-menu.js'], 
    stall, 
    hasItems: items.length > 0, 
    groups: Menu.groupByCategory(items),
    // CHANGED: Allow staff to order
    canOrder: !user || user.role === 'student' || user.role === 'staff',
    isCanteenOpen, 
    errors: [], 
    old: { qty: {} }, 
    ...extra 
  });
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

// CHANGED: Allow staff to submit orders
router.post('/stalls/:id/order', requireRole('student', 'staff'), async (req, res, next) => {
  try {
    const stall = await loadStall(req, res);
    if (!stall) return;
    
    const note = String(req.body.note ?? '').trim();
    const rawQty = {};
    for (const [k, v] of Object.entries(req.body)) {
      const mm = /^qty_(\d{1,9})$/.exec(k);
      if (mm) rawQty[mm[1]] = String(v);
    }
    const errors = [];

    // 1. quantities
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

    // 2. PICKUP LOGIC
    const now = new Date();
    const pickupDeadline = new Date(now.getTime() + (60 * 60000)); 
    const pickupTime = pickupDeadline.toTimeString().slice(0, 5); 

    // NEW: GLOBAL OPERATING HOURS CHECK
    const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentTimeInMinutes = phTime.getHours() * 60 + phTime.getMinutes();
    
    const OPEN_TIME = 6 * 60;  // 6:00 AM
    const CLOSE_TIME = 17 * 60; // 5:00 PM

    // Using >= so 5:00 PM exactly is closed
    if (currentTimeInMinutes < OPEN_TIME || currentTimeInMinutes >= CLOSE_TIME) {
      errors.push('The canteen is currently closed. Pre-orders are only accepted from 6:00 AM to 5:00 PM.');
    }

    // 3. Security Check: Ensure the items are within their specific time window
    if (!errors.length) {
      const menuItems = await Menu.listForStall(stall.id);

      for (const w of wanted) {
        const item = menuItems.find(i => i.id === w.id);
        if (item && item.order_start && item.order_end) {
          const [startH, startM] = item.order_start.split(':').map(Number);
          const [endH, endM] = item.order_end.split(':').map(Number);
          const startTotal = startH * 60 + startM;
          const endTotal = endH * 60 + endM;

          if (currentTimeInMinutes < startTotal || currentTimeInMinutes >= endTotal) {
            errors.push(`${item.name} is no longer available for ordering today.`);
            break;
          }
        }
      }
    }

    if (note.length > 200) errors.push('Note must be 200 characters or fewer.');

    // 4. the model re-checks availability and limits inside a transaction
    if (!errors.length) {
      try {
        const { reference } = await Orders.create({
          userId: req.session.user.id, 
          stallId: stall.id, 
          pickupTime, 
          note, 
          wanted 
        });
        req.session.flash = 'Order ' + reference + ' placed at ' + stall.name + '. Please pick up by ' + pickupTime + '.';
        return res.redirect(303, '/orders'); // Post/Redirect/Get
      } catch (err) {
        if (!(err instanceof Orders.UserError)) throw err;
        errors.push(err.message);
      }
    }
    await showStall(req, res, stall, { errors, old: { qty: rawQty, note } }, 422);
  } catch (err) { next(err); }
});

module.exports = router;