import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db, prompts, promptVersions, promptTags, tags, usageLogs } from '../db';
import { eq, and, desc, sql, like, or, inArray } from 'drizzle-orm';
import { authMiddleware, checkWorkspaceAccess } from '../middleware/auth';

const promptsRouter = new Hono();

// 所有路由都需要认证
promptsRouter.use('*', authMiddleware);

// 创建提示词验证
const createPromptSchema = z.object({
  workspaceId: z.string(),
  categoryId: z.string().optional(),
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
  content: z.string().min(1, '提示词内容不能为空'),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    defaultValue: z.string().optional(),
  })).optional(),
  outputExample: z.string().optional(),
  targetModels: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']).optional(),
  visibility: z.enum(['private', 'workspace', 'public']).optional(),
});

// 更新提示词验证
const updatePromptSchema = z.object({
  categoryId: z.string().optional().nullable(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  content: z.string().min(1).optional(),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    defaultValue: z.string().optional(),
  })).optional(),
  outputExample: z.string().optional().nullable(),
  targetModels: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  visibility: z.enum(['private', 'workspace', 'public']).optional(),
  changelog: z.string().optional(),
});

// 获取提示词列表
promptsRouter.get('/', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.query('workspaceId');
  const categoryId = c.req.query('categoryId');
  const status = c.req.query('status');
  const search = c.req.query('search');
  const tagId = c.req.query('tagId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');

  if (!workspaceId) {
    return c.json({ error: '请提供工作空间ID' }, 400);
  }

  // 检查工作空间权限
  const access = await checkWorkspaceAccess(user.id, workspaceId);
  if (!access.hasAccess) {
    return c.json({ error: '无权访问该工作空间' }, 403);
  }

  try {
    // 构建查询条件
    const conditions = [eq(prompts.workspaceId, workspaceId)];

    if (categoryId) {
      conditions.push(eq(prompts.categoryId, categoryId));
    }

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      conditions.push(eq(prompts.status, status as 'draft' | 'published' | 'archived'));
    } else {
      // 默认不显示已归档
      conditions.push(sql`${prompts.status} != 'archived'`);
    }

    // 全文搜索：标题、描述和正文内容
    if (search) {
      // 使用子查询搜索提示词正文
      conditions.push(
        or(
          like(prompts.title, `%${search}%`),
          like(prompts.description, `%${search}%`),
          // 搜索当前版本的内容
          sql`${prompts.id} IN (
            SELECT ${promptVersions.promptId} FROM ${promptVersions}
            WHERE ${promptVersions.id} = ${prompts.currentVersionId}
            AND ${promptVersions.content} LIKE ${'%' + search + '%'}
          )`
        )!
      );
    }

    // 基础查询
    let query = db.select({
      id: prompts.id,
      title: prompts.title,
      description: prompts.description,
      status: prompts.status,
      visibility: prompts.visibility,
      categoryId: prompts.categoryId,
      usageCount: prompts.usageCount,
      lastUsedAt: prompts.lastUsedAt,
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      creatorId: prompts.creatorId,
    })
      .from(prompts)
      .where(and(...conditions))
      .orderBy(desc(prompts.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const promptList = await query;

    // 获取每个提示词的标签
    const promptIds = promptList.map(p => p.id);
    const tagData = promptIds.length > 0
      ? await db.select({
          promptId: promptTags.promptId,
          tagId: tags.id,
          tagName: tags.name,
          tagColor: tags.color,
        })
          .from(promptTags)
          .innerJoin(tags, eq(promptTags.tagId, tags.id))
          .where(inArray(promptTags.promptId, promptIds))
      : [];

    // 按标签过滤（如果指定了标签）
    let filteredPrompts = promptList;
    if (tagId) {
      const promptsWithTag = tagData.filter(t => t.tagId === tagId).map(t => t.promptId);
      filteredPrompts = promptList.filter(p => promptsWithTag.includes(p.id));
    }

    // 组合结果
    const result = filteredPrompts.map(prompt => ({
      ...prompt,
      tags: tagData
        .filter(t => t.promptId === prompt.id)
        .map(t => ({ id: t.tagId, name: t.tagName, color: t.tagColor })),
    }));

    // 获取总数
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(prompts)
      .where(and(...conditions));

    return c.json({
      prompts: result,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('获取提示词列表错误:', error);
    return c.json({ error: '获取提示词列表失败' }, 500);
  }
});

// 获取单个提示词详情
promptsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');

  try {
    const prompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
      with: {
        category: true,
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        versions: {
          orderBy: desc(promptVersions.createdAt),
        },
        promptTags: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!prompt) {
      return c.json({ error: '提示词不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, prompt.workspaceId);
    if (!access.hasAccess && prompt.visibility !== 'public') {
      return c.json({ error: '无权访问该提示词' }, 403);
    }

    // 获取当前版本内容
    const currentVersion = prompt.currentVersionId
      ? prompt.versions.find(v => v.id === prompt.currentVersionId)
      : prompt.versions[0];

    return c.json({
      ...prompt,
      currentVersion,
      tags: prompt.promptTags.map(pt => pt.tag),
    });
  } catch (error) {
    console.error('获取提示词详情错误:', error);
    return c.json({ error: '获取提示词详情失败' }, 500);
  }
});

// 创建提示词
promptsRouter.post('/', async (c) => {
  const user = c.get('user');

  try {
    const body = await c.req.json();
    const data = createPromptSchema.parse(body);

    // 检查工作空间权限
    const access = await checkWorkspaceAccess(user.id, data.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权在该工作空间创建提示词' }, 403);
    }

    const promptId = nanoid();
    const versionId = nanoid();

    // 创建提示词
    await db.insert(prompts).values({
      id: promptId,
      workspaceId: data.workspaceId,
      categoryId: data.categoryId || null,
      title: data.title,
      description: data.description || null,
      status: data.status || 'draft',
      visibility: data.visibility || 'workspace',
      currentVersionId: versionId,
      creatorId: user.id,
    });

    // 创建第一个版本
    await db.insert(promptVersions).values({
      id: versionId,
      promptId,
      version: 'v1.0',
      content: data.content,
      variables: data.variables ? JSON.stringify(data.variables) : null,
      outputExample: data.outputExample || null,
      targetModels: data.targetModels ? JSON.stringify(data.targetModels) : null,
      changelog: '初始版本',
      status: 'current',
      creatorId: user.id,
    });

    // 添加标签
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(promptTags).values(
        data.tagIds.map(tagId => ({
          id: nanoid(),
          promptId,
          tagId,
        }))
      );
    }

    return c.json({
      message: '创建成功',
      prompt: {
        id: promptId,
        versionId,
      },
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('创建提示词错误:', error);
    return c.json({ error: '创建提示词失败' }, 500);
  }
});

// 更新提示词（创建新版本）
promptsRouter.put('/:id', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');

  try {
    const body = await c.req.json();
    const data = updatePromptSchema.parse(body);

    // 获取现有提示词
    const existingPrompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
      with: {
        versions: {
          orderBy: desc(promptVersions.createdAt),
          limit: 1,
        },
      },
    });

    if (!existingPrompt) {
      return c.json({ error: '提示词不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, existingPrompt.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权修改该提示词' }, 403);
    }

    // 如果内容有变化，创建新版本
    let newVersionId = existingPrompt.currentVersionId;
    if (data.content) {
      const latestVersion = existingPrompt.versions[0];
      const versionNumber = latestVersion
        ? incrementVersion(latestVersion.version)
        : 'v1.0';

      newVersionId = nanoid();

      // 将旧版本标记为历史
      if (latestVersion) {
        await db.update(promptVersions)
          .set({ status: 'history' })
          .where(eq(promptVersions.id, latestVersion.id));
      }

      // 创建新版本
      await db.insert(promptVersions).values({
        id: newVersionId,
        promptId,
        version: versionNumber,
        content: data.content,
        variables: data.variables ? JSON.stringify(data.variables) : latestVersion?.variables,
        outputExample: data.outputExample !== undefined ? data.outputExample : latestVersion?.outputExample,
        targetModels: data.targetModels ? JSON.stringify(data.targetModels) : latestVersion?.targetModels,
        changelog: data.changelog || '更新内容',
        status: 'current',
        creatorId: user.id,
      });
    }

    // 更新提示词基础信息
    await db.update(prompts)
      .set({
        categoryId: data.categoryId !== undefined ? data.categoryId : existingPrompt.categoryId,
        title: data.title || existingPrompt.title,
        description: data.description !== undefined ? data.description : existingPrompt.description,
        status: data.status || existingPrompt.status,
        visibility: data.visibility || existingPrompt.visibility,
        currentVersionId: newVersionId,
        updatedAt: new Date(),
      })
      .where(eq(prompts.id, promptId));

    // 更新标签
    if (data.tagIds !== undefined) {
      // 删除旧标签
      await db.delete(promptTags).where(eq(promptTags.promptId, promptId));

      // 添加新标签
      if (data.tagIds.length > 0) {
        await db.insert(promptTags).values(
          data.tagIds.map(tagId => ({
            id: nanoid(),
            promptId,
            tagId,
          }))
        );
      }
    }

    return c.json({ message: '更新成功', versionId: newVersionId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('更新提示词错误:', error);
    return c.json({ error: '更新提示词失败' }, 500);
  }
});

// 删除提示词
promptsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');

  try {
    const existingPrompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
    });

    if (!existingPrompt) {
      return c.json({ error: '提示词不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, existingPrompt.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权删除该提示词' }, 403);
    }

    await db.delete(prompts).where(eq(prompts.id, promptId));

    return c.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除提示词错误:', error);
    return c.json({ error: '删除提示词失败' }, 500);
  }
});

