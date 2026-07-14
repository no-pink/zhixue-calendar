const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Setup in-memory database before anything else
const testDb = new Database(':memory:');
testDb.pragma('journal_mode = WAL');
testDb.pragma('foreign_keys = ON');

testDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL,
    date TEXT NOT NULL, start_hour INTEGER NOT NULL, end_hour INTEGER NOT NULL,
    description TEXT NOT NULL, completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'text', content TEXT, file_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_plan_date ON tasks(plan_id, date);
`);

// Patch db module
const dbModule = require('../db');
dbModule.getDB = () => testDb;

// Seed
const hash = bcrypt.hashSync('test123', 10);
testDb.prepare('INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)').run(1, 'testuser', hash);
testDb.prepare('INSERT OR IGNORE INTO plans (id, user_id, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)').run(1, 1, '测试计划', '2026-01-01', '2026-12-31');

const { describe, it } = require('mocha');
const { strict: assert } = require('node:assert');
const config = require('../config');
const authRoutes = require('../routes/auth');
const planRoutes = require('../routes/plans');
const taskRoutes = require('../routes/tasks');
const { sendError } = require('../errors');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use((err, req, res, next) => sendError(res, err));
  return app;
}

function getToken() {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id: 1, username: 'testuser' }, config.jwtSecret, { expiresIn: '1h' });
}

describe('Auth', () => {
  it('registers a new user', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ username: 'newuser', password: 'pass123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, 'newuser');
  });

  it('rejects duplicate username', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ username: 'newuser', password: 'pass123' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'CONFLICT');
  });

  it('logs in with correct credentials', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it('rejects wrong password', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'AUTH_FAILED');
  });

  it('rejects missing fields', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ username: 'no' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
  });
});

describe('Plans', () => {
  it('creates a plan', async () => {
    const res = await request(createApp())
      .post('/api/plans')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ name: '数学计划', start_date: '2026-01-01', end_date: '2026-06-30' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, '数学计划');
  });

  it('rejects duplicate plan name', async () => {
    const res = await request(createApp())
      .post('/api/plans')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ name: '数学计划', start_date: '2026-01-01', end_date: '2026-06-30' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'CONFLICT');
  });

  it('lists plans', async () => {
    const res = await request(createApp())
      .get('/api/plans')
      .set('Authorization', `Bearer ${getToken()}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });
});

describe('Tasks', () => {
  let taskId;

  it('creates a task', async () => {
    const res = await request(createApp())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ plan_id: 1, date: '2026-03-15', start_hour: 8, end_hour: 10, description: '学习高数' });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, '学习高数');
    taskId = res.body.id;
  });

  it('detects same name conflict', async () => {
    const res = await request(createApp())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ plan_id: 1, date: '2026-03-15', start_hour: 10, end_hour: 12, description: '学习高数' });
    assert.equal(res.body.code, 'CONFLICT_SAME_NAME');
  });

  it('detects time overlap conflict', async () => {
    const res = await request(createApp())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ plan_id: 1, date: '2026-03-15', start_hour: 9, end_hour: 11, description: '学习英语' });
    assert.equal(res.body.code, 'CONFLICT_OVERLAP');
  });

  it('creates with force override', async () => {
    const res = await request(createApp())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ plan_id: 1, date: '2026-03-15', start_hour: 8, end_hour: 10, description: '学习物理', force: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, '学习物理');
    taskId = res.body.id;
  });

  it('gets tasks by date', async () => {
    const res = await request(createApp())
      .get('/api/tasks/1/2026-03-15')
      .set('Authorization', `Bearer ${getToken()}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  it('toggles completion', async () => {
    const res = await request(createApp())
      .patch(`/api/tasks/${taskId}/toggle`)
      .set('Authorization', `Bearer ${getToken()}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.completed, 1);
  });

  it('updates a task', async () => {
    const res = await request(createApp())
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ description: '学习线性代数', start_hour: 14, end_hour: 16 });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, '学习线性代数');
  });

  it('rejects unauthorized access', async () => {
    const jwt = require('jsonwebtoken');
    const otherToken = jwt.sign({ id: 999, username: 'hacker' }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(createApp())
      .get('/api/tasks/1/2026-03-15')
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'NOT_FOUND');
  });

  it('batch fills tasks', async () => {
    const res = await request(createApp())
      .post('/api/tasks/batch')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ plan_id: 1, dates: ['2026-04-01', '2026-04-02'], slots: ['08-10', '14-16'], template: '学习物理' });
    assert.equal(res.status, 200);
    assert.equal(res.body.created, 4);
  });

  it('copies tasks to other dates', async () => {
    const res = await request(createApp())
      .post('/api/tasks/copy')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ task_ids: [taskId], target_dates: ['2026-05-01', '2026-05-02'], plan_id: 1, conflict_mode: 'keep_both' });
    assert.equal(res.status, 200);
    assert.equal(res.body.created, 2);
  });

  it('deletes a task', async () => {
    const res = await request(createApp())
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${getToken()}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.code, 'OK');
  });

  it('rejects request without auth token', async () => {
    const res = await request(createApp()).get('/api/tasks/1/2026-03-15');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'AUTH_REQUIRED');
  });
});
