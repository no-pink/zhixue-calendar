const express = require('express');
const { getDB } = require('../db');
const { auth } = require('./auth');
const { AppError } = require('../errors');
const planService = require('../services/planService');

const router = express.Router();

router.use(auth);

// Get all plans
router.get('/', (req, res) => {
  res.json(planService.getPlansByUser(req.user.id));
});

// Create plan
router.post('/', (req, res) => {
  const { name, start_date, end_date } = req.body;
  if (!name || !start_date || !end_date) throw new AppError('VALIDATION_ERROR', '请填写完整信息');
  if (new Date(end_date) < new Date(start_date)) throw new AppError('VALIDATION_ERROR', '结束日期不能早于开始日期');

  const db = getDB();
  const existing = planService.findPlanByName(db, req.user.id, name);
  if (existing) throw new AppError('CONFLICT', '已有同名计划');

  const plan = planService.createPlan(req.user.id, name, start_date, end_date);
  res.json(plan);
});

// Update plan
router.put('/:id', (req, res) => {
  const { name, start_date, end_date } = req.body;
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);

  if (name && name !== plan.name) {
    const dup = planService.findPlanByName(db, req.user.id, name, req.params.id);
    if (dup) throw new AppError('CONFLICT', '已有同名计划');
  }

  const updated = planService.updatePlan(req.params.id, { name: name || undefined, start_date: start_date || undefined, end_date: end_date || undefined });
  res.json(updated);
});

// Delete plan
router.delete('/:id', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);

  planService.deletePlanWithCleanup(db, req.params.id);
  res.json({ code: 'OK', message: '删除成功' });
});

// Get plan calendar data
router.get('/:id/calendar', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);

  res.json(planService.getPlanCalendar(req.params.id));
});

// Get plan statistics
router.get('/:id/stats', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);

  res.json(planService.getPlanStats(req.params.id));
});

module.exports = router;
