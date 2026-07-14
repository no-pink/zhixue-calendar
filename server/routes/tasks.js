const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { auth } = require('./auth');
const config = require('../config');
const taskService = require('../services/taskService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (req, file, cb) => {
    if (config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  },
});

router.use(auth);

// Get tasks for a plan + date
router.get('/:planId/:date', (req, res) => {
  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?')
    .get(req.params.planId, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  res.json(taskService.getTasksByPlanAndDate(req.params.planId, req.params.date));
});

// Create task — check overlaps first, block until user decides
router.post('/', (req, res) => {
  const { plan_id, date, start_hour, end_hour, hour, description, submissions, force } = req.body;
  const sh = start_hour ?? hour;
  const eh = end_hour ?? (hour !== undefined ? hour + 1 : undefined);
  if (!plan_id || !date || sh === undefined || eh === undefined || !description) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(plan_id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  // Check same name
  const sameName = taskService.findSameName(db, plan_id, date, description);
  if (sameName && !force && !req.body.skip_conflict_check) {
    return res.json({ conflict: true, conflictType: 'same_name', overlapping: [{ start_hour: sh, end_hour: eh, description }] });
  }

  // Report overlaps before creating
  const overlaps = taskService.findOverlaps(db, plan_id, date, sh, eh);
  if (overlaps.length > 0 && !force && !req.body.skip_conflict_check) {
    return res.json({ conflict: true, conflictType: 'overlap', overlapping: overlaps });
  }

  // Force mode: remove conflicting tasks first
  if (force) {
    if (overlaps.length > 0) {
      const ids = overlaps.map(o => o.id);
      db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    }
    const sn = taskService.findSameName(db, plan_id, date, description);
    if (sn) {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(sn.id);
    }
  }

  const task = taskService.createTask(plan_id, date, sh, eh, description, submissions);
  res.json(task);
});

// Upload file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  res.json({ file_path: req.file.filename, original_name: req.file.originalname });
});

// Update task
router.put('/:id', (req, res) => {
  const { description, completed, start_hour, end_hour, submissions, force } = req.body;
  const db = getDB();

  const task = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  const newStart = start_hour ?? task.start_hour;
  const newEnd = end_hour ?? task.end_hour;

  // Check same name (exclude self)
  if (description !== undefined) {
    const dup = taskService.findSameName(db, task.plan_id, task.date, description, task.id);
    if (dup && !force) {
      return res.json({ conflict: true, conflictType: 'same_name', overlapping: [{ start_hour: newStart, end_hour: newEnd, description }] });
    }
  }

  // Report overlaps before updating
  if ((start_hour !== undefined || end_hour !== undefined) && !force) {
    const overlaps = taskService.findOverlaps(db, task.plan_id, task.date, newStart, newEnd, task.id);
    if (overlaps.length > 0) {
      return res.json({ conflict: true, conflictType: 'overlap', overlapping: overlaps });
    }
  }

  if (force && (start_hour !== undefined || end_hour !== undefined)) {
    const overlaps = taskService.findOverlaps(db, task.plan_id, task.date, newStart, newEnd, task.id);
    if (overlaps.length > 0) {
      const ids = overlaps.map(o => o.id);
      db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    }
  }

  const updated = taskService.updateTask(req.params.id, { description, completed, start_hour, end_hour, submissions });
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

  // Delete associated files from disk
  const subs = db.prepare('SELECT file_path FROM submissions WHERE task_id = ? AND file_path IS NOT NULL').all(req.params.id);
  subs.forEach(s => {
    const fp = path.join(__dirname, '../uploads', s.file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// Batch fill tasks — one template across slot combos
router.post('/batch', (req, res) => {
  const { plan_id, dates, slots, template, conflict_mode } = req.body;
  if (!plan_id || !dates || !slots || !template) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(plan_id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  const insert = db.prepare('INSERT INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)');
  const count = { created: 0, skipped: 0, overwritten: 0 };

  const transaction = db.transaction(() => {
    dates.forEach(date => {
      slots.forEach(slot => {
        const [startH, endH] = slot.split('-').map(s => parseInt(s.trim()));
        taskService.resolveTaskConflict(db, plan_id, date, startH, endH, template, conflict_mode, insert, count);
      });
    });
  });

  transaction();
  res.json(count);
});

// Batch create on multiple dates
router.post('/batch-simple', (req, res) => {
  const { plan_id, dates, start_hour, end_hour, description, conflict_mode } = req.body;
  if (!plan_id || !dates || !dates.length || start_hour === undefined || end_hour === undefined || !description) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(plan_id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  if (!conflict_mode) {
    const allOverlaps = [];
    dates.forEach(date => {
      const overlaps = taskService.findOverlaps(db, plan_id, date, start_hour, end_hour);
      overlaps.forEach(o => allOverlaps.push({ ...o, date }));
    });
    if (allOverlaps.length > 0) {
      return res.json({ conflict: true, overlapping: allOverlaps });
    }
  }

  const insert = db.prepare('INSERT INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)');
  const count = { created: 0, skipped: 0, overwritten: 0 };

  const transaction = db.transaction(() => {
    dates.forEach(date => {
      taskService.resolveTaskConflict(db, plan_id, date, start_hour, end_hour, description, conflict_mode || 'keep_both', insert, count);
    });
  });

  transaction();
  res.json(count);
});

// Copy tasks to other dates/plans
router.post('/copy', (req, res) => {
  const { task_ids, target_dates, target_plan_id, conflict_mode } = req.body;
  if (!task_ids || !task_ids.length || !target_dates || !target_dates.length) {
    return res.status(400).json({ error: '请选择任务和目标日期' });
  }

  const db = getDB();
  const targetPlanId = target_plan_id || req.body.plan_id;

  const targetPlan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(targetPlanId, req.user.id);
  if (!targetPlan) return res.status(404).json({ error: '目标计划不存在' });

  const placeholders = task_ids.map(() => '?').join(',');
  const sourceTasks = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id IN (${placeholders}) AND p.user_id = ?
  `).all(...task_ids, req.user.id);
  if (sourceTasks.length === 0) return res.status(404).json({ error: '任务不存在' });

  if (!conflict_mode) {
    const allConflicts = [];
    target_dates.forEach(date => {
      sourceTasks.forEach(task => {
        const overlaps = taskService.findOverlaps(db, targetPlanId, date, task.start_hour, task.end_hour);
        overlaps.forEach(o => allConflicts.push({ ...o, date, source_task_id: task.id, source_description: task.description }));
        const sameName = taskService.findSameName(db, targetPlanId, date, task.description);
        if (sameName) {
          allConflicts.push({ ...sameName, date, source_task_id: task.id, source_description: task.description, conflictType: 'same_name' });
        }
      });
    });
    if (allConflicts.length > 0) {
      return res.json({ conflict: true, conflicts: allConflicts });
    }
  }

  const insertTask = db.prepare('INSERT INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)');
  const count = { created: 0, skipped: 0, overwritten: 0 };

  const transaction = db.transaction(() => {
    target_dates.forEach(date => {
      sourceTasks.forEach(task => {
        taskService.resolveTaskConflict(db, targetPlanId, date, task.start_hour, task.end_hour, task.description, conflict_mode || 'keep_both', insertTask, count);
      });
    });
  });

  transaction();
  res.json(count);
});

module.exports = router;
