const { getDB } = require('../db');

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
  const path = require('path');
  const fs = require('fs');

  const files = db.prepare(`
    SELECT s.file_path FROM submissions s
    JOIN tasks t ON t.id = s.task_id
    WHERE t.plan_id = ? AND s.file_path IS NOT NULL
  `).all(planId);
  files.forEach(s => {
    const fp = path.join(__dirname, '../uploads', s.file_path);
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

module.exports = {
  getPlansByUser,
  findPlanByName,
  createPlan,
  updatePlan,
  deletePlanWithCleanup,
  getPlanCalendar,
};
