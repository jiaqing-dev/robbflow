export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  key_prefix: string;
  status: string;
  color: string;
  created_at: string;
  templates: string[];
};

export type WorkTemplateTable = {
  type_key: string;
  name: string;
};

export type WorkTemplate = {
  key: string;
  name: string;
  description: string;
  tables: WorkTemplateTable[];
};

export type WorkItem = {
  id: string;
  project_id: string;
  type: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  creator_id: string;
  assignee_id: string | null;
  parent_id: string | null;
  position: number;
  properties: Record<string, unknown>;
  sprint_id: string | null;
  milestone_id: string | null;
  due_at: string | null;
  start_at: string | null;
  created_at: string;
  updated_at: string;
  assignee: User | null;
  creator?: User | null;
  project_name: string | null;
};

export type Comment = {
  id: string;
  body: string;
  author: User;
  created_at: string;
};

export type WorkItemLink = {
  id: string;
  url: string;
  title: string;
  provider: string;
  kind: string;
  created_at: string;
};

export type Activity = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type BoardColumn = {
  key: string;
  name: string;
  color: string;
  category: string;
  items: WorkItem[];
};

export type WorkflowState = {
  key: string;
  name: string;
  category: string;
  color: string;
  position: number;
  layout_x: number;
  layout_y: number;
};

export type WorkflowTransition = {
  from_state: string;
  to_state: string;
  name: string | null;
  require_role?: string | null;
  require_approver?: boolean;
};

export type Workflow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_default: boolean;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  created_at: string;
};

export type TypePort = {
  type_key: string;
  relation: string;
  label?: string | null;
};

export type WorkItemType = {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  fields: Array<Record<string, unknown>>;
  workflow_id: string | null;
  description: string | null;
  inputs: TypePort[];
  outputs: TypePort[];
  layout_x: number | null;
  layout_y: number | null;
  detail_layout?: {
    main: Array<{ kind: "system" | "field"; key: string }>;
    sidebar: Array<{ kind: "system" | "field"; key: string }>;
  } | null;
};

export type TypeGraphEdge = {
  source_key: string;
  target_key: string;
  relation: string;
  label?: string | null;
};

export type Sprint = {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  item_count: number;
  done_count: number;
  progress: number;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type SavedView = {
  id: string;
  name: string;
  project_id: string | null;
  filters: Record<string, unknown>;
  created_at: string;
};

export type ProjectDocument = {
  id: string;
  project_id: string | null;
  work_item_id: string | null;
  provider: string;
  kind: string;
  title: string;
  url: string | null;
  mime: string | null;
  external_id: string | null;
  body: string | null;
  created_at: string;
};

export type GitLink = {
  id: string;
  provider: string;
  repo: string;
  ref: string;
  url: string;
  kind: string;
};

export type IntegrationRow = {
  key: string;
  name: string;
  status: string;
  enabled: boolean;
};

export type IdentityBinding = {
  provider: string;
  external_id: string;
};

export type Milestone = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  due_at: string | null;
  status: string;
  item_count: number;
};

export type Relation = {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  source_key: string | null;
  source_title: string | null;
  target_key: string | null;
  target_title: string | null;
};

export type GraphPayload = {
  origin_id: string;
  nodes: Array<{
    id: string;
    key: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    project_name: string | null;
  }>;
  edges: Array<{ id: string; source: string; target: string; relation_type: string }>;
};

export type BoardLane = {
  key: string;
  name: string;
  items_by_status: Record<string, WorkItem[]>;
};

export type BoardPayload = {
  project: Project;
  type_key: string | null;
  type_name: string | null;
  columns: BoardColumn[];
  lanes: BoardLane[];
  counts: { total: number; open: number };
  workflow: {
    key: string;
    name: string;
    states: WorkflowState[];
    transitions: WorkflowTransition[];
  };
};

