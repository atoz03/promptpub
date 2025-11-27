import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  ArrowLeft,
  Copy,
  Edit,
  Trash2,
  Clock,
  User,
  History,
  Tag,
  FolderTree,
  Download,
  BarChart3,
  RotateCcw,
  Hash,
} from 'lucide-react';
import { countTokens, estimateCost } from '../utils/tokenCounter';

export function PromptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenCount, setTokenCount] = useState<number>(0);

  useEffect(() => {
    if (id) {
      loadPrompt();
    }
  }, [id]);

  // 自动计算 token 数量
  useEffect(() => {
    if (prompt?.currentVersion?.content) {
      const count = countTokens(prompt.currentVersion.content);
      setTokenCount(count);
    } else {
      setTokenCount(0);
    }
  }, [prompt?.currentVersion?.content]);

  const loadPrompt = async () => {
    try {
      const data = await api.getPrompt(id!);
      setPrompt(data);

      const versionsData = await api.getPromptVersions(id!);
      setVersions(versionsData.versions);
    } catch (error) {
      console.error('Failed to load prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!prompt?.currentVersion?.content) return;

    try {
      await navigator.clipboard.writeText(prompt.currentVersion.content);
      await api.recordPromptUse(id!, 'web');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个提示词吗？此操作不可撤销。')) return;

    try {
      await api.deletePrompt(id!);
      navigate('/prompts');
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('删除失败');
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!confirm('确定要回滚到这个版本吗？')) return;

    try {
      await api.rollbackPrompt(id!, versionId);
      loadPrompt();
      alert('回滚成功');
    } catch (error) {
      console.error('Failed to rollback:', error);
      alert('回滚失败');
    }
  };

  const handleExport = async (format: 'json' | 'markdown') => {
    try {
      const response = await api.exportPrompt(id!, format);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prompt.title}.${format === 'markdown' ? 'md' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
      alert('导出失败');
    }
  };

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

  if (!prompt) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-medium text-gray-900">提示词不存在</h2>
        <Link to="/prompts" className="text-primary-600 hover:underline mt-2 inline-block">
          返回列表
        </Link>
      </div>
    );
  }

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

  const currentVersion = prompt.currentVersion;
  const variables = currentVersion?.variables
    ? JSON.parse(currentVersion.variables)
    : [];
  const targetModels = currentVersion?.targetModels
    ? JSON.parse(currentVersion.targetModels)
    : [];

  return (
    <div className="p-8">
      {/* 返回链接 */}
      <Link
        to="/prompts"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回列表
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 主内容区 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 标题和操作 */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{prompt.title}</h1>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[prompt.status as keyof typeof statusColors]}`}>
                    {statusLabels[prompt.status as keyof typeof statusLabels]}
                  </span>
                </div>
                {prompt.description && (
                  <p className="text-gray-500">{prompt.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('json')}
                  className="btn btn-secondary"
                >
                  <Download className="w-4 h-4" />
                  导出
                </button>
                <Link to={`/prompts/${id}/edit`} className="btn btn-secondary">
                  <Edit className="w-4 h-4" />
                  编辑
                </Link>
                <button onClick={handleDelete} className="btn btn-danger">
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </div>
            </div>

            {/* 元信息 */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {prompt.category && (
                <div className="flex items-center gap-1">
                  <FolderTree className="w-4 h-4" />
                  {prompt.category.name}
                </div>
              )}
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {prompt.creator?.name}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(prompt.updatedAt).toLocaleString()}
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="w-4 h-4" />
                使用 {prompt.usageCount} 次
              </div>
            </div>

            {/* 标签 */}
            {prompt.tags?.length > 0 && (
              <div className="flex items-center gap-2 mt-4">
                <Tag className="w-4 h-4 text-gray-400" />
                {prompt.tags.map((tag: any) => (
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
              </div>
            )}
          </div>

          {/* 提示词内容 */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold text-gray-900">
                  提示词内容
                  {currentVersion && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({currentVersion.version})
                    </span>
                  )}
                </h2>
                {/* Token 统计 */}
                {tokenCount > 0 && (
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                      <Hash className="w-4 h-4" />
                      <span className="font-medium">{tokenCount.toLocaleString()}</span>
                      <span className="text-blue-600">tokens</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <span>≈</span>
                      <span className="font-medium">
                        ${estimateCost(tokenCount, 'gpt-4').toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleCopy}
                className={`btn ${copied ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Copy className="w-4 h-4" />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-[500px]">
                {currentVersion?.content || '暂无内容'}
              </pre>
            </div>
          </div>

          {/* 变量说明 */}
          {variables.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">变量说明</h2>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500">
                      <th className="pb-2">变量名</th>
                      <th className="pb-2">说明</th>
                      <th className="pb-2">默认值</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {variables.map((v: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-2 font-mono text-primary-600">{`{${v.name}}`}</td>
                        <td className="py-2 text-gray-600">{v.description || '-'}</td>
                        <td className="py-2 text-gray-500">{v.defaultValue || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 输出示例 */}
          {currentVersion?.outputExample && (
            <div className="card">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">输出示例</h2>
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg">
                  {currentVersion.outputExample}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 适用模型 */}
          {targetModels.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">适用模型</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {targetModels.map((model: string) => (
                    <span
                      key={model}
                      className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 版本历史 */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="w-full flex items-center justify-between font-semibold text-gray-900"
              >
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  版本历史
                </span>
                <span className="text-sm font-normal text-gray-500">
                  {versions.length} 个版本
                </span>
              </button>
            </div>
            {showVersions && (
              <div className="p-4 space-y-3 max-h-[400px] overflow-auto">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-3 rounded-lg border ${
                      version.id === prompt.currentVersionId
                        ? 'border-primary-200 bg-primary-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{version.version}</span>
                      {version.id === prompt.currentVersionId ? (
                        <span className="text-xs text-primary-600">当前版本</span>
                      ) : (
                        <button
                          onClick={() => handleRollback(version.id)}
                          className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          回滚
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{version.changelog || '无更新说明'}</p>
                    <div className="text-xs text-gray-400 mt-1">
                      {version.creator?.name} · {new Date(version.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
