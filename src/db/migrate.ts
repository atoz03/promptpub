import { sqlite } from './index';

// 数据库初始化 SQL
const initSQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 工作空间表
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 工作空间成员表
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('owner', 'editor', 'viewer')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, user_id)
);

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, name)
);

-- 提示词表
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'workspace' CHECK(visibility IN ('private', 'workspace', 'public')),
  current_version_id TEXT,
  creator_id TEXT NOT NULL REFERENCES users(id),
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 提示词版本表
CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT,
  output_example TEXT,
  target_models TEXT,
  changelog TEXT,
  status TEXT NOT NULL DEFAULT 'current' CHECK(status IN ('current', 'history', 'experimental')),
  creator_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 提示词-标签关联表
CREATE TABLE IF NOT EXISTS prompt_tags (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(prompt_id, tag_id)
);

-- 使用日志表
CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES prompt_versions(id),
  user_id TEXT REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'web' CHECK(source IN ('web', 'api', 'plugin')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 反馈表
CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 创建索引以优化搜索
CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category_id);
CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);
CREATE INDEX IF NOT EXISTS idx_prompts_creator ON prompts(creator_id);
CREATE INDEX IF NOT EXISTS idx_prompts_title ON prompts(title);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_workspace ON tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompt_tags_prompt ON prompt_tags(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_tags_tag ON prompt_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_prompt ON usage_logs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_feedbacks_prompt ON feedbacks(prompt_id);

-- 全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
  title,
  description,
  content_from_prompts,
  content='prompts',
  content_rowid='rowid'
);
`;

export function migrate() {
  console.log('Running database migrations...');

  try {
    // 分割并执行每个 SQL 语句
    const statements = initSQL.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        sqlite.exec(statement + ';');
      }
    }
    console.log('Database migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// 如果直接运行此文件则执行迁移
if (import.meta.main) {
  migrate();
}
