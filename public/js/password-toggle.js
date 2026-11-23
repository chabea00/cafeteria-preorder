// Adds a Show/Hide button to every password field on the page.
(function () {
  var css =
    '.pw-wrap{position:relative;display:block;width:100%}' +
    '.pw-wrap input{width:100%;max-width:none;padding-right:4.5rem;box-sizing:border-box}' +
    '.pw-toggle{position:absolute;top:50%;right:.5rem;transform:translateY(-50%);' +
    'background:none;border:0;padding:.25rem .5rem;font:inherit;font-size:.85rem;' +
    'font-weight:600;color:inherit;opacity:.75;cursor:pointer;text-decoration:underline}' +
    '.pw-toggle:hover,.pw-toggle:focus-visible{opacity:1}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function enhance(input) {
    if (input.dataset.pwToggle) return;
    input.dataset.pwToggle = '1';

    // Measure the input BEFORE wrapping so the wrapper keeps exactly the same width.
    var width = input.getBoundingClientRect().width;

    var wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    if (width > 0) wrap.style.maxWidth = width + 'px';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.textContent = 'Show';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Show password');
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    wrap.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[type="password"]').forEach(enhance);
  });
})();