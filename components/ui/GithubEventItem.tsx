import {
  CircleDot, GitBranch, GitCommitHorizontal, GitMerge, GitPullRequest, MessageCircle, PlayCircle, Zap,
} from 'lucide-react';
import type { GithubEvent } from '@/lib/types';
import { RelativeTime } from './RelativeTime';

const ICONS: Record<string, typeof Zap> = {
  push: GitCommitHorizontal,
  pull_request: GitPullRequest,
  pull_request_review: GitMerge,
  issue_comment: MessageCircle,
  issues: CircleDot,
  workflow_run: PlayCircle,
  create: GitBranch,
};

export function GithubEventItem({ event }: { event: GithubEvent }) {
  const Icon = ICONS[event.event_type] ?? Zap;
  const title = event.url ? (
    <a href={event.url} target="_blank" rel="noopener noreferrer" className="font-medium text-fg hover:underline">
      {event.title}
    </a>
  ) : (
    <span className="font-medium text-fg">{event.title}</span>
  );
  return (
    <div className="flex gap-2.5 py-2.5">
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm leading-snug">{title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-fg-subtle">
          {event.actor_login && <span>@{event.actor_login}</span>}
          {event.ref && <span className="max-w-[10rem] truncate">{event.ref.replace(/^refs\/(heads|tags)\//, '')}</span>}
          <RelativeTime iso={event.created_at} />
        </p>
      </div>
    </div>
  );
}
