# 智学日程 — 测试文档

> 最后更新：2026-07-15

---

## 一、测试概览

| 项目 | 详情 |
|------|------|
| **测试框架** | Mocha + Supertest + assert 严格模式 |
| **数据库** | SQLite 内存数据库 (:memory:)，与生产隔离 |
| **测试文件** | `server/test/routes.test.js` |
| **运行命令** | `cd server && npm test` 或 `npx mocha test/**/*.test.js --timeout 5000` |
| **当前覆盖** | 20 个测试用例（auth × 5, plans × 3, tasks × 12） |
| **运行时间** | < 1 秒 |

---

## 二、测试架构

### 2.1 数据库隔离策略

测试使用 **SQLite 内存数据库** (`:memory:`)，与生产数据库 (`server/data.db`) 完全隔离：

```javascript
const testDb = new Database(':memory:');
testDb.pragma('journal_mode = WAL');
testDb.pragma('foreign_keys = ON');

// 手动建表（与 db.js 中结构一致）
testDb.exec(`CREATE TABLE IF NOT EXISTS users (...) ...`);

// 替换 getDB() 返回测试数据库
const dbModule = require('../db');
dbModule.getDB = () => testDb;
```

**为什么不用生产数据库**:
- 测试不污染生产数据
- 每次运行从空白状态开始，结果可重现
- 内存数据库速度极快
- CI 环境无需配置数据库

### 2.2 测试辅助函数

```javascript
// 创建 Express 应用实例（复用路由和错误处理中间件）
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use((err, req, res, next) => sendError(res, err));
  return app;
}

// 生成测试用 JWT Token（模拟已登录用户）
function getToken() {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id: 1, username: 'testuser' }, config.jwtSecret, { expiresIn: '1h' });
}
```

### 2.3 种子数据

每个测试文件顶部预置种子数据：

```javascript
// 测试用户: testuser / test123
const hash = bcrypt.hashSync('test123', 10);
testDb.prepare('INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)')
  .run(1, 'testuser', hash);

// 测试计划: id=1, user_id=1, 2026全年
testDb.prepare('INSERT OR IGNORE INTO plans (id, user_id, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)')
  .run(1, 1, '测试计划', '2026-01-01', '2026-12-31');
```

**注意**：使用 `INSERT OR IGNORE` 是因为同一个测试文件中多个 describe 块可能在同一个进程内运行，种子数据可能已存在。

---

## 三、已有测试用例一览

### 3.1 Auth（5 个用例）

| # | 测试用例 | 验证点 |
|---|---------|--------|
| 1 | `registers a new user` | 注册成功返回 token + user 对象 |
| 2 | `rejects duplicate username` | 重复用户名 → `CONFLICT` 错误码 |
| 3 | `logs in with correct credentials` | 正确密码登录成功返回 token |
| 4 | `rejects wrong password` | 错误密码 → `AUTH_FAILED` 错误码 |
| 5 | `rejects missing fields` | 缺少密码 → `VALIDATION_ERROR` |

### 3.2 Plans（3 个用例）

| # | 测试用例 | 验证点 |
|---|---------|--------|
| 6 | `creates a plan` | 创建成功返回计划对象 |
| 7 | `rejects duplicate plan name` | 同名计划 → `CONFLICT` 错误码 |
| 8 | `lists plans` | 列表返回数组，包含已创建的测试计划 |

### 3.3 Tasks（12 个用例）

| # | 测试用例 | 验证点 |
|---|---------|--------|
| 9 | `creates a task` | 创建成功返回任务对象 |
| 10 | `detects same name conflict` | 同名任务 → `CONFLICT_SAME_NAME` |
| 11 | `detects time overlap conflict` | 时段重叠 → `CONFLICT_OVERLAP` |
| 12 | `creates with force override` | force=true 覆盖冲突 |
| 13 | `gets tasks by date` | 按日期获取任务列表 |
| 14 | `toggles completion` | completed 从 0 变为 1 |
| 15 | `updates a task` | 更新描述和时段 |
| 16 | `rejects unauthorized access` | 其他用户的 token → `NOT_FOUND` |
| 17 | `batch fills tasks` | 2天×2时段 = 4个任务 |
| 18 | `copies tasks to other dates` | 复制任务到 2 个目标日期 |
| 19 | `deletes a task` | 删除成功 → `OK` |
| 20 | `rejects request without auth token` | 无 token → `AUTH_REQUIRED` |
| 15 | `updates a task` | 更新描述和时段 |
| 16 | `rejects unauthorized access` | 其他用户的 token → `NOT_FOUND` |
| 17 | `batch fills tasks` | 2天×2时段 = 4个任务 |
| 18 | `copies tasks to other dates` | 复制任务到 2 个目标日期 |
| 19 | `deletes a task` | 删除成功 → `OK` |
| 20 | `rejects request without auth token` | 无 token → `AUTH_REQUIRED` |

