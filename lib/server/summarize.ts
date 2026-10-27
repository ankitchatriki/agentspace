import type { HookPayload } from '@/lib/types';

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function rel(p: string, cwd?: string): string {
  if (cwd && p.startsWith(cwd.endsWith('/') ? cwd : cwd + '/')) return p.slice(cwd.length).replace(/^\//, '');
  return p;
}

function detail(hook: HookPayload): string {
  const input = (hook.tool_input && typeof hook.tool_input === 'object' ? hook.tool_input : {}) as Record<string, unknown>;
  switch (hook.tool_name) {
    case 'Bash':
      return cut(str(input.command), 120);
    case 'Read':
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return rel(str(input.file_path ?? input.notebook_path), hook.cwd);
    case 'Grep':
    case 'Glob':
      return str(input.pattern);
    case 'WebFetch':
      return str(input.url);
    case 'WebSearch':
      return str(input.query);
    case 'Task':
    case 'Agent':
      return str(input.description);
    case 'TodoWrite':
      return 'updated todos';
    default:
      return '';
  }
}

export function summarizeHookEvent(hook: HookPayload, redacted: boolean): string {
  let s: string;
  switch (hook.hook_event_name) {
    case 'SessionStart':
      s = `Session started (${hook.source ?? 'startup'})`;
      break;
    case 'UserPromptSubmit':
      s = redacted || hook.prompt === undefined ? 'Prompt (redacted)' : `Prompt: ${cut(str(hook.prompt), 160)}`;
      break;
    case 'PreToolUse':
      s = `${hook.tool_name ?? 'Tool'}: ${detail(hook)}`.trimEnd();
      break;
    case 'PostToolUse': {
      const r = hook.tool_response as Record<string, unknown> | string | undefined;
      const isErr = !!(r && typeof r === 'object' && (r.is_error || r.error));
      s = `${hook.tool_name ?? 'Tool'} ${isErr ? '✗' : '✓'} ${detail(hook)}`.trimEnd();
      break;
    }
    case 'Notification':
      s = str(hook.message) || 'Needs attention';
      break;
    case 'Stop':
      s = 'Turn finished';
      break;
    case 'SubagentStop':
      s = 'Subagent finished';
      break;
    case 'SessionEnd':
      s = `Session ended (${hook.reason ?? 'unknown'})`;
      break;
    default:
      s = hook.hook_event_name;
  }
  return cut(s, 240);
}
