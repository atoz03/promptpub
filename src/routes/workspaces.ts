import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db, workspaces, workspaceMembers, users, prompts, categories, tags } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { authMiddleware, checkWorkspaceAccess } from '../middleware/auth';

const workspacesRouter = new Hono();

workspacesRouter.use('*', authMiddleware);

// 创建工作空间验证
const createWorkspaceSchema = z.object({
  name: z.string().min(1, '工作空间名称不能为空'),
  description: z.string().optional(),
});

// 更新工作空间验证
const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
});

// 获取用户的所有工作空间
workspacesRouter.get('/', async (c) => {
  const user = c.get('user');

  try {
    const memberRecords = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, user.id),
      with: {
        workspace: true,
      },
    });

    // 获取每个工作空间的统计信息
    const result = await Promise.all(
      memberRecords.map(async (m) => {
        const [promptCount] = await db.select({ count: sql<number>`count(*)` })
          .from(prompts)
          .where(eq(prompts.workspaceId, m.workspace.id));

        const [memberCount] = await db.select({ count: sql<number>`count(*)` })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, m.workspace.id));

        return {
          id: m.workspace.id,
          name: m.workspace.name,
          description: m.workspace.description,
          role: m.role,
          promptCount: promptCount.count,
          memberCount: memberCount.count,
          createdAt: m.workspace.createdAt,
        };
      })
    );

    return c.json({ workspaces: result });
  } catch (error) {
    console.error('获取工作空间列表错误:', error);
    return c.json({ error: '获取工作空间列表失败' }, 500);
  }
});

// 获取单个工作空间详情
workspacesRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');

  try {
    // 检查权限
    const access = await checkWorkspaceAccess(user.id, workspaceId);
    if (!access.hasAccess) {
      return c.json({ error: '无权访问该工作空间' }, 403);
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!workspace) {
      return c.json({ error: '工作空间不存在' }, 404);
    }

    // 获取成员列表
    const members = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // 获取统计信息
    const [promptStats] = await db.select({
      total: sql<number>`count(*)`,
      published: sql<number>`sum(case when status = 'published' then 1 else 0 end)`,
      draft: sql<number>`sum(case when status = 'draft' then 1 else 0 end)`,
    })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId));

    const [categoryCount] = await db.select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(eq(categories.workspaceId, workspaceId));

    const [tagCount] = await db.select({ count: sql<number>`count(*)` })
      .from(tags)
      .where(eq(tags.workspaceId, workspaceId));

    return c.json({
      ...workspace,
      role: access.role,
      members: members.map(m => ({
        ...m.user,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      stats: {
        prompts: {
          total: promptStats.total || 0,
          published: promptStats.published || 0,
          draft: promptStats.draft || 0,
        },
        categories: categoryCount.count,
        tags: tagCount.count,
        members: members.length,
      },
    });
  } catch (error) {
    console.error('获取工作空间详情错误:', error);
    return c.json({ error: '获取工作空间详情失败' }, 500);
  }
});

// 创建工作空间
workspacesRouter.post('/', async (c) => {
  const user = c.get('user');

  try {
    const body = await c.req.json();
    const data = createWorkspaceSchema.parse(body);

    const workspaceId = nanoid();

    await db.insert(workspaces).values({
      id: workspaceId,
      name: data.name,
      description: data.description || null,
      ownerId: user.id,
    });

    // 添加创建者为所有者
    await db.insert(workspaceMembers).values({
      id: nanoid(),
      workspaceId,
      userId: user.id,
      role: 'owner',
    });

    return c.json({
      message: '创建成功',
      workspace: { id: workspaceId, name: data.name },
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('创建工作空间错误:', error);
    return c.json({ error: '创建工作空间失败' }, 500);
  }
});

// 更新工作空间
workspacesRouter.put('/:id', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const data = updateWorkspaceSchema.parse(body);

    // 检查权限（只有 owner 可以修改）
    const access = await checkWorkspaceAccess(user.id, workspaceId, 'owner');
    if (!access.hasAccess) {
      return c.json({ error: '无权修改该工作空间' }, 403);
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });

    if (!workspace) {
      return c.json({ error: '工作空间不存在' }, 404);
    }

    await db.update(workspaces)
      .set({
        name: data.name || workspace.name,
        description: data.description !== undefined ? data.description : workspace.description,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));

    return c.json({ message: '更新成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('更新工作空间错误:', error);
    return c.json({ error: '更新工作空间失败' }, 500);
  }
});

// 删除工作空间
workspacesRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');

  try {
    // 检查权限（只有 owner 可以删除）
    const access = await checkWorkspaceAccess(user.id, workspaceId, 'owner');
    if (!access.hasAccess) {
      return c.json({ error: '无权删除该工作空间' }, 403);
    }

    // 检查是否是用户唯一的工作空间
    const userWorkspaces = await db.select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, user.id));

    if (userWorkspaces[0].count <= 1) {
      return c.json({ error: '不能删除唯一的工作空间' }, 400);
    }

    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    return c.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除工作空间错误:', error);
    return c.json({ error: '删除工作空间失败' }, 500);
  }
});

