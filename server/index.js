const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('express-async-errors');
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

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by Nginx or later via helmet config
}));

// CORS
const corsOptions = { origin: config.corsOrigin };
if (process.env.NODE_ENV === 'production' && config.corsOrigin === '*') {
  logger.warn('CORS_ORIGIN is "*" in production — consider restricting to a specific domain');
}
app.use(cors(corsOptions));

// Global rate limit
app.use(rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
}));

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
  const { sendError } = require('./errors');
  sendError(res, err);
});

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
