#!/usr/bin/env node
// Agentspace ask-a-human CLI. Node >= 18, no dependencies. Exit code is always 0 (2 on usage error).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const CONNECTOR_VERSION = '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function usage(msg) {
  if (msg) console.error('cc-ask: ' + msg);
  console.error('Usage: node cc-ask.mjs "question" [--kind question|action|approval] [--options "a,b,c"] [--context "…"] [--timeout 540] [--expires 86400] [--session <id>] [--as <name>] [--resume <request_id>] [--no-wait]');
  process.exit(2);
}

function parseArgs(argv) {
  const out = { positional: [] };
  const valued = new Set(['kind', 'options', 'context', 'timeout', 'expires', 'session', 'as', 'resume']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-wait') out.noWait = true;
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (!valued.has(key)) usage('unknown option --' + key);
      let val;
      if (eq > 0) val = a.slice(eq + 1);
      else { val = argv[++i]; if (val === undefined) usage('missing value for --' + key); }
      out[key] = val;
    } else out.positional.push(a);
  }
  return out;
}

function loadConfig() {
  let url = process.env.AGENTSPACE_URL;
  let token = process.env.AGENTSPACE_TOKEN;
  let user;
  try {
    const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
    url = url || cfg.url;
    token = token || cfg.token;
    user = cfg.user;
  } catch {}
  if (typeof url === 'string') url = url.replace(/\/+$/, '');
  return { url, token, user };
}

function resolveHuman(cfgUser) {
  if (process.env.CC_USER) return process.env.CC_USER;
  if (cfgUser) return cfgUser;
  try {
    const e = execFileSync('git', ['config', 'user.email'], { timeout: 1000, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
    if (e) return e;
  } catch {}
  try { return os.userInfo().username; } catch { return null; }
}

const args = parseArgs(process.argv.slice(2));
const prompt = args.positional.join(' ').trim();
if (!args.resume && !prompt) usage('a question is required');
if (args.kind && !['question', 'action', 'approval'].includes(args.kind)) usage('invalid --kind');
const timeoutSec = args.timeout !== undefined ? Number(args.timeout) : 540;
const expiresSec = args.expires !== undefined ? Number(args.expires) : 86400;
if (!Number.isFinite(timeoutSec) || timeoutSec < 0) usage('invalid --timeout');
if (!Number.isFinite(expiresSec) || expiresSec < 60 || expiresSec > 604800) usage('--expires must be 60..604800');

const { url, token, user } = loadConfig();
const unavailable = (reason) => {
  console.log(`[agentspace] UNAVAILABLE: ${reason}. Ask the human directly in the terminal.`);
  process.exit(0);
};
if (!url || !token) unavailable('Agentspace is not configured (missing url/token)');

const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + token };
let requestId = args.resume || null;

async function http(method, path, body, timeoutMs = 10000) {
  const res = await fetch(url + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

let cancelling = false;
async function onSignal() {
  if (cancelling) return;
  cancelling = true;
  try {
    if (requestId) await http('POST', `/api/requests/${requestId}/cancel`, {}, 2000);
  } catch {}
  process.exit(0);
}
process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);

async function create() {
  const session = args.session || process.env.CC_SESSION_ID || process.env.CLAUDE_SESSION_ID || undefined;
  const askedBy = args.as || process.env.CC_AGENT_NAME || undefined;
  const body = {
    session_id: session,
    prompt,
    kind: args.kind || 'question',
    options: args.options ? args.options.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10) : undefined,
    context: args.context || undefined,
    expires_in_sec: expiresSec,
    asked_by: askedBy,
    meta: {
      human: resolveHuman(user),
      agent_name: process.env.CC_AGENT_NAME || null,
      agent_role: process.env.CC_AGENT_ROLE || null,
      host: os.hostname(),
      cwd: process.cwd(),
      connector_version: CONNECTOR_VERSION,
      sent_at: new Date().toISOString(),
    },
  };
  const backoff = [1000, 3000];
  let lastErr = 'unknown error';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await http('POST', '/api/requests', body, 10000);
      if (r.status === 201 && r.data && r.data.id) return r.data;
      if (r.status === 401) unavailable('invalid or revoked token');
      lastErr = `server responded ${r.status}${r.data && r.data.error ? ' (' + r.data.error + ')' : ''}`;
      if (r.status >= 400 && r.status < 500) break;
    } catch (e) {
      lastErr = e && e.message ? e.message : String(e);
    }
    if (attempt < 2) await sleep(backoff[attempt]);
  }
  unavailable(lastErr);
}

async function main() {
  if (!requestId) {
    const created = await create();
    requestId = created.id;
    if (args.noWait) {
      console.log(`[agentspace] REQUEST ${requestId} created`);
      return;
    }
  } else if (args.noWait) {
    console.log(`[agentspace] REQUEST ${requestId} resumed`);
    return;
  }

  const start = Date.now();
  while (true) {
    const elapsed = (Date.now() - start) / 1000;
    if (elapsed >= timeoutSec) {
      console.log(`[agentspace] TIMEOUT after ${Math.round(elapsed)}s; request ${requestId} is still open. Re-run with --resume ${requestId} to keep waiting.`);
      return;
    }
    try {
      const r = await http('GET', `/api/requests/${requestId}`, undefined, 10000);
      if (r.status === 404) { unavailable('request not found'); }
      if (r.status === 401) { unavailable('invalid or revoked token'); }
      const d = r.data;
      if (r.status === 200 && d) {
        if (d.status === 'answered') {
          if (d.answered_by_name) console.error(`[agentspace] answered by ${d.answered_by_name}`);
          console.log(d.answer ?? '');
          return;
        }
        if (d.status === 'cancelled') {
          console.log(`[agentspace] CANCELLED: the human dismissed this request.${d.answer ? ' Reason: ' + d.answer : ''}`);
          return;
        }
        if (d.status === 'expired') {
          console.log('[agentspace] EXPIRED: no answer before the request expired.');
          return;
        }
      }
    } catch {}
    await sleep(elapsed < 60 ? 2000 : 5000);
  }
}

main().catch((e) => unavailable(e && e.message ? e.message : String(e))).finally(() => process.exit(0));
