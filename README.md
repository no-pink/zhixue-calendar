# 智学日程 — 学习计划管理系统

一个基于 Web 的学习计划管理工具，支持按时段排课、任务复制、批量操作、提交物和数据备份。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + React Router 6 + Vite + Tailwind CSS 4 |
| 后端 | Node.js + Express 4 |
| 数据库 | SQLite (better-sqlite3) |
| 日志 | Pino |
| 认证 | JWT (jsonwebtoken) + bcryptjs |
| 限速 | express-rate-limit |

## 功能

- **用户系统** — 注册、登录、修改密码，登录/注册接口限速防暴力破解
- **学习计划** — 创建/编辑/删除计划，同名检测，设定起止日期
- **日历视图** — 按月查看，直观展示每日任务完成情况，支持左右滚动
- **任务管理** — 按时段排课（如 08:00-10:00），增删改查，完成状态切换
- **任务复制** — 复制一个或多个任务到其他日期或其他计划，仅复制任务时段和描述（不含提交物），支持批量跨天复制
- **冲突检测** — 同名检测（同一天+同一计划+同名）和时段重叠检测（时间段交叉），弹窗提示用户选择：
  - **保留新旧** — 原有任务和新任务共存
  - **跳过** — 保留原有任务，不添加新任务
  - **覆盖** — 删除原有任务，用新任务替换
- **多选模式** — 日历面板支持多选日期，也可按住 Ctrl 点选
- **批量填充** — 在多选日期范围内按时段批量创建任务
- **提交物** — 支持文本提交和文件上传（图片、文档等）
- **数据备份** — 导出为 ZIP（含 JSON + 附件），支持恢复
- **响应式布局** — 适配桌面和移动端，窄屏任务面板可浮动折叠
- **Toast 通知** — 全局轻量消息提示，替代原生 alert

## 快速开始

### 前置要求

- Node.js >= 18
- npm

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/no-pink/zhixue-calendar.git
cd zhixue-calendar

# 2. 安装所有依赖
npm run setup

# 3. 配置环境变量（可选）
cp server/.env.example server/.env
# 编辑 server/.env 设置 JWT_SECRET（生产环境必须）

# 4. 同时启动前后端
npm run dev
```

服务端运行在 `http://localhost:3001`，客户端运行在 `http://localhost:5173`（Vite 自动代理 API 请求到 3001）。

### 生产部署

```bash
cd client && npx vite build
# 将 dist/ 部署到 Nginx/CDN，后端用 pm2 或 systemd 管理
```

## 配置说明

通过 `server/.env` 文件配置（参考 `server/.env.example`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 服务端口 |
| `JWT_SECRET` | 无（生产环境必填） | JWT 签名密钥 |
| `JWT_EXPIRES_IN` | 7d | Token 过期时间 |
| `LOG_LEVEL` | info | 日志级别 |
| `MAX_FILE_SIZE` | 10485760 (10MB) | 上传文件大小上限 |
| `ALLOWED_MIME_TYPES` | image/jpeg,image/png,... | 允许上传的 MIME 类型 |
| `RATE_LIMIT_MAX` | 100 | 全局请求上限/15分钟 |
| `RATE_LIMIT_AUTH_MAX` | 10 | 登录接口请求上限/15分钟 |

## 目录结构

```
├── client/                              # React 前端
│   └── src/
│       ├── components/
│       │   ├── Dashboard.jsx            # 主面板（响应式布局）
│       │   ├── CalendarView.jsx         # 日历视图（含多选模式）
│       │   ├── TaskPanel.jsx            # 任务详情面板（含冲突弹窗）
│       │   ├── PlanList.jsx             # 计划列表
│       │   ├── Login.jsx                # 登录/注册
│       │   ├── BatchFillModal.jsx       # 批量填充弹窗
│       │   ├── CopyTasksModal.jsx       # 任务复制弹窗
│       │   └── SettingsModal.jsx        # 设置（改密/备份）
│       ├── context/
│       │   ├── AuthContext.jsx          # 认证上下文
│       │   └── ToastContext.jsx         # 全局 Toast 通知
│       └── api/index.js                # API 封装
├── server/                              # Express 后端
│   ├── index.js                         # 入口与中间件（含限速）
│   ├── config.js                        # 统一配置（dotenv）
│   ├── logger.js                        # 结构化日志（pino）
│   ├── db.js                            # SQLite 初始化与表结构
│   ├── migrate.js                       # 数据库迁移引擎
│   ├── migrations/                      # 版本化 SQL 迁移文件
│   ├── services/
│   │   └── taskService.js               # 任务业务逻辑层
│   ├── routes/
│   │   ├── auth.js                      # 注册/登录/改密
│   │   ├── plans.js                     # 计划 CRUD（含同名检测）
│   │   ├── tasks.js                     # 任务 CRUD + 冲突检测 + 批量操作
│   │   └── backup.js                    # 数据导出/恢复
│   ├── uploads/                         # 上传文件存储
│   └── .env.example                     # 环境变量示例
├── package.json                         # 根目录脚本
└── README.md
```

## API

所有 API 除认证接口外均需在 Header 携带 `Authorization: Bearer <token>`。

### 认证

| 方法 | 路径 | 说明 | 限速 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 10次/15min |
| POST | `/api/auth/login` | 登录 | 10次/15min |
| POST | `/api/auth/change-password` | 修改密码 | — |
| GET | `/api/auth/me` | 获取当前用户 | — |

### 计划

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plans` | 获取计划列表（含进度统计） |
| POST | `/api/plans` | 创建计划（同名检测） |
| PUT | `/api/plans/:id` | 更新计划 |
| DELETE | `/api/plans/:id` | 删除计划（级联删除任务和提交物） |
| GET | `/api/plans/:id/calendar` | 获取日历统计数据 |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks/:planId/:date` | 获取指定日期任务列表 |
| POST | `/api/tasks` | 创建任务（同名+重叠检测） |
| PUT | `/api/tasks/:id` | 更新任务（同名+重叠检测） |
| PATCH | `/api/tasks/:id/toggle` | 切换完成状态 |
| DELETE | `/api/tasks/:id` | 删除任务（同步清理上传文件） |
| POST | `/api/tasks/batch` | 批量填充（多时间段×多日期，支持三种冲突模式） |
| POST | `/api/tasks/batch-simple` | 简单批量创建（同一时段×多日期） |
| POST | `/api/tasks/copy` | 复制任务到其他日期/计划（含冲突检测） |
| POST | `/api/tasks/upload` | 上传文件（MIME 类型和大小校验） |

### 备份

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/backup/export` | 导出数据 ZIP（含 JSON + 附件） |
| POST | `/api/backup/restore` | 恢复数据（完全替换当前用户数据） |

## 数据库

使用 SQLite (better-sqlite3)，WAL 模式，文件位于 `server/data.db`。

**表结构：**

- **users** — 用户（id, username, password, created_at）
- **plans** — 学习计划（id, user_id, name, start_date, end_date, created_at）
- **tasks** — 任务（id, plan_id, date, start_hour, end_hour, description, completed, created_at）
- **submissions** — 提交物（id, task_id, type, content, file_path, created_at）
- **schema_migrations** — 迁移记录（version, name, applied_at）

外键级联删除：删除计划 → 级联删除任务和提交物 → 清理硬盘上的文件。

数据库迁移通过 `server/migrations/` 目录中的版本化 SQL 文件管理，启动时自动运行未执行的迁移。

## 开发

```bash
# 安装依赖
npm run setup

# 同时启动前后端
npm run dev

# 仅启动后端
npm run server

# 仅启动前端
cd client && npx vite
```
