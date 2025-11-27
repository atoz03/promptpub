import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db, users, workspaces, workspaceMembers } from '../db';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware } from '../middleware/auth';

const auth = new Hono();

// 注册请求验证
const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位'),
  name: z.string().min(1, '姓名不能为空'),
});

// 登录请求验证
const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

// 注册
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const data = registerSchema.parse(body);

    // 检查邮箱是否已存在
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (existingUser) {
      return c.json({ error: '该邮箱已被注册' }, 400);
    }

    // 创建用户
    const userId = nanoid();
    const passwordHash = await bcrypt.hash(data.password, 10);

    await db.insert(users).values({
      id: userId,
      email: data.email,
      passwordHash,
      name: data.name,
    });

    // 创建默认工作空间
    const workspaceId = nanoid();
    await db.insert(workspaces).values({
      id: workspaceId,
      name: `${data.name}的工作空间`,
      description: '默认工作空间',
      ownerId: userId,
    });

    // 添加用户为工作空间所有者
    await db.insert(workspaceMembers).values({
      id: nanoid(),
      workspaceId,
      userId,
      role: 'owner',
    });

    // 生成 Token
    const token = await generateToken({ userId, email: data.email });

    return c.json({
      message: '注册成功',
      token,
      user: {
        id: userId,
        email: data.email,
        name: data.name,
      },
      workspace: {
        id: workspaceId,
        name: `${data.name}的工作空间`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('注册错误:', error);
    return c.json({ error: '注册失败' }, 500);
  }
});

// 登录
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const data = loginSchema.parse(body);

    // 查找用户
    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (!user) {
      return c.json({ error: '邮箱或密码错误' }, 401);
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      return c.json({ error: '邮箱或密码错误' }, 401);
    }

    // 获取用户的工作空间
    const memberRecords = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, user.id),
      with: {
        workspace: true,
      },
    });

    // 生成 Token
    const token = await generateToken({ userId: user.id, email: user.email });

    return c.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      workspaces: memberRecords.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('登录错误:', error);
    return c.json({ error: '登录失败' }, 500);
  }
});

// 获取当前用户信息
auth.get('/me', authMiddleware, async (c) => {
  const currentUser = c.get('user');

  const user = await db.query.users.findFirst({
    where: eq(users.id, currentUser.id),
  });

  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }

  // 获取用户的工作空间
  const memberRecords = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, user.id),
    with: {
      workspace: true,
    },
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    workspaces: memberRecords.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      description: m.workspace.description,
      role: m.role,
    })),
  });
});

export default auth;
