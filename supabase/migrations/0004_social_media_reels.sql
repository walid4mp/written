-- 0004_social_media_reels.sql — idempotent (safe to re-run)
begin;

-- media: view counter used by reels
alter table public.media add column if not exists views_count integer not null default 0;

-- one view per (reel, viewer) — the PK makes double counting impossible
create table if not exists public.reel_views (
  media_id   uuid not null references public.media(id) on delete cascade,
  viewer_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, viewer_id)
);
alter table public.reel_views enable row level security;

drop policy if exists reel_views_insert on public.reel_views;
create policy reel_views_insert on public.reel_views
  for insert to authenticated with check (viewer_id = auth.uid());

drop policy if exists reel_views_read on public.reel_views;
create policy reel_views_read on public.reel_views
  for select to authenticated using (viewer_id = auth.uid() or public.is_moderator());

create or replace function public.register_reel_view(p_media uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_first boolean := false; v_count integer;
begin
  if auth.uid() is null then
    select views_count into v_count from public.media where id = p_media;
    return coalesce(v_count, 0);
  end if;
  insert into public.reel_views (media_id, viewer_id)
  values (p_media, auth.uid())
  on conflict (media_id, viewer_id) do nothing
  returning true into v_first;
  if coalesce(v_first, false) then
    update public.media set views_count = views_count + 1 where id = p_media;
  end if;
  select views_count into v_count from public.media where id = p_media;
  return coalesce(v_count, 0);
end; $$;

revoke all on function public.register_reel_view(uuid) from public;
grant execute on function public.register_reel_view(uuid) to authenticated;

-- media → posts link + indexes
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'media_post_id_fkey') then
    alter table public.media
      add constraint media_post_id_fkey
      foreign key (post_id) references public.posts(id) on delete cascade;
  end if;
end $$;

create index if not exists media_post_id_idx on public.media (post_id) where post_id is not null;
create index if not exists media_video_idx on public.media (created_at desc) where kind = 'video';
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);

-- media RLS
alter table public.media enable row level security;

drop policy if exists media_read on public.media;
create policy media_read on public.media
  for select using (
    owner_id = auth.uid()
    or public.is_moderator()
    or post_id is null
    or exists (
      select 1 from public.posts p
      where p.id = media.post_id and p.deleted_at is null
        and (p.visibility = 'public' or p.author_id = auth.uid())
    )
  );

drop policy if exists media_insert on public.media;
create policy media_insert on public.media
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists media_delete on public.media;
create policy media_delete on public.media
  for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- posts: you may only insert as yourself
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated with check (author_id = auth.uid());

-- follows: no self-follow, no duplicates
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'follows_no_self') then
    alter table public.follows add constraint follows_no_self check (follower_id <> following_id);
  end if;
end $$;

create unique index if not exists follows_unique_pair on public.follows (follower_id, following_id);

commit;
