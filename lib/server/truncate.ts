const MAX_STR = 4000;

function cutStrings(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return v.length > MAX_STR ? v.slice(0, MAX_STR) + '…[truncated]' : v;
  if (depth > 12) return '[depth limit]';
  if (Array.isArray(v)) return v.map((x) => cutStrings(x, depth + 1));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = cutStrings(val, depth + 1);
    return out;
  }
  return v;
}

const size = (o: unknown) => Buffer.byteLength(JSON.stringify(o), 'utf8');

export function truncatePayload(obj: Record<string, unknown>, maxBytes = 32_768): Record<string, unknown> {
  let out = cutStrings(obj) as Record<string, unknown>;
  if (size(out) <= maxBytes) return out;
  if ('tool_response' in out) {
    const { tool_response: _drop, ...rest } = out;
    void _drop;
    out = rest;
    if (size(out) <= maxBytes) return out;
  }
  if ('tool_input' in out) {
    out = { ...out, tool_input: '[dropped: too large]' };
  }
  return out;
}
