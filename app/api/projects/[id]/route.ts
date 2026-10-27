import { requireUser } from '@/lib/server/auth';
import { error, json, readJson } from '@/lib/server/http';
import { updateProjectSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase } = auth;
  const { id } = await params;
  const parsed = await readJson(req, updateProjectSchema, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const patch: Record<string, unknown> = {};
  const b = parsed.data;
  if (b.name !== undefined) patch.name = b.name;
  if (b.description !== undefined) patch.description = b.description;
  if (b.repo_full_name !== undefined) patch.repo_full_name = b.repo_full_name || null;
  const { data: existing } = await supabase.from('projects').select('id').eq('id', id).maybeSingle();
  if (!existing) return error(404, 'not found');
  if (Object.keys(patch).length === 0) {
    const { data } = await supabase.from('projects').select('*').eq('id', id).single();
    return json({ project: data });
  }
  const { data, error: err } = await supabase.from('projects').update(patch).eq('id', id).select().maybeSingle();
  if (err) {
    if (err.code === '23505') return error(409, 'repo already used in this team');
    return error(400, err.message);
  }
  if (!data) return error(404, 'not found');
  return json({ project: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase } = auth;
  const { id } = await params;
  const { data: existing } = await supabase.from('projects').select('id').eq('id', id).maybeSingle();
  if (!existing) return error(404, 'not found');
  const { error: err } = await supabase.from('projects').delete().eq('id', id);
  if (err) return error(400, err.message);
  return json({ ok: true });
}
