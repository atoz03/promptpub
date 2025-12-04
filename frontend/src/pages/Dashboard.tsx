import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { api } from '../api/client';
import { FileText, FolderTree, Tags, Users, TrendingUp, Clock } from 'lucide-react';
import type { WorkspaceDetail } from '../types/api';

export function DashboardPage() {
  const { currentWorkspaceId } = useStore();
  const [stats, setStats] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!currentWorkspaceId) {
      return;
    }

    try {
      const data = await api.getWorkspace(currentWorkspaceId);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: '提示词总数',
      value: stats?.stats?.prompts?.total || 0,
      icon: FileText,
      color: 'bg-blue-50 text-blue-600',
      link: '/prompts',
    },
    {
      label: '已发布',
      value: stats?.stats?.prompts?.published || 0,
      icon: TrendingUp,
      color: 'bg-green-50 text-green-600',
      link: '/prompts?status=published',
    },
    {
      label: '分类数量',
      value: stats?.stats?.categories || 0,
      icon: FolderTree,
      color: 'bg-purple-50 text-purple-600',
      link: '/categories',
    },
    {
      label: '标签数量',
      value: stats?.stats?.tags || 0,
      icon: Tags,
      color: 'bg-orange-50 text-orange-600',
      link: '/tags',
    },
  ];

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">概览</h1>
        <p className="text-gray-500 mt-1">
          欢迎回来，{stats?.name || '工作空间'}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.link}
              className="card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 成员信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 成员列表 */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              工作空间成员
            </h2>
          </div>
          <div className="p-4">
            {stats?.members?.length ? (
              <div className="space-y-3">
                {stats.members.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                      {member.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      {member.role === 'owner' ? '所有者' : member.role === 'editor' ? '编辑者' : '查看者'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">暂无成员</p>
            )}
          </div>
        </div>

        {/* 快速操作 */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              快速操作
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <Link
              to="/prompts/new"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">创建新提示词</p>
                <p className="text-sm text-gray-500">添加一个新的提示词模板</p>
              </div>
            </Link>
            <Link
              to="/categories"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">管理分类</p>
                <p className="text-sm text-gray-500">组织和管理提示词分类</p>
              </div>
            </Link>
            <Link
              to="/tags"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">管理标签</p>
                <p className="text-sm text-gray-500">创建和编辑标签</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
