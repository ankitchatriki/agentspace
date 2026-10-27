import { createAdminClient } from '@/lib/supabase/admin';
import { error, json } from '@/lib/server/http';
import { env } from '@/lib/server/env';
import { summarizeGithubEvent, verifySignature } from '@/lib/server/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BYTES) return error(413, 'payload too large');
  const raw = await req.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) return error(413, 'payload too large');
  const eventType = req.headers.get('x-github-event') ?? '';
  const delivery = req.headers.get('x-github-delivery') ?? '';
  const sig = req.headers.get('x-hub-signature-256');
  if (!eventType || !delivery) return error(400, 'missing github headers');

  let payload: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    payload = JSON.parse(raw);
  } catch {
    return error(400, 'invalid JSON');
  }
  const admin = createAdminClient();
  const globalSecret = env.githubWebhookSecret;

  if (eventType === 'ping') {
    const secrets: string[] = [];
    if (globalSecret) secrets.push(globalSecret);
    const { data } = await admin.from('project_secrets').select('github_webhook_secret');
    for (const r of data ?? []) if (r.github_webhook_secret) secrets.push(r.github_webhook_secret);
    if (secrets.length === 0) return json({ ok: true, ignored: 'no projects' }, 202);
    if (secrets.some((s) => verifySignature(raw, sig, s))) return json({ ok: true, pong: true });
    return error(401, 'bad signature');
  }

  const full: string | undefined = payload.repository?.full_name;
  if (!full) return json({ ignored: 'no repository' }, 202);

  const { data: projects } = await admin.from('projects').select('id, team_id, repo_full_name').ilike('repo_full_name', full.replace(/[\\%_]/g, (c) => '\\' + c));
  const candidates = (projects ?? []).filter((p) => p.repo_full_name?.toLowerCase() === full.toLowerCase());
  if (candidates.length === 0) return json({ ignored: 'no project' }, 202);

  const { data: secretRows } = await admin
    .from('project_secrets')
    .select('project_id, github_webhook_secret')
    .in('project_id', candidates.map((c) => c.id));
  const secretByProject = new Map((secretRows ?? []).map((r) => [r.project_id, r.github_webhook_secret as string | null]));

  const accepted = candidates.filter((p) => {
    const set = [secretByProject.get(p.id), globalSecret].filter((s): s is string => !!s);
    return set.some((s) => verifySignature(raw, sig, s));
  });
  if (accepted.length === 0) return error(401, 'bad signature');

  const summary = summarizeGithubEvent(eventType, payload);
  if (summary.ignored) return json({ ignored: `${eventType}.${summary.action}` }, 202);

  let stored = 0;
  for (const p of accepted) {
    const { data, error: err } = await admin
      .from('github_events')
      .upsert(
        {
          team_id: p.team_id,
          project_id: p.id,
          delivery_id: delivery,
          event_type: eventType,
          action: summary.action,
          repo_full_name: full,
          ref: summary.ref,
          actor_login: summary.actor_login,
          title: summary.title,
          url: summary.url,
          payload: summary.payload,
        },
        { onConflict: 'project_id,delivery_id', ignoreDuplicates: true },
      )
      .select('id');
    if (err) return error(500, 'insert failed', err.message);
    stored += data?.length ?? 0;
  }
  return json({ ok: true, stored });
}
