import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store';
import {
  Home,
  FileText,
  FolderTree,
  Tags,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { useState } from 'react';

export function Layout() {
  const { user, workspaces, currentWorkspaceId, setCurrentWorkspace, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: Home, label: '概览' },
    { path: '/prompts', icon: FileText, label: '提示词' },
    { path: '/categories', icon: FolderTree, label: '分类' },
    { path: '/tags', icon: Tags, label: '标签' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Link to="/" className="text-xl font-bold text-primary-600">
            PromptPub
          </Link>
        </div>

        {/* 工作空间选择器 */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="truncate font-medium">
                {currentWorkspace?.name || '选择工作空间'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setCurrentWorkspace(ws.id);
                      setShowWorkspaceMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                      ws.id === currentWorkspaceId ? 'bg-primary-50 text-primary-600' : ''
                    }`}
                  >
                    {ws.name}
                    <span className="text-xs text-gray-400 ml-2">({ws.role})</span>
                  </button>
                ))}
                <div className="border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowWorkspaceMenu(false);
                      navigate('/settings/workspaces');
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-primary-600 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    新建工作空间
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 底部用户信息 */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/settings"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              设置
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
