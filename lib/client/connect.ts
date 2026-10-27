export function buildInstallCommands(appUrl: string, token: string): string {
  const url = appUrl.replace(/\/$/, '');
  return [
    'mkdir -p .claude/agentspace',
    `curl -fsSL ${url}/api/connector/hook.mjs   -o .claude/agentspace/hook.mjs`,
    `curl -fsSL ${url}/api/connector/cc-ask.mjs -o .claude/agentspace/cc-ask.mjs`,
    "cat > .claude/agentspace/config.json <<'EOF'",
    `{ "url": "${url}", "token": "${token}" }`,
    'EOF',
    "grep -qxF '.claude/agentspace/config.json' .gitignore 2>/dev/null || echo '.claude/agentspace/config.json' >> .gitignore",
    `# then merge the hooks + permissions from ${url}/api/connector/settings.snippet.json into .claude/settings.json`,
    '# (or .claude/settings.local.json to keep it personal). Restart Claude Code.',
  ].join('\n');
}

export function buildConfigJson(appUrl: string, token: string, user?: string | null): string {
  const cfg: Record<string, string> = { url: appUrl.replace(/\/$/, ''), token };
  if (user) cfg.user = user;
  return JSON.stringify(cfg, null, 2);
}
