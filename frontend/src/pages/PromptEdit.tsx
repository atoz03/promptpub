import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store';
import { api } from '../api/client';
import { ArrowLeft, Plus, X, Save, Eye } from 'lucide-react';

interface Variable {
  name: string;
  description: string;
  defaultValue: string;
}

export function PromptEditPage() {
  const { id } = useParams<{ id: string }>();
  const { currentWorkspaceId } = useStore();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // 表单数据
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [outputExample, setOutputExample] = useState('');
  const [targetModels, setTargetModels] = useState<string[]>([]);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [changelog, setChangelog] = useState('');

  // 预览模式
  const [showPreview, setShowPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [currentWorkspaceId, id]);

  const loadData = async () => {
    if (!currentWorkspaceId) return;

    try {
      const [categoriesData, tagsData] = await Promise.all([
        api.getCategories(currentWorkspaceId),
        api.getTags(currentWorkspaceId),
      ]);

      setCategories(flattenCategories(categoriesData.categories));
      setTags(tagsData.tags);

      if (id) {
        const prompt = await api.getPrompt(id);
        setTitle(prompt.title);
        setDescription(prompt.description || '');
        setCategoryId(prompt.categoryId || '');
        setSelectedTags(prompt.tags?.map((t: any) => t.id) || []);
        setStatus(prompt.status === 'archived' ? 'draft' : prompt.status);

        if (prompt.currentVersion) {
          setContent(prompt.currentVersion.content);
          setOutputExample(prompt.currentVersion.outputExample || '');

          if (prompt.currentVersion.variables) {
            setVariables(JSON.parse(prompt.currentVersion.variables));
          }

          if (prompt.currentVersion.targetModels) {
            setTargetModels(JSON.parse(prompt.currentVersion.targetModels));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const flattenCategories = (cats: any[], level = 0): any[] => {
    return cats.flatMap((cat) => [
      { ...cat, level },
      ...(cat.children ? flattenCategories(cat.children, level + 1) : []),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('请输入标题');
      return;
    }

    if (!content.trim()) {
      alert('请输入提示词内容');
      return;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await api.updatePrompt(id!, {
          title,
          description: description || undefined,
          content,
          categoryId: categoryId || null,
          tagIds: selectedTags,
          variables: variables.filter((v) => v.name),
          status,
          changelog: changelog || '更新内容',
        });
      } else {
        const result = await api.createPrompt({
          workspaceId: currentWorkspaceId!,
          title,
          description: description || undefined,
          content,
          categoryId: categoryId || undefined,
          tagIds: selectedTags,
          variables: variables.filter((v) => v.name),
          targetModels: targetModels.length > 0 ? targetModels : undefined,
          status,
        });

        navigate(`/prompts/${result.prompt.id}`);
        return;
      }

      navigate(`/prompts/${id}`);
    } catch (error: any) {
      console.error('Failed to save:', error);
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const addVariable = () => {
    setVariables([...variables, { name: '', description: '', defaultValue: '' }]);
  };

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    const newVariables = [...variables];
    newVariables[index][field] = value;
    setVariables(newVariables);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  // 解析提示词中的变量
  const parseVariables = () => {
    const regex = /\{(\w+)\}/g;
    const matches = content.match(regex);
    if (!matches) return;

    const newVars = [...new Set(matches.map((m) => m.slice(1, -1)))];
    const existingNames = new Set(variables.map((v) => v.name));

    const varsToAdd = newVars
      .filter((name) => !existingNames.has(name))
      .map((name) => ({ name, description: '', defaultValue: '' }));

    if (varsToAdd.length > 0) {
      setVariables([...variables, ...varsToAdd]);
    }
  };

  // 生成预览内容
  const generatePreview = () => {
    let preview = content;
    variables.forEach((v) => {
      const value = previewValues[v.name] || v.defaultValue || `{${v.name}}`;
      preview = preview.replace(new RegExp(`\\{${v.name}\\}`, 'g'), value);
    });
    return preview;
  };

  const modelOptions = [
    'GPT-4',
    'GPT-4 Turbo',
    'GPT-3.5 Turbo',
    'Claude 3 Opus',
    'Claude 3 Sonnet',
    'Claude 3 Haiku',
    'Gemini Pro',
    'Llama 3',
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* 返回链接 */}
      <Link
        to={isEditing ? `/prompts/${id}` : '/prompts'}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {isEditing ? '返回详情' : '返回列表'}
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? '编辑提示词' : '新建提示词'}
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="btn btn-secondary"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? '关闭预览' : '预览'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 主编辑区 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本信息 */}
            <div className="card p-6 space-y-4">
              <div>
                <label className="label">标题 *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="请输入提示词标题"
                  required
                />
              </div>

              <div>
                <label className="label">描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="简要描述这个提示词的用途"
                />
              </div>
            </div>

            {/* 提示词内容 */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="label mb-0">提示词内容 *</label>
                <button
                  type="button"
                  onClick={parseVariables}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  解析变量
                </button>
              </div>

              {showPreview ? (
                <div className="space-y-4">
                  {/* 变量输入 */}
                  {variables.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-gray-700">预览变量值</p>
                      <div className="grid grid-cols-2 gap-3">
                        {variables.map((v) => (
                          <div key={v.name}>
                            <label className="text-xs text-gray-500">{v.name}</label>
                            <input
                              type="text"
                              value={previewValues[v.name] || ''}
                              onChange={(e) =>
                                setPreviewValues({ ...previewValues, [v.name]: e.target.value })
                              }
                              placeholder={v.defaultValue || `输入 ${v.name}`}
                              className="input text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg">
                    {generatePreview()}
                  </pre>
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input font-mono"
                  rows={12}
                  placeholder="在此输入提示词内容，使用 {变量名} 定义可替换变量"
                  required
                />
              )}
            </div>

            {/* 变量定义 */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="label mb-0">变量定义</label>
                <button
                  type="button"
                  onClick={addVariable}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  添加变量
                </button>
              </div>

              {variables.length === 0 ? (
                <p className="text-sm text-gray-500">
                  在提示词中使用 {'{变量名}'} 格式定义变量，点击"解析变量"自动提取
                </p>
              ) : (
                <div className="space-y-3">
                  {variables.map((variable, index) => (
                    <div key={index} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={variable.name}
                          onChange={(e) => updateVariable(index, 'name', e.target.value)}
                          className="input text-sm"
                          placeholder="变量名"
                        />
                        <input
                          type="text"
                          value={variable.description}
                          onChange={(e) => updateVariable(index, 'description', e.target.value)}
                          className="input text-sm"
                          placeholder="说明"
                        />
                        <input
                          type="text"
                          value={variable.defaultValue}
                          onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                          className="input text-sm"
                          placeholder="默认值"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVariable(index)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 输出示例 */}
            <div className="card p-6">
              <label className="label">输出示例</label>
              <textarea
                value={outputExample}
                onChange={(e) => setOutputExample(e.target.value)}
                className="input font-mono"
                rows={4}
                placeholder="提供一个期望的输出示例"
              />
            </div>

            {/* 更新说明（仅编辑模式） */}
            {isEditing && (
              <div className="card p-6">
                <label className="label">更新说明</label>
                <input
                  type="text"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  className="input"
                  placeholder="简要描述本次更新的内容"
                />
              </div>
            )}
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 发布状态 */}
            <div className="card p-6">
              <label className="label">发布状态</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                    className="text-primary-600"
                  />
                  <span className="text-sm">草稿</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="published"
                    checked={status === 'published'}
                    onChange={() => setStatus('published')}
                    className="text-primary-600"
                  />
                  <span className="text-sm">发布</span>
                </label>
              </div>
            </div>

            {/* 分类 */}
            <div className="card p-6">
              <label className="label">分类</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input"
              >
                <option value="">未分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {'　'.repeat(cat.level)}{cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 标签 */}
            <div className="card p-6">
              <label className="label">标签</label>
              <div className="space-y-2 max-h-48 overflow-auto">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTags([...selectedTags, tag.id]);
                        } else {
                          setSelectedTags(selectedTags.filter((id) => id !== tag.id));
                        }
                      }}
                      className="text-primary-600"
                    />
                    <span
                      className="px-2 py-0.5 text-xs rounded-full"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                    </span>
                  </label>
                ))}
                {tags.length === 0 && (
                  <p className="text-sm text-gray-500">暂无标签</p>
                )}
              </div>
            </div>

            {/* 适用模型 */}
            <div className="card p-6">
              <label className="label">适用模型</label>
              <div className="space-y-2 max-h-48 overflow-auto">
                {modelOptions.map((model) => (
                  <label key={model} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={targetModels.includes(model)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTargetModels([...targetModels, model]);
                        } else {
                          setTargetModels(targetModels.filter((m) => m !== model));
                        }
                      }}
                      className="text-primary-600"
                    />
                    <span className="text-sm">{model}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
