# SARAD — سَراد

> منصّة أدبية واجتماعية عالمية: روايات وقصص وحكايات وشعر، مع شبكة اجتماعية كاملة،
> محرّر كتابة احترافي، نظام اشتراكات ومدفوعات مُتحقَّق منها على الخادم، ولوحة إدارة.

**Repo:** https://github.com/walid4mp/written

---

## 1. الهوية

| العنصر | القيمة |
|---|---|
| الاسم التجاري | **SARAD** (سَراد) — من «السَّرْد»: فعل الحكي المتّصل |
| الاسم اللاتيني | SARAD |
| الشعار اللفظي | «حيث تُروى الحكايات» · *Where stories are told* · *Là où les histoires se racontent* |
| اللون الأساسي | `#0B0B0C` (ليل السَّراد) |
| لون التمييز | `#C9A227` (ذهبي مخطوط) |
| لون ثانوي | `#7C3AED` (بنفسجي حِبر) |
| اللهجات | عربية RTL · فرنسية LTR · إنجليزية LTR |

الهوية البصرية مبنية على مراجع التصميم المرفقة: خلفية داكنة فاخرة، ذهبي/عنبري
كلون تمييز، أغلفة كتب بارزة، وشريط تنقّل سفلي بزِر دائري مركزي.

---

## 2. البنية

```
written/
├── apps/mobile            # React Native + Expo Router + TypeScript
├── apps/admin             # لوحة الإدارة (React + Vite + TypeScript)
├── packages/shared        # الأنواع والثوابت المشتركة (i18n، enums)
├── supabase/
│   ├── migrations/0001_init.sql     # المخطّط الكامل + RLS + triggers + seed
│   └── functions/
│       ├── stripe-webhook/          # التحقق من التوقيع + تحصيل المدفوعات
│       ├── publish-check/           # سلطة حصّة النشر (على الخادم)
│       └── admin-action/            # عمليات إدارية محميّة
├── tests/01_rls.sql                 # 12 اختبار صلاحيات على قاعدة البيانات الحقيقية
└── docs/
```

### التقنيات
- **Mobile:** Expo SDK, Expo Router, TypeScript, Zustand, TanStack Query, i18next (ar/fr/en + RTL), expo-notifications
- **Backend:** Supabase (PostgreSQL 17, Auth, Storage, Realtime, Edge Functions/Deno)
- **Admin:** React 18 + Vite + TypeScript + Supabase JS
- **Payments:** Stripe (primary) + PayPal (adapter ready) — **webhook-verified only**

---

## 3. قاعدة البيانات (مُطبَّقة فعلياً)

المخطّط الكامل في `supabase/migrations/0001_init.sql` — 45 جدولاً، 9 enums،
فهارس trigram وGIN للبحث النصي، ومشغّلات (triggers) للعدّادات والتدقيق.

المجموعات:
1. **الهوية:** `profiles`, `app_settings`, `founders`, `device_sessions`, `auth_events`
2. **التوثيق:** `badge_types` (9 شارات), `user_badges`, `verification_requests`, `account_type_requests`
3. **المحتوى:** `works`, `chapters`, `reading_progress`, `bookmarks`, `library_items`, `ratings`
4. **الاجتماعي:** `follows`, `friendships`, `blocks`, `posts`, `media`, `comments`, `likes`, `mentions`
5. **القصص:** `stories`, `story_views`, `story_highlights`
6. **الرسائل:** `conversations`, `conversation_members`, `messages`, `message_reads`, `typing_indicators`
7. **المجموعات:** `groups`, `group_members`, `group_contests`
8. **المدفوعات:** `plans`, `subscriptions`, `payments`, `invoices`, `exemptions`, `coupons`, `coupon_redemptions`, `webhook_events`
9. **الأمان:** `reports`, `notifications`, `push_tokens`, `audit_logs`