const RAW_API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const API = RAW_API.replace("://localhost", "://127.0.0.1");
const TOKEN_KEY = "rf_token";
const API_DOWN =
  "无法连接 API。请在仓库根目录另开终端运行：make api（http://127.0.0.1:8000）";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(8000),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    throw new ApiError(0, timedOut ? `请求超时。${API_DOWN}` : API_DOWN);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: { name: string; email: string; password: string; workspace_name: string }) =>
    api<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => api<{ user: User; workspace: Workspace; role: string }>("/auth/me"),
};

export const dataApi = {
  inbox: () => api<WorkItem[]>("/inbox"),
  myWork: () => api<WorkItem[]>("/my-work"),
  activity: () => api<Activity[]>("/activity"),
  search: (q: string) => api<WorkItem[]>(`/search?q=${encodeURIComponent(q)}`),
  projects: () => api<Project[]>("/projects"),
  project: (id: string) => api<Project>(`/projects/${id}`),
  board: (id: string, opts?: { lane?: string; type?: string }) => {
    const q = new URLSearchParams();
    if (opts?.lane) q.set("lane", opts.lane);
    if (opts?.type) q.set("type", opts.type);
    const qs = q.toString();
    return api<BoardPayload>(`/projects/${id}/board${qs ? `?${qs}` : ""}`);
  },
  createProject: (body: Partial<Project> & { name: string }) =>
    api<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: Record<string, unknown>) =>
    api<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  workTemplates: () => api<WorkTemplate[]>("/work-templates"),
  workItems: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return api<WorkItem[]>(`/work-items${q ? `?${q}` : ""}`);
  },
  workItem: (id: string) => api<WorkItem>(`/work-items/${id}`),
  createWorkItem: (body: Record<string, unknown>) =>
    api<WorkItem>("/work-items", { method: "POST", body: JSON.stringify(body) }),
  updateWorkItem: (id: string, body: Record<string, unknown>) =>
    api<WorkItem>(`/work-items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  comments: (id: string) => api<Comment[]>(`/work-items/${id}/comments`),
  addComment: (id: string, body: string) =>
    api<Comment>(`/work-items/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  itemLinks: (id: string) => api<WorkItemLink[]>(`/work-items/${id}/links`),
  addItemLink: (id: string, url: string, title?: string) =>
    api<WorkItemLink>(`/work-items/${id}/links`, {
      method: "POST",
      body: JSON.stringify({ url, title: title || undefined }),
    }),
  deleteItemLink: (id: string, linkId: string) =>
    api<{ ok: boolean }>(`/work-items/${id}/links/${linkId}`, { method: "DELETE" }),
  itemActivity: (id: string) => api<Activity[]>(`/work-items/${id}/activity`),
  relations: (id: string) => api<Relation[]>(`/work-items/${id}/relations`),
  addRelation: (id: string, target_id: string, relation_type: string) =>
    api<Relation>(`/work-items/${id}/relations`, {
      method: "POST",
      body: JSON.stringify({ target_id, relation_type }),
    }),
  deleteRelation: (id: string, relationId: string) =>
    api<{ ok: boolean }>(`/work-items/${id}/relations/${relationId}`, { method: "DELETE" }),
  graph: (id: string) => api<GraphPayload>(`/work-items/${id}/graph`),
  workflows: () => api<Workflow[]>("/workflows"),
  workflow: (id: string) => api<Workflow>(`/workflows/${id}`),
  saveWorkflow: (id: string, body: Partial<Workflow> & { name: string; states: WorkflowState[]; transitions: WorkflowTransition[] }) =>
    api<Workflow>(`/workflows/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  createWorkflow: (body: { name: string; preset?: string }) =>
    api<Workflow>("/workflows", { method: "POST", body: JSON.stringify(body) }),
  workItemTypes: () => api<WorkItemType[]>("/work-item-types"),
  updateWorkItemType: (id: string, body: Partial<WorkItemType>) =>
    api<WorkItemType>(`/work-item-types/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  createWorkItemType: (body: Partial<WorkItemType> & { name: string }) =>
    api<WorkItemType>("/work-item-types", { method: "POST", body: JSON.stringify(body) }),
  saveTypeGraph: (body: {
    nodes: Array<{
      id: string;
      layout_x: number;
      layout_y: number;
      name?: string;
      color?: string;
      description?: string | null;
      fields?: Array<Record<string, unknown>>;
      workflow_id?: string | null;
      detail_layout?: {
        main: Array<{ kind: "system" | "field"; key: string }>;
        sidebar: Array<{ kind: "system" | "field"; key: string }>;
      } | null;
    }>;
    edges: TypeGraphEdge[];
  }) => api<WorkItemType[]>("/work-item-types/graph", { method: "PUT", body: JSON.stringify(body) }),
  sprints: (projectId?: string) =>
    api<Sprint[]>(`/sprints${projectId ? `?project_id=${projectId}` : ""}`),
  createSprint: (body: Record<string, unknown>) =>
    api<Sprint>("/sprints", { method: "POST", body: JSON.stringify(body) }),
  updateSprint: (id: string, body: Record<string, unknown>) =>
    api<Sprint>(`/sprints/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  milestones: (projectId?: string) =>
    api<Milestone[]>(`/milestones${projectId ? `?project_id=${projectId}` : ""}`),
  createMilestone: (body: Record<string, unknown>) =>
    api<Milestone>("/milestones", { method: "POST", body: JSON.stringify(body) }),
  members: () => api<Array<{ id: string; name: string; email: string; role: string }>>("/members"),
  plan: (prompt: string, project_id?: string, apply = false) =>
    api<{
      summary: string;
      source: string;
      items: { type: string; title: string; priority: string }[];
      created: WorkItem[];
    }>("/agent/plan", { method: "POST", body: JSON.stringify({ prompt, project_id, apply }) }),
  notifications: (unread = false) =>
    api<Notification[]>(`/notifications${unread ? "?unread=true" : ""}`),
  readNotification: (id: string) =>
    api<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
  readAllNotifications: () => api<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
  views: (projectId?: string) =>
    api<SavedView[]>(`/views${projectId ? `?project_id=${projectId}` : ""}`),
  createView: (body: { name: string; project_id?: string; filters: Record<string, unknown> }) =>
    api<SavedView>("/views", { method: "POST", body: JSON.stringify(body) }),
  deleteView: (id: string) => api<{ ok: boolean }>(`/views/${id}`, { method: "DELETE" }),
  documents: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return api<ProjectDocument[]>(`/documents${q ? `?${q}` : ""}`);
  },
  createDocument: (body: Record<string, unknown>) =>
    api<ProjectDocument>("/documents", { method: "POST", body: JSON.stringify(body) }),
  deleteDocument: (id: string) => api<{ ok: boolean }>(`/documents/${id}`, { method: "DELETE" }),
  children: (id: string) => api<WorkItem[]>(`/work-items/${id}/children`),
  gitLinks: (id: string) => api<GitLink[]>(`/work-items/${id}/git-links`),
  addGitLink: (id: string, body: Partial<GitLink> & { url: string; repo: string }) =>
    api<GitLink>(`/work-items/${id}/git-links`, { method: "POST", body: JSON.stringify(body) }),
  deleteGitLink: (id: string, linkId: string) =>
    api<{ ok: boolean }>(`/work-items/${id}/git-links/${linkId}`, { method: "DELETE" }),
  integrations: () => api<IntegrationRow[]>("/integrations"),
  saveIntegration: (provider: string, config: Record<string, unknown>, enabled = true) =>
    api<{ ok: boolean; connected: boolean; provider: string }>(`/integrations/${provider}`, {
      method: "PUT",
      body: JSON.stringify({ provider, config, enabled }),
    }),
  testIntegration: (provider: string) =>
    api<{ ok: boolean }>(`/integrations/${provider}/test`, { method: "POST" }),
  bindings: () => api<IdentityBinding[]>("/integrations/bindings"),
  bindIdentity: (provider: string, external_id: string) =>
    api<IdentityBinding>("/integrations/bindings", {
      method: "POST",
      body: JSON.stringify({ provider, external_id }),
    }),
  oidc: (provider: string) =>
    api<{ status: string; provider: string; hint: string; authorize_url: string | null }>(
      `/integrations/oidc/${provider}`,
    ),
};
