import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Project } from '@/lib/types';

export function generateToken(): string {
  return 'ags_' + randomBytes(32).toString('base64url');
}

export function hashToken(t: string): string {
  return createHash('sha256').update(t).digest('hex');
}

export async function authenticateProjectToken(req: Request): Promise<{ project: Project; tokenId: string } | null> {
  const header = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('project_tokens')
    .select('id, last_used_at, project:projects(*)')
    .eq('token_hash', hashToken(m[1]))
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const project = (Array.isArray(data.project) ? data.project[0] : data.project) as Project | null;
  if (!project) return null;
  const last = data.last_used_at ? new Date(data.last_used_at as string).getTime() : 0;
  if (!last || Date.now() - last > 60_000) {
    await admin.from('project_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  }
  return { project, tokenId: data.id as string };
}
