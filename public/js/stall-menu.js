// Progressive enhancement for the stall menu: filter, sort, layout, quantity buttons, cart bar.
(function () {
  'use strict';
  // Escape text before putting it into innerHTML (item names are typed by stall owners).
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
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
        lists[c.dataset.cat].appendChild(c); 
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

  // FIXED: This now handles empty strings correctly so typing "1" doesn't become "10"
  function clamp(input) {
    var max = parseInt(input.max, 10) || 10;
    var val = input.value.trim();
    if (val === '') return 0; // Treat empty as 0 for the math
    
    var q = parseInt(val, 10);
    if (isNaN(q) || q < 0) q = 0;
    if (q > max) q = max;
    return q;
  }

  function money(n) { return '₱' + (n % 1 === 0 ? String(n) : n.toFixed(2)); }

  function updateCart() {
    if (!bar) return;
    var total = 0, count = 0, parts = [];
    var checkoutHTML = '';

    cards.forEach(function (c) {
      var input = c.querySelector('.qty');
      if (!input || input.disabled) return;
      var q = clamp(input);
      if (q > 0) {
        var subtotal = q * parseFloat(c.dataset.price);
        total += subtotal;
        count += q;
        parts.push(c.dataset.name + ' x ' + q);
        
        checkoutHTML += `
          <div class="checkout-item">
            <div>
              <span class="checkout-item-name">${esc(c.dataset.name)}</span>
              <span class="checkout-item-qty">x ${q}</span>
            </div>
            <span class="checkout-item-price">₱${subtotal.toFixed(2)}</span>
          </div>
        `;
      }
    });

    bar.hidden = count === 0;
    document.body.classList.toggle('has-cart', count > 0);
    document.getElementById('cart-badge').textContent = String(count);
    document.getElementById('cart-text').textContent = parts.join(', ');
    document.getElementById('cart-total').textContent = 'Total: ' + money(total);
    
    const inlineTotal = document.getElementById('inline-total');
    if (inlineTotal) {
      inlineTotal.textContent = `Total: ₱${total.toFixed(2)}`;
    }

    const checkoutItemsDiv = document.getElementById('checkout-items');
    if (checkoutItemsDiv) {
      if (count > 0) {
        checkoutItemsDiv.innerHTML = checkoutHTML;
      } else {
        checkoutItemsDiv.innerHTML = '<p class="meta">No items selected yet.</p>';
      }
    }
  }

      // 1. Handle the + and - button clicks
  app.addEventListener('click', function (e) {
    var side = e.target.closest('.side-btn');
    if (side) { state[side.dataset.group] = side.dataset.value; render(); return; }
    
    var step = e.target.closest('.step');
    if (step && !step.disabled) {
      e.preventDefault(); // Stop the browser from doing native number stuff
      
      var input = document.getElementById(step.dataset.for);
      
      // Get the current number. If it's empty, it's 0.
      var currentNum = parseInt(input.value, 10);
      if (isNaN(currentNum)) currentNum = 0; 
      
      var stepNum = parseInt(step.dataset.step, 10);
      var maxNum = parseInt(input.max, 10) || 10;
      
      // Do the math
      var newNum = currentNum + stepNum;
      
      // Make sure it doesn't go below 0 or above the max
      if (newNum < 0) newNum = 0;
      if (newNum > maxNum) newNum = maxNum;
      
      // Put the number back in the box. If it's 0, clear it.
      input.value = newNum === 0 ? '' : String(newNum);
      
      // Update the cart total ONCE
      updateCart();
    }
  });

  // 2. Handle manual typing (ONLY ONE LISTENER)
  app.addEventListener('input', function(e) {
    if (e.target.classList.contains('qty')) {
      var max = parseInt(e.target.max, 10) || 10;
      // If they type a number larger than the max, force it down
      if (e.target.value !== '' && parseInt(e.target.value, 10) > max) {
        e.target.value = String(max);
      }
      updateCart();
    }
  });

  render();
  updateCart();

  const checkoutSection = document.getElementById('checkout');
  if (checkoutSection && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (bar) bar.style.display = entry.isIntersecting ? 'none' : 'flex';
      });
    }, { threshold: 0.1 });
    
    observer.observe(checkoutSection);
  }
})();