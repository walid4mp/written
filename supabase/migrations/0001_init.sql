-- ============================================================================
-- Written — Literary Social Platform
-- Migration 0001: full schema, RLS, triggers, seed configuration
-- Target: Supabase (PostgreSQL 17)
-- ============================================================================
set client_min_messages to warning;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type account_type as enum ('reader','author','novelist','storyteller','poet','vip','developer','moderator','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_role as enum ('user','developer','moderator','admin','owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_kind as enum ('novel','short_story','tale','poetry','article','series');
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_status as enum ('draft','pending_review','scheduled','published','rejected','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_lang as enum ('ar','fr','en');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending','approved','rejected','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_level as enum ('none','official','writer','novelist','storyteller','poet','developer','founder','vip','moderator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friend_status as enum ('pending','accepted','blocked','declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type group_privacy as enum ('public','private','hidden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type group_role as enum ('member','moderator','owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_kind as enum ('text','image','video','file','audio','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_interval as enum ('month','year','lifetime');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sub_status as enum ('active','trialing','past_due','canceled','expired','incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending','requires_action','succeeded','failed','refunded','partially_refunded','disputed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_purpose as enum ('subscription','publish_fee','chapter_fee','work_purchase','donation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type provider_kind as enum ('stripe','paypal','paddle','local');
exception when duplicate_object then null; end $$;

do $$ begin
  create type exemption_kind as enum ('publish_fee','subscription','unlimited_publish');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('open','reviewing','resolved','dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_kind as enum (
    'new_follower','friend_request','friend_accepted','like','comment','reply','new_message',
    'story_view','new_chapter','work_update','work_approved','work_rejected','payment_success',
    'payment_failed','subscription_expiring','verification_approved','verification_rejected',
    'admin_announcement','group_invite','mention');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_kind as enum ('image','video','audio','file');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. HELPERS
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. CORE IDENTITY
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                boolean primary key default true check (id),
  app_name          text not null default 'Written',
  default_language  content_lang not null default 'ar',
  -- publish policy (fully admin editable)
  publish_policy    text not null default 'free_quota'
                    check (publish_policy in ('free','always_paid','free_quota','subscription_only')),
  free_works_limit  integer not null default 3,
  price_per_work    numeric(10,2) not null default 4.99,
  price_per_chapter numeric(10,2) not null default 0.99,
  price_currency    text not null default 'USD',
  require_work_review boolean not null default false,
  allow_registration boolean not null default true,
  maintenance_mode  boolean not null default false,
  payment_providers jsonb not null default '{"stripe":true,"paypal":false,"paddle":false,"local":false}'::jsonb,
  max_upload_mb     integer not null default 25,
  story_ttl_hours   integer not null default 24,
  features          jsonb not null default '{"stories":true,"reels":true,"groups":true,"messaging":true,"payments":true}'::jsonb,
  updated_at        timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique not null check (username ~ '^[a-zA-Z0-9_.]{3,30}$'),
  display_name        text not null default '',
  bio                 text,
  avatar_url          text,
  cover_url           text,
  website             text,
  account_type        account_type not null default 'reader',
  role                staff_role not null default 'user',
  language            content_lang not null default 'ar',
  is_verified         boolean not null default false,
  highest_badge       verification_level not null default 'none',
  is_vip              boolean not null default false,
  is_banned           boolean not null default false,
  ban_reason          text,
  is_deactivated      boolean not null default false,
  is_private          boolean not null default false,
  payout_email        text,
  free_works_used     integer not null default 0,
  unlimited_publish   boolean not null default false,
  email_verified_at   timestamptz,
  followers_count     integer not null default 0,
  following_count     integer not null default 0,
  works_count         integer not null default 0,
  notify_prefs        jsonb not null default '{"push":true,"email":true,"likes":true,"comments":true,"follows":true,"messages":true,"chapters":true,"payments":true,"announcements":true}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index if not exists profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_display_trgm on public.profiles using gin (display_name gin_trgm_ops);
create index if not exists profiles_account_type on public.profiles(account_type) where deleted_at is null;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role in ('admin','owner') and not p.is_banned);
$$;

create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role in ('admin','owner','moderator','developer') and not p.is_banned);
$$;

create or replace function public.is_moderator(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role in ('admin','owner','moderator') and not p.is_banned);
$$;

-- registration language mention, foundation team
create table if not exists public.founders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  slug          text unique not null,
  full_name     text not null,
  role_title    text not null,
  role_title_ar text,
  role_title_fr text,
  bio           text,
  bio_ar        text,
  bio_fr        text,
  avatar_url    text,
  instagram_url text,
  tiktok_url    text,
  website_url   text,
  is_official   boolean not null default true,
  is_primary_author boolean not null default false,
  ownership_verified boolean not null default false,
  ownership_proof jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. BADGES / VERIFICATION / ACCOUNT TYPE REQUESTS
-- ---------------------------------------------------------------------------
create table if not exists public.badge_types (
  key         text primary key,
  name_en     text not null,
  name_fr     text not null,
  name_ar     text not null,
  color       text not null default '#C9A227',
  icon        text not null default 'seal',
  is_special  boolean not null default false,
  assignable_by_admin_only boolean not null default true,
  sort_order  integer not null default 0
);
insert into public.badge_types (key,name_en,name_fr,name_ar,color,icon,is_special,sort_order) values
 ('official','Official','Officiel','رسمي','#3B82F6','badge-check',false,10),
 ('writer','Verified Writer','Écrivain vérifié','كاتب موثق','#C9A227','feather',false,20),
 ('novelist','Verified Novelist','Romancier vérifié','روائي موثق','#8B5CF6','book-open',false,30),
 ('storyteller','Verified Storyteller','Conteur vérifié','راوي موثق','#10B981','mic',false,40),
 ('poet','Verified Poet','Poète vérifié','شاعر موثق','#EC4899','quote',false,50),
 ('developer','Developer','Développeur','مطوّر','#0EA5E9','code',true,60),
 ('founder','Founder','Fondateur','مؤسس','#F59E0B','crown',true,70),
 ('vip','VIP Member','Membre VIP','عضو مميز','#EF4444','star',true,80),
 ('moderator','Moderator','Modérateur','مشرف','#64748B','shield',true,90)
on conflict (key) do nothing;

create table if not exists public.user_badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  badge_key   text not null references public.badge_types(key),
  granted_by  uuid references public.profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  revoke_reason text,
  unique (user_id, badge_key)
);
create index if not exists user_badges_user on public.user_badges(user_id) where revoked_at is null;

create table if not exists public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  requested_badge text not null references public.badge_types(key),
  legal_name    text,
  id_document_url text,
  portfolio_url text,
  published_works integer,
  note          text,
  status        request_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now()
);
create index if not exists verification_pending on public.verification_requests(status, created_at desc);

create table if not exists public.account_type_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  current_type  account_type not null,
  requested_type account_type not null,
  motivation    text,
  status        request_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. CONTENT: WORKS / CHAPTERS
-- ---------------------------------------------------------------------------
create table if not exists public.works (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  kind          work_kind not null default 'novel',
  title         text not null check (char_length(title) between 1 and 200),
  synopsis      text,
  cover_url     text,
  language      content_lang not null default 'ar',
  genres        text[] not null default '{}',
  tags          text[] not null default '{}',
  status        work_status not null default 'draft',
  is_mature     boolean not null default false,
  is_premium    boolean not null default false,
  price         numeric(10,2) not null default 0,
  currency      text not null default 'USD',
  is_series     boolean not null default false,
  series_id     uuid references public.works(id) on delete set null,
  chapters_count integer not null default 0,
  words_count   integer not null default 0,
  reads_count   bigint not null default 0,
  likes_count   integer not null default 0,
  comments_count integer not null default 0,
  rating_avg    numeric(3,2) not null default 0,
  rating_count  integer not null default 0,
  published_at  timestamptz,
  scheduled_at  timestamptz,
  rejection_reason text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  search_doc    tsvector,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists works_author on public.works(author_id);
create index if not exists works_status_pub on public.works(status, published_at desc);
create index if not exists works_kind on public.works(kind);
create index if not exists works_lang on public.works(language);
create index if not exists works_genres on public.works using gin (genres);
create index if not exists works_tags on public.works using gin (tags);
create index if not exists works_search on public.works using gin (search_doc);
create index if not exists works_title_trgm on public.works using gin (title gin_trgm_ops);

create or replace function public.works_search_refresh()
returns trigger language plpgsql as $$
begin
  new.search_doc :=
    setweight(to_tsvector('simple', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.tags,' '),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.genres,' '),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.synopsis,'')), 'C');
  return new;
