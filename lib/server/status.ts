import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Agent, AgentStatus, AttentionKind, HookPayload } from '@/lib/types';

export function applyHookEvent(
  agent: Pick<Agent, 'open_request_count'>,
  hook: HookPayload,
  now: Date = new Date(),
): Partial<Agent> {
  const open = agent.open_request_count > 0;
  const busy: AgentStatus = open ? 'waiting_on_human' : 'running';
  const clear = { attention_kind: null, attention_message: null } as const;
  switch (hook.hook_event_name) {
    case 'SessionStart':
    case 'UserPromptSubmit':
      return { status: busy, ...clear, ended_at: null };
    case 'PreToolUse': {
      if (hook.tool_name === 'AskUserQuestion') {
        const input = (hook.tool_input ?? {}) as { questions?: { question?: string }[] };
        return {
          status: 'waiting_on_human',
          attention_kind: 'question',
          attention_message: input.questions?.[0]?.question ?? 'Asked a question in the terminal',
        };
      }
      if (hook.tool_name === 'ExitPlanMode') {
        return { status: 'waiting_on_human', attention_kind: 'question', attention_message: 'Plan ready for approval in the terminal' };
      }
      return { status: busy, ...clear };
    }
    case 'PostToolUse':
      return { status: busy, ...clear };
    case 'Notification': {
      const message = typeof hook.message === 'string' ? hook.message : undefined;
      const kind: AttentionKind =
        (message && /permission/i.test(message)) || hook.notification_type === 'permission_prompt' ? 'permission' : 'input';
      return { status: 'waiting_on_human', attention_kind: kind, attention_message: message ?? 'Needs attention' };
    }
    case 'Stop':
      return { status: open ? 'waiting_on_human' : 'idle', ...clear };
    case 'SessionEnd':
      return { status: 'ended', ...clear, ended_at: now.toISOString() };
    default:
      return {};
  }
}

export async function recomputeAgentRequests(admin: SupabaseClient, agentId: string | null | undefined): Promise<void> {
  if (!agentId) return;
  const nowIso = new Date().toISOString();
  const { count } = await admin
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('status', 'open')
    .gt('expires_at', nowIso);
  const n = count ?? 0;
  const { data: agent } = await admin.from('agents').select('status, attention_kind').eq('id', agentId).maybeSingle();
  if (!agent) return;
  if (agent.status === 'ended') {
    await admin.from('agents').update({ open_request_count: n }).eq('id', agentId);
  } else if (n > 0) {
    await admin.from('agents').update({ open_request_count: n, status: 'waiting_on_human' }).eq('id', agentId);
  } else if (agent.status === 'waiting_on_human' && agent.attention_kind === null) {
    await admin.from('agents').update({ open_request_count: 0, status: 'running' }).eq('id', agentId);
  } else {
    await admin.from('agents').update({ open_request_count: 0 }).eq('id', agentId);
  }
}
