const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDB } = require('../db');
const config = require('../config');
const { AppError } = require('../errors');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitAuthMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '登录尝试过于频繁，请稍后再试' },
});

router.use('/login', authLimiter);
router.use('/register', authLimiter);

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ code: 'AUTH_REQUIRED', message: '未登录' });
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ code: 'AUTH_EXPIRED', message: '登录已过期' });
  }
};

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw new AppError('VALIDATION_ERROR', '用户名和密码不能为空');
  if (password.length < 6) throw new AppError('VALIDATION_ERROR', '密码长度不能少于6位');

  const db = getDB();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) throw new AppError('CONFLICT', '用户名已存在');

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
  const token = jwt.sign({ id: result.lastInsertRowid, username }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

  res.json({ token, user: { id: result.lastInsertRowid, username } });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw new AppError('VALIDATION_ERROR', '用户名和密码不能为空');

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw new AppError('AUTH_FAILED', '用户名或密码错误', 400);
  }

  const token = jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json({ token, user: { id: user.id, username: user.username } });
});

router.post('/change-password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) throw new AppError('VALIDATION_ERROR', '请提供旧密码和新密码');

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    throw new AppError('AUTH_FAILED', '旧密码错误');
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: '密码修改成功' });
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
module.exports.auth = auth;
