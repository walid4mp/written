-- ============================================================================
-- SARAD — Migration 0002
-- Fix: internal (system) writes to profiles were reverted by the privilege
-- guard trigger, so publishing never incremented `free_works_used`.
-- Adds an explicit system-write flag that only security-definer triggers set.
-- ============================================================================
set client_min_messages to warning;

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Internal writes performed by trusted triggers (e.g. publish accounting)
  -- must bypass the self-escalation guard.
  if coalesce(current_setting('sarad.system_write', true), 'off') = 'on' then
    return new;
  end if;

  if auth.uid() = new.id and not public.is_admin() then
    new.role              := old.role;
    new.is_verified       := old.is_verified;
    new.highest_badge     := old.highest_badge;
    new.is_vip            := old.is_vip;
    new.unlimited_publish := old.unlimited_publish;
    new.free_works_used   := old.free_works_used;
    new.is_banned         := old.is_banned;
    new.works_count       := old.works_count;
  end if;
  return new;
end $$;

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
        perform set_config('sarad.system_write', 'on', true);
        update profiles
           set free_works_used = free_works_used + 1,
               works_count     = works_count + 1
         where id = new.author_id;
        perform set_config('sarad.system_write', 'off', true);
      end if;
    end if;
    new.reviewed_by       := old.reviewed_by;
    new.rejection_reason  := old.rejection_reason;
  end if;
  return new;
end $$;

-- Admin review path must credit the author the same way.
create or replace function public.admin_review_work(work uuid, decision work_status, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare w works; was_published boolean;
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;

  select status = 'published' into was_published from works where id = work;

  update works
     set status = decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = case when decision = 'rejected' then reason else null end,
         published_at = case when decision = 'published' then coalesce(published_at, now()) else published_at end
   where id = work
   returning * into w;

  if decision = 'published' and not coalesce(was_published, false) then
    perform set_config('sarad.system_write', 'on', true);
    update profiles set works_count = works_count + 1 where id = w.author_id;
    perform set_config('sarad.system_write', 'off', true);
  end if;

  insert into notifications (user_id, kind, title, body, target_type, target_id, data)
  values (w.author_id,
          case when decision = 'published' then 'work_approved'::notification_kind else 'work_rejected'::notification_kind end,
          case when decision = 'published' then 'Work approved' else 'Work rejected' end,
          reason, 'work', w.id, jsonb_build_object('title', w.title));
end $$;

-- Liking a work must not be able to inflate counters via direct UPDATE either.
create or replace function public.guard_work_counters()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('sarad.system_write', true), 'off') = 'on' then
    return new;
  end if;
  if auth.uid() = new.author_id and not public.is_moderator() then
    new.likes_count    := old.likes_count;
    new.comments_count := old.comments_count;
    new.reads_count    := old.reads_count;
    new.rating_avg     := old.rating_avg;
    new.rating_count   := old.rating_count;
    new.chapters_count := old.chapters_count;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_work_counters on public.works;
create trigger trg_guard_work_counters before update on public.works
for each row execute function public.guard_work_counters();

-- Reads counter RPC (called by the reader screen once per chapter open).
create or replace function public.register_read(p_work uuid, p_chapter uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform set_config('sarad.system_write', 'on', true);
  update works set reads_count = reads_count + 1 where id = p_work;
  if p_chapter is not null then
    update chapters set reads_count = reads_count + 1 where id = p_chapter;
  end if;
  perform set_config('sarad.system_write', 'off', true);
end $$;

grant execute on function public.register_read(uuid, uuid) to authenticated;
