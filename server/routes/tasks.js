const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { auth } = require('./auth');
const config = require('../config');
const taskService = require('../services/taskService');
const { AppError, sendConflict } = require('../errors');

const router = express.Router();

const UPLOAD_DIR = config.uploadDir;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
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

function verifyPlanAccess(db, planId, userId) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(planId, userId);
  if (!plan) throw new AppError('NOT_FOUND', '计划不存在', 404);
  return plan;
}

function verifyTaskOwnership(db, taskId, userId) {
  const task = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id = ? AND p.user_id = ?
  `).get(taskId, userId);
  if (!task) throw new AppError('NOT_FOUND', '任务不存在', 404);
  return task;
}

// Get tasks for a plan + date
router.get('/:planId/:date', (req, res) => {
  const db = getDB();
  verifyPlanAccess(db, req.params.planId, req.user.id);
  res.json(taskService.getTasksByPlanAndDate(req.params.planId, req.params.date));
});

// Create task
router.post('/', (req, res) => {
  const { plan_id, date, start_hour, end_hour, hour, description, submissions, force } = req.body;
  const sh = start_hour ?? hour;
  const eh = end_hour ?? (hour !== undefined ? hour + 1 : undefined);
  if (!plan_id || !date || sh === undefined || eh === undefined || !description) {
    throw new AppError('VALIDATION_ERROR', '请填写完整信息');
  }

  const db = getDB();
  verifyPlanAccess(db, plan_id, req.user.id);

  const sameName = taskService.findSameName(db, plan_id, date, description);
  if (sameName && !force && !req.body.skip_conflict_check) {
    return sendConflict(res, 'same_name', [{ start_hour: sh, end_hour: eh, description }]);
  }

  const overlaps = taskService.findOverlaps(db, plan_id, date, sh, eh);
  if (overlaps.length > 0 && !force && !req.body.skip_conflict_check) {
    return sendConflict(res, 'overlap', overlaps);
  }

  if (force) {
    if (overlaps.length > 0) {
      const ids = overlaps.map(o => o.id);
      db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    }
    const sn = taskService.findSameName(db, plan_id, date, description);
    if (sn) db.prepare('DELETE FROM tasks WHERE id = ?').run(sn.id);
  }

  const task = taskService.createTask(plan_id, date, sh, eh, description, submissions);
  res.json(task);
});

// Upload file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) throw new AppError('VALIDATION_ERROR', '请选择文件');
  res.json({ file_path: req.file.filename, original_name: req.file.originalname });
});

// Update task
router.put('/:id', (req, res) => {
  const { description, completed, start_hour, end_hour, submissions, force } = req.body;
  const db = getDB();
  const task = verifyTaskOwnership(db, req.params.id, req.user.id);

  const newStart = start_hour ?? task.start_hour;
  const newEnd = end_hour ?? task.end_hour;

  if (description !== undefined) {
    const dup = taskService.findSameName(db, task.plan_id, task.date, description, task.id);
    if (dup && !force) {
      return sendConflict(res, 'same_name', [{ start_hour: newStart, end_hour: newEnd, description }]);
    }
  }

  if ((start_hour !== undefined || end_hour !== undefined) && !force) {
    const overlaps = taskService.findOverlaps(db, task.plan_id, task.date, newStart, newEnd, task.id);
    if (overlaps.length > 0) return sendConflict(res, 'overlap', overlaps);
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
  const task = verifyTaskOwnership(db, req.params.id, req.user.id);
  const newStatus = task.completed ? 0 : 1;
  db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(newStatus, req.params.id);
  res.json({ id: req.params.id, completed: newStatus });
});

// Delete task
router.delete('/:id', (req, res) => {
  const db = getDB();
  const task = verifyTaskOwnership(db, req.params.id, req.user.id);

  const subs = db.prepare('SELECT file_path FROM submissions WHERE task_id = ? AND file_path IS NOT NULL').all(req.params.id);
  subs.forEach(s => {
    const fp = path.join(UPLOAD_DIR, s.file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ code: 'OK', message: '删除成功' });
});

// Batch fill
router.post('/batch', (req, res) => {
  const { plan_id, dates, slots, template, conflict_mode } = req.body;
  if (!plan_id || !dates || !slots || !template) {
    throw new AppError('VALIDATION_ERROR', '请填写完整信息');
  }

  const db = getDB();
  verifyPlanAccess(db, plan_id, req.user.id);

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

// Batch simple
router.post('/batch-simple', (req, res) => {
  const { plan_id, dates, start_hour, end_hour, description, conflict_mode } = req.body;
  if (!plan_id || !dates || !dates.length || start_hour === undefined || end_hour === undefined || !description) {
    throw new AppError('VALIDATION_ERROR', '请填写完整信息');
  }

  const db = getDB();
  verifyPlanAccess(db, plan_id, req.user.id);

  if (!conflict_mode) {
    const allOverlaps = [];
    dates.forEach(date => {
      const overlaps = taskService.findOverlaps(db, plan_id, date, start_hour, end_hour);
      overlaps.forEach(o => allOverlaps.push({ ...o, date }));
    });
    if (allOverlaps.length > 0) {
      return res.json({ code: 'CONFLICT', message: '存在时段冲突', details: { overlapping: allOverlaps } });
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

// Copy tasks
router.post('/copy', (req, res) => {
  const { task_ids, target_dates, target_plan_id, conflict_mode } = req.body;
  if (!task_ids || !task_ids.length || !target_dates || !target_dates.length) {
    throw new AppError('VALIDATION_ERROR', '请选择任务和目标日期');
  }

  const db = getDB();
  const targetPlanId = target_plan_id || req.body.plan_id;
  verifyPlanAccess(db, targetPlanId, req.user.id);

  const placeholders = task_ids.map(() => '?').join(',');
  const sourceTasks = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id IN (${placeholders}) AND p.user_id = ?
  `).all(...task_ids, req.user.id);
  if (sourceTasks.length === 0) throw new AppError('NOT_FOUND', '任务不存在', 404);

  if (!conflict_mode) {
    const allConflicts = [];
    target_dates.forEach(date => {
      sourceTasks.forEach(task => {
        const overlaps = taskService.findOverlaps(db, targetPlanId, date, task.start_hour, task.end_hour);
        overlaps.forEach(o => allConflicts.push({ ...o, date, source_task_id: task.id, source_description: task.description }));
        const sameName = taskService.findSameName(db, targetPlanId, date, task.description);
        if (sameName) allConflicts.push({ ...sameName, date, source_task_id: task.id, source_description: task.description, conflictType: 'same_name' });
      });
    });
    if (allConflicts.length > 0) {
      return res.json({ code: 'CONFLICT', message: `存在 ${allConflicts.length} 个冲突`, details: { conflicts: allConflicts } });
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
