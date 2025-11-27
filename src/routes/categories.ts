import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db, categories, prompts } from '../db';
import { eq, and, asc, sql } from 'drizzle-orm';
import { authMiddleware, checkWorkspaceAccess } from '../middleware/auth';

const categoriesRouter = new Hono();

categoriesRouter.use('*', authMiddleware);

// 创建分类验证
const createCategorySchema = z.object({
  workspaceId: z.string(),
  parentId: z.string().optional(),
  name: z.string().min(1, '分类名称不能为空'),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
});

// 更新分类验证
const updateCategorySchema = z.object({
  parentId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
});

// 获取分类列表（树形结构）
categoriesRouter.get('/', async (c) => {
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
    const categoryList = await db.select({
      id: categories.id,
      parentId: categories.parentId,
      name: categories.name,
      description: categories.description,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
    })
      .from(categories)
      .where(eq(categories.workspaceId, workspaceId))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    // 获取每个分类下的提示词数量
    const promptCounts = await db.select({
      categoryId: prompts.categoryId,
      count: sql<number>`count(*)`,
    })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId))
      .groupBy(prompts.categoryId);

    const countMap = new Map(promptCounts.map(p => [p.categoryId, p.count]));

    // 构建树形结构
    const categoryTree = buildCategoryTree(
      categoryList.map(cat => ({
        ...cat,
        promptCount: countMap.get(cat.id) || 0,
      }))
    );

    return c.json({ categories: categoryTree });
  } catch (error) {
    console.error('获取分类列表错误:', error);
    return c.json({ error: '获取分类列表失败' }, 500);
  }
});

// 获取单个分类
categoriesRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const categoryId = c.req.param('id');

  try {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      return c.json({ error: '分类不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, category.workspaceId);
    if (!access.hasAccess) {
      return c.json({ error: '无权访问该分类' }, 403);
    }

    // 获取子分类
    const children = await db.select()
      .from(categories)
      .where(eq(categories.parentId, categoryId))
      .orderBy(asc(categories.sortOrder));

    // 获取提示词数量
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(prompts)
      .where(eq(prompts.categoryId, categoryId));

    return c.json({
      ...category,
      children,
      promptCount: count,
    });
  } catch (error) {
    console.error('获取分类详情错误:', error);
    return c.json({ error: '获取分类详情失败' }, 500);
  }
});

// 创建分类
categoriesRouter.post('/', async (c) => {
  const user = c.get('user');

  try {
    const body = await c.req.json();
    const data = createCategorySchema.parse(body);

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, data.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权在该工作空间创建分类' }, 403);
    }

    // 如果有父分类，检查父分类是否存在
    if (data.parentId) {
      const parentCategory = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, data.parentId),
          eq(categories.workspaceId, data.workspaceId)
        ),
      });

      if (!parentCategory) {
        return c.json({ error: '父分类不存在' }, 400);
      }
    }

    const categoryId = nanoid();

    await db.insert(categories).values({
      id: categoryId,
      workspaceId: data.workspaceId,
      parentId: data.parentId || null,
      name: data.name,
      description: data.description || null,
      sortOrder: data.sortOrder || 0,
    });

    return c.json({
      message: '创建成功',
      category: { id: categoryId },
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('创建分类错误:', error);
    return c.json({ error: '创建分类失败' }, 500);
  }
});

// 更新分类
categoriesRouter.put('/:id', async (c) => {
  const user = c.get('user');
  const categoryId = c.req.param('id');

  try {
    const body = await c.req.json();
    const data = updateCategorySchema.parse(body);

    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!existingCategory) {
      return c.json({ error: '分类不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, existingCategory.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权修改该分类' }, 403);
    }

    // 防止设置自己为父分类
    if (data.parentId === categoryId) {
      return c.json({ error: '不能将自己设为父分类' }, 400);
    }

    await db.update(categories)
      .set({
        parentId: data.parentId !== undefined ? data.parentId : existingCategory.parentId,
        name: data.name || existingCategory.name,
        description: data.description !== undefined ? data.description : existingCategory.description,
        sortOrder: data.sortOrder !== undefined ? data.sortOrder : existingCategory.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId));

    return c.json({ message: '更新成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('更新分类错误:', error);
    return c.json({ error: '更新分类失败' }, 500);
  }
});

// 删除分类
categoriesRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const categoryId = c.req.param('id');
  const { force = false, targetCategoryId } = await c.req.json().catch(() => ({}));

  try {
    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!existingCategory) {
      return c.json({ error: '分类不存在' }, 404);
    }

    // 检查权限
    const access = await checkWorkspaceAccess(user.id, existingCategory.workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权删除该分类' }, 403);
    }

    // 检查是否有子分类
    const childCategories = await db.select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, categoryId));

    if (childCategories.length > 0 && !force) {
      return c.json({
        error: '该分类下有子分类，请先删除子分类或使用强制删除',
        childCount: childCategories.length,
      }, 400);
    }

    // 检查是否有提示词
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(prompts)
      .where(eq(prompts.categoryId, categoryId));

    if (count > 0) {
      if (targetCategoryId) {
        // 迁移提示词到目标分类
        await db.update(prompts)
          .set({ categoryId: targetCategoryId })
          .where(eq(prompts.categoryId, categoryId));
      } else if (!force) {
        return c.json({
          error: '该分类下有提示词，请指定迁移目标分类或使用强制删除',
          promptCount: count,
        }, 400);
      } else {
        // 强制删除：将提示词的分类设为 null
        await db.update(prompts)
          .set({ categoryId: null })
          .where(eq(prompts.categoryId, categoryId));
      }
    }

    // 处理子分类（如果强制删除）
    if (force && childCategories.length > 0) {
      await db.update(categories)
        .set({ parentId: existingCategory.parentId })
        .where(eq(categories.parentId, categoryId));
    }

    await db.delete(categories).where(eq(categories.id, categoryId));

    return c.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除分类错误:', error);
    return c.json({ error: '删除分类失败' }, 500);
  }
});

// 辅助函数：构建树形结构
interface CategoryNode {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  promptCount: number;
  children?: CategoryNode[];
}

function buildCategoryTree(categories: CategoryNode[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // 首先将所有分类放入 map
  categories.forEach(cat => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // 构建树形结构
  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default categoriesRouter;
