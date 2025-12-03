import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import {
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Eye,
  Edit,
  Trash2,
  Clock,
  BarChart3,
} from 'lucide-react';

interface Prompt {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  categoryId: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: string; name: string; color: string }>;
}

interface Category {
  id: string;
  name: string;
  children?: Category[];
}

export function PromptListPage() {
  const { currentWorkspaceId } = useStore();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';
  const tagId = searchParams.get('tag') || '';

  useEffect(() => {
    if (currentWorkspaceId) {
      loadData();
    }
  }, [currentWorkspaceId, search, categoryId, status, tagId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [promptsData, categoriesData, tagsData] = await Promise.all([
        api.getPrompts({
          workspaceId: currentWorkspaceId!,
          search: search || undefined,
          categoryId: categoryId || undefined,
          status: status || undefined,
          tagId: tagId || undefined,
        }),
        api.getCategories(currentWorkspaceId!),
        api.getTags(currentWorkspaceId!),
      ]);

      setPrompts(promptsData.prompts);
      setPagination(promptsData.pagination);
      setCategories(categoriesData.categories);
      setTags(tagsData.tags);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    setSearchParams(params);
  };

  const handleCopyPrompt = async (prompt: Prompt) => {
    try {
      // 获取完整的提示词内容
      const fullPrompt = await api.getPrompt(prompt.id);
      const content = fullPrompt.currentVersion?.content || '';

      await navigator.clipboard.writeText(content);

      // 记录使用
      await api.recordPromptUse(prompt.id, 'web');

      // 显示复制成功动画
      setCopiedId(prompt.id);
      setTimeout(() => setCopiedId(null), 2000);

      // 刷新数据以更新使用次数
      loadData();

      showToast('已复制到剪贴板', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('复制失败', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个提示词吗？')) return;

    try {
      await api.deletePrompt(id);
      loadData();
      showToast('删除成功', 'success');
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast('删除失败', 'error');
    }
  };

  const statusColors = {
    draft: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-800',
  };

  const statusLabels = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  };

  // 递归渲染分类树
  const renderCategoryOptions = (cats: Category[], level = 0): React.ReactNode[] => {
    return cats.flatMap((cat) => [
      <option key={cat.id} value={cat.id}>
        {'　'.repeat(level)}{cat.name}
      </option>,
      ...(cat.children ? renderCategoryOptions(cat.children, level + 1) : []),
    ]);
  };

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">提示词</h1>
          <p className="text-gray-500 mt-1">管理和组织您的提示词模板</p>
        </div>
        <Link to="/prompts/new" className="btn btn-primary">
          <Plus className="w-4 h-4" />
          新建提示词
        </Link>
      </div>

      {/* 筛选栏 */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索标题、描述或正文..."
                defaultValue={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* 分类筛选 */}
          <select
            value={categoryId}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set('category', e.target.value);
              } else {
                params.delete('category');
              }
              setSearchParams(params);
            }}
            className="input w-auto"
          >
            <option value="">全部分类</option>
            {renderCategoryOptions(categories)}
          </select>

          {/* 状态筛选 */}
          <select
            value={status}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set('status', e.target.value);
              } else {
                params.delete('status');
              }
              setSearchParams(params);
            }}
            className="input w-auto"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>

          {/* 标签筛选 */}
          <select
            value={tagId}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set('tag', e.target.value);
              } else {
                params.delete('tag');
              }
              setSearchParams(params);
            }}
            className="input w-auto"
          >
            <option value="">全部标签</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 提示词列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">没有找到提示词</h3>
          <p className="text-gray-500 mb-4">
            {search || categoryId || status || tagId
              ? '尝试调整筛选条件'
              : '开始创建您的第一个提示词'}
          </p>
          <Link to="/prompts/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            新建提示词
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      to={`/prompts/${prompt.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-primary-600"
                    >
                      {prompt.title}
                    </Link>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[prompt.status]}`}>
                      {statusLabels[prompt.status]}
                    </span>
                  </div>

                  {prompt.description && (
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">
                      {prompt.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {/* 标签 */}
                    {prompt.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {prompt.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {prompt.tags.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{prompt.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 使用统计 */}
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" />
                      使用 {prompt.usageCount} 次
                    </div>

                    {/* 更新时间 */}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(prompt.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleCopyPrompt(prompt)}
                    className={`p-2 rounded-lg transition-colors ${
                      copiedId === prompt.id
                        ? 'text-green-600 bg-green-50'
                        : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                    }`}
                    title="复制提示词"
                  >
                    {copiedId === prompt.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <Link
                    to={`/prompts/${prompt.id}`}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="查看详情"
                  >
                    <Eye className="w-5 h-5" />
                  </Link>
                  <Link
                    to={`/prompts/${prompt.id}/edit`}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => handleDelete(prompt.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set('page', String(page));
                setSearchParams(params);
              }}
              className={`px-3 py-1 rounded-lg ${
                page === pagination.page
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