// 复制提示词
promptsRouter.post('/:id/copy', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');
  const { workspaceId } = await c.req.json();

  try {
    const sourcePrompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
      with: {
        versions: {
          where: eq(promptVersions.status, 'current'),
          limit: 1,
        },
        promptTags: true,
      },
    });

    if (!sourcePrompt) {
      return c.json({ error: '源提示词不存在' }, 404);
    }

    // 检查目标工作空间权限
    const targetWsId = workspaceId || sourcePrompt.workspaceId;
    const access = await checkWorkspaceAccess(user.id, targetWsId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权在目标工作空间创建提示词' }, 403);
    }

    const newPromptId = nanoid();
    const newVersionId = nanoid();
    const currentVersion = sourcePrompt.versions[0];

    // 创建新提示词
    await db.insert(prompts).values({
      id: newPromptId,
      workspaceId: targetWsId,
      categoryId: sourcePrompt.categoryId,
      title: `${sourcePrompt.title} (副本)`,
      description: sourcePrompt.description,
      status: 'draft',
      visibility: 'workspace',
      currentVersionId: newVersionId,
      creatorId: user.id,
    });

    // 复制当前版本
    if (currentVersion) {
      await db.insert(promptVersions).values({
        id: newVersionId,
        promptId: newPromptId,
        version: 'v1.0',
        content: currentVersion.content,
        variables: currentVersion.variables,
        outputExample: currentVersion.outputExample,
        targetModels: currentVersion.targetModels,
        changelog: '从其他提示词复制',
        status: 'current',
        creatorId: user.id,
      });
    }

    return c.json({
      message: '复制成功',
      prompt: { id: newPromptId },
    }, 201);
  } catch (error) {
    console.error('复制提示词错误:', error);
    return c.json({ error: '复制提示词失败' }, 500);
  }
});

