import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { VersionDiff } from '../components/VersionDiff';
import {
  ArrowLeft,
  Copy,
  Check,
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
  GitCompare,
  Eye,
} from 'lucide-react';
import { countTokens, estimateCost } from '../utils/tokenCounter';
import { parseJson } from '../utils/json';
import type { PromptDetail, PromptVariable, PromptVersion } from '../types/api';

export function PromptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState<PromptDetail | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  // 版本对比相关状态
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  // 变量预览相关状态
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  const loadPrompt = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    try {
      const [data, versionsData] = await Promise.all([
        api.getPrompt(id),
        api.getPromptVersions(id),
      ]);
      setPrompt(data);
      setVersions(versionsData.versions);
    } catch (error) {
      console.error('Failed to load prompt:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPrompt();
  }, [loadPrompt]);

  // 自动计算 token 数量
  useEffect(() => {
    if (prompt?.currentVersion?.content) {
      const count = countTokens(prompt.currentVersion.content);
      setTokenCount(count);
    } else {
      setTokenCount(0);
    }
  }, [prompt?.currentVersion?.content]);

  const handleCopy = async () => {
    if (!prompt?.currentVersion?.content || !id) return;

    try {
      await navigator.clipboard.writeText(prompt.currentVersion.content);
      await api.recordPromptUse(id, 'web');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('已复制到剪贴板', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('复制失败', 'error');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('确定要删除这个提示词吗？此操作不可撤销。')) return;

    try {
      await api.deletePrompt(id);
      showToast('删除成功', 'success');
      navigate('/prompts');
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast('删除失败', 'error');
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!id) return;
    if (!confirm('确定要回滚到这个版本吗？')) return;

    try {
      await api.rollbackPrompt(id, versionId);
      loadPrompt();
      showToast('回滚成功', 'success');
    } catch (error) {
      console.error('Failed to rollback:', error);
      showToast('回滚失败', 'error');
    }
  };

  // 版本选择处理
  const handleVersionSelect = (versionId: string) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(selectedVersions.filter(v => v !== versionId));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, versionId]);
    } else {
      setSelectedVersions([selectedVersions[1], versionId]);
    }
  };

  // 获取对比的版本数据
  const getCompareVersions = () => {
    const v1 = versions.find(v => v.id === selectedVersions[0]);
    const v2 = versions.find(v => v.id === selectedVersions[1]);
    if (!v1 || !v2) return null;
    const sorted = [v1, v2].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return { old: sorted[0], new: sorted[1] };
  };

  // 生成预览内容（替换变量）
  const getPreviewContent = () => {
    if (!currentVersion?.content) return '';
    let content = currentVersion.content;

    variables.forEach((v) => {
      const value = variableValues[v.name] || v.defaultValue || `{${v.name}}`;
      const regex = new RegExp(`\\{${v.name}\\}`, 'g');
      content = content.replace(regex, value);
    });

    return content;
  };

  // 复制预览内容
  const handleCopyPreview = async () => {
    if (!id) return;
    const previewContent = getPreviewContent();
    try {
      await navigator.clipboard.writeText(previewContent);
      await api.recordPromptUse(id, 'web');
      showToast('预览内容已复制', 'success');
    } catch {
      showToast('复制失败', 'error');
    }
  };

  // 重置变量值
  const resetVariables = () => {
    setVariableValues({});
  };

  const handleExport = async (format: 'json' | 'markdown') => {
    if (!id || !prompt) return;
    try {
      const response = await api.exportPrompt(id, format);
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

  const currentVersion = prompt.currentVersion ?? null;
  const variables: PromptVariable[] = currentVersion
    ? parseJson<PromptVariable[]>(currentVersion.variables, [])
    : [];
  const targetModels: string[] = currentVersion
    ? parseJson<string[]>(currentVersion.targetModels, [])
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
                {prompt.tags.map((tag) => (
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

          {/* 变量预览 */}
          {variables.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">变量设置与预览</h2>
                <div className="flex items-center gap-2">
                  {Object.keys(variableValues).length > 0 && (
                    <button
                      onClick={resetVariables}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      重置
                    </button>
                  )}
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`btn btn-secondary text-xs py-1 px-2 ${showPreview ? 'bg-primary-50 text-primary-700' : ''}`}
                  >
                    <Eye className="w-3 h-3" />
                    {showPreview ? '隐藏预览' : '显示预览'}
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* 变量输入区域 */}
                <div className="grid gap-3">
                  {variables.map((variable, index) => (
                    <div key={variable.name || index} className="flex items-start gap-3">
                      <div className="w-28 flex-shrink-0">
                        <span className="font-mono text-sm text-primary-600 bg-primary-50 px-2 py-1 rounded">
                          {`{${variable.name}}`}
                        </span>
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder={variable.defaultValue || `输入 ${variable.name} 的值...`}
                          value={variableValues[variable.name] || ''}
                          onChange={(e) =>
                            setVariableValues({ ...variableValues, [variable.name]: e.target.value })
                          }
                          className="input text-sm"
                        />
                        {variable.description && (
                          <p className="text-xs text-gray-500 mt-1">{variable.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 预览区域 */}
                {showPreview && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">预览结果</span>
                      <button
                        onClick={handleCopyPreview}
                        className="btn btn-secondary text-xs py-1 px-2"
                      >
                        <Copy className="w-3 h-3" />
                        复制预览
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-sm bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 p-4 rounded-lg overflow-auto max-h-[300px]">
                      {getPreviewContent()}
                    </pre>
                  </div>
                )}
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
                  {targetModels.map((model) => (
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
              <div className="p-4 space-y-3">
                {/* 对比模式切换 */}
                {versions.length >= 2 && (
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => {
                        setCompareMode(!compareMode);
                        setSelectedVersions([]);
                      }}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${
                        compareMode
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <GitCompare className="w-3 h-3" />
                      {compareMode ? '退出对比' : '版本对比'}
                    </button>
                    {compareMode && selectedVersions.length === 2 && (
                      <button
                        onClick={() => setShowDiff(true)}
                        className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700"
                      >
                        查看差异
                      </button>
                    )}
                  </div>
                )}
                {compareMode && (
                  <p className="text-xs text-gray-500 mb-2">
                    选择两个版本进行对比 ({selectedVersions.length}/2)
                  </p>
                )}

                <div className="max-h-[350px] overflow-auto space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      onClick={() => compareMode && handleVersionSelect(version.id)}
                      className={`p-3 rounded-lg border transition-colors ${
                        compareMode ? 'cursor-pointer' : ''
                      } ${
                        selectedVersions.includes(version.id)
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                          : version.id === prompt.currentVersionId
                          ? 'border-primary-200 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {compareMode && (
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                selectedVersions.includes(version.id)
                                  ? 'border-primary-500 bg-primary-500'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedVersions.includes(version.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{version.version}</span>
                        </div>
                        {!compareMode && (
                          version.id === prompt.currentVersionId ? (
                            <span className="text-xs text-primary-600">当前版本</span>
                          ) : (
                            <button
                              onClick={() => handleRollback(version.id)}
                              className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              回滚
                            </button>
                          )
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{version.changelog || '无更新说明'}</p>
                      <div className="text-xs text-gray-400 mt-1">
                        {version.creator?.name} · {new Date(version.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 版本对比弹窗 */}
      {showDiff && selectedVersions.length === 2 && (() => {
        const compareData = getCompareVersions();
        if (!compareData) return null;
        return (
          <VersionDiff
            oldVersion={{ version: compareData.old.version, content: compareData.old.content }}
            newVersion={{ version: compareData.new.version, content: compareData.new.content }}
            onClose={() => setShowDiff(false)}
          />
        );
      })()}
    </div>
  );
}
