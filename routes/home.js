const { Router } = require('express');
const Menu = require('../models/menu');
const router = Router();

router.get('/', async (req, res) => {
  let menu = [];
  try { menu = await Menu.listAvailable(); }
  catch (err) { console.error('Home: menu unavailable:', err.code || err.message); } // page still loads
  const groups = {};
  menu.forEach((m) => { (groups[m.category] = groups[m.category] || []).push(m); });
  res.render('home', { title: 'Skip the line', wide: true, menu, groups });
});

module.exports = router;