// 邀请成员
workspacesRouter.post('/:id/members', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const { email, role = 'viewer' } = await c.req.json();

  try {
    // 检查权限（只有 owner 可以邀请）
    const access = await checkWorkspaceAccess(user.id, workspaceId, 'owner');
    if (!access.hasAccess) {
      return c.json({ error: '无权邀请成员' }, 403);
    }

    // 查找用户
    const invitedUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!invitedUser) {
      return c.json({ error: '用户不存在' }, 404);
    }

    // 检查是否已经是成员
    const existingMember = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, invitedUser.id)
      ),
    });

    if (existingMember) {
      return c.json({ error: '该用户已经是成员' }, 400);
    }

    await db.insert(workspaceMembers).values({
      id: nanoid(),
      workspaceId,
      userId: invitedUser.id,
      role: role as 'owner' | 'editor' | 'viewer',
    });

    return c.json({
      message: '邀请成功',
      member: {
        id: invitedUser.id,
        name: invitedUser.name,
        email: invitedUser.email,
        role,
      },
    });
  } catch (error) {
    console.error('邀请成员错误:', error);
    return c.json({ error: '邀请成员失败' }, 500);
  }
});

// 更新成员角色
workspacesRouter.put('/:id/members/:memberId', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const memberId = c.req.param('memberId');
  const { role } = await c.req.json();

  try {
    // 检查权限（只有 owner 可以修改角色）
    const access = await checkWorkspaceAccess(user.id, workspaceId, 'owner');
    if (!access.hasAccess) {
      return c.json({ error: '无权修改成员角色' }, 403);
    }

    // 不能修改自己的角色
    if (memberId === user.id) {
      return c.json({ error: '不能修改自己的角色' }, 400);
    }

    await db.update(workspaceMembers)
      .set({ role })
      .where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, memberId)
      ));

    return c.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新成员角色错误:', error);
    return c.json({ error: '更新成员角色失败' }, 500);
  }
});

// 移除成员
workspacesRouter.delete('/:id/members/:memberId', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const memberId = c.req.param('memberId');

  try {
    // 检查权限（只有 owner 可以移除成员）
    const access = await checkWorkspaceAccess(user.id, workspaceId, 'owner');
    if (!access.hasAccess) {
      return c.json({ error: '无权移除成员' }, 403);
    }

    // 不能移除自己
    if (memberId === user.id) {
      return c.json({ error: '不能移除自己' }, 400);
    }

    await db.delete(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, memberId)
      ));

    return c.json({ message: '移除成功' });
  } catch (error) {
    console.error('移除成员错误:', error);
    return c.json({ error: '移除成员失败' }, 500);
  }
});

// 获取工作空间统计
workspacesRouter.get('/:id/stats', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const days = parseInt(c.req.query('days') || '30');

  try {
    // 检查权限
    const access = await checkWorkspaceAccess(user.id, workspaceId);
    if (!access.hasAccess) {
      return c.json({ error: '无权访问该工作空间' }, 403);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // 获取最常使用的提示词
    const topPrompts = await db.select({
      id: prompts.id,
      title: prompts.title,
      usageCount: prompts.usageCount,
    })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId))
      .orderBy(desc(prompts.usageCount))
      .limit(10);

    // 获取最近更新的提示词
    const recentPrompts = await db.select({
      id: prompts.id,
      title: prompts.title,
      updatedAt: prompts.updatedAt,
    })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId))
      .orderBy(desc(prompts.updatedAt))
      .limit(10);

    return c.json({
      topPrompts,
      recentPrompts,
      period: {
        days,
        startDate: startDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('获取统计信息错误:', error);
    return c.json({ error: '获取统计信息失败' }, 500);
  }
});

export default workspacesRouter;
