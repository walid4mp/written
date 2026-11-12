# SARAD patch notes (2026-11-12)

## Changes in this package
- Fixed Supabase Storage uploads to send the raw file bytes with the correct Content-Type header (instead of multipart/form-data).
- Kept authenticated session-token authorization and real XHR upload progress reporting.
- Added signed URLs for private `documents` uploads; public media continues to use public URLs.
- Added profile-photo and profile-cover selection, upload, and profile refresh in Settings.
- Added work-cover selection/upload to the novel/chapter editor and persistence to `works.cover_url`.
- Added the creator earnings screen using the existing `myEarnings` API helper and linked it from the profile.
- Added image/video/file attachments to direct messages. The conversation screen already had a Supabase Realtime subscription for messages and typing indicators; that subscription was retained.
- Added a creator earnings ledger table and an admin-editable platform commission percentage setting.
- Expanded existing Storage bucket MIME allow-lists and upload limits through a new idempotent migration.
- Updated profile auth data to include `cover_url`.

## Required Supabase step
Apply migrations in order, including:
- `0005_storage_upload_support.sql`
- `0006_creator_earnings.sql`

The `creator_earnings` table intentionally has no client write policy. A trusted payment webhook/Edge Function must write earnings rows after verified purchases. The commission setting is stored in `app_settings`; the existing purchase/payment settlement code must read that setting when it calculates each sale.

## Not completed / external requirements
- The new app icon and splash artwork were not replaced because image generation was explicitly marked as requiring confirmation.
- No live Supabase credentials were supplied, so migrations could not be applied to the hosted project and real two-account upload/chat tests could not be run.
- Dependency installation timed out in this environment. A TypeScript/Expo build could not be certified here; run `npm ci --legacy-peer-deps` in `apps/mobile`, then `npm run typecheck` and the GitHub Actions APK workflow.
- Private document links are signed for seven days. A production document viewer should request a fresh signed URL from `storage_path` when reopening an older attachment rather than relying on an expired stored URL.
