# Agentspace connector

Two dependency-free Node (>= 18) scripts that connect Claude Code to your Agentspace command center.

- `hook.mjs` is a Claude Code hook. It posts session activity to `/api/ingest`. It always exits 0 and never blocks the agent.
- `cc-ask.mjs` lets an agent ask a human in the Agentspace inbox and wait for the answer on stdout.

## Install (in the repo you want to track)

Create a token on the project's Connect page, then run:

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

## Teams

Teammates commit `hook.mjs`, `cc-ask.mjs` and `.claude/settings.json`. Each person creates their own token from the project page. `config.json` stays gitignored; alternatively each person sets `AGENTSPACE_URL` and `AGENTSPACE_TOKEN` in their environment.

## Environment variables

| Variable | Effect |
|---|---|
| `AGENTSPACE_URL`, `AGENTSPACE_TOKEN` | Override `config.json` |
| `CC_USER` | Human label (default: `config.user`, git email, OS user) |
| `CC_AGENT_NAME`, `CC_AGENT_ROLE` | Label this agent; run separate `claude` processes to get separate rows |
| `AGENTSPACE_REDACT_PROMPTS=1` | Never send prompt text |
| `AGENTSPACE_QUIET=1` | Do not inject the Agentspace instructions into the session context |
| `AGENTSPACE_DEBUG=1` | Print connector errors to stderr |

## Asking a human

```bash
node .claude/agentspace/cc-ask.mjs --session <id> "Which region?" --options "us-east-1,eu-west-1" --as coder-a
```

The answer is printed to stdout. Outputs starting with `[agentspace] TIMEOUT` mean re-run with `--resume <id>`; `UNAVAILABLE` means ask in the terminal. Run it with the Bash tool timeout set to 600000.

## Subagents

Subagents launched with the Task tool share their parent's `session_id`, so they appear as one agent with `SubagentStop` events. Use `--as <name>` to label which subagent asked.
