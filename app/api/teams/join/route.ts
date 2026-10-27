import { requireUser } from '@/lib/server/auth';
import { error, json, readJson } from '@/lib/server/http';
import { joinTeamSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase } = auth;
  const parsed = await readJson(req, joinTeamSchema, 2 * 1024);
  if (!parsed.ok) return parsed.response;
  const { data, error: err } = await supabase.rpc('join_team', { p_code: parsed.data.code });
  if (err) {
    if (err.code === 'P0002') return error(404, 'invalid invite code');
    return error(400, err.message);
  }
  const teamId = data as string;
  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).maybeSingle();
  return json({ team_id: teamId, team_name: team?.name ?? '' });
}