end $$;

create table if not exists public.chapters (
  id            uuid primary key default gen_random_uuid(),
  work_id       uuid not null references public.works(id) on delete cascade,
  title         text not null default '',
  content       text not null default '',
  chapter_number integer not null default 1,
  words_count   integer not null default 0,
  is_premium    boolean not null default false,
  price         numeric(10,2) not null default 0,
  status        work_status not null default 'draft',
  published_at  timestamptz,
  scheduled_at  timestamptz,
  reads_count   bigint not null default 0,
  comments_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (work_id, chapter_number)
);
create index if not exists chapters_work on public.chapters(work_id, chapter_number);

create table if not exists public.reading_progress (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  work_id     uuid not null references public.works(id) on delete cascade,
  chapter_id  uuid references public.chapters(id) on delete set null,
  percent     numeric(5,2) not null default 0 check (percent between 0 and 100),
  scroll_pos  numeric(12,4) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, work_id)
);

create table if not exists public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  work_id     uuid not null references public.works(id) on delete cascade,
  chapter_id  uuid references public.chapters(id) on delete cascade,
  position    numeric(12,4) not null default 0,
  label       text,
  created_at  timestamptz not null default now()
);
create index if not exists bookmarks_user on public.bookmarks(user_id, created_at desc);

create table if not exists public.library_items (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  work_id     uuid not null references public.works(id) on delete cascade,
  collection  text not null default 'saved' check (collection in ('saved','favorite','finished','reading')),
  created_at  timestamptz not null default now(),
  primary key (user_id, work_id, collection)
);

create table if not exists public.ratings (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  work_id     uuid not null references public.works(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  review      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, work_id)
);

create or replace function public.ratings_aggregate()
returns trigger language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  wid := coalesce(new.work_id, old.work_id);
  update works w set
    rating_avg = coalesce((select round(avg(score)::numeric,2) from ratings r where r.work_id = wid),0),
    rating_count = (select count(*) from ratings r where r.work_id = wid)
  where w.id = wid;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 6. SOCIAL GRAPH
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following on public.follows(following_id);

