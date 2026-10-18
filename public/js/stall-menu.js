// Progressive enhancement for the stall menu: filter, sort, layout, quantity buttons, cart bar.
// Without JavaScript the page still works: every item is listed by category and the form submits normally.
(function () {
  'use strict';
  var app = document.getElementById('menu-app');
  if (!app) return;
  app.classList.add('js');

  var cards = [].slice.call(app.querySelectorAll('.card'));
  var sections = [].slice.call(app.querySelectorAll('.cat-section'));
  var grouped = document.getElementById('grouped');
  var flat = document.getElementById('flat-list');
  var title = document.getElementById('menu-title');
  var bar = document.getElementById('cart-bar');
  var state = { cat: 'All', sort: 'category', layout: 'grid' };

  var lists = {};
  sections.forEach(function (s) { lists[s.dataset.cat] = s.querySelector('.cards'); });
  cards.forEach(function (c, i) { c.dataset.i = String(i); });

  var sorters = {
    price_asc: function (a, b) { return a.dataset.price - b.dataset.price || a.dataset.i - b.dataset.i; },
    price_desc: function (a, b) { return b.dataset.price - a.dataset.price || a.dataset.i - b.dataset.i; },
    name_asc: function (a, b) { return a.dataset.name.localeCompare(b.dataset.name); },
    name_desc: function (a, b) { return b.dataset.name.localeCompare(a.dataset.name); }
  };

  function render() {
    var byCategory = state.sort === 'category';
    grouped.hidden = !byCategory;
    flat.hidden = byCategory;
    title.textContent = state.cat;

    if (byCategory) {
      sections.forEach(function (s) {
        s.hidden = !(state.cat === 'All' || s.dataset.cat === state.cat);
        s.querySelector('.cat-title').hidden = state.cat !== 'All';
      });
      cards.slice().sort(function (a, b) { return a.dataset.i - b.dataset.i; }).forEach(function (c) {
        c.hidden = false;
        lists[c.dataset.cat].appendChild(c); // real nodes are moved, so typed quantities are kept
      });
    } else {
      cards.forEach(function (c) { c.hidden = !(state.cat === 'All' || c.dataset.cat === state.cat); });
      cards.slice().sort(sorters[state.sort]).forEach(function (c) { flat.appendChild(c); });
    }

    app.dataset.layout = state.layout;
    [].slice.call(app.querySelectorAll('.side-btn')).forEach(function (b) {
      b.setAttribute('aria-pressed', String(state[b.dataset.group] === b.dataset.value));
    });
  }

  function clamp(input) {
    var max = parseInt(input.max, 10) || 10;
    var q = parseInt(input.value, 10);
    if (isNaN(q) || q < 0) q = 0;
    if (q > max) q = max;
    return q;
  }

  function money(n) { return '₱' + (n % 1 === 0 ? String(n) : n.toFixed(2)); }

  function updateCart() {
    if (!bar) return;
    var total = 0, count = 0, parts = [];
    cards.forEach(function (c) {
      var input = c.querySelector('.qty');
      if (!input || input.disabled) return;
      var q = clamp(input);
      if (q > 0) {
        total += q * parseFloat(c.dataset.price);
        count += q;
        parts.push(c.dataset.name + ' x ' + q);
      }
    });
    bar.hidden = count === 0;
    document.body.classList.toggle('has-cart', count > 0);
    document.getElementById('cart-badge').textContent = String(count);
    document.getElementById('cart-text').textContent = parts.join(', ');
    document.getElementById('cart-total').textContent = 'Total: ' + money(total);
  }

  app.addEventListener('click', function (e) {
    var side = e.target.closest('.side-btn');
    if (side) { state[side.dataset.group] = side.dataset.value; render(); return; }
    var step = e.target.closest('.step');
    if (step && !step.disabled) {
      var input = document.getElementById(step.dataset.for);
      input.value = String(Math.max(0, Math.min(parseInt(input.max, 10) || 10, clamp(input) + parseInt(step.dataset.step, 10))));
      updateCart();
    }
  });
  app.addEventListener('input', updateCart);
  app.addEventListener('change', function (e) {
    if (e.target.classList.contains('qty')) { e.target.value = String(clamp(e.target)); updateCart(); }
  });

  render();
  updateCart();
})();
