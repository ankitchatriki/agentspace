# Agentspace — Command Center v1 Spec

Agentspace is a web app where a team watches all of its Claude Code agents, across all projects, as they work. When an agent needs something from a human, it asks in the app's request inbox and waits there. A teammate answers in the browser, and the agent receives the answer on stdout.

```
Claude Code (user + teammates)
  ├─ .claude/agentspace/hook.mjs   ── POST /api/ingest ─────────┐
  └─ .claude/agentspace/cc-ask.mjs ── POST /api/requests         │
                                   ── GET  /api/requests/[id] ◄──┤ (poll for answer)
GitHub webhook (push, PR, …) ────── POST /api/github/webhook ────┤
                                                                 ▼
                               Next.js API routes (Vercel, service role)
                                                                 │
                                                       Supabase Postgres
                                                                 │ Realtime (RLS-filtered)
                                                                 ▼
                                   React dashboard (Supabase Auth, GitHub OAuth)
                                   └─ POST /api/requests/[id]/answer
```

Rules everyone follows:
- Next.js 15 App Router + TypeScript (strict), Tailwind v3, Supabase (`@supabase/ssr`). The repo root is the app root.
- **Reads** in the dashboard go straight to Supabase from the browser or RSC client, and RLS guards them. **Writes** always go through `app/api/**` routes. The browser never writes to Supabase directly.
- Next 15 specifics: route handler and page `params` are a **Promise** (`{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params`), and `cookies()` is async.
- Every API route file sets `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
- Error JSON is always `{ "error": string, "details"?: unknown }`.
- Do not commit or push. The orchestrator handles git.

---

## 0. Phasing, file ownership, dependencies

### 0.1 Phase 0: Coder A scaffold (do this FIRST, about 10 minutes)
Coder A creates these files in order, runs `npm install`, then creates `docs/SCAFFOLD_READY.md` (one line: "scaffold ready"). The designer and Coder B may write their own files right away, but they **must not run `npm`/`npx`/`next` until `docs/SCAFFOLD_READY.md` exists**. Only Coder A ever runs `npm install`.

1. `package.json` (exact contents in §0.3)
2. `tsconfig.json` (strict, `"baseUrl": "."`, `"paths": { "@/*": ["./*"] }`, `"moduleResolution": "bundler"`, `"jsx": "preserve"`, `"plugins": [{ "name": "next" }]`, include `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`; exclude `node_modules`, `connector`)
3. `next.config.ts`:
   ```ts
   import type { NextConfig } from 'next';
   const nextConfig: NextConfig = {
     eslint: { ignoreDuringBuilds: true },
     outputFileTracingIncludes: { '/api/connector/[file]': ['./connector/**'] },
   };
   export default nextConfig;
   ```
4. `postcss.config.mjs` → `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`
5. `tailwind.config.ts`: a **stub**. It holds `content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}']` and the token color mapping from §4.1 verbatim. **After Phase 0 the designer owns it.**
6. `app/globals.css`: a **stub** with `@tailwind base; @tailwind components; @tailwind utilities;` plus the CSS variables from §4.1 (placeholder values are fine). **After Phase 0 the designer owns it.**
7. `app/layout.tsx`: a minimal root layout. It imports `./globals.css`, sets `metadata = { title: 'Agentspace', description: 'Agent command center' }`, and renders `<html lang="en"><body className="bg-canvas text-fg antialiased">{children}</body></html>`. Coder A owns it. It never contains nav.
8. `lib/types.ts`: verbatim from §7.
9. `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`, `middleware.ts` (signatures in §2.0)
10. `.env.example` (§8)
11. `docs/DEPS_REQUESTS.md` with the header `# Dependency requests (designer / Coder B append; Coder A installs)`
12. `npm install`, then `docs/SCAFFOLD_READY.md`

### 0.2 Ownership (no file has two owners)
| Owner | Files |
|---|---|
| **DESIGNER** | `tailwind.config.ts` (after Phase 0), `app/globals.css` (after Phase 0), `components/ui/**` (including `components/ui/index.ts` barrel and `components/ui/cn.ts`), `app/styleguide/page.tsx` |
| **CODER A** (backend) | `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts`, `app/layout.tsx`, `middleware.ts`, `lib/types.ts`, `lib/supabase/*`, `lib/server/*`, `supabase/**`, `app/api/**`, `app/auth/**`, `connector/**`, `.env.example`, `README.md`, `docs/SCAFFOLD_READY.md` |
| **CODER B** (frontend) | `app/(dashboard)/**` (including `app/(dashboard)/_components/*`), `app/login/**`, `lib/hooks/*`, `lib/client/*` |
| Anyone (append only) | `docs/DEPS_REQUESTS.md` |

- **Nobody creates `app/page.tsx`.** `/` is served by `app/(dashboard)/page.tsx`.
- The designer and Coder B never touch `package.json`. If they need a dependency, they append a line to `docs/DEPS_REQUESTS.md` (`- pkg@^x.y — why — requester`) and Coder A installs it.
- If someone needs a change in a file they do not own (for example a missing field in `lib/types.ts`), they append it to `docs/DEPS_REQUESTS.md` under `## Change requests`, and the owner applies it.
- Coder B builds against the component contracts in §4.3 even before the designer finishes. The designer must implement **exactly** those names and props. Extra optional props are fine.

### 0.3 `package.json` (pre-decided; covers the whole v1)
```json
{
  "name": "agentspace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18.18" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "check:connector": "node --check connector/hook.mjs && node --check connector/cc-ask.mjs"
  },
  "dependencies": {
    "next": "^15.5.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@supabase/supabase-js": "^2.49.0",
    "@supabase/ssr": "^0.6.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.468.0",
    "date-fns": "^4.1.0",
    "zod": "^3.24.1",
    "server-only": "^0.0.1"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20"
  }
}
```
Notes: `"type": "module"` means config files are ESM. The `.mjs` connector scripts have **no dependencies**, so `node:` built-ins and global `fetch` (Node 18 or later) only.

---

## 1. Data model: `supabase/migrations/0001_init.sql`

Coder A writes this file verbatim. It must be idempotent enough to run once on a fresh Supabase project, either pasted into the SQL editor or applied with `supabase db push`.