create table if not exists public.friendships (
  id          uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status      friend_status not null default 'pending',
  created_at  timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_addressee on public.friendships(addressee_id, status);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------------------------------------------------------------------------
-- 7. POSTS / MEDIA / COMMENTS / LIKES
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  group_id    uuid,
  body        text,
  work_id     uuid references public.works(id) on delete set null,
  visibility  text not null default 'public' check (visibility in ('public','friends','private','group')),
  is_repost_of uuid references public.posts(id) on delete set null,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  shares_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists posts_author on public.posts(author_id, created_at desc);
create index if not exists posts_feed on public.posts(created_at desc) where deleted_at is null;

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  bucket      text not null default 'media',
  storage_path text not null,
  url         text not null,
  kind        media_kind not null default 'image',
  mime        text,
  size_bytes  bigint,
  width       integer,
  height      integer,
  duration_s  numeric(10,2),
  post_id     uuid references public.posts(id) on delete cascade,
  work_id     uuid references public.works(id) on delete cascade,
  message_id  uuid,
  story_id    uuid,
  created_at  timestamptz not null default now()
);
create index if not exists media_owner on public.media(owner_id);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  target_type text not null check (target_type in ('post','work','chapter','story')),
  target_id   uuid not null,
  body        text not null check (char_length(body) between 1 and 5000),
  likes_count integer not null default 0,
  replies_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists comments_target on public.comments(target_type, target_id, created_at desc);

