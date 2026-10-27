// lib/types.ts: shared types for server, client and components.
// Source of truth: docs/SPEC.md §7. Change requests go to docs/DEPS_REQUESTS.md.

export type AgentStatus = 'running' | 'waiting_on_human' | 'idle' | 'ended';
export type AttentionKind = 'permission' | 'input' | 'question';
export type RequestKind = 'question' | 'action' | 'approval';
export type RequestStatus = 'open' | 'answered' | 'cancelled' | 'expired';
export type TeamRole = 'owner' | 'member';

export const HOOK_EVENT_NAMES = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'SessionEnd',
] as const;
export type KnownHookEventName = (typeof HOOK_EVENT_NAMES)[number];

/** Display/sort order: needs-human first. */
export const AGENT_STATUSES: readonly AgentStatus[] = ['waiting_on_human', 'running', 'idle', 'ended'];

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  running: 'Running',
  waiting_on_human: 'Needs you',
  idle: 'Idle',
  ended: 'Ended',
};

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  question: 'Question',
  action: 'Action needed',
  approval: 'Approval',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  open: 'Open',
  answered: 'Answered',
  cancelled: 'Dismissed',
  expired: 'Expired',
};

// ---------- database rows ----------
export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  github_login: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  repo_full_name: string | null;
  github_webhook_configured: boolean;
  created_by: string | null;
  created_at: string;
}

/** Never includes token_hash. */
export interface ProjectToken {
  id: string;
  team_id: string;
  project_id: string;
  label: string | null;
  token_prefix: string;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface Agent {
  id: string;
  team_id: string;
  project_id: string;
  session_id: string;
  name: string | null;
  role: string | null;
  human: string | null;
  host: string | null;
  cwd: string | null;
  git_branch: string | null;
  transcript_path: string | null;
  status: AgentStatus;
  attention_kind: AttentionKind | null;
  attention_message: string | null;
  last_event_name: string | null;
  last_event_summary: string | null;
  last_event_at: string;
  open_request_count: number;
  event_count: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface AgentEvent {
  id: number;
  team_id: string;
  project_id: string;
  agent_id: string;
  session_id: string;
  hook_event_name: string;
  tool_name: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  human: string | null;
  created_at: string;
}

export interface AgentRequest {
  id: string;
  team_id: string;
  project_id: string;
  agent_id: string | null;
  session_id: string | null;
  asked_by: string | null;
  kind: RequestKind;
  prompt: string;
  context: string | null;
  options: string[];
  status: RequestStatus;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface GithubEvent {
  id: number;
  team_id: string;
  project_id: string;
  delivery_id: string;
  event_type: string;
  action: string | null;
  repo_full_name: string;
  ref: string | null;
  actor_login: string | null;
  title: string;
  url: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

// ---------- view models ----------
export type ProjectRef = Pick<Project, 'id' | 'name' | 'team_id'>;
export type AgentRef = Pick<Agent, 'id' | 'session_id' | 'name' | 'role' | 'human' | 'status'>;
export type ProfileRef = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;

export interface AgentWithProject extends Agent {
  project: ProjectRef | null;
}

export interface RequestWithContext extends AgentRequest {
  agent: AgentRef | null;
  project: ProjectRef | null;
  answerer: ProfileRef | null;
}

export interface TeamMemberWithProfile extends TeamMember {
  profile: Profile | null;
}

export interface TeamWithMembers extends Team {
  members: TeamMemberWithProfile[];
  my_role: TeamRole;
}

export type StatusCounts = Record<AgentStatus, number>;

// ---------- connector / API payloads ----------
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface OkResponse {
  ok: true;
}

/** Raw JSON Claude Code passes to a hook on stdin (fields vary by event). */
export interface HookPayload {
  session_id: string;
  hook_event_name: string;
  transcript_path?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  message?: string;
  prompt?: string;
  source?: string;
  reason?: string;
  stop_hook_active?: boolean;
  [key: string]: unknown;
}

export interface ConnectorMeta {
  human?: string | null;
  agent_name?: string | null;
  agent_role?: string | null;
  host?: string | null;
  cwd?: string | null;
  git_branch?: string | null;
  redacted?: boolean;
  connector_version: string;
  sent_at: string;
}

export interface IngestBody {
  hook: HookPayload;
  meta: ConnectorMeta;
}

export interface IngestResponse {
  ok: true;
  agent_id: string;
  status: AgentStatus;
}

export interface CreateRequestBody {
  session_id?: string | null;
  prompt: string;
  kind?: RequestKind;
  options?: string[];
  context?: string | null;
  expires_in_sec?: number;
  asked_by?: string | null;
  meta: ConnectorMeta;
}

export interface CreateRequestResponse {
  id: string;
  status: 'open';
  agent_id: string;
  expires_at: string;
  url: string;
}

export interface RequestPollResponse {
  id: string;
  status: RequestStatus;
  kind: RequestKind;
  answer: string | null;
  answered_by_name: string | null;
  answered_at: string | null;
  expires_at: string;
}

export interface AnswerRequestBody {
  answer: string;
}

export interface DismissRequestBody {
  reason?: string | null;
}

export interface RequestMutationResponse {
  request: AgentRequest;
}

export interface CreateProjectBody {
  team_id: string;
  name: string;
  description?: string | null;
  repo_full_name?: string | null;
}

export type UpdateProjectBody = Partial<Pick<CreateProjectBody, 'name' | 'description' | 'repo_full_name'>>;

export interface ProjectResponse {
  project: Project;
}

export interface CreateTokenBody {
  label?: string | null;
}

export interface CreateTokenResponse {
  token: string;
  token_meta: ProjectToken;
}

export interface WebhookSecretResponse {
  secret: string;
  webhook_url: string;
}

export interface JoinTeamBody {
  code: string;
}

export interface JoinTeamResponse {
  team_id: string;
  team_name: string;
}

export interface UpdateTeamBody {
  name: string;
}

export interface TeamResponse {
  team: Team;
}

export interface InviteCodeResponse {
  invite_code: string;
}

// ---------- pure helpers ----------
export const STALE_AFTER_MS = 30 * 60 * 1000;

export function agentDisplayName(a: Pick<Agent, 'name' | 'role' | 'session_id'>): string {
  if (a.name) return a.name;
  const short = a.session_id.startsWith('adhoc:') ? 'ad-hoc' : a.session_id.slice(0, 8);
  return `${a.role ?? 'agent'} · ${short}`;
}

export function isStale(a: Pick<Agent, 'status' | 'last_event_at'>, now: number = Date.now()): boolean {
  return a.status === 'running' && now - new Date(a.last_event_at).getTime() > STALE_AFTER_MS;
}

export function isRequestLive(r: Pick<AgentRequest, 'status' | 'expires_at'>, now: number = Date.now()): boolean {
  return r.status === 'open' && new Date(r.expires_at).getTime() > now;
}

/** Agent needs a human in the terminal (not via an Agentspace request). */
export function needsTerminalAttention(a: Pick<Agent, 'status' | 'open_request_count'>): boolean {
  return a.status === 'waiting_on_human' && a.open_request_count === 0;
}

export function emptyStatusCounts(): StatusCounts {
  return { running: 0, waiting_on_human: 0, idle: 0, ended: 0 };
}
