export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description?: string | null;
  role: WorkspaceRole;
  promptCount: number;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMember extends UserSummary {
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceStats {
  prompts: {
    total: number;
    published: number;
    draft: number;
  };
  categories: number;
  tags: number;
  members: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  owner?: UserSummary;
  role: WorkspaceRole;
  stats: WorkspaceStats;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptTag {
  id: string;
  name: string;
  color: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PromptListItem {
  id: string;
  workspaceId?: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  visibility: 'private' | 'workspace' | 'public';
  categoryId: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  tags: PromptTag[];
}

export interface PromptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: string;
  content: string;
  variables: string | null;
  outputExample: string | null;
  targetModels: string | null;
  changelog: string | null;
  status: 'current' | 'history' | 'experimental';
  creatorId: string;
  creator?: UserSummary;
  createdAt: string;
}

export interface PromptDetail extends PromptListItem {
  workspaceId: string;
  creator?: UserSummary;
  currentVersionId?: string | null;
  currentVersion?: PromptVersion | null;
  versions: PromptVersion[];
  category?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
}

export interface CategoryNode {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  promptCount: number;
  children?: CategoryNode[];
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
  usageCount: number;
}

export interface LoginResponse {
  token: string;
  user: UserSummary;
  workspaces: Array<{
    id: string;
    name: string;
    role: WorkspaceRole;
  }>;
}

export interface RegisterResponse {
  token: string;
  user: UserSummary;
  workspace: {
    id: string;
    name: string;
  };
}

export interface CategoriesResponse {
  categories: CategoryNode[];
}

export interface TagsResponse {
  tags: TagItem[];
}

export interface PromptsResponse {
  prompts: PromptListItem[];
  pagination: Pagination;
}

export interface PromptVersionsResponse {
  versions: PromptVersion[];
}

export interface WorkspacesResponse {
  workspaces: WorkspaceSummary[];
}

export interface MeResponse {
  user: UserSummary;
  workspaces: WorkspaceSummary[];
}
