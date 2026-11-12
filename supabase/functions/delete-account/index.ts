// supabase/functions/delete-account/index.ts
// Server-side account deletion. Only the authenticated owner may delete their
// own auth user; the service key never leaves the function.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err, json } from '../_shared/http.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err('method_not_allowed', 405);

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: authErr } = await db.auth.getUser(token);
  if (authErr || !userData.user) return err('unauthorized', 401);

  const uid = userData.user.id;

  // An admin cannot be deleted through this path (prevents lock-out).
  const { data: profile } = await db.from('profiles').select('role').eq('id', uid).single();
  if (profile && (profile.role === 'admin' || profile.role === 'owner')) {
    return err('admin_account_requires_manual_deletion', 403);
  }

  const { error: delErr } = await db.auth.admin.deleteUser(uid);
  if (delErr) return err(delErr.message, 500);

  return json({ ok: true, deleted: uid });
});
