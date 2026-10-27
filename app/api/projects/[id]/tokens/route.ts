import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/server/auth';
import { error, json, readJson } from '@/lib/server/http';
import { createTokenSchema } from '@/lib/server/schemas';
import { generateToken, hashToken } from '@/lib/server/tokens';
import type { ProjectToken } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase, user } = auth;
  const { id } = await params;
  const parsed = await readJson(req, createTokenSchema, 4 * 1024);
  if (!parsed.ok) return parsed.response;
  const { data: project } = await supabase.from('projects').select('id, team_id').eq('id', id).maybeSingle();
  if (!project) return error(404, 'not found');

  const token = generateToken();
  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from('project_tokens')
    .insert({
      team_id: project.team_id,
      project_id: project.id,
      label: parsed.data.label || null,
      token_prefix: token.slice(0, 12),
      token_hash: hashToken(token),
      created_by: user.id,
    })
    .select('id, team_id, project_id, label, token_prefix, created_by, created_at, last_used_at, revoked_at')
    .single();
  if (err || !data) return error(500, 'could not create token', err?.message);
  return json({ token, token_meta: data as ProjectToken }, 201, { 'Cache-Control': 'no-store' });
}
