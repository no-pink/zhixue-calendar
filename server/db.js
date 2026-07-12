const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

let db;

function initDB() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_hour INTEGER NOT NULL CHECK(start_hour >= 0 AND start_hour < 24),
      end_hour INTEGER NOT NULL CHECK(end_hour > 0 AND end_hour <= 24),
      description TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT,
      file_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_plan_date ON tasks(plan_id, date);
    CREATE INDEX IF NOT EXISTS idx_submissions_task ON submissions(task_id);
  `);

  // Migrate old database with `hour` column
  const hasHourCol = db.prepare("SELECT name FROM pragma_table_info('tasks') WHERE name = 'hour'").get();
  if (hasHourCol) {
    db.exec(`ALTER TABLE tasks ADD COLUMN start_hour INTEGER;`);
    db.exec(`ALTER TABLE tasks ADD COLUMN end_hour INTEGER;`);
    db.exec(`UPDATE tasks SET start_hour = hour, end_hour = hour + 1;`);
  }

  return db;
}

function getDB() {
  return db;
}

module.exports = { initDB, getDB };