create table if not exists public.likes (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','work','chapter','story')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists likes_target on public.likes(target_type, target_id);

create table if not exists public.mentions (
  id          uuid primary key default gen_random_uuid(),
  mentioned_id uuid not null references public.profiles(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. STORIES
-- ---------------------------------------------------------------------------
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  media_url   text,
  media_kind  media_kind not null default 'image',
  caption     text,
  overlay     jsonb not null default '[]'::jsonb,
  music_url   text,
  bg_color    text not null default '#0B0B0C',
  privacy     text not null default 'followers' check (privacy in ('public','followers','close_friends')),
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  is_archived boolean not null default false,
  is_highlight boolean not null default false,
  views_count integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists stories_live on public.stories(created_at desc) where is_archived = false;

create table if not exists public.story_views (
  story_id    uuid not null references public.stories(id) on delete cascade,
  viewer_id   uuid not null references public.profiles(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.story_highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  cover_url   text,
  story_ids   uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9. MESSAGING
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'direct' check (kind in ('direct','group')),
  title       text,
  avatar_url  text,
  created_by  uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  is_muted    boolean not null default false,
  role        text not null default 'member' check (role in ('member','admin')),
  joined_at   timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conv_members_user on public.conversation_members(user_id);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  kind        message_kind not null default 'text',
  body        text,
  media_url   text,
  file_name   text,
  reply_to_id uuid references public.messages(id) on delete set null,
  forwarded_from uuid references public.messages(id) on delete set null,
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists messages_conv on public.messages(conversation_id, created_at desc);

create table if not exists public.message_reads (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 10. GROUPS
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  cover_url   text,
  privacy     group_privacy not null default 'public',
  category    text not null default 'general',
  language    content_lang not null default 'ar',
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  members_count integer not null default 0,
  requires_approval boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        group_role not null default 'member',
  status      request_status not null default 'pending',
  joined_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_contests (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null,
  brief       text,
  kind        work_kind not null default 'short_story',
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  prize_note  text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. COMMERCE
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name_en     text not null,
  name_fr     text not null,
  name_ar     text not null,
  description_en text,
  description_fr text,
  description_ar text,
  price       numeric(10,2) not null default 0,
  currency    text not null default 'USD',
  interval    plan_interval not null default 'month',
  publish_limit integer,           -- null = unlimited
  features    jsonb not null default '{}'::jsonb,
  provider_price_id text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  plan_id     uuid not null references public.plans(id) on delete restrict,
  status      sub_status not null default 'incomplete',
  provider    provider_kind not null default 'stripe',
  provider_sub_id text,
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null default (now() + interval '1 month'),
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end   timestamptz,
  granted_by  uuid references public.profiles(id) on delete set null,
  is_grant     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists subs_user on public.subscriptions(user_id, status);

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  purpose     payment_purpose not null,
  amount      numeric(10,2) not null check (amount >= 0),
  currency    text not null default 'USD',
  status      payment_status not null default 'pending',
  provider    provider_kind not null default 'stripe',
  provider_ref text,                 -- payment_intent / order id
  provider_event_id text unique,     -- idempotency on webhook event
  subscription_id uuid references public.subscriptions(id) on delete set null,
  work_id     uuid references public.works(id) on delete set null,
  chapter_id  uuid references public.chapters(id) on delete set null,
  coupon_id   uuid,
  meta        jsonb not null default '{}'::jsonb,
  failure_reason text,
  refunded_amount numeric(10,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists payments_user on public.payments(user_id, created_at desc);
create index if not exists payments_status on public.payments(status);

create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  number      text unique not null,
  payment_id  uuid not null references public.payments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(10,2) not null,
  currency    text not null default 'USD',
  issued_at   timestamptz not null default now(),
  pdf_url     text
);

create table if not exists public.exemptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        exemption_kind not null,
  reason      text,
  granted_by  uuid references public.profiles(id) on delete set null,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,          -- null = permanent
  is_active   boolean not null default true,
  revoked_at  timestamptz,
  revoke_reason text,
  created_at  timestamptz not null default now()
);
create index if not exists exemptions_user on public.exemptions(user_id) where is_active;

create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  percent_off numeric(5,2),
  amount_off  numeric(10,2),
  currency    text not null default 'USD',
  max_redemptions integer,
  redeemed      integer not null default 0,
  valid_until timestamptz,
  is_active   boolean not null default true,
  applies_to  text not null default 'any' check (applies_to in ('any','subscription','publish_fee','work_purchase')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  coupon_id   uuid not null references public.coupons(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  payment_id  uuid references public.payments(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  primary key (coupon_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 12. SAFETY / NOTIFICATIONS / AUDIT / DEVICES
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','comment','work','chapter','story','message','group')),
  target_id   uuid not null,
  reason      text not null,
  details     text,
  status      report_status not null default 'open',
  handled_by  uuid references public.profiles(id) on delete set null,
  handled_at  timestamptz,
  action_note text,
  created_at  timestamptz not null default now()
);
create index if not exists reports_open on public.reports(status, created_at desc);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        notification_kind not null,
  title       text,
  body        text,
  actor_id    uuid references public.profiles(id) on delete set null,
  target_type text,
  target_id   uuid,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  push_sent   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread on public.notifications(user_id) where read_at is null;

create table if not exists public.push_tokens (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    text not null default 'android' check (platform in ('ios','android','web')),
  device_name text,
  last_seen   timestamptz not null default now(),
  primary key (user_id, token)
);

create table if not exists public.device_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  device_name text,
  platform    text,
  ip          inet,
  user_agent  text,
  last_active timestamptz not null default now(),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.auth_events (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  email       text,
  event       text not null,
  success     boolean not null default true,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists auth_events_created on public.auth_events(created_at desc);

create table if not exists public.audit_logs (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  text,
  table_name  text not null,
  action      text not null check (action in ('insert','update','delete')),
  row_id      text,
  before      jsonb,
  after       jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_table on public.audit_logs(table_name, created_at desc);

create table if not exists public.webhook_events (
  id          bigserial primary key,
  provider    text not null,
  event_id    text not null,
  event_type  text not null,
  signature_ok boolean not null default false,
  processed   boolean not null default false,
  payload     jsonb not null default '{}'::jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- 13. TRIGGERS
-- ---------------------------------------------------------------------------
drop trigger if exists trg_profiles_upd on public.profiles;
create trigger trg_profiles_upd before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_works_upd on public.works;
create trigger trg_works_upd before update on public.works
for each row execute function public.set_updated_at();

drop trigger if exists trg_works_search on public.works;
create trigger trg_works_search before insert or update of title, synopsis, tags, genres on public.works
for each row execute function public.works_search_refresh();

drop trigger if exists trg_chapters_upd on public.chapters;
create trigger trg_chapters_upd before update on public.chapters
for each row execute function public.set_updated_at();

drop trigger if exists trg_posts_upd on public.posts;
create trigger trg_posts_upd before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists trg_groups_upd on public.groups;
create trigger trg_groups_upd before update on public.groups
for each row execute function public.set_updated_at();

drop trigger if exists trg_plans_upd on public.plans;
create trigger trg_plans_upd before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_subs_upd on public.subscriptions;
create trigger trg_subs_upd before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_upd on public.payments;
create trigger trg_payments_upd before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists trg_ratings_upd on public.ratings;
create trigger trg_ratings_upd before update on public.ratings
for each row execute function public.set_updated_at();

drop trigger if exists trg_ratings_agg on public.ratings;
create trigger trg_ratings_agg after insert or update or delete on public.ratings
for each row execute function public.ratings_aggregate();

drop trigger if exists trg_founders_upd on public.founders;
create trigger trg_founders_upd before update on public.founders
for each row execute function public.set_updated_at();

-- profile bootstrap on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text;
  base  text;
  n     int := 0;
  want_lang content_lang;
begin
  base := regexp_replace(lower(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email,'user'),'@',1))), '[^a-z0-9_.]', '', 'g');
  if length(base) < 3 then base := 'writer' || substr(replace(new.id::text,'-',''),1,6); end if;
  base := substr(base,1,24);
  uname := base;
  while exists (select 1 from public.profiles p where p.username = uname) loop
    n := n + 1; uname := base || n::text;
  end loop;

  begin
    want_lang := coalesce((new.raw_user_meta_data->>'language')::content_lang, 'ar');
  exception when others then want_lang := 'ar';
  end;

  insert into public.profiles (id, username, display_name, language, email_verified_at)
  values (new.id, uname, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), uname), want_lang,
          case when new.email_confirmed_at is not null then now() else null end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- generic audit
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  rrole text;
begin
  select role::text into rrole from public.profiles where id = actor;
  insert into public.audit_logs (actor_id, actor_role, table_name, action, row_id, before, after)
  values (
    actor, rrole, tg_table_name, lower(tg_op),
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, ''),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','works','chapters','payments','subscriptions','exemptions','user_badges','verification_requests','account_type_requests','reports','app_settings','plans','coupons','founders','groups']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- follow counters
create or replace function public.follows_counters()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update profiles set followers_count = followers_count + 1 where id = new.following_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    insert into notifications (user_id, kind, actor_id, target_type, target_id, data)
    values (new.following_id, 'new_follower', new.follower_id, 'user', new.follower_id, '{}'::jsonb);
  elsif tg_op = 'DELETE' then
    update profiles set followers_count = greatest(followers_count - 1,0) where id = old.following_id;
    update profiles set following_count = greatest(following_count - 1,0) where id = old.follower_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_follows_counters on public.follows;
create trigger trg_follows_counters after insert or delete on public.follows
for each row execute function public.follows_counters();

-- like counters
create or replace function public.likes_counters()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta int := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_op = 'INSERT' then
    insert into notifications (user_id, kind, actor_id, target_type, target_id, data)
    select owner_id, 'like', new.user_id, new.target_type, new.target_id, '{}'::jsonb
    from (
      select author_id as owner_id from posts where id = new.target_id and new.target_type = 'post'
      union all select author_id from works where id = new.target_id and new.target_type = 'work'
      union all select author_id from comments where id = new.target_id and new.target_type = 'comment'
    ) s where owner_id <> new.user_id;
  end if;

  if new.target_type = 'post' then
    update posts set likes_count = greatest(likes_count + delta,0) where id = coalesce(new.target_id, old.target_id);
  elsif new.target_type = 'comment' then
    update comments set likes_count = greatest(likes_count + delta,0) where id = coalesce(new.target_id, old.target_id);
  elsif new.target_type = 'work' then
    update works set likes_count = greatest(likes_count + delta,0) where id = coalesce(new.target_id, old.target_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_likes_counters on public.likes;
create trigger trg_likes_counters after insert or delete on public.likes
for each row execute function public.likes_counters();

-- comment counters
create or replace function public.comments_counters()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta int := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if new.target_type = 'post' then
    update posts set comments_count = greatest(comments_count + delta,0) where id = coalesce(new.target_id, old.target_id);
  elsif new.target_type = 'chapter' then
    update chapters set comments_count = greatest(comments_count + delta,0) where id = coalesce(new.target_id, old.target_id);
  elsif new.target_type = 'work' then
    update works set comments_count = greatest(comments_count + delta,0) where id = coalesce(new.target_id, old.target_id);
  end if;
  if tg_op = 'INSERT' and new.parent_id is not null then
    update comments set replies_count = replies_count + 1 where id = new.parent_id;
    insert into notifications (user_id, kind, actor_id, target_type, target_id, data)
    select c.author_id, 'reply', new.author_id, 'comment', new.id, '{}'::jsonb
    from comments c where c.id = new.parent_id and c.author_id <> new.author_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_comments_counters on public.comments;
create trigger trg_comments_counters after insert or delete on public.comments
for each row execute function public.comments_counters();

-- chapter counters + new chapter notifications
create or replace function public.chapter_after_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    update works set chapters_count = (select count(*) from chapters c where c.work_id = new.work_id and c.status='published'),
      updated_at = now() where id = new.work_id;
    insert into notifications (user_id, kind, actor_id, target_type, target_id, data)
    select l.user_id, 'new_chapter', w.author_id, 'chapter', new.id, jsonb_build_object('work_title', w.title)
    from library_items l join works w on w.id = new.work_id
    where l.work_id = new.work_id and l.user_id <> w.author_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_chapter_publish on public.chapters;
create trigger trg_chapter_publish after update on public.chapters
for each row execute function public.chapter_after_publish();

-- ---------------------------------------------------------------------------
-- 14. BUSINESS LOGIC: publish quota / plan grants
-- ---------------------------------------------------------------------------
create or replace function public.can_publish(uid uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s app_settings;
  p profiles;
  used int;
  ex boolean;
  active_sub record;
begin
  select * into s from app_settings where id;
  select * into p from profiles where id = uid;
  if p is null then return jsonb_build_object('allowed', false, 'reason', 'no_profile'); end if;

  if p.unlimited_publish then
    return jsonb_build_object('allowed', true, 'reason', 'unlimited_grant', 'price', 0);
  end if;

  select exists(
    select 1 from exemptions e
    where e.user_id = uid and e.kind = 'publish_fee' and e.is_active and e.revoked_at is null
      and (e.expires_at is null or e.expires_at > now())
  ) into ex;
  if ex then
    return jsonb_build_object('allowed', true, 'reason', 'exempt', 'price', 0);
  end if;

  if s.publish_policy = 'free' then
    return jsonb_build_object('allowed', true, 'reason', 'free_policy', 'price', 0);
  end if;

  select * into active_sub from subscriptions sub
   where sub.user_id = uid and sub.status in ('active','trialing') and sub.current_period_end > now()
   order by sub.current_period_end desc limit 1;
  if active_sub.id is not null then
    return jsonb_build_object('allowed', true, 'reason', 'subscription', 'price', 0, 'plan_id', active_sub.plan_id);
  end if;

  if s.publish_policy = 'subscription_only' then
    return jsonb_build_object('allowed', false, 'reason', 'subscription_required', 'price', s.price_per_work, 'currency', s.price_currency);
  end if;

  used := p.free_works_used;
  if s.publish_policy = 'free_quota' and used < s.free_works_limit then
    return jsonb_build_object('allowed', true, 'reason', 'free_quota', 'used', used, 'limit', s.free_works_limit, 'price', 0);
  end if;

  return jsonb_build_object('allowed', false, 'reason', 'payment_required', 'price', s.price_per_work,
                            'currency', s.price_currency, 'used', used, 'limit', s.free_works_limit);
end $$;

-- ---------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'app_settings','profiles','founders','badge_types','user_badges','verification_requests',
    'account_type_requests','works','chapters','reading_progress','bookmarks','library_items',
    'ratings','follows','friendships','blocks','posts','media','comments','likes','mentions',
    'stories','story_views','story_highlights','conversations','conversation_members','messages',
    'message_reads','groups','group_members','group_contests','plans','subscriptions','payments',
    'invoices','exemptions','coupons','coupon_redemptions','reports','notifications','push_tokens',
    'device_sessions','auth_events','audit_logs','webhook_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- app_settings
create policy settings_read on public.app_settings for select using (true);
create policy settings_admin_write on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy profiles_read on public.profiles for select
  using (deleted_at is null and (not is_private or id = auth.uid() or public.is_staff()));
create policy profiles_self_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- guard: users cannot self-escalate role / badges / unlimited_publish
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = new.id and not public.is_admin() then
    new.role := old.role;
    new.is_verified := old.is_verified;
    new.highest_badge := old.highest_badge;
    new.is_vip := old.is_vip;
    new.unlimited_publish := old.unlimited_publish;
    new.free_works_used := old.free_works_used;
    new.is_banned := old.is_banned;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile before update on public.profiles
for each row execute function public.guard_profile_privileges();

-- founders (public read, admin write)
create policy founders_read on public.founders for select using (true);
create policy founders_admin on public.founders for all using (public.is_admin()) with check (public.is_admin());

-- badge catalog
create policy badge_types_read on public.badge_types for select using (true);
create policy badge_types_admin on public.badge_types for all using (public.is_admin()) with check (public.is_admin());

-- user_badges: admin only writes; owner reads own; all read active badges
create policy user_badges_read on public.user_badges for select using (true);
create policy user_badges_admin on public.user_badges for all using (public.is_admin()) with check (public.is_admin());

-- verification requests
create policy verif_self_read on public.verification_requests for select using (user_id = auth.uid() or public.is_moderator());
create policy verif_self_insert on public.verification_requests for insert with check (user_id = auth.uid() and status = 'pending');
create policy verif_admin on public.verification_requests for update using (public.is_moderator()) with check (public.is_moderator());

-- account type requests
create policy atr_self_read on public.account_type_requests for select using (user_id = auth.uid() or public.is_admin());
create policy atr_self_insert on public.account_type_requests for insert with check (user_id = auth.uid() and status='pending');
create policy atr_admin on public.account_type_requests for update using (public.is_admin()) with check (public.is_admin());

-- works
create policy works_read on public.works for select
  using (status = 'published' or author_id = auth.uid() or public.is_moderator());
create policy works_insert on public.works for insert with check (author_id = auth.uid());
create policy works_update on public.works for update
  using (author_id = auth.uid() or public.is_moderator())
  with check (author_id = auth.uid() or public.is_moderator());
create policy works_delete on public.works for delete using (author_id = auth.uid() or public.is_admin());

-- guard work publishing: cannot self-approve, cannot self-grant published when review is required
create or replace function public.guard_work_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare s app_settings;
begin
  select * into s from app_settings where id;
  if auth.uid() = new.author_id and not public.is_moderator() then
    if new.status = 'published' and old.status is distinct from 'published' then
      if s.require_work_review then
        new.status := 'pending_review';
      else
        new.published_at := coalesce(new.published_at, now());
        update profiles set free_works_used = free_works_used + 1 where id = new.author_id;
        update profiles set works_count = works_count + 1 where id = new.author_id;
      end if;
    end if;
    new.reviewed_by := old.reviewed_by;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_work_status on public.works;
create trigger trg_guard_work_status before update on public.works
for each row execute function public.guard_work_status();

-- chapters
create policy chapters_read on public.chapters for select using (
  status = 'published'
  or exists (select 1 from works w where w.id = work_id and w.author_id = auth.uid())
  or public.is_moderator()
);
create policy chapters_write on public.chapters for insert with check (
  exists (select 1 from works w where w.id = work_id and w.author_id = auth.uid())
);
create policy chapters_update on public.chapters for update using (
  exists (select 1 from works w where w.id = work_id and w.author_id = auth.uid()) or public.is_moderator()
) with check (
  exists (select 1 from works w where w.id = work_id and w.author_id = auth.uid()) or public.is_moderator()
);
create policy chapters_delete on public.chapters for delete using (
  exists (select 1 from works w where w.id = work_id and w.author_id = auth.uid()) or public.is_admin()
);

-- reading
create policy progress_own on public.reading_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bookmarks_own on public.bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy library_own on public.library_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ratings_read on public.ratings for select using (true);
create policy ratings_own on public.ratings for insert with check (user_id = auth.uid());
create policy ratings_own_upd on public.ratings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ratings_own_del on public.ratings for delete using (user_id = auth.uid() or public.is_admin());

-- social graph
create policy follows_read on public.follows for select using (true);
create policy follows_own on public.follows for insert with check (follower_id = auth.uid());
create policy follows_del on public.follows for delete using (follower_id = auth.uid() or following_id = auth.uid());
create policy friendships_read on public.friendships for select using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());
create policy friendships_insert on public.friendships for insert with check (requester_id = auth.uid());
create policy friendships_update on public.friendships for update using (addressee_id = auth.uid() or requester_id = auth.uid()) with check (addressee_id = auth.uid() or requester_id = auth.uid());
create policy blocks_own on public.blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- posts / media / comments / likes
create policy posts_read on public.posts for select using (
  deleted_at is null and (
    visibility = 'public'
    or author_id = auth.uid()
    or (visibility = 'friends' and exists (
      select 1 from friendships f where f.status='accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = posts.author_id) or (f.addressee_id = auth.uid() and f.requester_id = posts.author_id))))
    or public.is_moderator()
  )
);
create policy posts_insert on public.posts for insert with check (author_id = auth.uid());
create policy posts_update on public.posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete using (author_id = auth.uid() or public.is_admin());

create policy media_read on public.media for select using (true);
create policy media_own on public.media for insert with check (owner_id = auth.uid());
create policy media_del on public.media for delete using (owner_id = auth.uid() or public.is_admin());

create policy comments_read on public.comments for select using (deleted_at is null or author_id = auth.uid() or public.is_moderator());
create policy comments_insert on public.comments for insert with check (author_id = auth.uid());
create policy comments_update on public.comments for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete using (author_id = auth.uid() or public.is_moderator());

create policy likes_read on public.likes for select using (true);
create policy likes_insert on public.likes for insert with check (user_id = auth.uid());
create policy likes_delete on public.likes for delete using (user_id = auth.uid());
create policy mentions_read on public.mentions for select using (mentioned_id = auth.uid() or author_id = auth.uid());

-- stories
create policy stories_read on public.stories for select using (
  is_archived = false and expires_at > now()
  and (privacy = 'public' or author_id = auth.uid() or public.is_staff())
);
create policy stories_archive_read on public.stories for select using (author_id = auth.uid());
create policy stories_own on public.stories for insert with check (author_id = auth.uid());
create policy stories_update on public.stories for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy stories_delete on public.stories for delete using (author_id = auth.uid() or public.is_admin());
create policy story_views_insert on public.story_views for insert with check (viewer_id = auth.uid());
create policy story_views_read on public.story_views for select using (
  viewer_id = auth.uid() or exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
);
create policy highlights_read on public.story_highlights for select using (true);
create policy highlights_own on public.story_highlights for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messaging
create policy conv_read on public.conversations for select using (
  exists (select 1 from conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
);
create policy conv_insert on public.conversations for insert with check (created_by = auth.uid());
create policy conv_update on public.conversations for update using (
  exists (select 1 from conversation_members m where m.conversation_id = id and m.user_id = auth.uid() and m.role='admin')
);
create policy cm_read on public.conversation_members for select using (
  user_id = auth.uid() or exists (
    select 1 from conversation_members m2
    where m2.conversation_id = conversation_members.conversation_id and m2.user_id = auth.uid())
);
create policy cm_insert on public.conversation_members for insert with check (
  user_id = auth.uid() or exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid())
);
create policy cm_update on public.conversation_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cm_delete on public.conversation_members for delete using (
  user_id = auth.uid() or exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid())
);
create policy msg_read on public.messages for select using (
  exists (select 1 from conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);
create policy msg_insert on public.messages for insert with check (
  sender_id = auth.uid() and exists (select 1 from conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);
create policy msg_update on public.messages for update using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy msg_reads_own on public.message_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- groups
create policy groups_read on public.groups for select using (
  privacy <> 'hidden' or owner_id = auth.uid()
  or exists (select 1 from group_members gm where gm.group_id = id and gm.user_id = auth.uid() and gm.status='approved')
);
create policy groups_insert on public.groups for insert with check (owner_id = auth.uid());
create policy groups_update on public.groups for update using (
  owner_id = auth.uid() or exists (select 1 from group_members gm where gm.group_id = id and gm.user_id = auth.uid() and gm.role in ('owner','moderator'))
) with check (
  owner_id = auth.uid() or exists (select 1 from group_members gm where gm.group_id = id and gm.user_id = auth.uid() and gm.role in ('owner','moderator'))
);
create policy groups_delete on public.groups for delete using (owner_id = auth.uid() or public.is_admin());
create policy gm_read on public.group_members for select using (
  user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.privacy <> 'hidden')
);
create policy gm_insert on public.group_members for insert with check (user_id = auth.uid());
create policy gm_update on public.group_members for update using (
  user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid())
);
create policy gm_delete on public.group_members for delete using (
  user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid())
);
create policy contest_read on public.group_contests for select using (true);
create policy contest_write on public.group_contests for all using (
  exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid()) or public.is_admin()
) with check (
  exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid()) or public.is_admin()
);

-- commerce
create policy plans_read on public.plans for select using (is_active or public.is_admin());
create policy plans_admin on public.plans for all using (public.is_admin()) with check (public.is_admin());
create policy subs_read on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy subs_admin on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
create policy payments_read on public.payments for select using (user_id = auth.uid() or public.is_admin());
-- NOTE: no insert/update policy for authenticated users: payments are written by
-- service_role (webhook / edge function) only. This prevents client-side forgery.
create policy payments_admin on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy invoices_read on public.invoices for select using (user_id = auth.uid() or public.is_admin());
create policy exemptions_read on public.exemptions for select using (user_id = auth.uid() or public.is_admin());
create policy exemptions_admin on public.exemptions for all using (public.is_admin()) with check (public.is_admin());
create policy coupons_read on public.coupons for select using (is_active or public.is_admin());
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());
create policy coupon_red_own on public.coupon_redemptions for select using (user_id = auth.uid() or public.is_admin());

-- safety / notifications
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_moderator());
create policy reports_update on public.reports for update using (public.is_moderator()) with check (public.is_moderator());

create policy notif_own on public.notifications for select using (user_id = auth.uid());
create policy notif_own_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_own_delete on public.notifications for delete using (user_id = auth.uid());

create policy push_own on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_own on public.device_sessions for select using (user_id = auth.uid());
create policy devices_own_del on public.device_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy auth_events_read on public.auth_events for select using (public.is_admin());
create policy audit_read on public.audit_logs for select using (public.is_admin());
create policy webhook_read on public.webhook_events for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 16. ADMIN RPCs (security definer, all guarded)
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'users_total', (select count(*) from profiles),
    'users_active_30d', (select count(*) from profiles where updated_at > now() - interval '30 days'),
    'users_banned', (select count(*) from profiles where is_banned),
    'authors', (select count(*) from profiles where account_type in ('author','novelist','storyteller','poet')),
    'works_total', (select count(*) from works),
    'works_published', (select count(*) from works where status='published'),
    'works_pending', (select count(*) from works where status='pending_review'),
    'chapters_total', (select count(*) from chapters),
    'posts_total', (select count(*) from posts),
    'stories_total', (select count(*) from stories),
    'groups_total', (select count(*) from groups),
    'reports_open', (select count(*) from reports where status='open'),
    'subs_active', (select count(*) from subscriptions where status='active' and current_period_end > now()),
    'revenue_total', (select coalesce(sum(amount - refunded_amount),0) from payments where status in ('succeeded','partially_refunded')),
    'revenue_30d', (select coalesce(sum(amount - refunded_amount),0) from payments where status='succeeded' and created_at > now() - interval '30 days'),
    'payments_failed', (select count(*) from payments where status='failed'),
    'verifications_pending', (select count(*) from verification_requests where status='pending')
  ) into r;
  return r;
end $$;

create or replace function public.admin_grant_badge(target uuid, badge text, note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into user_badges (user_id, badge_key, granted_by)
  values (target, badge, auth.uid())
  on conflict (user_id, badge_key) do update set revoked_at = null, granted_by = auth.uid(), granted_at = now();
  update profiles set is_verified = true,
    highest_badge = badge::verification_level,
    is_vip = (badge = 'vip') or is_vip
  where id = target;
  insert into notifications (user_id, kind, title, body, data)
  values (target, 'verification_approved', 'Verification approved', note, jsonb_build_object('badge', badge));
end $$;

create or replace function public.admin_revoke_badge(target uuid, badge text, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update user_badges set revoked_at = now(), revoke_reason = reason where user_id = target and badge_key = badge;
  update profiles set is_verified = exists (select 1 from user_badges ub where ub.user_id = target and ub.revoked_at is null),
    is_vip = exists (select 1 from user_badges ub where ub.user_id = target and ub.badge_key='vip' and ub.revoked_at is null)
  where id = target;
  update profiles set highest_badge = coalesce((select ub.badge_key::verification_level from user_badges ub
    where ub.user_id = target and ub.revoked_at is null order by ub.granted_at desc limit 1), 'none') where id = target;
end $$;

create or replace function public.admin_set_role(target uuid, new_role staff_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if target = auth.uid() then raise exception 'cannot_change_own_role'; end if;
  update profiles set role = new_role where id = target;
end $$;

create or replace function public.admin_grant_exemption(target uuid, kind exemption_kind, days integer default null, reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into exemptions (user_id, kind, reason, granted_by, expires_at)
  values (target, kind, reason, auth.uid(), case when days is null then null else now() + (days || ' days')::interval end)
  returning id into new_id;
  if kind = 'unlimited_publish' then update profiles set unlimited_publish = true where id = target; end if;
  return new_id;
end $$;

create or replace function public.admin_revoke_exemption(exemption uuid)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid; k exemption_kind;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update exemptions set is_active = false, revoked_at = now() where id = exemption returning user_id, kind into owner, k;
  if k = 'unlimited_publish' and not exists (
    select 1 from exemptions e where e.user_id = owner and e.kind='unlimited_publish' and e.is_active and e.revoked_at is null
  ) then
    update profiles set unlimited_publish = false where id = owner;
  end if;
end $$;

create or replace function public.admin_review_work(work uuid, decision work_status, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare w works;
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  update works set status = decision, reviewed_by = auth.uid(), reviewed_at = now(),
    rejection_reason = case when decision='rejected' then reason else null end,
    published_at = case when decision='published' then now() else published_at end
  where id = work returning * into w;
  insert into notifications (user_id, kind, title, body, target_type, target_id, data)
  values (w.author_id, case when decision='published' then 'work_approved' else 'work_rejected' end,
          case when decision='published' then 'Work approved' else 'Work rejected' end,
          reason, 'work', w.id, jsonb_build_object('title', w.title));
end $$;

-- ---------------------------------------------------------------------------
-- 17. SEED: default plans
-- ---------------------------------------------------------------------------
insert into public.plans (code,name_en,name_fr,name_ar,description_en,price,interval,publish_limit,features,sort_order) values
 ('monthly','Monthly Writer','Écrivain Mensuel','كاتب شهري','Unlimited publishing while active',9.99,'month',null,'{"unlimited_publish":true,"verified_badge":false,"priority_review":true}',10),
 ('yearly','Yearly Writer','Écrivain Annuel','كاتب سنوي','Two months free vs monthly',89.99,'year',null,'{"unlimited_publish":true,"verified_badge":false,"priority_review":true}',20),
 ('lifetime','Lifetime Author','Auteur à vie','كاتب مدى الحياة','One-time payment, permanent publishing',249.00,'lifetime',null,'{"unlimited_publish":true,"verified_badge":true,"priority_review":true}',30)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 18. STORAGE BUCKETS + POLICIES
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
 ('avatars','avatars',true,5242880,array['image/png','image/jpeg','image/webp']),
 ('covers','covers',true,10485760,array['image/png','image/jpeg','image/webp']),
 ('media','media',true,26214400,array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','application/pdf']),
 ('stories','stories',true,26214400,array['image/png','image/jpeg','image/webp','video/mp4']),
 ('documents','documents',false,26214400,array['application/pdf','image/png','image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read" on storage.objects for select
  using (bucket_id in ('avatars','covers','media','stories'));

drop policy if exists "storage_own_write" on storage.objects;
create policy "storage_own_write" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars','covers','media','stories','documents')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_own_update" on storage.objects;
create policy "storage_own_update" on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text)
  with check ((storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage_own_delete" on storage.objects;
create policy "storage_own_delete" on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin());

drop policy if exists "storage_private_read" on storage.objects;
create policy "storage_private_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- 19. REALTIME
-- ---------------------------------------------------------------------------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.messages'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.conversations'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.notifications'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.typing_indicators'; exception when others then null; end;
end $$;

create table if not exists public.typing_indicators (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.typing_indicators enable row level security;
create policy typing_read on public.typing_indicators for select using (
  exists (select 1 from conversation_members m where m.conversation_id = typing_indicators.conversation_id and m.user_id = auth.uid())
);
create policy typing_own on public.typing_indicators for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.typing_indicators'; exception when others then null; end;
end $$;
