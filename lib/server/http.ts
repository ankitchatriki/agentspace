import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers });
}

export function error(status: number, message: string, details?: unknown) {
  return NextResponse.json(details === undefined ? { error: message } : { error: message, details }, { status });
}

export type ReadJsonResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function readJson<T>(req: Request, schema: ZodSchema<T>, maxBytes = 64 * 1024): Promise<ReadJsonResult<T>> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return { ok: false, response: error(413, 'payload too large') };
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, response: error(400, 'could not read body') };
  }
  if (Buffer.byteLength(text, 'utf8') > maxBytes) return { ok: false, response: error(413, 'payload too large') };
  let raw: unknown;
  try {
    raw = text.length ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: error(400, 'invalid JSON') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: error(400, 'validation failed', parsed.error.flatten()) };
  }
  return { ok: true, data: parsed.data };
}
