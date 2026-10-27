#!/usr/bin/env node
// Agentspace hook connector. Node >= 18, no dependencies. Always exits 0.
import { readFileSync, writeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const CONNECTOR_VERSION = '1';
const DEBUG = process.env.AGENTSPACE_DEBUG === '1';

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

function debug(...a) {
  if (DEBUG) {
    try { console.error('[agentspace]', ...a); } catch {}
  }
}

function readStdin(timeoutMs = 2000) {
  return new Promise((resolve) => {
    let buf = '';
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(buf); } };
    const timer = setTimeout(finish, timeoutMs);
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => { buf += c; });
      process.stdin.on('end', () => { clearTimeout(timer); finish(); });
      process.stdin.on('error', () => { clearTimeout(timer); finish(); });
    } catch { clearTimeout(timer); finish(); }
  });
}

function loadConfig() {
  let url = process.env.AGENTSPACE_URL;
  let token = process.env.AGENTSPACE_TOKEN;
  let user;
  if (!url || !token) {
    try {
      const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
      url = url || cfg.url;
      token = token || cfg.token;
      user = cfg.user;
    } catch {}
  } else {
    try {
      user = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8')).user;
    } catch {}
  }
  if (typeof url === 'string') url = url.replace(/\/+$/, '');
  return { url, token, user };
}

function git(args, cwd, timeout) {
  try {
    return execFileSync('git', args, { cwd, timeout, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim() || null;
  } catch { return null; }
}

function resolveHuman(cfgUser, cwd) {
  if (process.env.CC_USER) return process.env.CC_USER;
  if (cfgUser) return cfgUser;
  const email = git(['config', 'user.email'], cwd, 1000);
  if (email) return email;
  try { return os.userInfo().username; } catch { return null; }
}

function previewResponse(resp) {
  if (resp === undefined || resp === null) return resp;
  let s;
  try { s = typeof resp === 'string' ? resp : JSON.stringify(resp); } catch { return '[unserializable]'; }
  if (s.length <= 2000) return resp;
  return s.slice(0, 2000) + '…[truncated]';
}

function writeStdout(text) {
  try { writeSync(1, text); } catch {}
}

async function main() {
  const raw = await readStdin();
  let hook;
  try { hook = JSON.parse(raw); } catch { return; }
  if (!hook || typeof hook !== 'object' || !hook.session_id || !hook.hook_event_name) return;

  const { url, token, user } = loadConfig();
  if (!url || !token) return;

  const cwd = typeof hook.cwd === 'string' ? hook.cwd : process.cwd();
  const redacted = process.env.AGENTSPACE_REDACT_PROMPTS === '1';
  if (redacted) delete hook.prompt;
  if ('tool_response' in hook) hook.tool_response = previewResponse(hook.tool_response);

  const ev = hook.hook_event_name;
  const gitBranch = ev === 'SessionStart' || ev === 'Stop' ? git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, 500) : null;

  if (ev === 'SessionStart' && process.env.AGENTSPACE_QUIET !== '1') {
    const id = hook.session_id;
    writeStdout(
      `[Agentspace] This session is tracked in the team command center (session_id=${id}).\n` +
      `When you need information, a decision, or an action from a human, ask there instead of waiting in the terminal:\n` +
      `  node .claude/agentspace/cc-ask.mjs --session ${id} "your question" [--kind question|action|approval] [--options "a,b"] [--context "details"] [--as <your-name>]\n` +
      `Run it with the Bash tool timeout set to 600000. It blocks until a human answers and prints the answer.\n` +
      `If the output starts with "[agentspace] TIMEOUT", re-run with --resume <request_id> to keep waiting.\n` +
      `If it starts with "[agentspace] UNAVAILABLE", ask in the terminal instead.\n`,
    );
  }

  const body = JSON.stringify({
    hook,
    meta: {
      human: resolveHuman(user, cwd),
      agent_name: process.env.CC_AGENT_NAME || null,
      agent_role: process.env.CC_AGENT_ROLE || null,
      host: os.hostname(),
      cwd,
      git_branch: gitBranch,
      redacted,
      connector_version: CONNECTOR_VERSION,
      sent_at: new Date().toISOString(),
    },
  });

  try {
    const res = await fetch(url + '/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body,
      signal: AbortSignal.timeout(3000),
    });
    debug('ingest', res.status);
  } catch (e) {
    debug('ingest failed', e && e.message);
  }
}

main().catch(() => {}).finally(() => process.exit(0));
