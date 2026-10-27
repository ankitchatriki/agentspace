import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WHITELIST = new Set(['hook.mjs', 'cc-ask.mjs', 'settings.snippet.json', 'README.md']);

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!WHITELIST.has(file)) return error(404, 'not found');
  try {
    const body = await readFile(path.join(process.cwd(), 'connector', file), 'utf8');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': file.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return error(404, 'not found');
  }
}
