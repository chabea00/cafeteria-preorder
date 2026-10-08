function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');           // 401: who are you?
    if (!roles.includes(req.session.user.role)) {                   // 403: known, not allowed
      return res.status(403).render('error', { title: 'Not allowed', message: 'You do not have access to this page.' });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
