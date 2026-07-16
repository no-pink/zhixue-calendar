const { getDB } = require('../db');
const config = require('../config');

function getPlansByUser(userId) {
  const db = getDB();
  return db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks WHERE plan_id = p.id) as total_tasks,
      (SELECT COUNT(*) FROM tasks WHERE plan_id = p.id AND completed = 1) as completed_tasks
    FROM plans p WHERE p.user_id = ? ORDER BY p.start_date DESC
  `).all(userId);
}

function findPlanByName(db, userId, name, excludeId) {
  let query = 'SELECT id FROM plans WHERE user_id = ? AND name = ?';
  const params = [userId, name];
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  return db.prepare(query).get(...params);
}

function createPlan(userId, name, startDate, endDate) {
  const db = getDB();
  const result = db.prepare(
    'INSERT INTO plans (user_id, name, start_date, end_date) VALUES (?, ?, ?, ?)'
  ).run(userId, name, startDate, endDate);
  return db.prepare('SELECT * FROM plans WHERE id = ?').get(result.lastInsertRowid);
}

function updatePlan(id, fields) {
  const db = getDB();
  const sets = [];
  const params = [];
  if (fields.name !== undefined) { sets.push('name = ?'); params.push(fields.name); }
  if (fields.start_date !== undefined) { sets.push('start_date = ?'); params.push(fields.start_date); }
  if (fields.end_date !== undefined) { sets.push('end_date = ?'); params.push(fields.end_date); }
  if (sets.length > 0) {
    db.prepare(`UPDATE plans SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  }
  return db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
}

function deletePlanWithCleanup(db, planId) {
  const fs = require('fs');
  const path = require('path');

  const UPLOAD_DIR = config.uploadDir;
  const files = db.prepare(`
    SELECT s.file_path FROM submissions s
    JOIN tasks t ON t.id = s.task_id
    WHERE t.plan_id = ? AND s.file_path IS NOT NULL
  `).all(planId);
  files.forEach(s => {
    const fp = path.join(UPLOAD_DIR, s.file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });

  db.prepare('DELETE FROM plans WHERE id = ?').run(planId);
}

function getPlanCalendar(planId) {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return null;

  const tasks = db.prepare(`
    SELECT t.date,
      COUNT(*) as total,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed
    FROM tasks t WHERE t.plan_id = ? GROUP BY t.date
  `).all(planId);

  return { plan, tasks };
}

function getPlanStats(planId) {
  const db = getDB();

  const completion = db.prepare(`
    SELECT COUNT(*) as total, COALESCE(SUM(completed), 0) as completed
    FROM tasks WHERE plan_id = ?
  `).get(planId);

  // 近 7 天趋势——确保返回完整的 7 天，无任务的天显示 0
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = db.prepare(`
      SELECT COUNT(*) as total, COALESCE(SUM(completed), 0) as completed
      FROM tasks WHERE plan_id = ? AND date = ?
    `).get(planId, dateStr);
    trend.push({ date: dateStr, total: row.total, completed: row.completed });
  }

  // 连续学习天数——从最近有完成记录的日期往前数
  const streak = db.prepare(`
    SELECT DISTINCT date FROM tasks
    WHERE plan_id = ? AND completed = 1
    ORDER BY date DESC
  `).all(planId).map(r => r.date);

  let streakCount = 0;
  if (streak.length > 0) {
    const startFrom = new Date(streak[0]);
    for (let i = 0; ; i++) {
      const expected = new Date(startFrom);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);
      if (streak.includes(expectedStr)) streakCount++;
      else break;
    }
  }

  const hours = db.prepare(`
    SELECT start_hour, COUNT(*) as count
    FROM tasks WHERE plan_id = ? GROUP BY start_hour ORDER BY count DESC, start_hour ASC
  `).all(planId);

  return { completion, trend, streak: streakCount, hours };
}

module.exports = {
  getPlansByUser,
  findPlanByName,
  createPlan,
  updatePlan,
  deletePlanWithCleanup,
  getPlanCalendar,
  getPlanStats,
};
