# PromptPub

提示词管理与发布平台 - 为个人与团队提供统一的「提示词资产管理、协作、发布与复用」平台。

## 功能特性

### 核心功能

- **提示词管理**: 创建、编辑、删除、归档提示词模板
- **版本控制**: 自动记录历史版本，支持版本对比和一键回滚
- **变量系统**: 定义可替换变量，支持实时预览
- **Token 统计**: 自动统计提示词 Token 数量，实时显示成本估算
- **分类管理**: 多层级树形分类，灵活组织提示词
- **标签系统**: 自定义颜色标签，快速筛选
- **搜索过滤**: 全文搜索，按分类、标签、状态多维度筛选
- **一键复制**: 快速复制提示词内容，自动记录使用次数
- **导出功能**: 支持 JSON、Markdown、CSV 格式导出

### 协作功能

- **工作空间**: 支持多工作空间，团队协作
- **权限控制**: Owner/Editor/Viewer 三级权限
- **成员管理**: 邀请成员、设置角色

### 统计功能

- 提示词使用次数统计
- 最近使用时间追踪
- 工作空间数据概览

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Bun |
| 后端框架 | Hono |
| 数据库 | SQLite |
| ORM | Drizzle ORM |
| 前端框架 | React 19 |
| 构建工具 | Vite |
| CSS 框架 | TailwindCSS v4 |
| 状态管理 | Zustand |
| 路由 | React Router v7 |
| 认证 | JWT (jose) |

## 快速开始

### 环境要求

- [Bun](https://bun.sh/) >= 1.0

### 配置环境变量

首次使用前，请复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

**重要**：请务必修改以下配置：

1. **JWT_SECRET**: 生成安全的密钥
   ```bash
   # macOS/Linux
   openssl rand -hex 32

   # 或使用 Bun
   bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **PORT**: 如需修改端口（默认 7003）

### 安装依赖

```bash
# 后端依赖
bun install

# 前端依赖
cd frontend
bun install
```

### 开发模式

一键启动前后端：

```bash
bun run dev
```

- 后端 API: http://localhost:7003
- 前端页面: http://localhost:5173

访问 http://localhost:5173 开始使用。

### 生产模式

```bash
# 1. 构建前端
cd frontend
bun run build

# 2. 启动服务
cd ..
bun run start
```

访问 http://localhost:7003。

## 项目结构

```
promptpub/
├── src/                      # 后端源码
│   ├── db/                   # 数据库相关
│   │   ├── schema.ts         # 数据模型定义
│   │   ├── index.ts          # 数据库连接
│   │   └── migrate.ts        # 数据库迁移
│   ├── routes/               # API 路由
│   │   ├── auth.ts           # 认证接口
│   │   ├── prompts.ts        # 提示词接口
│   │   ├── categories.ts     # 分类接口
│   │   ├── tags.ts           # 标签接口
│   │   ├── workspaces.ts     # 工作空间接口
│   │   └── export.ts         # 导出接口
│   ├── middleware/           # 中间件
│   │   └── auth.ts           # JWT 认证中间件
│   └── index.ts              # 应用入口
├── frontend/                 # 前端源码
│   └── src/
│       ├── api/              # API 客户端
│       ├── store/            # 状态管理
│       ├── components/       # 通用组件
│       └── pages/            # 页面组件
├── data/                     # 数据库文件目录
└── package.json
```

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/me | 获取当前用户信息 |

### 提示词

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/prompts | 获取提示词列表 |
| GET | /api/prompts/:id | 获取提示词详情 |
| POST | /api/prompts | 创建提示词 |
| PUT | /api/prompts/:id | 更新提示词 |
| DELETE | /api/prompts/:id | 删除提示词 |
| POST | /api/prompts/:id/copy | 复制提示词 |
| POST | /api/prompts/:id/use | 记录使用 |
| GET | /api/prompts/:id/versions | 获取版本历史 |
| POST | /api/prompts/:id/rollback/:versionId | 回滚版本 |

### 分类

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/categories | 获取分类列表 |
| POST | /api/categories | 创建分类 |
| PUT | /api/categories/:id | 更新分类 |
| DELETE | /api/categories/:id | 删除分类 |

### 标签

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tags | 获取标签列表 |
| POST | /api/tags | 创建标签 |
| PUT | /api/tags/:id | 更新标签 |
| DELETE | /api/tags/:id | 删除标签 |

### 工作空间

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/workspaces | 获取工作空间列表 |
| GET | /api/workspaces/:id | 获取工作空间详情 |
| POST | /api/workspaces | 创建工作空间 |
| PUT | /api/workspaces/:id | 更新工作空间 |
| DELETE | /api/workspaces/:id | 删除工作空间 |
| POST | /api/workspaces/:id/members | 邀请成员 |
| PUT | /api/workspaces/:id/members/:memberId | 更新成员角色 |
| DELETE | /api/workspaces/:id/members/:memberId | 移除成员 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/export/prompts/:id | 导出单个提示词 |
| POST | /api/export/prompts/batch | 批量导出提示词 |
| GET | /api/export/workspace/:id | 导出整个工作空间 |

## 环境变量

创建 `.env` 文件（参考 `.env.example`）：

| 变量名 | 默认值 | 必填 | 说明 |
|--------|--------|------|------|
| PORT | 7003 | 否 | 服务端口 |
| JWT_SECRET | - | **是** | JWT 密钥（⚠️ 生产环境必须设置强密钥） |

⚠️ **安全提醒**：
- 生产环境必须设置强 JWT_SECRET
- 不要将 `.env` 文件提交到版本控制
- 数据库文件 `data/` 目录已被 .gitignore 忽略

## 数据模型

### 核心实体

- **User**: 用户
- **Workspace**: 工作空间
- **WorkspaceMember**: 工作空间成员
- **Prompt**: 提示词
- **PromptVersion**: 提示词版本
- **Category**: 分类
- **Tag**: 标签
- **PromptTag**: 提示词-标签关联
- **UsageLog**: 使用日志
- **Feedback**: 反馈评价

## 后续规划

根据 MVP.md 文档，后续可扩展功能：

- [ ] 审批流程
- [ ] 评论协作
- [ ] Webhook/API 外部集成
- [ ] A/B 测试
- [ ] 智能推荐
- [ ] 自动分类与标签
- [ ] 浏览器插件
- [ ] VSCode 插件

## License

MIT
