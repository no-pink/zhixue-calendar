const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const config = require('./config');
const logger = require('./logger');
const { initDB } = require('./db');
const { runMigrations } = require('./migrate');
const authRoutes = require('./routes/auth');
const planRoutes = require('./routes/plans');
const taskRoutes = require('./routes/tasks');
const backupRoutes = require('./routes/backup');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Global rate limit
app.use(rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
}));

app.use(require('cors')({ origin: config.corsOrigin }));
app.use(express.json({ limit: '50mb' }));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

initDB();
runMigrations();

app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/backup', backupRoutes);

app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