```sql
-- =========================================================
-- Agentspace 0001_init
-- =========================================================

-- ---------- tables ----------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  github_login text,
  created_at   timestamptz not null default now()
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.team_members (
  team_id   uuid not null references public.teams(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members(user_id);

create table public.projects (
  id                        uuid primary key default gen_random_uuid(),
  team_id                   uuid not null references public.teams(id) on delete cascade,
  name                      text not null check (char_length(name) between 1 and 80),
  description               text,
  repo_full_name            text check (repo_full_name is null or repo_full_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  github_webhook_configured boolean not null default false,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now()
);
create index projects_team_idx on public.projects(team_id);
create index projects_repo_idx on public.projects(lower(repo_full_name));
create unique index projects_team_repo_uidx on public.projects(team_id, lower(repo_full_name)) where repo_full_name is not null;

-- service-role only (RLS on, no policies): webhook secrets must be readable in plaintext for HMAC
create table public.project_secrets (
  project_id            uuid primary key references public.projects(id) on delete cascade,
  github_webhook_secret text,
  updated_at            timestamptz not null default now()
);

create table public.project_tokens (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  label        text,
  token_prefix text not null,            -- first 12 chars of plaintext, e.g. "ags_AbC123xy"
  token_hash   text not null unique,     -- sha256 hex of full plaintext token
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index project_tokens_project_idx on public.project_tokens(project_id);

-- one row per Claude Code session
create table public.agents (
  id                 uuid primary key default gen_random_uuid(),
  team_id            uuid not null references public.teams(id) on delete cascade,
  project_id         uuid not null references public.projects(id) on delete cascade,
  session_id         text not null,
  name               text,               -- CC_AGENT_NAME
  role               text,               -- CC_AGENT_ROLE
  human              text,               -- CC_USER / git email
  host               text,
  cwd                text,
  git_branch         text,
  transcript_path    text,
  status             text not null default 'running'
                     check (status in ('running','waiting_on_human','idle','ended')),
  attention_kind     text check (attention_kind in ('permission','input','question')),
  attention_message  text,
  last_event_name    text,
  last_event_summary text,
  last_event_at      timestamptz not null default now(),
  open_request_count int not null default 0,
  event_count        int not null default 0,
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  created_at         timestamptz not null default now(),
  unique (project_id, session_id)
);
create index agents_team_last_idx    on public.agents(team_id, last_event_at desc);
create index agents_project_last_idx on public.agents(project_id, last_event_at desc);
create index agents_team_status_idx  on public.agents(team_id, status);

create table public.events (
  id              bigint generated always as identity primary key,
  team_id         uuid not null references public.teams(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  agent_id        uuid not null references public.agents(id) on delete cascade,
  session_id      text not null,
  hook_event_name text not null,
  tool_name       text,
  summary         text,
  payload         jsonb not null default '{}'::jsonb,
  human           text,
  created_at      timestamptz not null default now()
);
create index events_agent_idx   on public.events(agent_id, created_at desc);
create index events_project_idx on public.events(project_id, created_at desc);
create index events_team_idx    on public.events(team_id, created_at desc);
create index events_ask_corr_idx on public.events(project_id, created_at desc)
  where hook_event_name = 'PreToolUse' and tool_name = 'Bash';

create table public.requests (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  agent_id    uuid references public.agents(id) on delete set null,
  session_id  text,
  asked_by    text,                       -- label of asking (sub)agent, e.g. "coder-b"
  kind        text not null default 'question' check (kind in ('question','action','approval')),
  prompt      text not null check (char_length(prompt) between 1 and 4000),
  context     text,
  options     text[] not null default '{}',
  status      text not null default 'open' check (status in ('open','answered','cancelled','expired')),
  answer      text,
  answered_by uuid references public.profiles(id) on delete set null,
  answered_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  created_at  timestamptz not null default now()
);
create index requests_team_idx    on public.requests(team_id, created_at desc);
create index requests_open_idx    on public.requests(team_id, created_at desc) where status = 'open';
create index requests_agent_idx   on public.requests(agent_id, created_at desc);
create index requests_project_idx on public.requests(project_id, created_at desc);

create table public.github_events (
  id             bigint generated always as identity primary key,
  team_id        uuid not null references public.teams(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  delivery_id    text not null,
  event_type     text not null,           -- X-GitHub-Event
  action         text,
  repo_full_name text not null,
  ref            text,
  actor_login    text,
  title          text not null,
  url            text,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  unique (project_id, delivery_id)
);
create index github_events_project_idx on public.github_events(project_id, created_at desc);
create index github_events_team_idx    on public.github_events(team_id, created_at desc);

-- ---------- helper functions (security definer avoids RLS recursion) ----------
create or replace function public.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = p_team and user_id = auth.uid());
$$;

create or replace function public.is_team_owner(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = p_team and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.shares_team_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members a
    join public.team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ---------- new user: profile + personal team ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'user_name', ''),
    split_part(coalesce(new.email, 'user'), '@', 1));
  v_team uuid;
begin
  insert into public.profiles (id, email, display_name, avatar_url, github_login)
  values (new.id, new.email, v_name,
          new.raw_user_meta_data->>'avatar_url',
          coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username'))
  on conflict (id) do nothing;

  insert into public.teams (name, created_by)
  values (left(v_name || '''s team', 80), new.id)
  returning id into v_team;

  insert into public.team_members (team_id, user_id, role) values (v_team, new.id, 'owner');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- invite-by-code ----------
create or replace function public.join_team(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select id into v_team from public.teams where invite_code = lower(trim(p_code));
  if v_team is null then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  insert into public.team_members (team_id, user_id, role) values (v_team, auth.uid(), 'member')
  on conflict do nothing;
  return v_team;
end $$;

create or replace function public.rotate_invite_code(p_team uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  if not public.is_team_owner(p_team) then raise exception 'not team owner' using errcode = '42501'; end if;
  update public.teams set invite_code = v_code where id = p_team;
  return v_code;
end $$;

-- optional maintenance
create or replace function public.prune_events(p_days int default 30) returns bigint
language sql security definer set search_path = public as $$
  with d as (delete from public.events where created_at < now() - make_interval(days => p_days) returning 1)
  select count(*) from d;
$$;

revoke all on function public.join_team(text) from public, anon;
revoke all on function public.rotate_invite_code(uuid) from public, anon;
revoke all on function public.prune_events(int) from public, anon, authenticated;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.profiles        enable row level security;
alter table public.teams           enable row level security;
alter table public.team_members    enable row level security;
alter table public.projects        enable row level security;
alter table public.project_secrets enable row level security;  -- no policies: service role only
alter table public.project_tokens  enable row level security;
alter table public.agents          enable row level security;
alter table public.events          enable row level security;
alter table public.requests        enable row level security;
alter table public.github_events   enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_team_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy teams_select on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_owner(id)) with check (public.is_team_owner(id));

create policy team_members_select on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
create policy team_members_delete on public.team_members for delete to authenticated
  using (user_id = auth.uid() or public.is_team_owner(team_id));

create policy projects_select on public.projects for select to authenticated
  using (public.is_team_member(team_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_team_member(team_id));

create policy project_tokens_select on public.project_tokens for select to authenticated
  using (public.is_team_member(team_id));

create policy agents_select on public.agents for select to authenticated
  using (public.is_team_member(team_id));
create policy events_select on public.events for select to authenticated
  using (public.is_team_member(team_id));
create policy github_events_select on public.github_events for select to authenticated
  using (public.is_team_member(team_id));

create policy requests_select on public.requests for select to authenticated
  using (public.is_team_member(team_id));
create policy requests_answer on public.requests for update to authenticated
  using (public.is_team_member(team_id) and status = 'open')
  with check (public.is_team_member(team_id) and status in ('answered','cancelled') and answered_by = auth.uid());

-- ---------- grants ----------
revoke all on all tables in schema public from anon;
grant select on public.profiles, public.teams, public.team_members, public.projects,
               public.project_tokens, public.agents, public.events, public.requests,
               public.github_events to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant update (name) on public.teams to authenticated;
grant delete on public.team_members to authenticated;
grant insert, update, delete on public.projects to authenticated;
revoke insert, update, delete on public.requests from authenticated;
grant update (status, answer, answered_by, answered_at) on public.requests to authenticated;
revoke all on public.project_secrets from authenticated;
revoke insert, update, delete on public.agents, public.events, public.github_events, public.project_tokens from authenticated;

-- ---------- realtime ----------
alter publication supabase_realtime add table
  public.agents, public.requests, public.events, public.github_events, public.projects;
```

Notes:
- `team_id` is denormalized onto every child table, so each RLS policy is one function call and Realtime filtering stays cheap. Ingest copies `team_id` from the project.
- The service role key bypasses RLS. All ingest, request, token and webhook writes use it (`lib/supabase/admin.ts`).
- Users can belong to several teams. The dashboard shows the union of everything they can see.
- Agents launched as subagents (the Task tool) share their parent's `session_id`, so they appear as one agent with `SubagentStop` events. Run separate `claude` processes with `CC_AGENT_NAME=...` to get separate rows. `cc-ask --as <name>` labels which subagent asked.

