import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  role: string;
}

interface AppState {
  user: User | null;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      workspaces: [],
      currentWorkspaceId: null,
      isAuthenticated: false,
      isLoading: !!api.getToken(),

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setWorkspaces: (workspaces) => {
        set({ workspaces });
        // 如果没有当前工作空间，设置第一个
        if (!get().currentWorkspaceId && workspaces.length > 0) {
          set({ currentWorkspaceId: workspaces[0].id });
        }
      },

      setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await api.login(email, password);
          set({
            user: data.user,
            workspaces: data.workspaces,
            currentWorkspaceId: data.workspaces[0]?.id || null,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const data = await api.register(email, password, name);
          set({
            user: data.user,
            workspaces: [{ ...data.workspace, role: 'owner' }],
            currentWorkspaceId: data.workspace.id,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        api.logout();
        set({
          user: null,
          workspaces: [],
          currentWorkspaceId: null,
          isAuthenticated: false,
        });
      },

      loadUser: async () => {
        if (!api.getToken()) {
          set({ isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const data = await api.getMe();
          set({
            user: data.user,
            workspaces: data.workspaces,
            currentWorkspaceId: get().currentWorkspaceId || data.workspaces[0]?.id || null,
            isAuthenticated: true,
          });
        } catch {
          set({ isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'promptpub-storage',
      partialize: (state) => ({
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    }
  )
);
