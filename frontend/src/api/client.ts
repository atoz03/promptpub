import type {
  CategoriesResponse,
  LoginResponse,
  MeResponse,
  PromptsResponse,
  PromptDetail,
  PromptVersionsResponse,
  RegisterResponse,
  TagsResponse,
  WorkspacesResponse,
  WorkspaceDetail,
} from '../types/api';

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const data = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: string }).error === 'string'
          ? (data as { error?: string }).error!
          : 'Request failed';
      throw new Error(message);
    }

    return data as T;
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(email: string, password: string, name: string) {
    const data = await this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<MeResponse>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Workspaces
  async getWorkspaces() {
    return this.request<WorkspacesResponse>('/workspaces');
  }

  async getWorkspace(id: string) {
    return this.request<WorkspaceDetail>(`/workspaces/${id}`);
  }

  async createWorkspace(name: string, description?: string) {
    return this.request<{ workspace: { id: string } }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  // Prompts
  async getPrompts(params: {
    workspaceId: string;
    categoryId?: string;
    status?: string;
    search?: string;
    tagId?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    return this.request<PromptsResponse>(`/prompts?${searchParams}`);
  }

  async getPrompt(id: string) {
    return this.request<PromptDetail>(`/prompts/${id}`);
  }

  async createPrompt(data: {
    workspaceId: string;
    title: string;
    description?: string;
    content: string;
    categoryId?: string;
    tagIds?: string[];
    variables?: Array<{ name: string; description?: string; defaultValue?: string }>;
    targetModels?: string[];
    status?: 'draft' | 'published';
  }) {
    return this.request<{ prompt: { id: string } }>('/prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePrompt(
    id: string,
    data: {
      title?: string;
      description?: string;
      content?: string;
      categoryId?: string | null;
      tagIds?: string[];
      variables?: Array<{ name: string; description?: string; defaultValue?: string }>;
      status?: 'draft' | 'published' | 'archived';
      changelog?: string;
    }
  ) {
    return this.request<{ message: string; versionId: string }>(`/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePrompt(id: string) {
    return this.request<{ message: string }>(`/prompts/${id}`, {
      method: 'DELETE',
    });
  }

  async copyPrompt(id: string, workspaceId?: string) {
    return this.request<{ prompt: { id: string } }>(`/prompts/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify({ workspaceId }),
    });
  }

  async recordPromptUse(id: string, source: 'web' | 'api' | 'plugin' = 'web') {
    return this.request<{ message: string }>(`/prompts/${id}/use`, {
      method: 'POST',
      body: JSON.stringify({ source }),
    });
  }

  async getPromptVersions(id: string) {
    return this.request<PromptVersionsResponse>(`/prompts/${id}/versions`);
  }

  async rollbackPrompt(promptId: string, versionId: string) {
    return this.request<{ message: string; versionId: string }>(`/prompts/${promptId}/rollback/${versionId}`, {
      method: 'POST',
    });
  }

  // Categories
  async getCategories(workspaceId: string) {
    return this.request<CategoriesResponse>(`/categories?workspaceId=${workspaceId}`);
  }

  async createCategory(data: {
    workspaceId: string;
    name: string;
    parentId?: string;
    description?: string;
  }) {
    return this.request<{ category: { id: string } }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: { name?: string; description?: string; parentId?: string | null }) {
    return this.request<{ message: string }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string, options?: { force?: boolean; targetCategoryId?: string }) {
    return this.request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(options || {}),
    });
  }

  // Tags
  async getTags(workspaceId: string) {
    return this.request<TagsResponse>(`/tags?workspaceId=${workspaceId}`);
  }

  async createTag(data: { workspaceId: string; name: string; color?: string }) {
    return this.request<{ tag: { id: string; name: string; color: string } }>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTag(id: string, data: { name?: string; color?: string }) {
    return this.request<{ message: string }>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: string) {
    return this.request<{ message: string }>(`/tags/${id}`, {
      method: 'DELETE',
    });
  }

  // Export
  async exportPrompt(id: string, format: 'json' | 'markdown' = 'json') {
    const response = await fetch(`${API_BASE}/export/prompts/${id}?format=${format}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return response;
  }

  async exportWorkspace(id: string) {
    const response = await fetch(`${API_BASE}/export/workspace/${id}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return response;
  }
}

export const api = new ApiClient();
