// supabase/functions/admin-action/index.ts
// Server-checked admin operations. The JWT is always re-verified against the
// database role — a forged client claim can never pass here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err, json } from '../_shared/http.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!, {
  auth: { persistSession: false },
});

const ADMIN_ONLY = new Set([
  'grant_badge',
  'revoke_badge',
  'set_role',
  'grant_exemption',
  'revoke_exemption',
  'set_setting',
  'upsert_plan',
  'upsert_coupon',
  'ban_user',
  'unban_user',
  'delete_work',
  'announce',
]);
const MODERATOR_OK = new Set(['review_work', 'review_verification', 'review_account_type', 'resolve_report', 'delete_comment']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err('method_not_allowed', 405);

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: authErr } = await db.auth.getUser(token);
  if (authErr || !userData.user) return err('unauthorized', 401);

  const { data: profile } = await db
    .from('profiles')
    .select('role,is_banned')
    .eq('id', userData.user.id)
    .single();
  if (!profile || profile.is_banned) return err('forbidden', 403);

  const isAdmin = profile.role === 'admin' || profile.role === 'owner';
  const isMod = isAdmin || profile.role === 'moderator';

  const body = await req.json().catch(() => ({}));
  const action: string = body.action;
  if (!action) return err('missing_action');

  if (ADMIN_ONLY.has(action) && !isAdmin) return err('admin_required', 403);
  if (MODERATOR_OK.has(action) && !isMod) return err('moderator_required', 403);
  if (!ADMIN_ONLY.has(action) && !MODERATOR_OK.has(action)) return err('unknown_action', 400);

  try {
    switch (action) {
      case 'grant_badge':
        await db.rpc('admin_grant_badge', { target: body.user_id, badge: body.badge, note: body.note ?? null });
        break;
      case 'revoke_badge':
        await db.rpc('admin_revoke_badge', { target: body.user_id, badge: body.badge, reason: body.reason ?? null });
        break;
      case 'set_role':
        await db.rpc('admin_set_role', { target: body.user_id, new_role: body.role });
        break;
      case 'grant_exemption':
        await db.rpc('admin_grant_exemption', {
          target: body.user_id,
          kind: body.kind,
          days: body.days ?? null,
          reason: body.reason ?? null,
        });
        break;
      case 'revoke_exemption':
        await db.rpc('admin_revoke_exemption', { exemption: body.exemption_id });
        break;
      case 'review_work':
        await db.rpc('admin_review_work', { work: body.work_id, decision: body.decision, reason: body.reason ?? null });
        break;
      case 'ban_user':
        await db.from('profiles').update({ is_banned: true, ban_reason: body.reason ?? null }).eq('id', body.user_id);
        break;
      case 'unban_user':
        await db.from('profiles').update({ is_banned: false, ban_reason: null }).eq('id', body.user_id);
        break;
      case 'set_setting':
        await db.from('app_settings').update(body.patch ?? {}).eq('id', true);
        break;
      case 'upsert_plan':
        await db.from('plans').upsert(body.plan, { onConflict: 'code' });
        break;
      case 'upsert_coupon':
        await db.from('coupons').upsert(body.coupon, { onConflict: 'code' });
        break;
      case 'announce':
        await db.from('notifications').insert(
          (body.user_ids as string[]).map((uid) => ({
            user_id: uid,
            kind: 'admin_announcement',
            title: body.title,
            body: body.message,
          })),
        );
        break;
      default:
        return err('unhandled_action', 400);
    }
    return json({ ok: true, action });
  } catch (e) {
    return err(String(e), 500);
  }
});
