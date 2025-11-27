import { Context, Next } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { db, users, workspaceMembers } from '../db';
import { eq, and } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'promptpub-secret-key-change-in-production'
);

export interface JWTPayload {
  userId: string;
  email: string;
  exp?: number;
}

// 生成 JWT Token
export async function generateToken(payload: Omit<JWTPayload, 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

// 验证 JWT Token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// 认证中间件
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未提供认证令牌' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: '无效或过期的令牌' }, 401);
  }

  // 获取用户信息
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });

  if (!user) {
    return c.json({ error: '用户不存在' }, 401);
  }

  // 将用户信息存储在上下文中
  c.set('user', {
    id: user.id,
    email: user.email,
    name: user.name,
  });

  await next();
}

// 工作空间权限检查
export async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string,
  requiredRole?: 'owner' | 'editor' | 'viewer'
): Promise<{ hasAccess: boolean; role?: string }> {
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });

  if (!member) {
    return { hasAccess: false };
  }

  const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };

  if (requiredRole && roleHierarchy[member.role] < roleHierarchy[requiredRole]) {
    return { hasAccess: false, role: member.role };
  }

  return { hasAccess: true, role: member.role };
}

// 类型扩展
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: string;
      email: string;
      name: string;
    };
  }
}
