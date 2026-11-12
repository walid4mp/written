-- ============================================================================
-- SARAD — Migration 0003: founding team seed + platform editorial identity
-- ============================================================================
set client_min_messages to warning;

insert into public.founders (slug, full_name, role_title, role_title_ar, role_title_fr, bio, bio_ar, bio_fr,
                             instagram_url, tiktok_url, is_official, is_primary_author, ownership_verified, sort_order)
values
(
  'rana',
  'رنا',
  'Founder · Lead Author',
  'المؤسِّسة · الكاتبة الرئيسية',
  'Fondatrice · Autrice principale',
  'The founding voice of SARAD. Writes novels, short stories and poetry, and shapes the literary identity of the platform.',
  'الصوت المؤسِّس لسَراد. تكتب الروايات والقصص القصيرة والشِعر، وتُشكّل الهوية الأدبية للمنصّة: اختيار الأعمال المميّزة، ومعايير النشر، ونبرة المجتمع الأدبي.',
  'La voix fondatrice de SARAD. Elle écrit romans, nouvelles et poésie, et façonne l''identité littéraire de la plateforme.',
  'https://www.instagram.com/630970695roona',
  'https://www.tiktok.com/@ra.na937',
  true, true, false, 10
),
(
  'walid',
  'Walid',
  'Founder · Developer',
  'المؤسِّس · المطوّر',
  'Fondateur · Développeur',
  'Builds and operates the SARAD platform: mobile app, backend, payments and moderation tooling.',
  'يبني ويُشغّل منصّة سَراد: تطبيق الهاتف، والخدمات الخلفية، ونظام المدفوعات، وأدوات الإشراف.',
  'Il construit et exploite la plateforme SARAD : application mobile, backend, paiements et outils de modération.',
  'https://www.instagram.com/404null8',
  'https://www.tiktok.com/@wahrani_mp40',
  true, false, false, 20
)
on conflict (slug) do update set
  role_title_ar = excluded.role_title_ar,
  role_title_fr = excluded.role_title_fr,
  bio_ar = excluded.bio_ar,
  bio_fr = excluded.bio_fr,
  instagram_url = excluded.instagram_url,
  tiktok_url = excluded.tiktok_url;

update public.app_settings set app_name = 'SARAD' where id;