---

## 四、测试未覆盖区域

以下区域**尚未有测试覆盖**，按风险从高到低排列：

### 高优先级（数据完整性风险）

| 区域 | 风险 | 未测试内容 |
|------|------|----------|
| **backup 恢复** | 高 | 级联删除 + 批量插入的事务完整性、旧文件清理、ID 冲突处理 |
| **backup 导出** | 中 | ZIP 生成、data.json 内容完整性、文件附件包含 |
| **计划删除** | 高 | 级联删除任务和提交物、文件系统清理 |
| **改密端点** | 中 | 旧密码校验、新密码写入、token 是否失效 |

### 中优先级（业务逻辑边界）

| 区域 | 风险 | 未测试内容 |
|------|------|----------|
| **批量填充 skip 模式** | 中 | 冲突时跳过不创建，不删除原有任务 |
| **批量填充 overwrite 模式** | 中 | 冲突时删除旧任务后创建新任务 |
| **任务复制冲突检测** | 中 | 跨计划复制时的同名和重叠检测 |
| **任务更新时同时处理同名+重叠** | 中 | 描述改同名 + 时段改重叠 → 两种冲突一起处理 |

### 低优先级（功能验证）

| 区域 | 风险 | 未测试内容 |
|------|------|----------|
| **文件上传** | 低 | MIME 白名单、大小限制、UUID 文件名 |
| **/api/auth/me** | 低 | 基本功能但未经测试 |
| **计划更新** | 低 | 同名检测、日期更新 |
| **提交物增删** | 低 | createTask/updateTask 的 submissions 数组处理 |
| **日历统计准确度** | 低 | total/completed 计数是否正确 |

---

## 五、如何运行测试

```bash
# 在项目根目录
cd server
npm test

# 或者直接使用 mocha
npx mocha test/**/*.test.js --timeout 5000

# 运行特定测试用例（按名称过滤）
npx mocha test/**/*.test.js --timeout 5000 --grep "Auth"

# 运行并显示详细输出
npx mocha test/**/*.test.js --timeout 5000 --reporter spec
```

---

## 六、如何添加新测试

### 6.1 添加新的测试文件

在 `server/test/` 下创建新文件，如 `server/test/backup.test.js`：

```javascript
const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { describe, it } = require('mocha');
const { strict: assert } = require('node:assert');

// 1. 创建内存数据库并建表（需要哪些表就建哪些）
const testDb = new Database(':memory:');
testDb.pragma('foreign_keys = ON');
testDb.exec(`
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
    start_hour INTEGER NOT NULL,
    end_hour INTEGER NOT NULL,
    description TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );
  -- ... 其他需要的表