---

## 2. API contracts

### 2.0 Shared server modules (Coder A)
| File | Exports |
|---|---|
| `lib/supabase/client.ts` | `'use client'`-safe `createClient(): SupabaseClient` (browser, singleton, `createBrowserClient` with `NEXT_PUBLIC_*`) |
| `lib/supabase/server.ts` | `async createClient(): Promise<SupabaseClient>` (cookie-bound user client for RSC and route handlers, `createServerClient` + `await cookies()`; `setAll` wrapped in try/catch for RSC) |
| `lib/supabase/admin.ts` | `import 'server-only'`; `createAdminClient(): SupabaseClient` (service role, `auth: { persistSession: false }`) |
| `lib/supabase/middleware.ts` | `updateSession(req: NextRequest): Promise<NextResponse>` (standard @supabase/ssr refresh, plus redirect to `/login?next=<path>` when there is no user on protected paths) |
| `middleware.ts` | calls `updateSession`; `config.matcher = ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)']`. Public (no redirect) paths: `/login`, `/auth/*`, `/styleguide`. |
| `lib/server/env.ts` | `env` object: `supabaseUrl`, `supabaseAnonKey`, `serviceRoleKey`, `appUrl` (falls back to `https://${VERCEL_URL}` then `http://localhost:3000`), `githubWebhookSecret?` |
| `lib/server/http.ts` | `json(data, status=200)`, `error(status, message, details?)`, `readJson<T>(req, schema: ZodSchema<T>, maxBytes)` → `{ ok: true, data } \| { ok: false, response }` (400 bad JSON or validation, 413 too large) |
| `lib/server/auth.ts` | `requireUser()` → `{ supabase, user } \| { response }` (401 if no user) |
| `lib/server/tokens.ts` | `generateToken(): string` (`'ags_' + randomBytes(32).toString('base64url')`), `hashToken(t): string` (sha256 hex), `authenticateProjectToken(req)` → `{ project: Project, tokenId: string } \| null`. It reads `Authorization: Bearer <token>`, looks up the hash with `revoked_at is null`, joins the project, and updates `last_used_at` only if it is null or more than 60s old. |
| `lib/server/schemas.ts` | zod schemas mirroring the §7 body types |
| `lib/server/summarize.ts` | `summarizeHookEvent(hook: HookPayload, redacted: boolean): string` (§3.3) |
| `lib/server/truncate.ts` | `truncatePayload(obj, maxBytes=32_768)`: strings over 4000 chars are cut and get a `…[truncated]` suffix; if still too big, drops `tool_response`, then `tool_input` (replaced by `"[dropped: too large]"`) |
| `lib/server/status.ts` | `applyHookEvent(agent, hook): Partial<Agent>` (pure, §3), `recomputeAgentRequests(admin, agentId): Promise<void>` (§3.2) |
| `lib/server/requests.ts` | `resolveAgentForAsk(admin, project, body)` (§2.3), `expireIfDue(admin, request)` |
| `lib/server/github.ts` | `verifySignature(rawBody, header, secret): boolean` (HMAC sha256, `timingSafeEqual`), `summarizeGithubEvent(eventType, payload) → { title, url, ref, actor_login, action, payload }` |

Auth types used below:
- **Token**: `Authorization: Bearer ags_…` (project ingest token). A missing, invalid or revoked token returns 401 `{error:"invalid token"}`.
- **Session**: Supabase auth cookie (`requireUser`). Without it, 401 `{error:"unauthorized"}`. Session routes check access by first reading the target row with the **user** client, so RLS gives 404 when it is not visible. Writes then use the user client when a policy exists (projects, requests answer), and otherwise the admin client.
- **Public**: no auth.

### 2.1 Route table
| Method & path | File | Auth |
|---|---|---|
| POST `/api/ingest` | `app/api/ingest/route.ts` | Token |
| POST `/api/requests` | `app/api/requests/route.ts` | Token |
| GET `/api/requests/[id]` | `app/api/requests/[id]/route.ts` | Token |
| POST `/api/requests/[id]/cancel` | `app/api/requests/[id]/cancel/route.ts` | Token |
| POST `/api/requests/[id]/answer` | `app/api/requests/[id]/answer/route.ts` | Session |
| POST `/api/requests/[id]/dismiss` | `app/api/requests/[id]/dismiss/route.ts` | Session |
| POST `/api/projects` | `app/api/projects/route.ts` | Session |
| PATCH, DELETE `/api/projects/[id]` | `app/api/projects/[id]/route.ts` | Session |
| POST `/api/projects/[id]/tokens` | `app/api/projects/[id]/tokens/route.ts` | Session |
| DELETE `/api/projects/[id]/tokens/[tokenId]` | `app/api/projects/[id]/tokens/[tokenId]/route.ts` | Session |
| POST `/api/projects/[id]/webhook-secret` | `app/api/projects/[id]/webhook-secret/route.ts` | Session |
| POST `/api/teams/join` | `app/api/teams/join/route.ts` | Session |
| PATCH `/api/teams/[id]` | `app/api/teams/[id]/route.ts` | Session (owner) |
| POST `/api/teams/[id]/invite-code` | `app/api/teams/[id]/invite-code/route.ts` | Session (owner) |
| POST `/api/github/webhook` | `app/api/github/webhook/route.ts` | HMAC |
| GET `/api/connector/[file]` | `app/api/connector/[file]/route.ts` | Public |
| GET `/api/health` | `app/api/health/route.ts` | Public |
| GET `/auth/callback` | `app/auth/callback/route.ts` | Public |
| POST `/auth/signout` | `app/auth/signout/route.ts` | Session |

### 2.2 `POST /api/ingest` (hook events)
Request (`IngestBody`, max 256 KB):
```json
{
  "hook": { "session_id": "abc-123", "hook_event_name": "PreToolUse", "cwd": "/repo",
            "transcript_path": "/…/abc-123.jsonl", "tool_name": "Bash",
            "tool_input": { "command": "npm test" } },
  "meta": { "human": "ana@acme.dev", "agent_name": "coder-a", "agent_role": "coder",
            "host": "ana-mbp", "git_branch": "main", "redacted": false,
            "connector_version": "1", "sent_at": "2026-10-27T10:00:00.000Z" }
}
```
Validation: `hook.session_id` is a non-empty string of at most 200 chars, `hook.hook_event_name` is a non-empty string of at most 64 chars, and other hook keys pass through. Unknown event names are stored and touch `last_event_at`, but do not change status.

Steps:
1. Authenticate the token and get the project.
2. Find the agent by `(project_id, session_id)`. If there is none, insert it with `on conflict (project_id, session_id) do nothing` and then select it again.
3. `patch = applyHookEvent(agent, hook)` (§3). Merge the non-null meta: `name`, `role`, `human`, `host`, `git_branch`, `cwd`, `transcript_path`. Set `last_event_name`, `last_event_summary`, `last_event_at=now()`, `event_count+1`. Update the agent.
4. Insert the `events` row with `payload = truncatePayload(hook)`, `tool_name`, `summary`, and `human`.
5. If the event is `SessionEnd`, set this agent's open requests to `cancelled`, then call `recomputeAgentRequests`.

Response `202 { "ok": true, "agent_id": "uuid", "status": "running" }`. Errors: 400, 401, 413, 500.

