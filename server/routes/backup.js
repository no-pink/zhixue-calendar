const express = require('express');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../db');
const { auth } = require('./auth');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../uploads');

router.use(auth);

// Export data
router.get('/export', (req, res) => {
  const db = getDB();
  const userId = req.user.id;

  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ?').all(userId);
  const planIds = plans.map(p => p.id);

  let tasks = [];
  let submissions = [];
  if (planIds.length > 0) {
    const placeholders = planIds.map(() => '?').join(',');
    tasks = db.prepare(`SELECT * FROM tasks WHERE plan_id IN (${placeholders})`).all(...planIds);
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length > 0) {
      const tPlaceholders = taskIds.map(() => '?').join(',');
      submissions = db.prepare(`SELECT * FROM submissions WHERE task_id IN (${tPlaceholders})`).all(...taskIds);
    }
  }

  const data = { plans, tasks, submissions };

  const archive = archiver('zip', { zlib: { level: 9 } });
  const filename = `zhixue-backup-${req.user.username}-${Date.now()}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  archive.pipe(res);
  archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });

  // Add submission files
  const filesAdded = new Set();
  submissions.forEach(s => {
    if (s.file_path && !filesAdded.has(s.file_path)) {
      const filePath = path.join(UPLOAD_DIR, s.file_path);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: `files/${s.file_path}` });
        filesAdded.add(s.file_path);
      }
    }
  });

  archive.finalize();
});

// Restore data (full replace)
router.post('/restore', (req, res) => {
  const { dataJson } = req.body;
  if (!dataJson) return res.status(400).json({ error: '请提供备份数据' });
  const db = getDB();
  const userId = req.user.id;

  let data;
  try {
    data = JSON.parse(dataJson);
  } catch {
    return res.status(400).json({ error: '备份数据格式无效' });
  }
  if (!data.plans || !data.tasks) {
    return res.status(400).json({ error: '备份数据格式无效' });
  }

  const transaction = db.transaction(() => {
    // Get old file paths to clean up
    const oldPlanIds = db.prepare('SELECT id FROM plans WHERE user_id = ?').all(userId).map(p => p.id);
    if (oldPlanIds.length > 0) {
      const ph = oldPlanIds.map(() => '?').join(',');
      const oldSubmissions = db.prepare(`SELECT file_path FROM submissions WHERE task_id IN (SELECT id FROM tasks WHERE plan_id IN (${ph}))`).all(...oldPlanIds);
      oldSubmissions.forEach(s => {
        if (s.file_path) {
          const fp = path.join(UPLOAD_DIR, s.file_path);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      });
    }

    // Delete old data (cascade handles tasks & submissions)
    db.prepare('DELETE FROM plans WHERE user_id = ?').run(userId);

    // Insert plans
    const insertPlan = db.prepare('INSERT INTO plans (id, user_id, name, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const insertTask = db.prepare('INSERT INTO tasks (id, plan_id, date, start_hour, end_hour, description, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertSub = db.prepare('INSERT INTO submissions (id, task_id, type, content, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)');

    data.plans.forEach(p => {
      insertPlan.run(p.id, userId, p.name, p.start_date, p.end_date, p.created_at);
    });

    data.tasks.forEach(t => {
      insertTask.run(t.id, t.plan_id, t.date, t.start_hour ?? t.hour, t.end_hour ?? (t.hour + 1), t.description, t.completed || 0, t.created_at);
    });

    data.submissions.forEach(s => {
      insertSub.run(s.id, s.task_id, s.type, s.content, s.file_path, s.created_at);
    });
  });

  transaction();
  res.json({ message: '数据恢复成功' });
});

module.exports = router;
