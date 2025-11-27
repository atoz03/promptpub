import { Hono } from 'hono';
import { db, prompts, promptVersions, categories, tags, promptTags } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { authMiddleware, checkWorkspaceAccess } from '../middleware/auth';

const exportRouter = new Hono();

exportRouter.use('*', authMiddleware);

// 导出单个提示词
exportRouter.get('/prompts/:id', async (c) => {
  const user = c.get('user');
  const promptId = c.req.param('id');
  const format = c.req.query('format') || 'json';

  try {
    const prompt = await db.query.prompts.findFirst({
      where: eq(prompts.id, promptId),
      with: {
        category: true,
        versions: true,
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

    const currentVersion = prompt.versions.find(v => v.id === prompt.currentVersionId);

    const exportData = {
      title: prompt.title,
      description: prompt.description,
      category: prompt.category?.name,
      tags: prompt.promptTags.map(pt => pt.tag.name),
      status: prompt.status,
      currentVersion: currentVersion ? {
        version: currentVersion.version,
        content: currentVersion.content,
        variables: currentVersion.variables ? JSON.parse(currentVersion.variables) : null,
        outputExample: currentVersion.outputExample,
        targetModels: currentVersion.targetModels ? JSON.parse(currentVersion.targetModels) : null,
      } : null,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
    };

    if (format === 'markdown') {
      const md = formatAsMarkdown(exportData);
      c.header('Content-Type', 'text/markdown');
      c.header('Content-Disposition', `attachment; filename="${prompt.title}.md"`);
      return c.text(md);
    }

    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', `attachment; filename="${prompt.title}.json"`);
    return c.json(exportData);
  } catch (error) {
    console.error('导出提示词错误:', error);
    return c.json({ error: '导出失败' }, 500);
  }
});

// 批量导出提示词
exportRouter.post('/prompts/batch', async (c) => {
  const user = c.get('user');
  const { promptIds, workspaceId, format = 'json' } = await c.req.json();

  try {
    // 检查权限
    const access = await checkWorkspaceAccess(user.id, workspaceId);
    if (!access.hasAccess) {
      return c.json({ error: '无权访问该工作空间' }, 403);
    }

    const promptList = await db.query.prompts.findMany({
      where: and(
        eq(prompts.workspaceId, workspaceId),
        promptIds ? inArray(prompts.id, promptIds) : undefined
      ),
      with: {
        category: true,
        versions: true,
        promptTags: {
          with: {
            tag: true,
          },
        },
      },
    });

    const exportData = promptList.map(prompt => {
      const currentVersion = prompt.versions.find(v => v.id === prompt.currentVersionId);
      return {
        id: prompt.id,
        title: prompt.title,
        description: prompt.description,
        category: prompt.category?.name,
        tags: prompt.promptTags.map(pt => pt.tag.name),
        status: prompt.status,
        currentVersion: currentVersion ? {
          version: currentVersion.version,
          content: currentVersion.content,
          variables: currentVersion.variables ? JSON.parse(currentVersion.variables) : null,
          outputExample: currentVersion.outputExample,
          targetModels: currentVersion.targetModels ? JSON.parse(currentVersion.targetModels) : null,
        } : null,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
      };
    });

    if (format === 'csv') {
      const csv = formatAsCSV(exportData);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="prompts.csv"');
      return c.text(csv);
    }

    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', 'attachment; filename="prompts.json"');
    return c.json({ prompts: exportData, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('批量导出错误:', error);
    return c.json({ error: '导出失败' }, 500);
  }
});

// 导出整个工作空间
exportRouter.get('/workspace/:id', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');

  try {
    // 检查权限
    const access = await checkWorkspaceAccess(user.id, workspaceId, 'editor');
    if (!access.hasAccess) {
      return c.json({ error: '无权导出该工作空间' }, 403);
    }

    // 获取所有数据
    const [allCategories, allTags, allPrompts] = await Promise.all([
      db.query.categories.findMany({
        where: eq(categories.workspaceId, workspaceId),
      }),
      db.query.tags.findMany({
        where: eq(tags.workspaceId, workspaceId),
      }),
      db.query.prompts.findMany({
        where: eq(prompts.workspaceId, workspaceId),
        with: {
          versions: true,
          promptTags: true,
        },
      }),
    ]);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      categories: allCategories.map(cat => ({
        id: cat.id,
        parentId: cat.parentId,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
      })),
      tags: allTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      })),
      prompts: allPrompts.map(prompt => ({
        id: prompt.id,
        categoryId: prompt.categoryId,
        title: prompt.title,
        description: prompt.description,
        status: prompt.status,
        visibility: prompt.visibility,
        tagIds: prompt.promptTags.map(pt => pt.tagId),
        versions: prompt.versions.map(v => ({
          id: v.id,
          version: v.version,
          content: v.content,
          variables: v.variables,
          outputExample: v.outputExample,
          targetModels: v.targetModels,
          changelog: v.changelog,
          status: v.status,
          createdAt: v.createdAt,
        })),
        currentVersionId: prompt.currentVersionId,
        usageCount: prompt.usageCount,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
      })),
    };

    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', 'attachment; filename="workspace-backup.json"');
    return c.json(exportData);
  } catch (error) {
    console.error('导出工作空间错误:', error);
    return c.json({ error: '导出失败' }, 500);
  }
});

// 辅助函数：格式化为 Markdown
function formatAsMarkdown(data: any): string {
  let md = `# ${data.title}\n\n`;

  if (data.description) {
    md += `> ${data.description}\n\n`;
  }

  if (data.category) {
    md += `**分类**: ${data.category}\n\n`;
  }

  if (data.tags && data.tags.length > 0) {
    md += `**标签**: ${data.tags.join(', ')}\n\n`;
  }

  md += `---\n\n`;

  if (data.currentVersion) {
    md += `## 提示词内容 (${data.currentVersion.version})\n\n`;
    md += '```\n' + data.currentVersion.content + '\n```\n\n';

    if (data.currentVersion.variables && data.currentVersion.variables.length > 0) {
      md += `### 变量\n\n`;
      data.currentVersion.variables.forEach((v: any) => {
        md += `- **${v.name}**: ${v.description || '无描述'}`;
        if (v.defaultValue) {
          md += ` (默认值: ${v.defaultValue})`;
        }
        md += '\n';
      });
      md += '\n';
    }

    if (data.currentVersion.targetModels && data.currentVersion.targetModels.length > 0) {
      md += `### 适用模型\n\n`;
      md += data.currentVersion.targetModels.join(', ') + '\n\n';
    }

    if (data.currentVersion.outputExample) {
      md += `### 输出示例\n\n`;
      md += '```\n' + data.currentVersion.outputExample + '\n```\n\n';
    }
  }

  md += `---\n\n`;
  md += `*导出时间: ${new Date().toISOString()}*\n`;

  return md;
}

// 辅助函数：格式化为 CSV
function formatAsCSV(data: any[]): string {
  const headers = ['标题', '描述', '分类', '标签', '状态', '提示词内容', '创建时间', '更新时间'];
  const rows = data.map(item => [
    escapeCSV(item.title),
    escapeCSV(item.description || ''),
    escapeCSV(item.category || ''),
    escapeCSV((item.tags || []).join('; ')),
    escapeCSV(item.status),
    escapeCSV(item.currentVersion?.content || ''),
    escapeCSV(item.createdAt?.toISOString() || ''),
    escapeCSV(item.updatedAt?.toISOString() || ''),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default exportRouter;
