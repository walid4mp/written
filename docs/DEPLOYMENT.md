# SARAD — Deployment & Release Guide

## 1. Database (already applied)

The live project has migrations 0001–0003 applied:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_quota_fix.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_founders_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/01_rls.sql
```

`DATABASE_URL` must include `?sslmode=require` for the Supabase pooler.

## 2. Make yourself an administrator

Registration never grants admin. Bootstrap once, from the database:

```sql
update public.profiles set role = 'owner' where id = (select id from auth.users where email = 'you@example.com');
```

After that all role changes go through the console / `admin-action` function.

## 3. Edge functions

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy stripe-webhook --no-verify-jwt   # provider cannot send a Supabase JWT
supabase functions deploy publish-check
supabase functions deploy admin-action
supabase functions deploy delete-account
supabase functions deploy push-fanout --no-verify-jwt
supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... EXPO_ACCESS_TOKEN=...
```

Webhook endpoint to register at Stripe:
`https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
Events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
`checkout.session.completed`, `customer.subscription.created|updated|deleted`,
`invoice.payment_failed`, `charge.refunded`.

`STRIPE_WEBHOOK_SECRET` is required — without it every delivery is rejected with
`webhook_secret_not_configured`.

## 4. Admin console (Render)

The console is a static Vite build; Render serves `apps/admin/dist`.

```bash
npm install
npm --workspace apps/admin run build     # -> apps/admin/dist
```

Render → New → Static Site
- Build command: `npm install && npm --workspace apps/admin run build`
- Publish directory: `apps/admin/dist`
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key only)

Or trigger the existing service with the deploy hook:
`curl "https://api.render.com/deploy/<service-id>?key=<key>"`

## 5. Mobile app

```bash
cd apps/mobile
npx expo install            # align native deps with the SDK
npx expo start              # Metro + QR
```

### Android APK / AAB
```bash
npm i -g eas-cli
eas login                       # your Expo account
eas build:configure
eas build -p android --profile preview     # APK
eas build -p android --profile production  # AAB for Play
```

### iOS
```bash
eas build -p ios --profile production      # needs an Apple Developer account
eas submit -p ios
```

The sandbox cannot run `eas build` because it requires interactive authentication
with your Expo/Apple/Google accounts — the commands above are the exact remaining step.

## 6. Environment keys

Only these two are compiled into the mobile app and the admin bundle:

- `EXPO_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`

Everything else (`SUPABASE_SECRET_KEY`, `STRIPE_*`, `EXPO_ACCESS_TOKEN`) lives only in
Supabase Edge Function secrets. The app has no code path that reads them.

## 7. Post-launch checks

1. Sign up a test user → confirm email → sign in.
2. Publish three works → the fourth is blocked by `can_publish`.
3. Grant yourself an exemption in the console → publishing works again.
4. Make a Stripe test payment → the row appears with status `succeeded` **only after**
   the webhook lands; check `webhook_events.processed = true`.
5. Try `update profiles set role='owner' where id=auth.uid()` from the app → no effect.