// 记录使用
promptsRouter.post('/:id/use', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');
  const { source = 'web' } = await c.req.json().catch(() => ({}));

  try {
    const prompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
    });

    if (!prompt) {
      return c.json({ error: '提示词不存在' }, 404);
    }

    // 记录使用日志
    await db.insert(usageLogs).values({
      id: nanoid(),
      promptId,
      versionId: prompt.currentVersionId,
      userId: user.id,
      source: source as 'web' | 'api' | 'plugin',
    });

    // 更新使用统计
    await db.update(prompts)
      .set({
        usageCount: prompt.usageCount + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(prompts.id, promptId));

    return c.json({ message: '记录成功' });
  } catch (error) {
    console.error('记录使用错误:', error);
    return c.json({ error: '记录使用失败' }, 500);
  }
});

// 获取版本历史
promptsRouter.get('/:id/versions', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');

  try {
    const prompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
    });

    if (!prompt) {
      return c.json({ error: '提示词不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, prompt.workspaceId);
    if (!access.hasAccess && prompt.visibility !== 'public') {
      return c.json({ error: '无权访问该提示词' }, 403);
    }

    const versions = await db.query.promptVersions.findMany({
      where: eq(promptVersions.promptId, promptId),
      orderBy: desc(promptVersions.createdAt),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return c.json({ versions });
  } catch (error) {
    console.error('获取版本历史错误:', error);
    return c.json({ error: '获取版本历史失败' }, 500);
  }
});

// 回滚到指定版本
promptsRouter.post('/:id/rollback/:versionId', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');
  const versionId = c.req.param('versionId');

  try {
    const prompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
    });

    if (!prompt) {
      return c.json({ error: '提示词不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, prompt.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权修改该提示词' }, 403);
    }

    const targetVersion = await db.query.promptVersions.findFirst({
      where: and(
        eq(promptVersions.id, versionId),
        eq(promptVersions.promptId, promptId)
      ),
    });

    if (!targetVersion) {
      return c.json({ error: '版本不存在' }, 404);
    }

    // 将当前版本标记为历史
    if (prompt.currentVersionId) {
      await db.update(promptVersions)
        .set({ status: 'history' })
        .where(eq(promptVersions.id, prompt.currentVersionId));
    }

    // 创建新版本（基于目标版本）
    const newVersionId = nanoid();
    const latestVersions = await db.query.promptVersions.findMany({
      where: eq(promptVersions.promptId, promptId),
      orderBy: desc(promptVersions.createdAt),
      limit: 1,
    });

    const newVersionNumber = latestVersions[0]
      ? incrementVersion(latestVersions[0].version)
      : 'v1.0';

    await db.insert(promptVersions).values({
      id: newVersionId,
      promptId,
      version: newVersionNumber,
      content: targetVersion.content,
      variables: targetVersion.variables,
      outputExample: targetVersion.outputExample,
      targetModels: targetVersion.targetModels,
      changelog: `回滚到 ${targetVersion.version}`,
      status: 'current',
      creatorId: user.id,
    });

    // 更新提示词
    await db.update(prompts)
      .set({
        currentVersionId: newVersionId,
        updatedAt: new Date(),
      })
      .where(eq(prompts.id, promptId));

    return c.json({
      message: '回滚成功',
      versionId: newVersionId,
    });
  } catch (error) {
    console.error('回滚版本错误:', error);
    return c.json({ error: '回滚版本失败' }, 500);
  }
});

// 辅助函数：递增版本号
function incrementVersion(version: string): string {
  const match = version.match(/v(\d+)\.(\d+)/);
  if (!match) return 'v1.1';

  const [, major, minor] = match;
  return `v${major}.${parseInt(minor) + 1}`;
}

export default promptsRouter;
