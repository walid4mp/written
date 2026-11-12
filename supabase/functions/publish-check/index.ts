// supabase/functions/publish-check/index.ts
// Single server-side authority for "may this user publish another work?".
// The mobile client calls this before opening the editor's publish action.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err, json } from '../_shared/http.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) return err('unauthorized', 401);

  const { data, error } = await db.rpc('can_publish', { uid: userData.user.id });
  if (error) return err(error.message, 500);
  return json({ ok: true, ...data });
});
