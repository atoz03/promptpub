import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db, tags, promptTags } from '../db';
import { eq, and, sql, asc } from 'drizzle-orm';
import { authMiddleware, checkWorkspaceAccess } from '../middleware/auth';

const tagsRouter = new Hono();

tagsRouter.use('*', authMiddleware);

// 创建标签验证
const createTagSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1, '标签名称不能为空'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确').optional(),
});

// 更新标签验证
const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确').optional(),
});

// 获取标签列表
tagsRouter.get('/', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.query('workspaceId');

  if (!workspaceId) {
    return c.json({ error: '请提供工作空间ID' }, 400);
  }

  // 检查权限
  const access = await checkWorkspaceAccess(user.id, workspaceId);
  if (!access.hasAccess) {
    return c.json({ error: '无权访问该工作空间' }, 403);
  }

  try {
    const tagList = await db.select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
    })
      .from(tags)
      .where(eq(tags.workspaceId, workspaceId))
      .orderBy(asc(tags.name));

    // 获取每个标签的使用次数
    const usageCounts = await db.select({
      tagId: promptTags.tagId,
      count: sql<number>`count(*)`,
    })
      .from(promptTags)
      .groupBy(promptTags.tagId);

    const countMap = new Map(usageCounts.map(u => [u.tagId, u.count]));

    const result = tagList.map(tag => ({
      ...tag,
      usageCount: countMap.get(tag.id) || 0,
    }));

    return c.json({ tags: result });
  } catch (error) {
    console.error('获取标签列表错误:', error);
    return c.json({ error: '获取标签列表失败' }, 500);
  }
});

// 创建标签
tagsRouter.post('/', async (c) => {
  const user = c.get('user');

  try {
    const body = await c.req.json();
    const data = createTagSchema.parse(body);

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, data.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权在该工作空间创建标签' }, 403);
    }

    // 检查标签名是否已存在
    const existingTag = await db.query.tags.findFirst({
      where: and(
        eq(tags.workspaceId, data.workspaceId),
        eq(tags.name, data.name)
      ),
    });

    if (existingTag) {
      return c.json({ error: '该标签名已存在' }, 400);
    }

    const tagId = nanoid();

    await db.insert(tags).values({
      id: tagId,
      workspaceId: data.workspaceId,
      name: data.name,
      color: data.color || '#6366f1',
    });

    return c.json({
      message: '创建成功',
      tag: { id: tagId, name: data.name, color: data.color || '#6366f1' },
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('创建标签错误:', error);
    return c.json({ error: '创建标签失败' }, 500);
  }
});

// 批量创建标签
tagsRouter.post('/batch', async (c) => {
  const user = c.get('user');

  try {
    const { workspaceId, tags: tagNames } = await c.req.json();

    if (!workspaceId || !Array.isArray(tagNames)) {
      return c.json({ error: '参数不正确' }, 400);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权在该工作空间创建标签' }, 403);
    }

    // 获取已存在的标签
    const existingTags = await db.select({ name: tags.name })
      .from(tags)
      .where(eq(tags.workspaceId, workspaceId));

    const existingNames = new Set(existingTags.map(t => t.name));

    // 过滤出不存在的标签
    const newTagNames = tagNames.filter(name => !existingNames.has(name));

    if (newTagNames.length === 0) {
      return c.json({ message: '所有标签已存在', created: [] });
    }

    // 预定义的颜色列表
    const colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
      '#f97316', '#eab308', '#22c55e', '#14b8a6',
      '#06b6d4', '#3b82f6',
    ];

    const newTags = newTagNames.map((name, index) => ({
      id: nanoid(),
      workspaceId,
      name,
      color: colors[index % colors.length],
    }));

    await db.insert(tags).values(newTags);

    return c.json({
      message: '创建成功',
      created: newTags.map(t => ({ id: t.id, name: t.name, color: t.color })),
    }, 201);
  } catch (error) {
    console.error('批量创建标签错误:', error);
    return c.json({ error: '批量创建标签失败' }, 500);
  }
});

// 更新标签
tagsRouter.put('/:id', async (c) => {
  const user = c.get('user');
  const tagId = c.req.param('id');

  try {
    const body = await c.req.json();
    const data = updateTagSchema.parse(body);

    const existingTag = await db.query.tags.findFirst({
      where: eq(tags.id, tagId),
    });

    if (!existingTag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, existingTag.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权修改该标签' }, 403);
    }

    // 如果修改名称，检查是否与其他标签重名
    if (data.name && data.name !== existingTag.name) {
      const duplicateTag = await db.query.tags.findFirst({
        where: and(
          eq(tags.workspaceId, existingTag.workspaceId),
          eq(tags.name, data.name)
        ),
      });

      if (duplicateTag) {
        return c.json({ error: '该标签名已存在' }, 400);
      }
    }

    await db.update(tags)
      .set({
        name: data.name || existingTag.name,
        color: data.color || existingTag.color,
      })
      .where(eq(tags.id, tagId));

    return c.json({ message: '更新成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('更新标签错误:', error);
    return c.json({ error: '更新标签失败' }, 500);
  }
});

// 删除标签
tagsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const tagId = c.req.param('id');

  try {
    const existingTag = await db.query.tags.findFirst({
      where: eq(tags.id, tagId),
    });

    if (!existingTag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, existingTag.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权删除该标签' }, 403);
    }

    // 删除标签（关联关系会自动级联删除）
    await db.delete(tags).where(eq(tags.id, tagId));

    return c.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除标签错误:', error);
    return c.json({ error: '删除标签失败' }, 500);
  }
});

// 合并标签
tagsRouter.post('/:id/merge', async (c) => {
  const user = c.get('user');
  const sourceTagId = c.req.param('id');
  const { targetTagId } = await c.req.json();

  if (!targetTagId) {
    return c.json({ error: '请提供目标标签ID' }, 400);
  }

  try {
    const sourceTag = await db.query.tags.findFirst({
      where: eq(tags.id, sourceTagId),
    });

    const targetTag = await db.query.tags.findFirst({
      where: eq(tags.id, targetTagId),
    });

    if (!sourceTag || !targetTag) {
      return c.json({ error: '标签不存在' }, 404);
    }

    if (sourceTag.workspaceId !== targetTag.workspaceId) {
      return c.json({ error: '不能合并不同工作空间的标签' }, 400);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, sourceTag.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权操作该标签' }, 403);
    }

    // 获取源标签的所有关联
    const sourcePromptTags = await db.select()
      .from(promptTags)
      .where(eq(promptTags.tagId, sourceTagId));

    // 获取目标标签已有的关联
    const targetPromptIds = await db.select({ promptId: promptTags.promptId })
      .from(promptTags)
      .where(eq(promptTags.tagId, targetTagId));

    const existingPromptIds = new Set(targetPromptIds.map(t => t.promptId));

    // 将源标签的关联迁移到目标标签（跳过已存在的）
    const newAssociations = sourcePromptTags
      .filter(pt => !existingPromptIds.has(pt.promptId))
      .map(pt => ({
        id: nanoid(),
        promptId: pt.promptId,
        tagId: targetTagId,
      }));

    if (newAssociations.length > 0) {
      await db.insert(promptTags).values(newAssociations);
    }

    // 删除源标签
    await db.delete(tags).where(eq(tags.id, sourceTagId));

    return c.json({
      message: '合并成功',
      merged: sourcePromptTags.length,
      added: newAssociations.length,
    });
  } catch (error) {
    console.error('合并标签错误:', error);
    return c.json({ error: '合并标签失败' }, 500);
  }
});

export default tagsRouter;