### 2.3 `POST /api/requests` (agent asks)
Request (`CreateRequestBody`):
```json
{ "session_id": "abc-123", "prompt": "Which Supabase region?", "kind": "question",
  "options": ["us-east-1", "eu-west-1"], "context": "Needed for .env", "expires_in_sec": 86400,
  "asked_by": "coder-a",
  "meta": { "human": "ana@acme.dev", "agent_name": "coder-a", "agent_role": "coder",
            "host": "ana-mbp", "cwd": "/repo", "connector_version": "1", "sent_at": "…" } }
```
Limits: prompt 1–4000 chars, options up to 10 items of 1–200 chars each, context up to 8000, `expires_in_sec` 60–604800 (default 86400). When `kind = "approval"` and `options` is empty, the server stores `["Approve","Reject"]`.

Agent resolution (`resolveAgentForAsk`):
1. If `session_id` is given, upsert the agent by `(project_id, session_id)`.
2. Otherwise, correlate. Take the latest 5 events in this project with `hook_event_name='PreToolUse' and tool_name='Bash' and created_at > now()-interval '120 seconds' and payload->'tool_input'->>'command' ilike '%cc-ask%'`. Prefer the one whose command contains the first 30 chars of the prompt; otherwise use the newest. Use that event's agent.
3. Otherwise, upsert the agent with `session_id = 'adhoc:' + (meta.human ?? 'unknown') + ':' + (meta.host ?? 'host')` and `name = meta.agent_name`.

Then insert the request (`expires_at = now() + expires_in_sec`) and call `recomputeAgentRequests(agent.id)`.

Response `201`:
```json
{ "id": "uuid", "status": "open", "agent_id": "uuid",
  "expires_at": "2026-10-28T10:00:00Z", "url": "https://app/inbox#req-<id>" }
```
Errors: 400, 401, 413.

### 2.4 `GET /api/requests/[id]` (agent polls)
The token's project must equal `request.project_id`, or the route returns 404. If the request is `open` and `expires_at < now()`, the route updates it to `expired` and calls `recomputeAgentRequests`. Response `200` (`RequestPollResponse`):
```json
{ "id": "uuid", "status": "answered", "kind": "question", "answer": "eu-west-1",
  "answered_by_name": "Ana", "answered_at": "…", "expires_at": "…" }
```
`answered_by_name` comes from `profiles.display_name` via the admin client and is null while open. It sets the header `Cache-Control: no-store`.

### 2.5 `POST /api/requests/[id]/cancel` (agent gives up: Ctrl-C or session end)
Token auth with the same project check. If the request is open, it becomes `cancelled`. The route then calls recompute. Response `200 { "request": AgentRequest }`. A request that is not open returns 409 `{error:"not open", details:{status}}`.

### 2.6 `POST /api/requests/[id]/answer` (human answers)
Body `{ "answer": "eu-west-1" }` (1–8000 chars, trimmed). The user client runs `update({ status:'answered', answer, answered_by:user.id, answered_at:now }).eq('id',id).eq('status','open').gt('expires_at', nowIso).select().maybeSingle()`. If that returns null, the route re-selects the row: missing gives 404, `expires_at` in the past gives 410 `{error:"expired"}` (and it expires the row via admin), and any other status gives 409 `{error:"not open", details:{status}}`. After success it calls `recomputeAgentRequests` (admin). Response `200 { "request": AgentRequest }`.

### 2.7 `POST /api/requests/[id]/dismiss`
Same as answer, but with `status:'cancelled'`, `answer: body.reason ?? null` (optional `{reason?: string}`), and `answered_by:user.id`. The agent then sees `CANCELLED`. Response `200 { "request" }`. Errors: 404, 409.

### 2.8 Projects
- `POST /api/projects` with body `CreateProjectBody` `{ team_id, name, description?, repo_full_name? }`. The user client inserts with `created_by=user.id`. Response `201 { project }`. A `repo_full_name` that is already used in this team gives 409. 400 on validation. RLS denial (not a team member) gives 403.
- `PATCH /api/projects/[id]` with body `UpdateProjectBody` → `200 { project }`. Errors: 404, 409.
- `DELETE /api/projects/[id]` → `200 { ok: true }`, 404. Deletes cascade.
- `POST /api/projects/[id]/tokens` with body `{ label?: string }` (≤ 80). The route reads the project with the user client (404 if not visible), generates the token, and inserts the hash with the admin client (`team_id` from project, `created_by=user.id`, `token_prefix = token.slice(0,12)`). Response `201 { "token": "ags_…", "token_meta": ProjectToken }`. **The plaintext is returned only once.** The `ProjectToken` type never includes `token_hash`.
- `DELETE /api/projects/[id]/tokens/[tokenId]` sets `revoked_at=now()` (admin, after a visibility check) → `200 { ok: true }`. Errors: 404.
- `POST /api/projects/[id]/webhook-secret` generates a new secret (`randomBytes(24).toString('hex')`) and upserts it into `project_secrets` (admin). It sets `projects.github_webhook_configured=true` and returns `200 { "secret": "…", "webhook_url": "<appUrl>/api/github/webhook" }`, shown once. Calling it again rotates the secret.

### 2.9 Teams
- `POST /api/teams/join` with body `{ code }` calls `supabase.rpc('join_team', { p_code: code })` (user client). Response `200 { team_id, team_name }`. An invalid code gives 404 `{error:"invalid invite code"}`.
- `PATCH /api/teams/[id]` with body `{ name }` (1–80). The user client update returns `200 { team }`. Non-owners get 403, because the update affects 0 rows; check with a select first.
- `POST /api/teams/[id]/invite-code` calls `rpc('rotate_invite_code', { p_team: id })` → `200 { invite_code }`. Non-owners get 403.

### 2.10 `POST /api/github/webhook`
1. Read the raw text body (≤ 5 MB) and the headers `X-GitHub-Event`, `X-GitHub-Delivery`, and `X-Hub-Signature-256`.
2. A `ping` event returns `200 { ok: true, pong: true }` if any candidate secret matches. When there are no projects, it returns 202.
3. Parse JSON and set `full = payload.repository?.full_name`. If it is missing, return `202 { ignored: "no repository" }`.
4. Candidate projects are those where `lower(repo_full_name) = lower(full)` (admin). If there are none, return `202 { ignored: "no project" }`.
5. For each candidate, the secret set is that project's `project_secrets.github_webhook_secret` plus the global `GITHUB_WEBHOOK_SECRET` (if set). A project is accepted if `verifySignature` passes against any secret in its set. If no candidate is accepted, return `401 { error: "bad signature" }`.
6. For each accepted project, insert into `github_events` with `on conflict (project_id, delivery_id) do nothing`, using `summarizeGithubEvent`:
   - `push`: `"{pusher.name} pushed {n} commit(s) to {branch}"`, url `compare`, ref `ref`. The stored payload keeps `ref`, `before`, `after`, `compare`, `head_commit{id,message,url}`, and `commits[≤20]{id,message,author.name}`.
   - `pull_request`: `"PR #{n} {merged ? 'merged' : action}: {title}"`, url `pull_request.html_url`, ref `pull_request.head.ref`.
   - `pull_request_review`: `"Review {review.state} on PR #{n}: {title}"`.
   - `issue_comment`: `"Comment on #{issue.number}: {issue.title}"`.
   - `workflow_run`: stored only when `action=='completed'`, as `"Workflow {name} {conclusion}"` on `head_branch`. Other actions return `202 { ignored }`.
   - Anything else: `"{event}{action ? '.'+action : ''}"`. The payload goes through `truncatePayload(…, 65536)`.
   - `actor_login = payload.sender?.login`.
7. Response `200 { ok: true, stored: <count> }`.

### 2.11 `GET /api/connector/[file]`
The whitelist is `hook.mjs`, `cc-ask.mjs`, `settings.snippet.json`, and `README.md`. The route reads `path.join(process.cwd(), 'connector', file)`. Content type is `text/plain; charset=utf-8`, or `application/json` for `.json`. It sets `Cache-Control: public, max-age=300`. Unknown files get 404.

