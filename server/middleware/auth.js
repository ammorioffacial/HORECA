const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'لم يتم تقديم رمز المصادقة' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'رمز المصادقة غير صالح أو منتهي الصلاحية' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى هذا المورد' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
