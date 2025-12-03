<div align="center">
  <img src="frontend/public/logo.svg" alt="PromptPub Logo" width="200" />
  <h1>PromptPub</h1>
  <p>提示词管理与发布平台 - 为个人与团队提供统一的「提示词资产管理、协作、发布与复用」平台</p>

  ![开发进度](https://img.shields.io/badge/开发进度-95%25-brightgreen)
  ![License](https://img.shields.io/badge/license-MIT-blue)
  ![Bun](https://img.shields.io/badge/runtime-Bun-orange)
</div>

---

## ✨ 功能特性

### 核心功能

- **提示词管理**: 创建、编辑、删除、归档提示词模板
- **版本控制**: 自动记录历史版本，支持版本对比和一键回滚
  - ✅ **版本 Diff 对比**: 可视化对比两个版本的差异（新增/删除行高亮显示）
  - ✅ 基于 LCS 算法的精确行级对比
  - ✅ 显示变更统计（+新增/-删除）
- **变量系统**: 定义可替换变量，支持实时预览
  - ✅ **变量预览替换**: 填写变量值后实时预览最终内容
  - ✅ 一键复制预览内容
  - ✅ 渐变背景突出预览区域
- **Token 统计**: 自动统计提示词 Token 数量，实时显示成本估算
- **多模型支持**: 支持标记提示词的适用模型（GPT-5、Claude Sonnet 4.5、Gemini 3 Pro 等）
- **分类管理**: 多层级树形分类，灵活组织提示词
- **标签系统**: 自定义颜色标签，快速筛选
- **搜索过滤**: 全文搜索，按分类、标签、状态多维度筛选
  - ✅ **全文搜索**: 支持搜索提示词标题、描述和正文内容
  - ✅ SQL 子查询优化，高性能检索
- **一键复制**: 快速复制提示词内容，自动记录使用次数
  - ✅ **复制反馈优化**: 图标变化（Copy → Check）+ Toast 通知
  - ✅ 2秒自动恢复
- **导出功能**: 支持 JSON、Markdown、CSV 格式导出

### UI/UX 增强

- ✅ **Toast 通知系统**: 优雅的右下角 Toast 提示，替代原生 alert
  - 滑入动画效果
  - 3秒自动消失 + 可手动关闭
  - 成功/错误状态颜色区分

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

### 开发模式（用于开发调试）

**适用场景**：正在开发新功能、修改代码、需要热重载

```bash
bun run dev
```

**特点**：
- ✅ 热重载：修改代码后自动刷新，无需重启
- ✅ 完整的错误提示和调试信息
- ⚠️ 占用资源较多，性能较慢

**访问地址**：
- 前端页面: http://localhost:5173
- 后端 API: http://localhost:7003

### 生产模式（用于日常使用）

**适用场景**：日常使用、演示、部署到生产环境

```bash
# 1. 构建前端（修改代码后需要重新构建）
cd frontend && bun run build && cd ..

# 2. 启动服务
bun run start
```

**特点**：
- ✅ 性能优化：代码已压缩合并，加载速度快
- ✅ 单端口运行，资源占用少
- ⚠️ 修改代码后需要重新构建

**访问地址**：http://localhost:7003

---

### 功能测试

详细的功能测试指南请参考 [TESTING.md](TESTING.md)，包括：

- ✅ 用户认证测试（注册/登录）
- ✅ Toast 通知测试（各种场景）
- ✅ 全文搜索测试（标题/正文搜索）
- ✅ 版本对比测试（Diff 视图）
- ✅ 变量预览测试（变量替换）
- ✅ 一键复制优化测试（视觉反馈）

---

### 命令对照表

| 操作 | 开发模式 | 生产模式 |
|------|---------|---------|
| 启动命令 | `bun run dev` | `bun run start` |
| 访问地址 | http://localhost:5173 | http://localhost:7003 |
| 修改代码后 | 自动刷新 | 需重新构建 + 重启 |
| 性能 | 慢（实时编译） | 快（已优化） |
| 适用场景 | 开发调试 | 日常使用、部署 |

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
│   │   ├── prompts.ts        # 提示词接口（含全文搜索）
│   │   ├── categories.ts     # 分类接口
│   │   ├── tags.ts           # 标签接口
│   │   ├── workspaces.ts     # 工作空间接口
│   │   └── export.ts         # 导出接口
│   ├── middleware/           # 中间件
│   │   └── auth.ts           # JWT 认证中间件
│   └── index.ts              # 应用入口
├── frontend/                 # 前端源码
│   ├── public/               # 静态资源
│   │   ├── logo.svg          # 应用 Logo
│   │   └── favicon.svg       # 浏览器图标
│   └── src/
│       ├── api/              # API 客户端
│       ├── store/            # 状态管理
│       ├── components/       # 通用组件
│       │   ├── Toast.tsx     # Toast 通知组件
│       │   └── VersionDiff.tsx  # 版本对比组件
│       └── pages/            # 页面组件
│           ├── PromptList.tsx   # 提示词列表（含搜索）
│           └── PromptDetail.tsx # 提示词详情（含版本对比、变量预览）
├── data/                     # 数据库文件目录
├── TESTING.md                # 功能测试指南
├── PROGRESS.md               # 开发进度文档
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

## 支持的 AI 模型

PromptPub 支持为提示词标记适用的 AI 模型，方便团队管理不同模型的最佳实践。

### OpenAI GPT 系列

| 模型 | 发布时间 | 特点 |
|------|---------|------|
| **GPT-5** | 2025年8月 | 最新旗舰模型，94.6% AIME 数学准确率 |
| **GPT-4.1** | 2025年 | 支持最多 100 万 tokens 上下文 |
| **GPT-4o** | 2025年 | 多模态模型，ChatGPT 当前默认 |
| **o3** | 2025年 | 高级推理模型 |
| **o4-mini** | 2025年 | 轻量级推理模型 |

### Anthropic Claude 系列

| 模型 | 发布时间 | 特点 |
|------|---------|------|
| **Claude Sonnet 4.5** | 2025年9月 | 全球最强编码模型，SWE-bench 77.2% |
| **Claude Opus 4** | 2025年5月 | 高级推理和复杂任务处理 |
| **Claude Sonnet 4** | 2025年5月 | 平衡性能与成本的最佳选择 |

### Google Gemini 系列

| 模型 | 发布时间 | 特点 |
|------|---------|------|
| **Gemini 3 Pro** | 2025年11月 | 最新旗舰模型，最佳多模态理解 |
| **Gemini 2.5 Pro** | 2025年3月 | LMArena 排名第一 |
| **Gemini 2.5 Flash** | 2025年3月 | 高性能 + 快速响应 |

### 其他模型

- **Llama 3**: Meta 开源模型
- **DeepSeek**: 高性能中文模型
- **Grok 4**: xAI 最新模型，支持 200 万 tokens 上下文

> **提示**: 模型列表会持续更新，以支持最新发布的 AI 模型。

## 常见问题

### Q: 前端页面空白或显示错误？

1. 清除浏览器缓存和 localStorage：
   ```javascript
   // 在浏览器控制台（F12）执行
   localStorage.clear()
   ```
2. 重新构建前端：
   ```bash
   cd frontend && bun run build && cd ..
   ```
3. 检查浏览器控制台是否有错误信息

### Q: 端口被占用怎么办？

修改 `.env` 文件中的 `PORT` 值：
```bash
PORT=8080  # 改为其他端口
```

### Q: 如何重置数据库？

删除 `data/` 目录下的数据库文件，重启服务会自动重建：
```bash
rm -rf data/*.db
bun run start
```

### Q: 修改代码后页面没有变化？

- **开发模式**：应该自动刷新，如果没有，检查终端是否有编译错误
- **生产模式**：需要重新构建前端：
  ```bash
  cd frontend && bun run build && cd ..
  ```

## 开发进度

当前进度：**95%**（详见 [PROGRESS.md](PROGRESS.md)）

### v1.1.0 已完成（2025年）

- ✅ Toast 通知系统（替代 alert）
- ✅ 全文搜索（支持搜索提示词正文内容）
- ✅ 版本对比 Diff 视图（基于 LCS 算法）
- ✅ 变量预览替换功能
- ✅ 一键复制优化（视觉反馈）
- ✅ Logo 和 Favicon 设计

### v1.0.0 核心功能（已完成）

- ✅ 用户认证系统
- ✅ 提示词 CRUD
- ✅ 版本控制
- ✅ 变量系统
- ✅ 分类管理
- ✅ 标签系统
- ✅ 工作空间
- ✅ 导出功能

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