### 2.12 `GET /api/health` → `200 { "ok": true, "time": "<iso>" }`

### 2.13 Auth routes
- `GET /auth/callback?code=…&next=/inbox` runs `exchangeCodeForSession(code)` with the server client and redirects to `next`. `next` must start with `/` and not `//`; otherwise it falls back to `/`. On failure it redirects to `/login?error=auth`.
- `POST /auth/signout` calls `signOut()` and returns a 303 redirect to `/login`.
- The login itself is client-side (Coder B): `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: \`${location.origin}/auth/callback?next=${encodeURIComponent(next)}\` } })`.

---

## 3. Agent status derivation (server-side, in `lib/server/status.ts`)

The dashboard never derives status from events. It reads `agents.status`, `attention_*` and `open_request_count`.

### 3.1 `applyHookEvent(agent, hook)` (pure function)
Let `open = agent.open_request_count > 0`, `busy = open ? 'waiting_on_human' : 'running'`, and `clear = { attention_kind: null, attention_message: null }`.

| Hook event | Resulting fields |
|---|---|
| `SessionStart` | `status: busy`, clear, `ended_at: null` (handles resume) |
| `UserPromptSubmit` | `status: busy`, clear, `ended_at: null` |
| `PreToolUse` with `tool_name` `AskUserQuestion` | `status: 'waiting_on_human'`, `attention_kind: 'question'`, `attention_message: tool_input.questions?.[0]?.question ?? 'Asked a question in the terminal'` |
| `PreToolUse` with `tool_name` `ExitPlanMode` | `status: 'waiting_on_human'`, `attention_kind: 'question'`, `attention_message: 'Plan ready for approval in the terminal'` |
| `PreToolUse` (other) | `status: busy`, clear |
| `PostToolUse` | `status: busy`, clear |
| `Notification` | `status: 'waiting_on_human'`, `attention_kind: /permission/i.test(message) \|\| hook.notification_type === 'permission_prompt' ? 'permission' : 'input'`, `attention_message: message ?? 'Needs attention'` |
| `Stop` | `status: open ? 'waiting_on_human' : 'idle'`, clear |
| `SubagentStop` | no status change (only last_event fields) |
| `SessionEnd` | `status: 'ended'`, clear, `ended_at: now` |
| unknown | no status change |

### 3.2 `recomputeAgentRequests(admin, agentId)`
This runs after every request insert, answer, dismiss, cancel or expire.
```
n = count(requests where agent_id = $1 and status = 'open' and expires_at > now())
if agent.status = 'ended':                      set open_request_count = n
elif n > 0:                                      set open_request_count = n, status = 'waiting_on_human'
elif agent.status = 'waiting_on_human' and attention_kind is null:
                                                 set open_request_count = 0, status = 'running'
else:                                            set open_request_count = 0
```
The race between read and write is acceptable for v1, because the next hook event corrects it.

### 3.3 Event summaries (`summarizeHookEvent`, at most 240 chars)
- `SessionStart` → `Session started ({source})`
- `UserPromptSubmit` → `Prompt: {prompt first 160}`, or `Prompt (redacted)` if `meta.redacted`
- `PreToolUse` → `{tool}: {detail}` / `PostToolUse` → `{tool} ✓ {detail}`. If `tool_response.is_error` or `tool_response.error` is set, it becomes `{tool} ✗ {detail}`. The detail depends on the tool: Bash uses `command` (first 120 chars). Read/Edit/MultiEdit/Write/NotebookEdit use `file_path` relative to `cwd`. Grep/Glob use `pattern`. WebFetch uses `url`. WebSearch uses `query`. Task/Agent use `description`. TodoWrite uses `updated todos`. `mcp__*` and anything else use an empty string.
- `Notification` → `message`
- `Stop` → `Turn finished`; `SubagentStop` → `Subagent finished`; `SessionEnd` → `Session ended ({reason})`

### 3.4 Client-side display helpers (in `lib/types.ts`)
`isStale(agent)` is true when the status is `running` and `last_event_at` is more than 30 minutes old. A stale agent shows a muted "quiet 45m" tag. The stored status is not changed.

---

## 4. Dashboard

### 4.1 Design tokens (fixed names; the designer chooses the values)
`tailwind.config.ts` → `theme.extend.colors` maps to CSS vars in `rgb(var(--x) / <alpha-value>)` form, defined in `globals.css` with light values in `:root` and dark values in `@media (prefers-color-scheme: dark) { :root { … } }`. The direction is dark-first.

| Tailwind color | CSS var | Use |
|---|---|---|
| `canvas` | `--canvas` | page background |
| `surface` | `--surface` | cards |
| `surface-2` | `--surface-2` | raised/hover, inputs |
| `line` | `--line` | borders/dividers |
| `fg` | `--fg` | primary text |
| `fg-muted` | `--fg-muted` | secondary text |
| `fg-subtle` | `--fg-subtle` | tertiary/meta |
| `accent` / `accent-fg` | `--accent` / `--accent-fg` | primary action, links / text on accent |
| `running` | `--status-running` | green |
| `waiting` | `--status-waiting` | amber (needs human) |
| `idle` | `--status-idle` | blue/slate |
| `ended` | `--status-ended` | zinc |
| `danger`, `success`, `warning`, `info` | `--danger` … | feedback |

Fonts: `fontFamily.sans` uses a system UI stack and `fontFamily.mono` a ui-monospace stack. There are no network fonts. The designer may add radius and shadow tokens. Coder B uses only these semantic classes plus layout utilities.