### ضوابط لا يمكن تجاوزها من التطبيق
- `guard_profile_privileges` — أي مستخدم يحاول تعديل `role` / `is_verified` / `is_vip` / `unlimited_publish` / `is_banned` على نفسه يُعاد ضبطه تلقائياً.
- `guard_work_status` — لا يمكن للمؤلف اعتماد عمله بنفسه؛ إن كان `require_work_review = true` يُحوّل النشر إلى `pending_review`.
- `payments` — **لا سياسة INSERT/UPDATE للمستخدمين**. السجل يُكتب فقط عبر `service_role` من داخل webhook موقَّع.
- `exemptions` / `user_badges` — كتابة إدارية فقط (`is_admin()`).
- `can_publish(uid)` — محرّك سياسة النشر (مجاني / مدفوع / حصة / اشتراك / إعفاء).

---

## 4. التشغيل

```bash
git clone https://github.com/walid4mp/written.git && cd written
cp .env.example .env        # املأ المفاتيح

# 1) قاعدة البيانات
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql

# 2) اختبار الصلاحيات
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/01_rls.sql

# 3) الدوال الطرفية
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy publish-check
supabase functions deploy admin-action
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# 4) لوحة الإدارة
npm install && npm run admin:dev     # http://localhost:5173

# 5) التطبيق
cd apps/mobile && npx expo start
```

---

## 5. سياسة النشر والمدفوعات

| السياسة (`app_settings.publish_policy`) | السلوك |
|---|---|
| `free` | نشر مجاني للجميع |
| `free_quota` | عدد أعمال مجانية (`free_works_limit`، افتراضي 3) ثم دفع `price_per_work` |
| `always_paid` | دفع لكل عمل |
| `subscription_only` | يتطلّب اشتراكاً نشطاً |

**الإعفاءات:** `exemptions(kind: publish_fee | subscription | unlimited_publish, expires_at, is_active)`
— يمنحها المدير لأي مستخدم، ويمكنه سحبها في أي وقت (`admin_revoke_exemption`).
`unlimited_publish` يضبط أيضاً `profiles.unlimited_publish = true`.

**المدفوعات:** لا يُعتبر أي دفع ناجحاً إلا بعد استلام webhook موقَّع
(HMAC-SHA256 على `t.payload`، مع فاصل زمني 300 ثانية وحماية من التكرار
عبر `unique(provider, event_id)`).

---

## 6. نتائج الاختبارات

منفَّذة على المشروع الحقيقي — راجع `tests/01_rls.sql` للتشغيل مرة أخرى.

| # | الاختبار | النتيجة |
|---|---|---|
| T1 | منح المستخدم شارة لنفسه | مرفوض (RLS) |
| T2 | ترقية الذات إلى admin | مُعاد ضبطه إلى `user` |
| T3 | تزوير سجل دفع ناجح من العميل | مرفوض (RLS) |
| T4 | إعفاء ذاتي من الرسوم | مرفوض (RLS) |
| T5 | إنشاء عمل باسم مؤلف آخر | مرفوض (RLS) |
| T6 | مسودّة مؤلف آخر | غير مرئية |
| T7 | النشر يستهلك حصة مجانية | ناجح + `published_at` |
| T8 | بوابة المراجعة | يُحوَّل إلى `pending_review` |
| T9 | `can_publish` (حصة/استنفاد/إعفاء) | ناجح |
| T10 | تجميع التقييمات | `4.00` من تقييمين |
| T11 | رفع الحظر الذاتي | مُتجاهل |
| T12 | استدعاء RPC إداري من مستخدم عادي | مرفوض |

---

## 7. الأمان

- Service/secret key **لا يوجد أبداً** داخل تطبيق الهاتف؛ فقط publishable key.
- كل التحقق الحسّاس (الشارات، الأدوار، المدفوعات، الحصص) يقع في `security definer` RPCs أو Edge Functions تعيد التحقق من JWT.
- RLS مُفعَّل على 45 جدولاً.
- `audit_logs` يسجّل كل تغيير على الجداول الحسّاسة مع الفاعل ودوره.
- Storage: سياسات bucket-busting (`(storage.foldername(name))[1] = auth.uid()`) — لا يكتب أحد في مجلد غيره.
