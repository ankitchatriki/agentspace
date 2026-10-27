import { requireUser } from '@/lib/server/auth';
import { error, json, readJson } from '@/lib/server/http';
import { createProjectSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase, user } = auth;
  const parsed = await readJson(req, createProjectSchema, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;
  const { data, error: err } = await supabase
    .from('projects')
    .insert({
      team_id: b.team_id,
      name: b.name,
      description: b.description ?? null,
      repo_full_name: b.repo_full_name || null,
      created_by: user.id,
    })
    .select()
    .single();
  if (err) {
    if (err.code === '23505') return error(409, 'repo already used in this team');
    if (err.code === '42501') return error(403, 'forbidden');
    return error(400, err.message);
  }
  return json({ project: data }, 201);
}