### 4.2 Pages (Coder B)
| Route | File | Contents |
|---|---|---|
| (layout) | `app/(dashboard)/layout.tsx` | Server component. Gets the user (`lib/supabase/server`), redirects to `/login` if absent, renders `<DashboardShell user={…}>{children}</DashboardShell>`. |
| | `app/(dashboard)/_components/DashboardShell.tsx` | `'use client'`. Uses `usePathname`, `useOpenRequests`, and `useAgents` to compute the inbox badge = live open requests + agents with `status='waiting_on_human' && open_request_count===0` (attention). Renders `<AppShell>`. Sign-out is a `<form action="/auth/signout" method="post">`. Optional: browser `Notification` on new requests. |
| `/` | `app/(dashboard)/page.tsx` | **Overview.** A `StatTile` row (Running / Needs you / Idle / Open requests). A `SegmentedControl` filter: Active (default: not ended, or ended < 1h ago) / Needs you / All (last 24h). A group-by toggle: Project / Person. Agents appear in `AgentGroup` sections containing `AgentCard`s, sorted waiting first, then running, idle, ended, then by `last_event_at` desc. A right rail holds "Needs you" (the top 5 `RequestCard compact`, linking to `/inbox`) and "GitHub activity" (the 10 latest `GithubEventItem`). Everything updates live. Empty state links to `/projects`. |
| `/inbox` | `app/(dashboard)/inbox/page.tsx` | Open live requests, oldest first (`RequestCard` with answer box and option buttons, `id="req-<id>"` anchors). A section "Needs attention in terminal" lists `AttentionCard`s for attention agents. A "Recently resolved" collapsible section shows the last 20 non-open requests. Answering calls `api.answerRequest`, and the card shows busy/error states. |
| `/projects` | `app/(dashboard)/projects/page.tsx` | Grid of `ProjectCard` (with per-status agent counts) and a create form (name, repo `owner/repo`, team select if more than one team). After create, it navigates to `/projects/[id]/connect`. |
| `/projects/[id]` | `app/(dashboard)/projects/[id]/page.tsx` | Header plus actions (Connect, Delete). Columns: live agents in the project; requests (all statuses, 50); GitHub events (30). Settings card: edit name/repo, "Generate webhook secret" (shows `CopyField secret` once, plus the webhook URL and instructions), token list (`TokenRow` with revoke). |
| `/projects/[id]/connect` | `app/(dashboard)/projects/[id]/connect/page.tsx` | Step 1: "Create token" (label defaults to the user's name), then `CopyField secret` with a `Callout` "shown once". Step 2: install commands `CodeBlock` (§5.4, token filled in). Step 3: `.claude/settings.json` snippet `CodeBlock` (fetched from `/api/connector/settings.snippet.json`). Step 4: optional env (`CC_USER`, `CC_AGENT_NAME`, `CC_AGENT_ROLE`). Step 5: "Waiting for first event…", which turns into a success callout when an agent appears for the project (realtime). |
| `/agents/[id]` | `app/(dashboard)/agents/[id]/page.tsx` | Header (display name, `StatusBadge`, role, human, project link, branch, cwd, session id `CopyField`, started/ended). Shows an attention `Callout` if `attention_message` is set. Open requests for this agent (answerable). `EventTimeline` of the latest 200 events, live-prepended, with a "Load older" button (cursor on `id < min`). A filter `SegmentedControl` offers All / Prompts / Tools / Attention, where Attention means Notification, Stop, Session*. |
| `/team` | `app/(dashboard)/team/page.tsx` | For each team: name (owner can rename), invite link `CopyField` (`${origin}/join/${invite_code}`), owner "Rotate", and members as `MemberRow`. |
| `/join/[code]` | `app/(dashboard)/join/[code]/page.tsx` | Client page. Calls `api.joinTeam(code)` on button click, then redirects to `/team`. Shows an error for an invalid code. |
| `/login` | `app/login/page.tsx` | `LoginCard`, which triggers GitHub OAuth and preserves `?next`. Shows `?error=auth`. |
| `/styleguide` | `app/styleguide/page.tsx` | **Designer.** Every component in every state, with mock data typed with `lib/types.ts`. |

### 4.3 Designer components: `components/ui/*` (presentational, props only, no data fetching, no Supabase)
Every component is exported from `components/ui/index.ts`. `cn(...inputs)` lives in `components/ui/cn.ts` (clsx + tailwind-merge) and is exported too. Components with local UI state (copied, text input, mobile nav) are `'use client'`. Icons use `lucide-react`. Links use `next/link`.

```ts
// primitives
Button:          ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'; loading?: boolean }
Badge:           { tone?: 'neutral'|'accent'|'success'|'warning'|'danger'|'info'; children: ReactNode; className?: string }
Card:            { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; padded?: boolean }
Input:           InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string|null }         // forwardRef
Textarea:        TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; error?: string|null }   // forwardRef
Select:          SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }
Spinner:         { size?: 'sm'|'md'; className?: string }
Avatar:          { name: string; src?: string|null; size?: 'xs'|'sm'|'md' }
Callout:         { tone?: 'info'|'success'|'warning'|'danger'; title?: ReactNode; children?: ReactNode; action?: ReactNode }
EmptyState:      { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }
PageHeader:      { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: { href: string; label: string }[] }
SegmentedControl:{ options: { value: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void; size?: 'sm'|'md' }
StatTile:        { label: string; value: number|string; tone?: 'neutral'|'running'|'waiting'|'idle'; hint?: string }
RelativeTime:    { iso: string; className?: string; prefix?: string }        // 'use client'; date-fns formatDistanceToNowStrict; re-renders every 30s; title=absolute time
CodeBlock:       { code: string; language?: string; title?: string; copyable?: boolean }   // 'use client'; copy button
CopyField:       { value: string; label?: string; secret?: boolean; mono?: boolean }      // 'use client'; secret = masked with reveal toggle
// shell
AppShell:        { nav: NavItem[]; activeHref: string; user: { name: string; avatarUrl?: string|null; email?: string|null };
                   userMenu?: ReactNode; children: ReactNode }   // 'use client'; sidebar on md+, top bar + drawer on mobile; brand "Agentspace"
  type NavItem = { href: string; label: string; icon: 'overview'|'inbox'|'projects'|'team'; badge?: number }
  // active if activeHref === href or (href !== '/' && activeHref.startsWith(href)); badge > 0 renders a waiting-tone pill
// domain
StatusDot:       { status: AgentStatus; pulse?: boolean; stale?: boolean }            // pulse default true for running/waiting
StatusBadge:     { status: AgentStatus; stale?: boolean }                             // label from AGENT_STATUS_LABEL
AgentCard:       { agent: AgentWithProject; href: string; showProject?: boolean }
                 // name via agentDisplayName; role badge; human; StatusDot; last_event_summary (1 line, mono-ish);
                 // RelativeTime(last_event_at); attention_message highlighted in waiting tone; open_request_count pill; stale via isStale
AgentGroup:      { title: ReactNode; subtitle?: ReactNode; count: number; href?: string; children: ReactNode }   // grid of cards
AttentionCard:   { agent: AgentWithProject; href: string }   // icon by attention_kind; "Respond in the terminal" hint
RequestCard:     { request: RequestWithContext; onAnswer?: (answer: string) => void | Promise<void>;
                   onDismiss?: () => void | Promise<void>; busy?: boolean; error?: string | null;
                   compact?: boolean; agentHref?: string }
                 // 'use client'. Shows kind badge (REQUEST_KIND_LABEL), prompt (pre-wrap), context (collapsible),
                 // agent name + project + human + asked_by, RelativeTime(created_at), expires hint.
                 // status open: option buttons (click → onAnswer(option)); free-text Textarea + Send (Cmd/Ctrl+Enter);
                 //   for kind 'approval' option buttons styled success/danger for Approve/Reject.
                 // status not open: read-only answer, answerer name, status badge. compact: prompt + agent + "Answer" link only.
EventItem:       { event: AgentEvent }        // icon by hook_event_name, summary, time; click to expand payload JSON (CodeBlock)
EventTimeline:   { events: AgentEvent[]; onLoadOlder?: () => void; loadingOlder?: boolean; hasMore?: boolean; emptyLabel?: string }
GithubEventItem: { event: GithubEvent }       // icon by event_type, title, actor, ref, RelativeTime, link to url
ProjectCard:     { project: Project; counts: Record<AgentStatus, number>; href: string; openRequests?: number }
TokenRow:        { token: ProjectToken; onRevoke?: () => void; busy?: boolean }   // label, prefix…, created, last used, revoked state
MemberRow:       { member: TeamMemberWithProfile; isYou?: boolean; onRemove?: () => void }
LoginCard:       { onGithubLogin: () => void; loading?: boolean; error?: string | null }
```

### 4.4 Coder B wiring: `lib/hooks/*`, `lib/client/*`
| File | Export |
|---|---|
| `lib/hooks/useSupabase.ts` | `useSupabase()` → memoized browser client from `@/lib/supabase/client` |
| `lib/hooks/useCurrentUser.ts` | `useCurrentUser()` → `{ user, profile, loading }` |
| `lib/hooks/useTeams.ts` | `useTeams()` → `{ teams: TeamWithMembers[], loading, reload }` (`teams` + `team_members(*, profile:profiles(*))`) |
| `lib/hooks/useProjects.ts` | `useProjects()` → `{ projects, byId: Record<string,Project>, loading, reload }` with realtime on `projects` |
| `lib/hooks/useAgents.ts` | `useAgents(opts?: { projectId?: string; sinceHours?: number })` → `{ agents: AgentWithProject[], loading }`. The initial select is `agents` where `ended_at is null or last_event_at > now-24h`, ordered by `last_event_at desc`, limit 500. Realtime `postgres_changes` `*` on `agents` (filter `project_id=eq.X` when given) is merged by id. `project` is attached from `useProjects().byId`, because realtime payloads have no joins. |
| `lib/hooks/useRequests.ts` | `useOpenRequests()` → `{ requests: RequestWithContext[], count, loading }` (status open, client-filtered with `isRequestLive`). `useRequests({ agentId?, projectId?, status?, limit? })`. Select: `*, agent:agents(id,session_id,name,role,human,status), project:projects(id,name,team_id), answerer:profiles(id,display_name,avatar_url)`. On a realtime INSERT or UPDATE, re-fetch that one row with the embed. |
| `lib/hooks/useAgentEvents.ts` | `useAgentEvents(agentId)` → `{ events, loadOlder, hasMore, loadingOlder }` (realtime INSERT filter `agent_id=eq.X`) |
| `lib/hooks/useGithubEvents.ts` | `useGithubEvents({ projectId?, limit })` (realtime INSERT) |
| `lib/hooks/useNow.ts` | `useNow(intervalMs=30000)` |
| `lib/client/api.ts` | Typed fetch wrappers. Each throws `Error(error)` on non-2xx: `answerRequest(id, answer)`, `dismissRequest(id, reason?)`, `createProject(body)`, `updateProject(id, body)`, `deleteProject(id)`, `createToken(projectId, label?)`, `revokeToken(projectId, tokenId)`, `createWebhookSecret(projectId)`, `joinTeam(code)`, `renameTeam(id, name)`, `rotateInviteCode(id)` |
| `lib/client/connect.ts` | `buildInstallCommands(appUrl: string, token: string): string` (§5.4), `buildConfigJson(appUrl, token, user?)` |
| `lib/client/format.ts` | `groupAgents(agents, by: 'project'\|'human')`, `sortAgents`, `countByStatus(agents): Record<AgentStatus,number>` |

Each hook unsubscribes its realtime channel on unmount. Channel names must be unique per hook instance (for example ``agents:${projectId ?? 'all'}:${random}``).

---

## 5. Connector (`connector/**`, Coder A)

Install layout in a target repo: `.claude/agentspace/{hook.mjs, cc-ask.mjs, config.json}` plus hooks merged into `.claude/settings.json`.

**Config resolution** (both scripts): env `AGENTSPACE_URL` + `AGENTSPACE_TOKEN`, else `config.json` next to the script (`new URL('./config.json', import.meta.url)`) with the shape `{ "url": "...", "token": "...", "user"?: "..." }`. A trailing `/` is stripped from the url. **The human** is env `CC_USER`, else `config.user`, else `git config user.email` (execFileSync, 1s timeout, cwd = hook cwd), else `os.userInfo().username`. **Agent** is env `CC_AGENT_NAME` and `CC_AGENT_ROLE`.

### 5.1 `connector/hook.mjs` (Node 18 or later, no dependencies)
- It wraps everything in `main().catch(() => {}).finally(() => process.exit(0))`, and also has `process.on('uncaughtException'|'unhandledRejection', () => process.exit(0))`. **It always exits 0 and never writes to stdout, except for the SessionStart context below.**
- It reads all of stdin. If stdin has not ended after 2s, it proceeds with what it has. On a JSON parse failure it exits 0.
- If there is no url or token, it exits 0 silently.
- `AGENTSPACE_REDACT_PROMPTS=1` deletes `hook.prompt` and sets `meta.redacted=true`. `tool_response` is cut to 2000 chars when stringified (it is replaced by a string preview).
- `git_branch` comes from `git rev-parse --abbrev-ref HEAD` (500ms timeout), only on `SessionStart` and `Stop`, and is null otherwise.
- `fetch(url + '/api/ingest', { method:'POST', headers:{ 'content-type':'application/json', authorization:'Bearer '+token }, body, signal: AbortSignal.timeout(3000) })`. Errors are swallowed, and printed to stderr only if `AGENTSPACE_DEBUG=1`.
- On `SessionStart`, unless `AGENTSPACE_QUIET=1`, it prints this to **stdout** (Claude Code adds SessionStart stdout to the agent's context) before the POST:
  ```
  [Agentspace] This session is tracked in the team command center (session_id=<id>).
  When you need information, a decision, or an action from a human, ask there instead of waiting in the terminal:
    node .claude/agentspace/cc-ask.mjs --session <id> "your question" [--kind question|action|approval] [--options "a,b"] [--context "details"] [--as <your-name>]
  Run it with the Bash tool timeout set to 600000. It blocks until a human answers and prints the answer.
  If the output starts with "[agentspace] TIMEOUT", re-run with --resume <request_id> to keep waiting.
  If it starts with "[agentspace] UNAVAILABLE", ask in the terminal instead.
  ```
- `const CONNECTOR_VERSION = '1'`.

### 5.2 `connector/cc-ask.mjs` (Node 18 or later, no dependencies)
Usage: `node cc-ask.mjs "question" [--kind question|action|approval] [--options "a,b,c"] [--context "…"] [--timeout 540] [--expires 86400] [--session <id>] [--as <name>] [--resume <request_id>] [--no-wait]`
- Session is `--session`, else env `CC_SESSION_ID`, else `CLAUDE_SESSION_ID`, else omitted (the server correlates, §2.3). `asked_by` is `--as`, else `CC_AGENT_NAME`.
- Create: POST `/api/requests` with a 10s per-attempt timeout and 3 attempts (backoff 1s and 3s). If every attempt fails, or the token gives 401, it prints `[agentspace] UNAVAILABLE: <reason>. Ask the human directly in the terminal.` and exits 0.
- `--no-wait`: it prints `[agentspace] REQUEST <id> created` and exits 0.
- Poll: GET `/api/requests/<id>` every 2s for the first 60s and every 5s after that, with a 10s per-request timeout. Network errors keep it polling.
- Output (stdout). **The exit code is always 0** (2 only for a usage error):
  - answered → the raw answer text, then a newline. Nothing else on stdout. Answerer info goes to stderr: `[agentspace] answered by Ana`.
  - cancelled → `[agentspace] CANCELLED: the human dismissed this request.{ reason ? ' Reason: '+reason : ''}`
  - expired → `[agentspace] EXPIRED: no answer before the request expired.`
  - `--timeout` (default 540s, under the Bash tool's 600s max) reached → `[agentspace] TIMEOUT after <n>s; request <id> is still open. Re-run with --resume <id> to keep waiting.` The request is NOT cancelled.
- On SIGINT or SIGTERM: a best-effort POST `/api/requests/<id>/cancel` (2s timeout), then exit 0.
- `--resume <id>` skips create and polls the existing request.

### 5.3 `connector/settings.snippet.json`
```json
{
  "permissions": {
    "allow": ["Bash(node .claude/agentspace/cc-ask.mjs:*)"]
  },
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }],
    "PreToolUse":       [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }],
    "PostToolUse":      [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }],
    "Notification":     [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }],
    "SubagentStop":     [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }],
    "SessionEnd":       [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/agentspace/hook.mjs\"", "timeout": 5 }] }]
  }
}
```

### 5.4 Install commands (`connector/README.md`, and generated by `buildInstallCommands`)
```bash
mkdir -p .claude/agentspace
curl -fsSL <APP_URL>/api/connector/hook.mjs   -o .claude/agentspace/hook.mjs
curl -fsSL <APP_URL>/api/connector/cc-ask.mjs -o .claude/agentspace/cc-ask.mjs
cat > .claude/agentspace/config.json <<'EOF'
{ "url": "<APP_URL>", "token": "<TOKEN>" }
EOF
grep -qxF '.claude/agentspace/config.json' .gitignore 2>/dev/null || echo '.claude/agentspace/config.json' >> .gitignore
# then merge the hooks + permissions from <APP_URL>/api/connector/settings.snippet.json into .claude/settings.json
# (or .claude/settings.local.json to keep it personal). Restart Claude Code. Optional: export CC_USER, CC_AGENT_NAME, CC_AGENT_ROLE.
```
`connector/README.md` also explains the following. Teammates commit `hook.mjs`, `cc-ask.mjs` and `settings.json`. Each person creates their own token from the project page. `config.json` stays gitignored, or each person uses the env vars. It also covers the privacy flags `AGENTSPACE_REDACT_PROMPTS` and `AGENTSPACE_QUIET`, debugging with `AGENTSPACE_DEBUG=1`, and the subagent caveat (§1 notes).

---

## 6. Request lifecycle (end to end)
1. The agent runs `node .claude/agentspace/cc-ask.mjs --session S "Which region?" --options "us,eu"`. The `PreToolUse` hook fires first, so an event is recorded.
2. `POST /api/requests` creates the request, and `recompute` sets the agent to `waiting_on_human`. Realtime then shows it in the Inbox, the badge goes up, and the agent card turns amber.
3. A teammate clicks "eu". `POST /api/requests/[id]/answer` marks it answered, and recompute sets the agent to `running`.
4. The cc-ask poll sees `answered` and prints `eu`. The Bash tool returns, and `PostToolUse` keeps the agent `running`.

---

## 7. `lib/types.ts` (Coder A creates verbatim)

```ts
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
```

---

## 8. Environment and deployment

### 8.1 `.env.example`
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role / secret key — server only>
NEXT_PUBLIC_APP_URL=https://<your-app>.vercel.app
# optional: one webhook secret for all repos (per-project secrets also supported)
GITHUB_WEBHOOK_SECRET=
```

### 8.2 Supabase
1. Create a project. In the SQL editor, run `supabase/migrations/0001_init.sql`, or run `supabase link && supabase db push`.
2. Check Database → Publications: `supabase_realtime` contains agents, requests, events, github_events, projects.
3. Authentication → Providers → GitHub: enable it and paste the Client ID and Secret (step 8.3).
4. Authentication → URL Configuration: set Site URL = `https://<app>.vercel.app`. Add redirect URLs `https://<app>.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, and (for previews) `https://*-<team>.vercel.app/auth/callback`.
5. Copy the URL, the anon key and the service role key from Settings → API.

### 8.3 GitHub OAuth App (login)
GitHub → Settings → Developer settings → OAuth Apps → New. Homepage is `https://<app>.vercel.app`. **Authorization callback URL is `https://<ref>.supabase.co/auth/v1/callback`** (this is Supabase's callback, not the app's). Copy the Client ID and Secret into Supabase (step 8.2.3).

### 8.4 Vercel
Import the repo (framework: Next.js, root `/`). Add every variable from §8.1 to Production and Preview. Deploy. Then check `GET https://<app>/api/health` → `{ok:true}`.

### 8.5 GitHub repo webhook (per connected repo)
In the dashboard, open the project, set `repo_full_name = owner/repo`, and click "Generate webhook secret". Then go to GitHub repo → Settings → Webhooks → Add:
- Payload URL `https://<app>/api/github/webhook`
- Content type `application/json`
- Secret: the one shown (or the global `GITHUB_WEBHOOK_SECRET`)
- Events: Pushes, Pull requests, Pull request reviews, Issue comments, Workflow runs

GitHub sends a `ping`, which should get a 200.

### 8.6 Connect a project
Dashboard → Projects → New → Connect page: create a token and run the install commands in the repo. Merge the settings snippet and restart `claude`. The connect page turns green on the first event.

---

## 9. Reviewer acceptance checklist

**Build and types**
- [ ] `npm install && npm run build` succeeds with no type errors. `npx tsc --noEmit` passes. `npm run check:connector` passes.
- [ ] No `app/page.tsx`. `/` resolves to `app/(dashboard)/page.tsx`.
- [ ] File ownership in §0.2 is respected, and `package.json` matches §0.3 plus any approved `docs/DEPS_REQUESTS.md` items.
- [ ] `lib/types.ts` matches §7. Every component and prop in §4.3 exists, is exported from `components/ui/index.ts`, and renders on `/styleguide`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only imported via `lib/supabase/admin.ts` (which has `import 'server-only'`). No client component imports `lib/server/*` or `lib/supabase/admin`.

**Connector** (run from the repo root)
- [ ] `echo '{"session_id":"t1","hook_event_name":"Stop"}' | AGENTSPACE_URL=http://127.0.0.1:9 AGENTSPACE_TOKEN=x node connector/hook.mjs; echo $?` prints `0`, finishes in under 4s, and leaves stdout empty.
- [ ] The same command with `AGENTSPACE_URL=http://10.255.255.1` (blackhole) exits 0 in about 3s, because the timeout works.
- [ ] `echo 'not json' | node connector/hook.mjs; echo $?` gives `0`. Without any config it also gives `0` immediately.
- [ ] With `hook_event_name: "SessionStart"` and config set, stdout contains the `[Agentspace]` context with the session id. With `AGENTSPACE_QUIET=1`, it prints nothing.
- [ ] `AGENTSPACE_URL=http://127.0.0.1:9 AGENTSPACE_TOKEN=x node connector/cc-ask.mjs "hi"; echo $?` prints `[agentspace] UNAVAILABLE…` and `0` (within about 35s).
- [ ] `connector/settings.snippet.json` is valid JSON and covers all 8 hook events.
- [ ] Neither script imports a non-`node:` module.

**Database** (apply the migration to a scratch Supabase project, or review it by reading)
- [ ] Signing up a user creates a profile, a personal team, and an owner membership.
- [ ] User B cannot select user A's projects, agents, events or requests until B calls `join_team(A's code)`. After that, B can see all of them and answer requests.
- [ ] An authenticated user cannot update `requests.prompt`, cannot insert into `agents`/`events`, and cannot read `project_secrets`.
- [ ] Realtime publication includes the 5 tables.

**API** (curl against `npm run dev` with real Supabase env)
- [ ] `/api/ingest` gives 401 without a token. A valid token with a SessionStart event gives 202 and an agent row with status `running`. Notification gives `waiting_on_human` with attention. Stop gives `idle`. SessionEnd gives `ended`.
- [ ] `POST /api/requests` gives 201, and the agent becomes `waiting_on_human` with `open_request_count=1`. GET poll shows `open`. Answering from the dashboard makes the poll return `answered` with the answer, and the agent goes back to `running`. A second answer gives 409.
- [ ] A token from project X cannot poll a request from project Y (404). A revoked token gives 401.
- [ ] The GitHub webhook gives 401 for a bad signature, 200 for a valid `push` (a row is inserted), and the same delivery id twice gives only one row.
- [ ] Token plaintext appears only in the create response. The DB stores the sha256 hash.
- [ ] `/api/connector/hook.mjs` serves the file. `/api/connector/../package.json` gives 404.

**Dashboard**
- [ ] An unauthenticated visit to `/` redirects to `/login`. GitHub login returns to the original `next` path.
- [ ] Overview updates live (no refresh) when hook events arrive. The inbox badge count updates live.
- [ ] Inbox option buttons and the free-text answer both work. Error and busy states show. Dismiss works.
- [ ] The connect page shows the token once, with copyable install commands and settings snippet, and detects the first event.
- [ ] Agent detail timeline is live, and "Load older" works.
- [ ] Team page invite link works for a second account. Rotating the code invalidates the old link.
- [ ] Layouts work at 375px width with no horizontal scroll, in both light and dark color schemes.
