# 智学日程 - 学习计划管理系统

一个基于 Web 的学习计划管理工具，支持按时段排课、任务提交、批量操作与数据备份。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + React Router 6 + Vite + Tailwind CSS 4 |
| 后端 | Node.js + Express 4 |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT (jsonwebtoken) + bcryptjs |

## 功能

- **用户系统** — 注册、登录、修改密码
- **学习计划** — 创建/编辑/删除计划，同名检测，设定起止日期
- **日历视图** — 按月查看，直观展示每日任务完成情况，支持左右滚动
- **任务管理** — 按时段排课（如 08:00-10:00），增删改查，完成状态切换
- **冲突检测** — 同名检测（同一天+同一计划+同名）和时段重叠检测（时间段交叉），弹窗提示用户选择：
  - **全都要** — 保留原有任务，同时添加新任务
  - **跳过** — 保留原有任务，不添加新任务
  - **替换** — 删除原有任务，用新任务覆盖
- **多选模式** — 日历面板支持开启多选模式，鼠标点选/取消即可选择多天，也可按住 Ctrl 多选
- **批量填充** — 在多选日期范围内按时段批量创建任务，支持三种冲突处理方式
- **作业提交** — 支持文本提交和文件上传（图片、文档等）
- **数据备份** — 导出为 ZIP（含 JSON + 附件），支持恢复
- **响应式布局** — 适配桌面和移动端，窄屏任务面板可浮动折叠

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
│       │   ├── Dashboard.jsx       # 主面板（响应式布局）
│       │   ├── CalendarView.jsx    # 日历视图（含多选模式）
│       │   ├── TaskPanel.jsx       # 任务详情面板（含冲突弹窗）
│       │   ├── PlanList.jsx        # 计划列表
│       │   ├── Login.jsx           # 登录/注册
│       │   ├── BatchFillModal.jsx  # 批量填充弹窗
│       │   └── SettingsModal.jsx   # 设置弹窗
│       ├── context/AuthContext.jsx # 认证上下文
│       └── api/index.js            # API 封装
├── server/                  # Express 后端
│   ├── index.js             # 入口与中间件
│   ├── db.js                # SQLite 初始化与表结构（含旧数据迁移）
│   ├── uploads/             # 上传文件存储
│   └── routes/
│       ├── auth.js          # 注册/登录/改密
│       ├── plans.js         # 计划 CRUD（含同名检测）
│       ├── tasks.js         # 任务 CRUD + 冲突检测 + 批量操作
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
| GET  | `/api/plans` | 获取计划列表（含进度统计） |
| POST | `/api/plans` | 创建计划（同名检测） |
| PUT  | `/api/plans/:id` | 更新计划（同名检测） |
| DELETE | `/api/plans/:id` | 删除计划 |
| GET  | `/api/plans/:id/calendar` | 获取计划日历统计数据 |
| GET  | `/api/tasks/:planId/:date` | 获取指定日期任务列表 |
| POST | `/api/tasks` | 创建任务（同名+重叠检测） |
| PUT  | `/api/tasks/:id` | 更新任务（同名+重叠检测） |
| PATCH | `/api/tasks/:id/toggle` | 切换任务完成状态 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| POST | `/api/tasks/batch` | 批量填充任务（支持三种冲突模式） |
| POST | `/api/tasks/batch-simple` | 简单批量创建（用于多选模式） |
| POST | `/api/tasks/upload` | 上传文件 |
| GET  | `/api/backup/export` | 导出数据 ZIP |
| POST | `/api/backup/restore` | 恢复数据 |

## 数据库表结构

- **users** — 用户（用户名、密码哈希）
- **plans** — 学习计划（名称、起止日期，关联用户）
- **tasks** — 任务（日期、开始小时、结束小时、描述、完成状态，关联计划）
- **submissions** — 作业提交（文本内容或文件路径，关联任务）
