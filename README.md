# 智学日程 - 学习计划管理系统

一个基于 Web 的学习计划管理工具，支持按天排课、任务提交与数据备份。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + React Router 6 + Vite + Tailwind CSS 4 |
| 后端 | Node.js + Express 4 |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT (jsonwebtoken) + bcryptjs |

## 功能

- **用户系统** — 注册、登录、修改密码
- **学习计划** — 创建/编辑/删除计划，设定起止日期
- **日历视图** — 按月查看，直观展示每日任务完成情况
- **任务管理** — 按小时排课，增删改查，完成状态切换
- **作业提交** — 支持文本提交和文件上传（图片、文档等）
- **批量填充** — 在选定的日期范围内按时段批量创建任务，支持跳过或覆盖
- **数据备份** — 导出为 ZIP（含 JSON + 附件），支持恢复

## 快速开始

```bash
# 安装依赖（根目录、服务端、客户端）
npm run setup

# 同时启动前后端
npm run dev
```

服务端运行在 `http://localhost:3001`，客户端运行在 `http://localhost:5173`（Vite 自动代理 API 请求到 3001）。

## 目录结构

```
├── client/                  # React 前端
│   └── src/
│       ├── components/      # 页面组件
│       │   ├── Dashboard.jsx       # 主面板
│       │   ├── CalendarView.jsx    # 日历视图
│       │   ├── TaskPanel.jsx       # 任务详情面板
│       │   ├── PlanList.jsx        # 计划列表
│       │   ├── Login.jsx           # 登录/注册
│       │   ├── BatchFillModal.jsx  # 批量填充弹窗
│       │   └── SettingsModal.jsx   # 设置弹窗
│       ├── context/AuthContext.jsx # 认证上下文
│       └── api/index.js            # API 封装
├── server/                  # Express 后端
│   ├── index.js             # 入口与中间件
│   ├── db.js                # SQLite 初始化与表结构
│   └── routes/
│       ├── auth.js          # 注册/登录/改密
│       ├── plans.js         # 计划 CRUD
│       ├── tasks.js         # 任务 CRUD + 批量填充 + 文件上传
│       └── backup.js        # 数据导出/恢复
└── package.json             # 根目录脚本
```

## API

所有 API 除认证接口外均需在 Header 携带 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/change-password` | 修改密码 |
| GET  | `/api/auth/me` | 获取当前用户 |
| GET  | `/api/plans` | 获取计划列表 |
| POST | `/api/plans` | 创建计划 |
| PUT  | `/api/plans/:id` | 更新计划 |
| DELETE | `/api/plans/:id` | 删除计划 |
| GET  | `/api/plans/:id/calendar` | 获取计划日历数据 |
| GET  | `/api/tasks/:planId/:date` | 获取指定日期任务 |
| POST | `/api/tasks` | 创建任务 |
| PUT  | `/api/tasks/:id` | 更新任务 |
| PATCH | `/api/tasks/:id/toggle` | 切换完成状态 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| POST | `/api/tasks/batch` | 批量填充任务 |
| POST | `/api/tasks/upload` | 上传文件 |
| GET  | `/api/backup/export` | 导出数据 ZIP |
| POST | `/api/backup/restore` | 恢复数据 |

## 数据库表结构

- **users** — 用户（用户名、密码哈希）
- **plans** — 学习计划（名称、起止日期，关联用户）
- **tasks** — 任务（日期、小时、描述、完成状态，关联计划）
- **submissions** — 作业提交（文本内容或文件路径，关联任务）
