const express = require('express');
const { getDB } = require('../db');
const { auth } = require('./auth');
const { AppError } = require('../errors');

const router = express.Router();

router.use(auth);

// Get all plans
router.get('/', (req, res) => {
  const db = getDB();
  const plans = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks WHERE plan_id = p.id) as total_tasks,
      (SELECT COUNT(*) FROM tasks WHERE plan_id = p.id AND completed = 1) as completed_tasks
    FROM plans p WHERE p.user_id = ? ORDER BY p.start_date DESC
  `).all(req.user.id);
  res.json(plans);
});

// Create plan
router.post('/', (req, res) => {
  const { name, start_date, end_date } = req.body;
  if (!name || !start_date || !end_date) throw new AppError('VALIDATION_ERROR', '请填写完整信息');
  if (new Date(end_date) < new Date(start_date)) throw new AppError('VALIDATION_ERROR', '结束日期不能早于开始日期');

  const db = getDB();
  const existing = db.prepare('SELECT id FROM plans WHERE user_id = ? AND name = ?').get(req.user.id, name);
  if (existing) throw new AppError('CONFLICT', '已有同名计划');

  const result = db.prepare('INSERT INTO plans (user_id, name, start_date, end_date) VALUES (?, ?, ?, ?)')
    .run(req.user.id, name, start_date, end_date);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(result.lastInsertRowid);
  res.json(plan);
});

// Update plan
router.put('/:id', (req, res) => {
  const { name, start_date, end_date } = req.body;
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);

  if (name && name !== plan.name) {
    const dup = db.prepare('SELECT id FROM plans WHERE user_id = ? AND name = ? AND id != ?').get(req.user.id, name, req.params.id);
    if (dup) throw new AppError('CONFLICT', '已有同名计划');
  }

  db.prepare('UPDATE plans SET name = ?, start_date = ?, end_date = ? WHERE id = ?')
    .run(name || plan.name, start_date || plan.start_date, end_date || plan.end_date, req.params.id);
  const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete plan
router.delete('/:id', (req, res) => {
  const db = getDB();
  const path = require('path');
  const fs = require('fs');
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);

  const files = db.prepare(`
    SELECT s.file_path FROM submissions s
    JOIN tasks t ON t.id = s.task_id
    WHERE t.plan_id = ? AND s.file_path IS NOT NULL
  `).all(req.params.id);
  files.forEach(s => {
    const fp = path.join(__dirname, '../uploads', s.file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });

  db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
  res.json({ code: 'OK', message: '删除成功' });
});

// Get plan calendar data
router.get('/:id/calendar', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);

  const tasks = db.prepare(`
    SELECT t.date,
      COUNT(*) as total,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed
    FROM tasks t WHERE t.plan_id = ? GROUP BY t.date
  `).all(req.params.id);

  res.json({ plan, tasks });
});

module.exports = router;
