const { getDB } = require('../db');

function findOverlaps(db, planId, date, startHour, endHour, excludeTaskId) {
  let query = `SELECT id, start_hour, end_hour, description FROM tasks WHERE plan_id = ? AND date = ? AND start_hour < ? AND end_hour > ?`;
  const params = [planId, date, endHour, startHour];
  if (excludeTaskId) {
    query += ` AND id != ?`;
    params.push(excludeTaskId);
  }
  return db.prepare(query).all(...params);
}

function findSameName(db, planId, date, description, excludeTaskId) {
  let query = `SELECT id, start_hour, end_hour, description FROM tasks WHERE plan_id = ? AND date = ? AND description = ?`;
  const params = [planId, date, description];
  if (excludeTaskId) {
    query += ` AND id != ?`;
    params.push(excludeTaskId);
  }
  return db.prepare(query).get(...params);
}

function resolveTaskConflict(db, planId, date, startH, endH, description, conflictMode, insert, count) {
  const sameName = findSameName(db, planId, date, description);
  if (sameName) {
    if (conflictMode === 'overwrite') {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(sameName.id);
      insert.run(planId, date, startH, endH, description);
      count.overwritten = (count.overwritten || 0) + 1;
      count.created++;
    } else if (conflictMode === 'skip') {
      count.skipped = (count.skipped || 0) + 1;
    } else {
      insert.run(planId, date, startH, endH, description);
      count.created++;
    }
    return;
  }

  const overlaps = findOverlaps(db, planId, date, startH, endH);
  if (overlaps.length > 0) {
    if (conflictMode === 'overwrite') {
      const ids = overlaps.map(o => o.id);
      db.prepare(`DELETE FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
      insert.run(planId, date, startH, endH, description);
      count.overwritten = (count.overwritten || 0) + overlaps.length;
      count.created++;
    } else if (conflictMode === 'skip') {
      count.skipped = (count.skipped || 0) + overlaps.length;
    } else {
      insert.run(planId, date, startH, endH, description);
      count.created++;
    }
  } else {
    insert.run(planId, date, startH, endH, description);
    count.created++;
  }
}

function createTask(planId, date, startHour, endHour, description, submissions) {
  const db = getDB();
  const result = db.prepare('INSERT INTO tasks (plan_id, date, start_hour, end_hour, description) VALUES (?, ?, ?, ?, ?)')
    .run(planId, date, startHour, endHour, description);
  const taskId = result.lastInsertRowid;

  if (submissions && submissions.length > 0) {
    const insertSub = db.prepare('INSERT INTO submissions (task_id, type, content, file_path) VALUES (?, ?, ?, ?)');
    submissions.forEach(s => insertSub.run(taskId, s.type, s.content || null, s.file_path || null));
  }

  return getDB().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

function updateTask(id, fields) {
  const db = getDB();
  const sets = [];
  const params = [];
  if (fields.description !== undefined) { sets.push('description = ?'); params.push(fields.description); }
  if (fields.start_hour !== undefined) { sets.push('start_hour = ?'); params.push(fields.start_hour); }
  if (fields.end_hour !== undefined) { sets.push('end_hour = ?'); params.push(fields.end_hour); }
  if (fields.completed !== undefined) { sets.push('completed = ?'); params.push(fields.completed ? 1 : 0); }
  if (sets.length > 0) {
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  }
  if (fields.submissions !== undefined) {
    db.prepare('DELETE FROM submissions WHERE task_id = ?').run(id);
    const insertSub = db.prepare('INSERT INTO submissions (task_id, type, content, file_path) VALUES (?, ?, ?, ?)');
    fields.submissions.forEach(s => insertSub.run(id, s.type, s.content || null, s.file_path || null));
  }
  return db.prepare('SELECT id, plan_id, date, start_hour, end_hour, description, completed, created_at FROM tasks WHERE id = ?').get(id);
}

function getTasksByPlanAndDate(planId, date) {
  const db = getDB();
  const rows = db.prepare(`
    SELECT t.*, s.id as submission_id, s.type as submission_type, s.content as submission_content, s.file_path as submission_file_path
    FROM tasks t
    LEFT JOIN submissions s ON s.task_id = t.id
    WHERE t.plan_id = ? AND t.date = ?
    ORDER BY t.start_hour ASC
  `).all(planId, date);

  const taskMap = {};
  rows.forEach(row => {
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
  return Object.values(taskMap);
}

module.exports = {
  findOverlaps, findSameName, resolveTaskConflict,
  createTask, updateTask, getTasksByPlanAndDate,
};
