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

// Check for time overlap conflicts
function findOverlaps(db, planId, date, startHour, endHour, excludeTaskId) {
  let query = `SELECT id, start_hour, end_hour, description FROM tasks WHERE plan_id = ? AND date = ? AND start_hour < ? AND end_hour > ?`;
  const params = [planId, date, endHour, startHour];
  if (excludeTaskId) {
    query += ` AND id != ?`;
    params.push(excludeTaskId);
  }
  return db.prepare(query).all(...params);
}

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

  // Report overlaps before creating (unless force or skip_conflict_check)
  const overlaps = findOverlaps(db, plan_id, date, sh, eh);
  if (overlaps.length > 0 && !force && !req.body.skip_conflict_check) {
    return res.json({ conflict: true, overlapping: overlaps });
  }

  // Check for same-name + overlapping (same plan+date+name where times overlap)
  const sameName = db.prepare(`SELECT id, start_hour, end_hour FROM tasks WHERE plan_id = ? AND date = ? AND description = ? AND start_hour < ? AND end_hour > ?`)
    .get(plan_id, date, description, eh, sh);
  if (sameName) {
    return res.json({ conflict: true, overlapping: [{ start_hour: sh, end_hour: eh, description: description + ' (同名且时段重叠)' }] });
  }

  // Remove overlapping tasks if force (overwrite mode)
  if (force && overlaps.length > 0) {
    const ids = overlaps.map(o => o.id);
    db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  }

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

// Update task — check overlaps first, block until user decides
router.put('/:id', (req, res) => {
  const { description, completed, start_hour, end_hour, submissions, force } = req.body;
  const db = getDB();

  const task = db.prepare(`
    SELECT t.* FROM tasks t JOIN plans p ON t.plan_id = p.id
    WHERE t.id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  // Check same-name on edit
  const newDesc = description ?? task.description;
  if (description !== undefined) {
    const dup = db.prepare('SELECT id FROM tasks WHERE plan_id = ? AND date = ? AND description = ? AND id != ?')
      .get(task.plan_id, task.date, newDesc, task.id);
    if (dup && !force) {
      return res.json({ conflict: true, overlapping: [{ start_hour: task.start_hour, end_hour: task.end_hour, description: newDesc + ' (同名)' }] });
    }
  }

  const newStart = start_hour ?? task.start_hour;
  const newEnd = end_hour ?? task.end_hour;

  // Check same-name + overlapping on edit (name+time both checked)
  if (description !== undefined) {
    const dup = db.prepare('SELECT id FROM tasks WHERE plan_id = ? AND date = ? AND description = ? AND start_hour < ? AND end_hour > ? AND id != ?')
      .get(task.plan_id, task.date, description, newEnd, newStart, task.id);
    if (dup && !force) {
      return res.json({ conflict: true, overlapping: [{ start_hour: newStart, end_hour: newEnd, description: description + ' (同名且时段重叠)' }] });
    }
  }

  // Report overlaps before updating (unless force)
  if ((start_hour !== undefined || end_hour !== undefined) && !force) {
    const overlaps = findOverlaps(db, task.plan_id, task.date, newStart, newEnd, task.id);
    if (overlaps.length > 0) {
      return res.json({ conflict: true, overlapping: overlaps });
    }
  }

  if (force && (start_hour !== undefined || end_hour !== undefined)) {
    const overlaps = findOverlaps(db, task.plan_id, task.date, newStart, newEnd, task.id);
    if (overlaps.length > 0) {
      const ids = overlaps.map(o => o.id);
      db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    }
  }

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

  const insert = db.prepare('INSERT INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)');
  const count = { created: 0, skipped: 0, overwritten: 0 };

  const transaction = db.transaction(() => {
    dates.forEach(date => {
      slots.forEach(slot => {
        const [startH, endH] = slot.split('-').map(s => parseInt(s.trim()));
        const overlaps = findOverlaps(db, plan_id, date, startH, endH);

        if (overlaps.length > 0) {
        if (conflict_mode === 'overwrite') {
          const ids = overlaps.map(o => o.id);
          db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
          insert.run(plan_id, date, startH, endH, template);
          count.overwritten += overlaps.length;
          count.created++;
        } else if (conflict_mode === 'skip') {
          // skip = keep old + don't add new (用户主动选择不要)
          count.skipped += overlaps.length;
        } else {
          // keep_both (default when no specific mode) = keep old + add new too
          insert.run(plan_id, date, startH, endH, template);
          count.created++;
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

// Batch create on multiple dates (used by TaskPanel multi-date mode)
router.post('/batch-simple', (req, res) => {
  const { plan_id, dates, start_hour, end_hour, description, conflict_mode } = req.body;
  if (!plan_id || !dates || !dates.length || start_hour === undefined || end_hour === undefined || !description) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDB();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(plan_id, req.user.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });

  // If no conflict_mode specified, check and return conflicts for user to decide
  if (!conflict_mode) {
    const allOverlaps = [];
    dates.forEach(date => {
      const overlaps = findOverlaps(db, plan_id, date, start_hour, end_hour);
      overlaps.forEach(o => allOverlaps.push({ ...o, date }));
    });
    if (allOverlaps.length > 0) {
      return res.json({ conflict: true, overlapping: allOverlaps });
    }
  }

  const insert = db.prepare('INSERT INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)');
  let created = 0, skipped = 0;

  const transaction = db.transaction(() => {
    dates.forEach(date => {
      const overlaps = findOverlaps(db, plan_id, date, start_hour, end_hour);
      if (overlaps.length > 0) {
        if (conflict_mode === 'overwrite') {
          const ids = overlaps.map(o => o.id);
          db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
          insert.run(plan_id, date, start_hour, end_hour, description);
          created++;
        } else if (conflict_mode === 'skip') {
          skipped++;
        } else {
          // keep_both (or default) — add new alongside old
          insert.run(plan_id, date, start_hour, end_hour, description);
          created++;
        }
      } else {
        insert.run(plan_id, date, start_hour, end_hour, description);
        created++;
      }
    });
  });

  transaction();
  res.json({ created, skipped });
});

module.exports = router;
