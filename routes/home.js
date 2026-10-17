const { Router } = require('express');
const Stalls = require('../models/stalls');
const Menu = require('../models/menu');
const router = Router();

router.get('/', async (req, res) => {
  let stalls = [], items = [];
  try { [stalls, items] = await Promise.all([Stalls.listWithCounts(), Menu.listPublic()]); }
  catch (err) { console.error('Home: data unavailable:', err.code || err.message); } // page still loads
  res.render('home', { title: 'Skip the line', wide: true, stalls, items });
});

module.exports = router;
