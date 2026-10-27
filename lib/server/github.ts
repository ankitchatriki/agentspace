import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { truncatePayload } from './truncate';

export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface SummarizedGithubEvent {
  title: string;
  url: string | null;
  ref: string | null;
  actor_login: string | null;
  action: string | null;
  payload: Record<string, unknown>;
  ignored?: boolean;
}

export function summarizeGithubEvent(eventType: string, p: Obj): SummarizedGithubEvent {
  const action: string | null = p.action ?? null;
  const actor: string | null = p.sender?.login ?? null;
  let title = `${eventType}${action ? '.' + action : ''}`;
  let url: string | null = null;
  let ref: string | null = null;
  let ignored = false;
  let payload: Obj = p;

  switch (eventType) {
    case 'push': {
      const n = Array.isArray(p.commits) ? p.commits.length : 0;
      const branch = String(p.ref ?? '').replace(/^refs\/(heads|tags)\//, '');
      const who = p.pusher?.name ?? actor ?? 'someone';
      title = `${who} pushed ${n} commit${n === 1 ? '' : 's'} to ${branch}`;
      url = p.compare ?? null;
      ref = p.ref ?? null;
      payload = {
        ref: p.ref,
        before: p.before,
        after: p.after,
        compare: p.compare,
        head_commit: p.head_commit
          ? { id: p.head_commit.id, message: p.head_commit.message, url: p.head_commit.url }
          : null,
        commits: (p.commits ?? []).slice(0, 20).map((c: Obj) => ({
          id: c.id,
          message: c.message,
          author: { name: c.author?.name },
        })),
      };
      break;
    }
    case 'pull_request': {
      const pr = p.pull_request ?? {};
      title = `PR #${p.number ?? pr.number} ${pr.merged ? 'merged' : action}: ${pr.title ?? ''}`;
      url = pr.html_url ?? null;
      ref = pr.head?.ref ?? null;
      break;
    }
    case 'pull_request_review': {
      const pr = p.pull_request ?? {};
      title = `Review ${p.review?.state ?? action} on PR #${pr.number}: ${pr.title ?? ''}`;
      url = p.review?.html_url ?? pr.html_url ?? null;
      ref = pr.head?.ref ?? null;
      break;
    }
    case 'issue_comment': {
      title = `Comment on #${p.issue?.number}: ${p.issue?.title ?? ''}`;
      url = p.comment?.html_url ?? p.issue?.html_url ?? null;
      break;
    }
    case 'workflow_run': {
      const w = p.workflow_run ?? {};
      if (action !== 'completed') ignored = true;
      title = `Workflow ${w.name ?? p.workflow?.name ?? ''} ${w.conclusion ?? ''}`.trim();
      url = w.html_url ?? null;
      ref = w.head_branch ?? null;
      break;
    }
    default:
      url = p.repository?.html_url ?? null;
  }
  return {
    title: title.slice(0, 500),
    url,
    ref,
    actor_login: actor,
    action,
    payload: truncatePayload(payload, 65_536),
    ...(ignored ? { ignored } : {}),
  };
}
