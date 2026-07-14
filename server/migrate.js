const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const logger = require('./logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(MIGRATIONS_DIR, '.gitkeep'), '');
  }

  const db = new Database(config.dbPath);

  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)
  );

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let latest = 0;
  for (const file of files) {
    const match = file.match(/^(\d{4})/);
    if (!match) continue;
    const version = parseInt(match[1], 10);
    if (version > latest) latest = version;
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    logger.info(`Running migration: ${file}`);
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, file);
    })();
    logger.info(`Applied migration: ${file}`);
  }

  db.close();
  return latest;
}

module.exports = { runMigrations };
