// supabase/functions/push-fanout/index.ts
// Turns un-sent notification rows into Expo push messages.
// Invoke from a cron trigger; safe to re-run (push_sent guards duplicates).
import { corsHeaders, json } from '../_shared/http.ts';

const EXPO_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: pending } = await db
    .from('notifications')
    .select('id,user_id,title,body,kind,data')
    .eq('push_sent', false)
    .is('read_at', null)
    .order('created_at')
    .limit(80);

  let sent = 0;

  for (const n of pending ?? []) {
    const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', n.user_id);
    if (!tokens?.length) {
      await db.from('notifications').update({ push_sent: true }).eq('id', n.id);
      continue;
    }
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: n.title ?? 'SARAD',
      body: n.body ?? '',
      data: { notificationId: n.id, kind: n.kind, ...n.data },
      sound: 'default',
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EXPO_TOKEN ? { Authorization: `Bearer ${EXPO_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages),
    });

    if (res.ok) {
      sent += messages.length;
      await db.from('notifications').update({ push_sent: true }).eq('id', n.id);
    }
  }

  return json({ ok: true, processed: pending?.length ?? 0, sent });
});
