import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { api } from '../api/client';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';

interface TagItem {
  id: string;
  name: string;
  color: string;
  usageCount: number;
}

const colorOptions = [
  '#6366f1', // 紫色
  '#8b5cf6', // 紫罗兰
  '#ec4899', // 粉色
  '#ef4444', // 红色
  '#f97316', // 橙色
  '#eab308', // 黄色
  '#22c55e', // 绿色
  '#14b8a6', // 青色
  '#06b6d4', // 天蓝
  '#3b82f6', // 蓝色
];

export function TagsPage() {
  const { currentWorkspaceId } = useStore();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: colorOptions[0],
  });

  useEffect(() => {
    if (currentWorkspaceId) {
      loadTags();
    }
  }, [currentWorkspaceId]);

  const loadTags = async () => {
    try {
      const data = await api.getTags(currentWorkspaceId!);
      setTags(data.tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setFormData({
      name: '',
      color: colorOptions[Math.floor(Math.random() * colorOptions.length)],
    });
    setShowModal(true);
  };

  const openEditModal = (tag: TagItem) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('请输入标签名称');
      return;
    }

    try {
      if (editingTag) {
        await api.updateTag(editingTag.id, {
          name: formData.name,
          color: formData.color,
        });
      } else {
        await api.createTag({
          workspaceId: currentWorkspaceId!,
          name: formData.name,
          color: formData.color,
        });
      }

      setShowModal(false);
      loadTags();
    } catch (error: any) {
      console.error('Failed to save tag:', error);
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = async (tag: TagItem) => {
    const message = tag.usageCount > 0
      ? `该标签被 ${tag.usageCount} 个提示词使用，确定要删除吗？`
      : '确定要删除这个标签吗？';

    if (!confirm(message)) return;

    try {
      await api.deleteTag(tag.id);
      loadTags();
    } catch (error: any) {
      console.error('Failed to delete tag:', error);
      alert(error.message || '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">标签管理</h1>
          <p className="text-gray-500 mt-1">创建和管理提示词标签</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          新建标签
        </button>
      </div>

      {tags.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有标签</h3>
          <p className="text-gray-500 mb-4">创建标签来标记您的提示词</p>
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            新建标签
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className="px-3 py-1 text-sm font-medium rounded-full"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(tag)}
                    className="p-1 text-gray-400 hover:text-primary-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {tag.usageCount} 个提示词使用
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTag ? '编辑标签' : '新建标签'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">标签名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="请输入标签名称"
                  required
                />
              </div>

              <div>
                <label className="label">标签颜色</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="label">预览</label>
                <span
                  className="px-3 py-1 text-sm font-medium rounded-full"
                  style={{
                    backgroundColor: `${formData.color}20`,
                    color: formData.color,
                  }}
                >
                  {formData.name || '标签名称'}
                </span>
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