`);

// 2. 替换 getDB
const dbModule = require('../db');
dbModule.getDB = () => testDb;

// 3. 配置种子数据
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('test123', 10);
testDb.prepare('INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)').run(1, 'testuser', hash);
testDb.prepare('INSERT OR IGNORE INTO plans (id, user_id, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)').run(1, 1, '测试计划', '2026-01-01', '2026-12-31');

// 4. 引入路由
const config = require('../config');
const backupRoutes = require('../routes/backup');
const { sendError } = require('../errors');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/backup', backupRoutes);
  app.use((err, req, res, next) => sendError(res, err));
  return app;
}

function getToken() {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id: 1, username: 'testuser' }, config.jwtSecret, { expiresIn: '1h' });
}

// 5. 编写测试
describe('Backup', () => {
  it('exports data as ZIP', async () => {
    // 先创建一些测试数据...
    const res = await request(createApp())
      .get('/api/backup/export')
      .set('Authorization', `Bearer ${getToken()}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/zip');
  });

  it('restores data and replaces existing', async () => {
    const dataJson = JSON.stringify({
      plans: [{ id: 10, user_id: 1, name: '恢复计划', start_date: '2026-01-01', end_date: '2026-12-31', created_at: '2026-01-01' }],
      tasks: [],
      submissions: [],
    });
    const res = await request(createApp())
      .post('/api/backup/restore')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ dataJson });
    assert.equal(res.status, 200);
  });
});
```

### 6.2 扩展现有测试

在 `server/test/routes.test.js` 中已有的 describe 块内添加 `it(...)` 即可：

```javascript
describe('Tasks', () => {
  // ... 现有测试 ...

  it('prevents accessing another user plan', async () => {
    // 创建另一个用户和计划
    const hash = bcrypt.hashSync('other', 10);
    testDb.prepare('INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)').run(2, 'otheruser', hash);
    testDb.prepare('INSERT OR IGNORE INTO plans (id, user_id, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)').run(2, 2, '别人的计划', '2026-01-01', '2026-12-31');

    const res = await request(createApp())
      .get('/api/tasks/2/2026-03-15')  // 用 testuser 的 token 访问 otheruser 的计划
      .set('Authorization', `Bearer ${getToken()}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'NOT_FOUND');
  });
});
```

---

## 七、编写测试的原则

### 7.1 必须遵守

1. **每次测试从干净状态开始** — 不要在测试之间依赖数据。如果一个测试创建了数据，下一个测试不要假设它还存在。
2. **测试真正的业务行为** — 不要测试框架（如 Express 中间件），测试你的业务逻辑。
3. **验证响应体，不只是状态码** — `assert.equal(res.body.code, 'CONFLICT_SAME_NAME')` 比 `assert.equal(res.status, 200)` 更有价值。
4. **覆盖错误路径** — 不仅要测正常情况，还要测错误输入、越权访问、参数缺失。
5. **使用 `INSERT OR IGNORE` 做种子数据** — 防止同一个 spec 文件中多个 describe 块间种子冲突。

### 7.2 冲突检测测试要点

任务冲突检测是最复杂的业务逻辑，测试时需覆盖以下矩阵：

| 场景 | conflict_mode | 期望行为 |
|------|--------------|---------|
| 无冲突 | N/A | 直接创建 |
| 同名冲突 | keep_both | 创建新任务，保留旧任务 |
| 同名冲突 | skip | 不创建，保留旧任务 |
| 同名冲突 | overwrite | 删除旧任务，创建新任务 |
| 时段重叠 | keep_both | 创建新任务，保留重叠任务 |
| 时段重叠 | skip | 不创建，保留重叠任务 |
| 时段重叠 | overwrite | 删除所有重叠任务，创建新任务 |
| 同名 + 重叠 | keep_both | 两个旧任务都不动，创建新任务 |
| 同名 + 重叠 | overwrite | 删除同名 + 删除所有重叠，创建新任务 |

### 7.3 不需要测试的内容

- **框架行为** — 不需要测试 Express 的中间件执行顺序、multer 的文件存储等
- **第三方库的行为** — bcrypt、jsonwebtoken、pino 等有自己的测试
- **纯 UI 展示** — 不使用前端测试框架，CSS 样式、动画等靠目测检查

---

## 八、测试与 CI 集成建议

当项目接入 CI（GitHub Actions 等）时，添加以下步骤：

```yaml
- name: Run tests
  run: |
    cd server
    npm ci
    npm test
```

测试在内存中运行，无需额外的数据库服务或环境变量配置。

---

## 九、待办测试清单

按优先级排列的待补充测试：

### 紧急（下次修改相关代码前必须补）

- [ ] **backup 恢复测试** — 验证数据完全替换 + 旧文件清理
- [ ] **计划删除测试** — 验证级联删除任务和提交物
- [ ] **改密测试** — 验证旧密码校验 + 新密码写入

### 重要（新功能开发前补）

- [ ] **批量填充 skip 模式测试**
- [ ] **批量填充 overwrite 模式测试**
- [ ] **任务复制冲突检测测试**
- [ ] **任务更新时同名+重叠同时处理测试**

### 一般（迭代中补充）

- [ ] **backup 导出内容完整性测试**
- [ ] **文件上传 MIME 校验测试**
- [ ] **文件上传大小限制测试**
- [ ] **/api/auth/me 测试**
- [ ] **计划更新同名检测测试**
- [ ] **日历统计准确度测试**
- [ ] **提交物 created + updated 替换测试**
