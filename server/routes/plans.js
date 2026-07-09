const express = require('express');
const { getDB } = require('../db');
const { auth } = require('./auth');

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
  if (!name || !start_date || !end_date) return res.status(400).json({ error: '请填写完整信息' });
  if (new Date(end_date) < new Date(start_date)) return res.status(400).json({ error: '结束日期不能早于开始日期' });

  const db = getDB();
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
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  db.prepare('UPDATE plans SET name = ?, start_date = ?, end_date = ? WHERE id = ?')
    .run(name || plan.name, start_date || plan.start_date, end_date || plan.end_date, req.params.id);
  const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete plan
router.delete('/:id', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// Get plan calendar data (tasks grouped by date)
router.get('/:id/calendar', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  const tasks = db.prepare(`
    SELECT t.date,
      COUNT(*) as total,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed
    FROM tasks t WHERE t.plan_id = ? GROUP BY t.date
  `).all(req.params.id);

  res.json({ plan, tasks });
});

module.exports = router;
