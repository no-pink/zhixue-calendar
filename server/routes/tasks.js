const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { auth } = require('./auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

router.use(auth);

// Get tasks for a plan + date
router.get('/:planId/:date', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?')
    .get(req.params.planId, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  const tasks = db.prepare(`
    SELECT t.*, s.id as submission_id, s.type as submission_type, s.content as submission_content, s.file_path as submission_file_path
    FROM tasks t
    LEFT JOIN submissions s ON s.task_id = t.id
    WHERE t.plan_id = ? AND t.date = ?
    ORDER BY t.start_hour ASC
  `).all(req.params.planId, req.params.date);

  // Group submissions per task
  const taskMap = {};
  tasks.forEach(row => {
    if (!taskMap[row.id]) {
      taskMap[row.id] = {
        id: row.id, plan_id: row.plan_id, date: row.date, start_hour: row.start_hour, end_hour: row.end_hour,
        description: row.description, completed: row.completed, created_at: row.created_at,
        submissions: []
      };
    }
    if (row.submission_id) {
      taskMap[row.id].submissions.push({
        id: row.submission_id, type: row.submission_type,
        content: row.submission_content,
        file_path: row.submission_file_path
      });
    }
  });

  res.json(Object.values(taskMap));
});

// Create task with optional submissions
router.post('/', (req, res) => {
  const { plan_id, date, start_hour, end_hour, hour, description, submissions } = req.body;
  const sh = start_hour ?? hour;
  const eh = end_hour ?? (hour !== undefined ? hour + 1 : undefined);
  if (!plan_id || !date || sh === undefined || eh === undefined || !description) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(plan_id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  const result = db.prepare('INSERT INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)')
    .run(plan_id, date, sh, eh, description);
  const taskId = result.lastInsertRowid;

  if (submissions && submissions.length > 0) {
    const insertSub = db.prepare('INSERT INTO submissions (task_id, type, content, file_path) VALUES (?, ?, ?, ?)');
    submissions.forEach(s => insertSub.run(taskId, s.type, s.content || null, s.file_path || null));
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.json(task);
});

// Upload file (separate endpoint)
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  res.json({ file_path: req.file.filename, original_name: req.file.originalname });
});

// Update task
router.put('/:id', (req, res) => {
  const { description, completed, start_hour, end_hour, submissions } = req.body;
  const db = getDB();

  const task = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  if (description !== undefined) {
    db.prepare('UPDATE tasks SET description = ? WHERE id = ?').run(description, req.params.id);
  }
  if (start_hour !== undefined) {
    db.prepare('UPDATE tasks SET start_hour = ? WHERE id = ?').run(start_hour, req.params.id);
  }
  if (end_hour !== undefined) {
    db.prepare('UPDATE tasks SET end_hour = ? WHERE id = ?').run(end_hour, req.params.id);
  }
  if (completed !== undefined) {
    db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, req.params.id);
  }
  if (submissions !== undefined) {
    db.prepare('DELETE FROM submissions WHERE task_id = ?').run(req.params.id);
    const insertSub = db.prepare('INSERT INTO submissions (task_id, type, content, file_path) VALUES (?, ?, ?, ?)');
    submissions.forEach(s => insertSub.run(req.params.id, s.type, s.content || null, s.file_path || null));
  }

  const updated = db.prepare('SELECT id, plan_id, date, start_hour, end_hour, description, completed, created_at FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Toggle complete
router.patch('/:id/toggle', (req, res) => {
  const db = getDB();
  const task = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  const newStatus = task.completed ? 0 : 1;
  db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(newStatus, req.params.id);
  res.json({ id: req.params.id, completed: newStatus });
});

// Delete task
router.delete('/:id', (req, res) => {
  const db = getDB();
  const task = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// Batch fill tasks
router.post('/batch', (req, res) => {
  const { plan_id, dates, slots, template, conflict_mode } = req.body;
  if (!plan_id || !dates || !slots || !template) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(plan_id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  const insert = db.prepare('INSERT OR IGNORE INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)');
  const findExisting = db.prepare('SELECT id FROM tasks WHERE plan_id = ? AND date = ? AND start_hour = ? AND end_hour = ?');
  const update = db.prepare('UPDATE tasks SET description = ? WHERE plan_id = ? AND date = ? AND start_hour = ? AND end_hour = ?');
  const count = { created: 0, skipped: 0, overwritten: 0 };

  const transaction = db.transaction(() => {
    dates.forEach(date => {
      slots.forEach(slot => {
        const [startH, endH] = slot.split('-').map(s => parseInt(s.trim()));
        const existing = findExisting.get(plan_id, date, startH, endH);

        if (existing) {
          if (conflict_mode === 'overwrite') {
            update.run(template, plan_id, date, startH, endH);
            count.overwritten++;
          } else {
            count.skipped++;
          }
        } else {
          insert.run(plan_id, date, startH, endH, template);
          count.created++;
        }
      });
    });
  });

  transaction();
  res.json(count);
});

module.exports = router;
