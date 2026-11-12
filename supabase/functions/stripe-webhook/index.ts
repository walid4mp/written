// supabase/functions/stripe-webhook/index.ts
// Deno edge function. Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// A payment is NEVER marked successful from the client. Only this verified
// webhook may flip a payment to "succeeded".
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err, json, verifyStripeSignature } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err('method_not_allowed', 405);
  if (!WEBHOOK_SECRET) return err('webhook_secret_not_configured', 500);

  const raw = await req.text();
  const verification = await verifyStripeSignature(raw, req.headers.get('stripe-signature'), WEBHOOK_SECRET);
  if (!verification.ok) {
    await db.from('webhook_events').insert({
      provider: 'stripe',
      event_id: `invalid_${crypto.randomUUID()}`,
      event_type: 'signature_failed',
      signature_ok: false,
      processed: false,
      error: verification.reason,
    });
    return err('invalid_signature', 400, { reason: verification.reason });
  }

  const event = JSON.parse(raw);
  const eventId: string = event.id;
  const eventType: string = event.type;

  // Idempotency: unique(provider, event_id). Duplicate delivery => 200 no-op.
  const { error: dupErr } = await db.from('webhook_events').insert({
    provider: 'stripe',
    event_id: eventId,
    event_type: eventType,
    signature_ok: true,
    processed: false,
    payload: event,
  });
  if (dupErr) return json({ ok: true, duplicate: true });

  const obj = event.data?.object ?? {};
  const meta = obj.metadata ?? {};
  const amount = typeof obj.amount_received === 'number' ? obj.amount_received / 100 : (obj.amount_total ?? 0) / 100;
  const currency = (obj.currency ?? 'usd').toUpperCase();

  try {
    if (eventType === 'payment_intent.succeeded' || eventType === 'checkout.session.completed') {
      const paymentIntentId = obj.id ?? obj.payment_intent;
      const userId = meta.user_id;
      const purpose = meta.purpose ?? 'publish_fee';

      const { data: existing } = await db
        .from('payments')
        .select('id')
        .eq('provider', 'stripe')
        .eq('provider_ref', paymentIntentId)
        .maybeSingle();

      let paymentId = existing?.id;
      if (!paymentId && userId) {
        const { data: inserted } = await db
          .from('payments')
          .insert({
            user_id: userId,
            purpose,
            amount,
            currency,
            status: 'succeeded',
            provider: 'stripe',
            provider_ref: paymentIntentId,
            provider_event_id: eventId,
            work_id: meta.work_id ?? null,
            chapter_id: meta.chapter_id ?? null,
            meta,
          })
          .select('id')
          .single();
        paymentId = inserted?.id;
      } else if (paymentId) {
        await db.from('payments').update({ status: 'succeeded', provider_event_id: eventId }).eq('id', paymentId);
      }

      if (paymentId && userId) {
        const { data: inv } = await db
          .from('invoices')
          .insert({
            number: `SARAD-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`,
            payment_id: paymentId,
            user_id: userId,
            amount,
            currency,
          })
          .select('id')
          .single();

        await db.from('notifications').insert({
          user_id: userId,
          kind: 'payment_success',
          title: 'Payment successful',
          body: `${amount.toFixed(2)} ${currency}`,
          data: { payment_id: paymentId, invoice_id: inv?.id ?? null, purpose },
        });

        // a publish fee unlocks exactly one additional work slot
        if (purpose === 'publish_fee') {
          const { data: p } = await db.from('profiles').select('free_works_used').eq('id', userId).single();
          await db
            .from('profiles')
            .update({ free_works_used: Math.max((p?.free_works_used ?? 0) - 1, 0) })
            .eq('id', userId);
        }
      }
    }

    if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
      const { data: plan } = await db.from('plans').select('id').eq('provider_price_id', obj.items?.data?.[0]?.price?.id ?? '').maybeSingle();
      if (plan && meta.user_id) {
        await db.from('subscriptions').upsert(
          {
            user_id: meta.user_id,
            plan_id: plan.id,
            status: obj.status === 'active' ? 'active' : obj.status === 'trialing' ? 'trialing' : 'past_due',
            provider: 'stripe',
            provider_sub_id: obj.id,
            current_period_start: new Date((obj.current_period_start ?? Date.now() / 1000) * 1000).toISOString(),
            current_period_end: new Date((obj.current_period_end ?? Date.now() / 1000 + 2592000) * 1000).toISOString(),
            cancel_at_period_end: !!obj.cancel_at_period_end,
          },
          { onConflict: 'provider_sub_id' },
        );
      }
    }

    if (eventType === 'customer.subscription.deleted') {
      await db
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('provider_sub_id', obj.id);
      if (meta.user_id) {
        await db.from('notifications').insert({
          user_id: meta.user_id,
          kind: 'subscription_expiring',
          title: 'Subscription ended',
          body: 'Your subscription has ended.',
        });
      }
    }

    if (eventType === 'payment_intent.payment_failed' || eventType === 'invoice.payment_failed') {
      const userId = meta.user_id;
      if (userId) {
        await db.from('payments').insert({
          user_id: userId,
          purpose: meta.purpose ?? 'publish_fee',
          amount,
          currency,
          status: 'failed',
          provider: 'stripe',
          provider_ref: obj.id,
          provider_event_id: eventId,
          failure_reason: obj.last_payment_error?.message ?? 'payment_failed',
          meta,
        });
        await db.from('notifications').insert({
          user_id: userId,
          kind: 'payment_failed',
          title: 'Payment failed',
          body: obj.last_payment_error?.message ?? 'Please retry with another method.',
        });
      }
    }

    if (eventType === 'charge.refunded') {
      const refunded = (obj.amount_refunded ?? 0) / 100;
      await db
        .from('payments')
        .update({
          status: refunded >= amount ? 'refunded' : 'partially_refunded',
          refunded_amount: refunded,
        })
        .eq('provider', 'stripe')
        .eq('provider_ref', obj.payment_intent);
    }

    await db.from('webhook_events').update({ processed: true }).eq('provider', 'stripe').eq('event_id', eventId);
    return json({ ok: true, type: eventType });
  } catch (e) {
    await db
      .from('webhook_events')
      .update({ processed: false, error: String(e) })
      .eq('provider', 'stripe')
      .eq('event_id', eventId);
    return err('processing_error', 500);
  }
});
