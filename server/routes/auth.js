const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username.trim()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'خطأ في الخادم، يرجى المحاولة مرة أخرى' });
  }
});

// GET /api/auth/me — verify token and return user info
router.get('/me', verifyToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

module.exports = router;
