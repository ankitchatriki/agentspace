import type {
  AgentRequest,
  CreateProjectBody,
  CreateTokenResponse,
  JoinTeamResponse,
  Project,
  Team,
  UpdateProjectBody,
  WebhookSecretResponse,
} from '@/lib/types';

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}

export const answerRequest = (id: string, answer: string) =>
  call<{ request: AgentRequest }>('POST', `/api/requests/${id}/answer`, { answer });
export const dismissRequest = (id: string, reason?: string) =>
  call<{ request: AgentRequest }>('POST', `/api/requests/${id}/dismiss`, reason ? { reason } : {});
export const createProject = (body: CreateProjectBody) => call<{ project: Project }>('POST', '/api/projects', body);
export const updateProject = (id: string, body: UpdateProjectBody) =>
  call<{ project: Project }>('PATCH', `/api/projects/${id}`, body);
export const deleteProject = (id: string) => call<{ ok: true }>('DELETE', `/api/projects/${id}`);
export const createToken = (projectId: string, label?: string) =>
  call<CreateTokenResponse>('POST', `/api/projects/${projectId}/tokens`, label ? { label } : {});
export const revokeToken = (projectId: string, tokenId: string) =>
  call<{ ok: true }>('DELETE', `/api/projects/${projectId}/tokens/${tokenId}`);
export const createWebhookSecret = (projectId: string) =>
  call<WebhookSecretResponse>('POST', `/api/projects/${projectId}/webhook-secret`, {});
export const joinTeam = (code: string) => call<JoinTeamResponse>('POST', '/api/teams/join', { code });
export const renameTeam = (id: string, name: string) => call<{ team: Team }>('PATCH', `/api/teams/${id}`, { name });
export const rotateInviteCode = (id: string) =>
  call<{ invite_code: string }>('POST', `/api/teams/${id}/invite-code`, {});
