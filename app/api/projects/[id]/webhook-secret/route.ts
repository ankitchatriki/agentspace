import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/server/auth';
import { error, json } from '@/lib/server/http';
import { env } from '@/lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase } = auth;
  const { id } = await params;
  const { data: project } = await supabase.from('projects').select('id').eq('id', id).maybeSingle();
  if (!project) return error(404, 'not found');
  const secret = randomBytes(24).toString('hex');
  const admin = createAdminClient();
  const { error: e1 } = await admin
    .from('project_secrets')
    .upsert({ project_id: id, github_webhook_secret: secret, updated_at: new Date().toISOString() });
  if (e1) return error(500, e1.message);
  const { error: e2 } = await admin.from('projects').update({ github_webhook_configured: true }).eq('id', id);
  if (e2) return error(500, e2.message);
  return json({ secret, webhook_url: `${env.appUrl}/api/github/webhook` }, 200, { 'Cache-Control': 'no-store' });
}
