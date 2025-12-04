import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { api } from '../api/client';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, FolderTree } from 'lucide-react';
import type { CategoryNode } from '../types/api';
import { flattenCategoryTree } from '../utils/categories';
import { getErrorMessage } from '../utils/error';

export function CategoriesPage() {
  const { currentWorkspaceId } = useStore();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
  });

  const loadCategories = useCallback(async () => {
    if (!currentWorkspaceId) {
      return;
    }

    try {
      const data = await api.getCategories(currentWorkspaceId);
      setCategories(data.categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const openCreateModal = (parentId?: string) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      parentId: parentId || '',
    });
    setShowModal(true);
  };

  const openEditModal = (category: CategoryNode) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('请输入分类名称');
      return;
    }

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: formData.name,
          description: formData.description || undefined,
          parentId: formData.parentId || null,
        });
      } else {
        await api.createCategory({
          workspaceId: currentWorkspaceId!,
          name: formData.name,
          description: formData.description || undefined,
          parentId: formData.parentId || undefined,
        });
      }

      setShowModal(false);
      loadCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      alert(getErrorMessage(error, '保存失败'));
    }
  };

  const handleDelete = async (category: CategoryNode) => {
    const message = category.promptCount > 0
      ? `该分类下有 ${category.promptCount} 个提示词，确定要删除吗？`
      : '确定要删除这个分类吗？';

    if (!confirm(message)) return;

    try {
      await api.deleteCategory(category.id, { force: true });
      loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert(getErrorMessage(error, '删除失败'));
    }
  };

  // 扁平化分类列表（用于下拉选择）
  const renderCategory = (category: CategoryNode, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);

    return (
      <div key={category.id}>
        <div
          className={`flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors ${
            level > 0 ? 'ml-6' : ''
          }`}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(category.id)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6"></span>
          )}

          <FolderTree className="w-5 h-5 text-gray-400" />

          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{category.name}</p>
            {category.description && (
              <p className="text-sm text-gray-500 truncate">{category.description}</p>
            )}
          </div>

          <span className="text-sm text-gray-500">{category.promptCount} 个提示词</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => openCreateModal(category.id)}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
              title="添加子分类"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => openEditModal(category)}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
              title="编辑"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(category)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l-2 border-gray-100 ml-4">
            {category.children!.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">分类管理</h1>
          <p className="text-gray-500 mt-1">组织和管理提示词分类</p>
        </div>
        <button onClick={() => openCreateModal()} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          新建分类
        </button>
      </div>

      <div className="card">
        {categories.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FolderTree className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">还没有分类</h3>
            <p className="text-gray-500 mb-4">创建分类来组织您的提示词</p>
            <button onClick={() => openCreateModal()} className="btn btn-primary">
              <Plus className="w-4 h-4" />
              新建分类
            </button>
          </div>
        ) : (
          <div className="p-4">
            {categories.map((category) => renderCategory(category))}
          </div>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? '编辑分类' : '新建分类'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">分类名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="请输入分类名称"
                  required
                />
              </div>

              <div>
                <label className="label">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="分类描述（可选）"
                />
              </div>

              <div>
                <label className="label">父分类</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="input"
                >
                  <option value="">无（顶级分类）</option>
                  {flattenCategoryTree(categories, 0, editingCategory?.id).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {'　'.repeat(cat.level)}{cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
