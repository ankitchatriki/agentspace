# Agentspace

An agent command center. A team watches all of its Claude Code agents across all projects, and agents ask humans for input in a shared request inbox instead of blocking in a terminal.

Stack: Next.js 15 (App Router, TypeScript), Tailwind v3, Supabase (Postgres, Auth, Realtime), deployed on Vercel. Full design: `docs/SPEC.md`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
npm run typecheck
npm run check:connector
```

## Setup

### 1. Supabase
1. Create a project. In the SQL editor run `supabase/migrations/0001_init.sql` (or `supabase link && supabase db push`).
2. Database, Publications: confirm `supabase_realtime` contains agents, requests, events, github_events, projects.
3. Authentication, Providers, GitHub: enable it and paste the Client ID and Secret from step 2.
4. Authentication, URL Configuration: set Site URL to `https://<app>.vercel.app`. Add redirect URLs `https://<app>.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, and for previews `https://*-<team>.vercel.app/auth/callback`.
5. Settings, API: copy the project URL, anon key and service role key.

### 2. GitHub OAuth App (login)
GitHub, Settings, Developer settings, OAuth Apps, New. Homepage is `https://<app>.vercel.app`. The authorization callback URL is `https://<ref>.supabase.co/auth/v1/callback` (Supabase's callback, not the app's). Copy the Client ID and Secret into Supabase.

### 3. Environment variables
See `.env.example`:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon or publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only; never expose to the browser |
| `NEXT_PUBLIC_APP_URL` | public URL of the deployed app |
| `GITHUB_WEBHOOK_SECRET` | optional global webhook secret; per-project secrets also work |

### 4. Deploy to Vercel
Import the repo (framework Next.js, root `/`). Add every variable above to Production and Preview. Deploy, then check `GET https://<app>/api/health` returns `{"ok":true,...}`.

### 5. GitHub repo webhook (per connected repo)
In the dashboard open the project, set the repo to `owner/repo`, and click "Generate webhook secret". Then in the GitHub repo, Settings, Webhooks, Add webhook:
- Payload URL `https://<app>/api/github/webhook`
- Content type `application/json`
- Secret: the one shown (or the global `GITHUB_WEBHOOK_SECRET`)
- Events: Pushes, Pull requests, Pull request reviews, Issue comments, Workflow runs

GitHub sends a `ping`; it should get a 200.

### 6. Connect a project
Dashboard, Projects, New, Connect page: create a token and run the install commands in the repo. Merge the settings snippet into `.claude/settings.json` and restart `claude`. The connect page turns green on the first event. See `connector/README.md` for details, privacy flags and environment variables.

## Layout
- `app/api/**`: ingest, requests, projects, teams, GitHub webhook, connector files, health
- `app/auth/**`: OAuth callback and sign-out
- `lib/server/**`: server-only helpers (status derivation, tokens, schemas, GitHub)
- `lib/supabase/**`: browser, server, admin and middleware clients
- `supabase/migrations/**`: database schema, RLS, realtime
- `connector/**`: dependency-free hook and `cc-ask` scripts served at `/api/connector/<file>`
