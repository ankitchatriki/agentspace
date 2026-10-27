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
