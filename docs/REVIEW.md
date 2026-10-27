# Agentspace command center v1: review

Reviewer pass on branch `command-center-v1` (2026-10-27).

## Verdict

**Ship-ready for a first deploy, after the fixes below.** It builds and typechecks, and the connector behaves to spec. Token and webhook authentication are sound. RLS scopes every table to team members. The migration had one real security gap: Supabase's default table-wide `UPDATE` grant made the intended column limits ineffective. That is fixed. The UI is polished and consistent in light and dark at 1440px and 390px, with two layout defects, also fixed. Database and API behaviour still need a pass against a real Supabase project (see the last section).

## §9 acceptance checklist

| Item | Result | Notes |
|---|---|---|
| `npm run build`, `npx tsc --noEmit`, `npm run check:connector` | PASS | Re-run after fixes: all green (placeholder env exported in the shell only) |
| No `app/page.tsx`; `/` is `(dashboard)/page.tsx` | PASS | |
| File ownership / package.json matches §0.3 | PASS | No extra deps; DEPS_REQUESTS.md is empty |
| `lib/types.ts` matches §7; §4.3 components exported and on `/styleguide` | PASS | Matches §7 exactly. All components are exported. `EventItem` is shown through `EventTimeline` |
| Service role key only via `lib/supabase/admin.ts` (`server-only`); no client imports of `lib/server`/admin | PASS | A grep of `.next/static` for the placeholder key value found 0 hits |
| hook.mjs: refused port → exit 0, <4s, stdout empty | PASS | 64 ms |
| hook.mjs: blackhole URL → exit 0 ~3s | PASS | The sandbox rejects at once (80 ms). The code uses `AbortSignal.timeout(3000)` |
| hook.mjs: bad JSON / no config → 0 immediately | PASS | Stdin left open → exits after 2.0 s |
| SessionStart context printed; `AGENTSPACE_QUIET=1` silent | PASS | |
| cc-ask unreachable → `UNAVAILABLE`, exit 0 | PASS | 4.1 s (3 attempts with 1s/3s backoff) |
| settings.snippet.json valid, 8 hook events | PASS | |
| Connector imports only `node:` modules | PASS | |
| cc-ask extra (mock server) | PASS | `--timeout` → TIMEOUT line, `--resume` → answer on stdout + "answered by" on stderr, `--no-wait`, SIGTERM → POST /cancel, usage error → exit 2 |
| DB: signup creates profile, team, owner | PASS (by reading) | `handle_new_user` trigger |
| DB: cross-team isolation; join_team grants access | PASS (by reading) | All `select` policies use `is_team_member(team_id)`. `anon` has every table privilege revoked, and all policies are `to authenticated` |
| DB: no update of `requests.prompt`, no insert into agents/events, no read of `project_secrets` | PASS (by reading) | Column-level update on requests. Insert/update/delete revoked on agents and events. All privileges on secrets revoked |
| Realtime publication has 5 tables | PASS | |
| API: ingest 401 without token | PASS | Live check: `{"error":"invalid token"}` 401 |
| API: ingest status transitions, request lifecycle, 409 on second answer | NEEDS SUPABASE | Code matches §2.2–§2.6 and §3 on reading |
| API: token from project X cannot poll Y (404); revoked → 401 | PASS (by reading) | `project_id !== auth.project.id` → 404 on GET and cancel. Lookup filters `revoked_at is null` |
| API: webhook 401 bad sig, 200 push, dedupe by delivery | PASS (by reading) | HMAC over the raw text body, `timingSafeEqual` after a length check, upsert `ignoreDuplicates` on (project_id, delivery_id) |
| Token plaintext only in create response; sha256 stored | PASS | And now also not readable by clients (fix 2) |
| `/api/connector/hook.mjs` served; `../package.json` 404 | PASS | Live check: both the raw and `%2F` forms give 404 (whitelist) |
| Unauthenticated `/` → `/login?next=` | PASS | Live check: `/inbox` → 307 `/login?next=%2Finbox`. The callback validates `next` (no `//`, no `/\`) |
| Live overview / inbox / connect / timeline / invites | NEEDS SUPABASE | Realtime hooks are wired and every one unsubscribes on unmount (checked) |
| 375px, no horizontal scroll, light + dark | PASS for /styleguide and /login | scrollWidth equals clientWidth at 390px. The wide table and code blocks scroll inside their containers. Dashboard pages need auth to render |

## Fixes made

1. **`supabase/migrations/0001_init.sql:306-312`: column-level UPDATE grants did nothing.** Supabase's default privileges give `authenticated` table-wide `UPDATE` on new tables, so `grant update (name)` added nothing. Any team member could `PATCH /rest/v1/projects` and change `team_id`, which moved a shared project into another team they belonged to and locked teammates out. They could also set `created_by` and `github_webhook_configured`. A team owner could also write `teams.invite_code` directly, and users could edit their own `profiles.email` and `github_login`. The fix adds `revoke update` on profiles, teams and projects, then grants update on `projects (name, description, repo_full_name)` only.
2. **`0001_init.sql:301-303` + `app/(dashboard)/projects/[id]/page.tsx:63`: `token_hash` was readable by clients.** The page did `select('*')`, and table-wide SELECT exposed the hash to every member. This contradicted §2.8 ("never includes token_hash"). The migration now grants SELECT on every column except `token_hash`, and the page selects explicit columns.
3. **`0001_init.sql:293`: the `requests_answer` policy now requires `expires_at > now()`.** Before this, an expired-but-still-`open` request could be answered by a direct PostgREST call that bypassed the route's check.
4. **`app/(dashboard)/projects/[id]/connect/page.tsx:20,41-43,51`: false "Connected".** Step 5 showed success as soon as the project had any agent, including agents from teammates. It now counts only agents with events after this token's server-side `created_at`.
5. **`app/(dashboard)/_components/DashboardShell.tsx:20,51-52,68`: browser notifications fired for every existing request.** The "seen" set was seeded from the empty first render, before requests loaded. It is now seeded after load.
6. **`components/ui/TokenRow.tsx:13,15`: text overlapped at 390px.** The token prefix ran into the "created/used" column. The fix adds a `truncate` prefix and a `min-w-[9rem]` label block, so the row wraps cleanly.
7. **`components/ui/AvatarStack.tsx:16,21`: initials were clipped.** A 6px overlap on 20px avatars hid the second letter ("AI BI CI" instead of "AR BK CW"). The overlap is now 2px.

## Remaining issues (ranked)

1. **Security (by design, high if multi-tenant): the global `GITHUB_WEBHOOK_SECRET` leaks events across teams.** The global secret is in every project's secret set. Any team can create a project with `repo_full_name = victim/repo`, and when the victim signs with the global secret, that team receives the victim's GitHub events. **Recommendation:** in a shared or multi-tenant deployment, leave `GITHUB_WEBHOOK_SECRET` unset (per-project secrets are safe). Alternatively, use the global secret only when a single team owns that repo name. I did not change this because it is how §2.10 specifies it.
2. **Correctness: cc-ask cancels the request on SIGTERM.** If the agent forgets `timeout: 600000`, the Bash tool's default 2-minute timeout kills cc-ask, and the human's request is silently cancelled instead of staying open for `--resume`. Consider cancelling only on SIGINT, or leaving it open and printing the TIMEOUT line.
3. **hook.mjs worst case is about 6.5s against a 5s hook timeout.** That breaks down as 2s for stdin, 1s for git email, 0.5s for git branch and 3s for the POST. Claude Code closes stdin, so in practice the worst case is about 4.5s. Consider cutting the fetch timeout to 2.5s or caching the git email.
4. **Any team member can delete projects and rename repos (per spec).** Owners cannot be distinguished from members for destructive actions. An owner can also remove themselves and leave a team with no owner.
5. **Team member removal via the client `delete()` fails silently** when RLS denies it (0 rows, no error). Use a route or `.select()` and check the count.
6. **`Notification.requestPermission()` runs on mount without a user gesture.** Chrome may suppress it. Put it behind a button.
7. **Status races.** `event_count + 1` and the read-then-write in `recomputeAgentRequests` can lose updates under concurrent hooks. This is accepted in the spec, and the next event corrects it.
8. **Polish.** Login is clean but sparse for "enterprise". Consider a short product value strip or footer, and a "Sign in with SSO" placeholder. The wrapped Revoke button in TokenRow sits left-aligned at mobile width. The `/styleguide` page is publicly reachable in production (it uses mock data only).

## Still needs a real Supabase project

- Apply the migration (including the new grant statements) and run the §9 Database items with two accounts: isolation, join, the `requests.prompt` update being rejected, `project_secrets` being unreadable, and that `select('*')` on `project_tokens` now fails while explicit columns succeed.
- Confirm the PostgREST UPDATE…RETURNING on `projects` and `requests` works with the column grants (it should, because SELECT is granted).
- The whole API flow: ingest transitions, request create/poll/answer/409/410, cross-project 404, revoked-token 401, the webhook ping/push/dedupe.
- GitHub OAuth round trip with `next`. Realtime as an authenticated user (RLS-filtered `postgres_changes`), the inbox badge, the connect-page detection, the agent timeline "Load older", and invite rotation.
- The dashboard pages at 375px in light and dark (they are behind auth, so they were not screenshotted).

## Screenshots

`docs/review/`: `styleguide-{1440,390}-{light,dark}.png` and `login-{1440,390}-{light,dark}.png`, taken after the fixes against `next start` with placeholder env. Neither page logged a console error.
