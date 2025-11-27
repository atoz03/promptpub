import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 用户表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 工作空间表
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 工作空间成员表
export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull().default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 分类表（支持多层级）
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'), // 父分类ID，null表示顶级分类
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 标签表
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#6366f1'), // 默认紫色
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 提示词表（基础信息）
export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  visibility: text('visibility', { enum: ['private', 'workspace', 'public'] }).notNull().default('workspace'),
  currentVersionId: text('current_version_id'), // 当前版本ID
  creatorId: text('creator_id').notNull().references(() => users.id),
  usageCount: integer('usage_count').notNull().default(0),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 提示词版本表
export const promptVersions = sqliteTable('prompt_versions', {
  id: text('id').primaryKey(),
  promptId: text('prompt_id').notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  version: text('version').notNull(), // 如 v1.0, v1.1
  content: text('content').notNull(), // Prompt 正文
  variables: text('variables'), // JSON 格式的变量定义 [{name, description, defaultValue}]
  outputExample: text('output_example'), // 期望输出示例
  targetModels: text('target_models'), // JSON 数组，适配的模型列表
  changelog: text('changelog'), // 版本变更说明
  status: text('status', { enum: ['current', 'history', 'experimental'] }).notNull().default('current'),
  creatorId: text('creator_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 提示词-标签关联表
export const promptTags = sqliteTable('prompt_tags', {
  id: text('id').primaryKey(),
  promptId: text('prompt_id').notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

// 使用日志表
export const usageLogs = sqliteTable('usage_logs', {
  id: text('id').primaryKey(),
  promptId: text('prompt_id').notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  versionId: text('version_id').references(() => promptVersions.id),
  userId: text('user_id').references(() => users.id),
  source: text('source', { enum: ['web', 'api', 'plugin'] }).notNull().default('web'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 反馈表
export const feedbacks = sqliteTable('feedbacks', {
  id: text('id').primaryKey(),
  promptId: text('prompt_id').notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(), // 1-5 星
  comment: text('comment'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 定义关系
export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
  workspaceMembers: many(workspaceMembers),
  prompts: many(prompts),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  categories: many(categories),
  tags: many(tags),
  prompts: many(prompts),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [categories.workspaceId],
    references: [workspaces.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  prompts: many(prompts),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tags.workspaceId],
    references: [workspaces.id],
  }),
  promptTags: many(promptTags),
}));

export const promptsRelations = relations(prompts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [prompts.workspaceId],
    references: [workspaces.id],
  }),
  category: one(categories, {
    fields: [prompts.categoryId],
    references: [categories.id],
  }),
  creator: one(users, {
    fields: [prompts.creatorId],
    references: [users.id],
  }),
  currentVersion: one(promptVersions, {
    fields: [prompts.currentVersionId],
    references: [promptVersions.id],
  }),
  versions: many(promptVersions),
  promptTags: many(promptTags),
  usageLogs: many(usageLogs),
  feedbacks: many(feedbacks),
}));

export const promptVersionsRelations = relations(promptVersions, ({ one }) => ({
  prompt: one(prompts, {
    fields: [promptVersions.promptId],
    references: [prompts.id],
  }),
  creator: one(users, {
    fields: [promptVersions.creatorId],
    references: [users.id],
  }),
}));

export const promptTagsRelations = relations(promptTags, ({ one }) => ({
  prompt: one(prompts, {
    fields: [promptTags.promptId],
    references: [prompts.id],
  }),
  tag: one(tags, {
    fields: [promptTags.tagId],
    references: [tags.id],
  }),
}));
