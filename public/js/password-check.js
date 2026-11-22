document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password');
  const reqBox = document.getElementById('password-requirements');
  
  if (!passwordInput || !reqBox) return;

  const rules = {
    length: (val) => val.length >= 8,
    number: (val) => /[0-9]/.test(val),
    upper: (val) => /[A-Z]/.test(val),
    lower: (val) => /[a-z]/.test(val)
  };

  const updateUI = (val) => {
    const check = (id, isValid) => {
      const el = document.getElementById(id);
      if (isValid) {
        el.classList.remove('invalid');
        el.classList.add('valid');
      } else {
        el.classList.remove('valid');
        el.classList.add('invalid');
      }
    };

    check('req-length', rules.length(val));
    check('req-number', rules.number(val));
    check('req-upper', rules.upper(val));
    check('req-lower', rules.lower(val));
  };

  passwordInput.addEventListener('input', (e) => {
    updateUI(e.target.value);
  });

  updateUI(passwordInput.value);
});