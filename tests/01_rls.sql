-- ============================================================================
-- SARAD — RLS / privilege / business-rule test suite
-- Runs against the real Supabase project. Every check prints PASS or FAIL.
-- Usage: psql "$DATABASE_URL" -f tests/01_rls.sql
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages to warning;

-- ---------- fixtures -------------------------------------------------------
delete from auth.users where email like 'rls.%@saradtest.local';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls.author@saradtest.local',crypt('x',gen_salt('bf')),now(),'{"provider":"email"}','{"username":"rls_author","display_name":"RLS Author"}',now(),now()),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls.other@saradtest.local',crypt('x',gen_salt('bf')),now(),'{"provider":"email"}','{"username":"rls_other","display_name":"RLS Other"}',now(),now())
on conflict (id) do nothing;

delete from public.works where author_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

create table if not exists public._rls_results (seq serial primary key, test text, result text);
truncate public._rls_results;

-- ---------- helpers --------------------------------------------------------
create or replace function public._as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function public._as_anon(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create or replace function public._as_root() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
end $$;

-- ============================================================================
-- T1  A user can NEVER grant themselves a badge
-- ============================================================================
create or replace function public._t1() returns text language plpgsql as $$
declare msg text;
begin
  perform public._as_user('11111111-1111-4111-8111-111111111111');
  begin
    insert into public.user_badges (user_id, badge_key) values ('11111111-1111-4111-8111-111111111111','vip');
    msg := 'FAIL — self badge insert was allowed';
  exception when others then
    msg := 'PASS — blocked by RLS (' || sqlstate || ')';
  end;
  perform public._as_root();
  return msg;
end $$;

-- ============================================================================
-- T2  A user can NEVER promote themselves to admin
-- ============================================================================
create or replace function public._t2() returns text language plpgsql as $$
declare msg text; r text;
begin
  perform public._as_user('11111111-1111-4111-8111-111111111111');
  begin
    update public.profiles set role = 'admin', is_verified = true, unlimited_publish = true
     where id = '11111111-1111-4111-8111-111111111111';
    msg := 'update accepted';
  exception when others then
    msg := 'exception: ' || sqlerrm;
  end;
  perform public._as_root();
  select role::text into r from public.profiles where id = '11111111-1111-4111-8111-111111111111';
  if r = 'user' then
    return 'PASS — ' || msg || ', role still "' || r || '" (guard trigger reset it)';
  else
    return 'FAIL — role is now ' || r;
  end if;
end $$;

-- ============================================================================
-- T3  A client can NEVER insert a payment record (only the verified webhook)
-- ============================================================================
create or replace function public._t3() returns text language plpgsql as $$
declare msg text;
begin
  perform public._as_user('11111111-1111-4111-8111-111111111111');
  begin
    insert into public.payments (user_id, purpose, amount, status)
    values ('11111111-1111-4111-8111-111111111111','subscription',0.0,'succeeded');
    msg := 'FAIL — client forged a successful payment';
  exception when others then
    msg := 'PASS — blocked by RLS (' || sqlstate || ')';
  end;
  perform public._as_root();
  return msg;
end $$;

-- ============================================================================
-- T4  A client can NEVER write an exemption (free-pass) for themselves
-- ============================================================================
create or replace function public._t4() returns text language plpgsql as $$
 declare msg text;
begin
  perform public._as_user('11111111-1111-4111-8111-111111111111');
  begin
    insert into public.exemptions (user_id, kind) values ('11111111-1111-4111-8111-111111111111','unlimited_publish');
    msg := 'FAIL — self exemption allowed';
  exception when others then
    msg := 'PASS — blocked by RLS (' || sqlstate || ')';
  end;
  perform public._as_root();
  return msg;
end $$;

-- ============================================================================
-- T5  A user cannot create a work in another author's name
-- ============================================================================
create or replace function public._t5() returns text language plpgsql as $$
declare msg text;
begin
  perform public._as_user('11111111-1111-4111-8111-111111111111');
  begin
    insert into public.works (author_id, title, kind) values ('22222222-2222-4222-8222-222222222222','stolen','novel');
    msg := 'FAIL — impersonation allowed';
  exception when others then
    msg := 'PASS — blocked by RLS (' || sqlstate || ')';
  end;
  perform public._as_root();
  return msg;
end $$;

-- ============================================================================
-- T6  Drafts of another author are invisible
-- ============================================================================
create or replace function public._t6() returns text language plpgsql as $$
declare n int;
begin
  perform public._as_root();
  insert into public.works (id, author_id, title, kind, status)
  values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Secret Draft','novel','draft')
  on conflict (id) do update set status = 'draft';

  perform public._as_user('22222222-2222-4222-8222-222222222222');
  select count(*) into n from public.works where id = '33333333-3333-4333-8333-333333333333';
  perform public._as_root();
  return case when n = 0 then 'PASS — hidden from other users' else 'FAIL — draft leaked to another user' end;
end $$;

-- ============================================================================
-- T7  Publishing consumes a free slot and stamps published_at
-- ============================================================================
create or replace function public._t7() returns text language plpgsql as $$
declare used int; st text; pub timestamptz;
begin
  perform public._as_root();
  update public.app_settings set require_work_review = false, publish_policy = 'free_quota', free_works_limit = 3 where id;
  update public.profiles set free_works_used = 0 where id = '11111111-1111-4111-8111-111111111111';

  perform public._as_user('11111111-1111-4111-8111-111111111111');
  update public.works set status = 'published' where id = '33333333-3333-4333-8333-333333333333';
  perform public._as_root();

  select free_works_used into used from public.profiles where id = '11111111-1111-4111-8111-111111111111';
  select status::text, published_at into st, pub from public.works where id = '33333333-3333-4333-8333-333333333333';
  if st = 'published' and pub is not null and used = 1 then
    return 'PASS — status=published, published_at set, free_works_used=1';
  else
    return format('FAIL — status=%s published_at=%s used=%s', st, pub, used);
  end if;
end $$;

-- ============================================================================
-- T8  Review-gated policy forces pending_review instead of instant publish
-- ============================================================================
create or replace function public._t8() returns text language plpgsql as $$
declare st text;
begin
  perform public._as_root();
  update public.app_settings set require_work_review = true where id;
  insert into public.works (id, author_id, title, kind, status)
  values ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Gated Work','novel','draft')
  on conflict (id) do update set status = 'draft';

  perform public._as_user('11111111-1111-4111-8111-111111111111');
  update public.works set status = 'published' where id = '44444444-4444-4444-8444-444444444444';
  perform public._as_root();

  select status::text into st from public.works where id = '44444444-4444-4444-8444-444444444444';
  update public.app_settings set require_work_review = false where id;
  return case when st = 'pending_review' then 'PASS — downgraded to pending_review' else 'FAIL — status=' || st end;
end $$;

-- ============================================================================
-- T9  can_publish() honours quota, exemption and unlimited_publish
-- ============================================================================
create or replace function public._t9() returns text language plpgsql as $$
declare r1 jsonb; r2 jsonb; r3 jsonb; out text := '';
begin
  perform public._as_root();
  update public.app_settings set publish_policy='free_quota', free_works_limit=3 where id;
  update public.profiles set free_works_used=0, unlimited_publish=false where id='11111111-1111-4111-8111-111111111111';
  select public.can_publish('11111111-1111-4111-8111-111111111111') into r1;
  update public.profiles set free_works_used=3 where id='11111111-1111-4111-8111-111111111111';
  select public.can_publish('11111111-1111-4111-8111-111111111111') into r2;
  insert into public.exemptions (user_id, kind, reason) values ('11111111-1111-4111-8111-111111111111','publish_fee','test');
  select public.can_publish('11111111-1111-4111-8111-111111111111') into r3;

  if (r1->>'allowed')::bool and r1->>'reason' = 'free_quota' then out := out || 'PASS quota-under-limit; '; else out := out || 'FAIL quota-under-limit (' || r1::text || '); '; end if;
  if not (r2->>'allowed')::bool and r2->>'reason' = 'payment_required' then out := out || 'PASS quota-exhausted; '; else out := out || 'FAIL quota-exhausted (' || r2::text || '); '; end if;
  if (r3->>'allowed')::bool and r3->>'reason' = 'exempt' then out := out || 'PASS exemption-overrides'; else out := out || 'FAIL exemption (' || r3::text || ')'; end if;

  delete from public.exemptions where reason = 'test';
  update public.profiles set free_works_used=1 where id='11111111-1111-4111-8111-111111111111';
  return out;
end $$;

-- ============================================================================
-- T10 Ratings aggregate recomputes works.rating_avg
-- ============================================================================
create or replace function public._t10() returns text language plpgsql as $$
declare avg1 numeric; cnt int;
begin
  perform public._as_root();
  delete from public.ratings where work_id = '33333333-3333-4333-8333-333333333333';
  insert into public.ratings (user_id, work_id, score) values
    ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',5),
    ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',3);
  select rating_avg, rating_count into avg1, cnt from public.works where id='33333333-3333-4333-8333-333333333333';
  return case when avg1 = 4.00 and cnt = 2 then 'PASS — avg=4.00 over 2 ratings' else format('FAIL — avg=%s count=%s', avg1, cnt) end;
end $$;

-- ============================================================================
-- T11 A banned user stays banned even if they try to unban themselves
-- ============================================================================
create or replace function public._t11() returns text language plpgsql as $$
declare r boolean;
begin
  perform public._as_root();
  update public.profiles set is_banned = true, ban_reason = 'test' where id='11111111-1111-4111-8111-111111111111';
  perform public._as_user('11111111-1111-4111-8111-111111111111');
  begin
    update public.profiles set is_banned = false where id='11111111-1111-4111-8111-111111111111';
  exception when others then null;
  end;
  perform public._as_root();
  select is_banned into r from public.profiles where id='11111111-1111-4111-8111-111111111111';
  update public.profiles set is_banned = false, ban_reason = null where id='11111111-1111-4111-8111-111111111111';
  return case when r then 'PASS — unban attempt ignored (guard trigger)' else 'FAIL — user unbanned themselves' end;
end $$;

-- ============================================================================
-- T12 Admin RPCs reject non-admin callers
-- ============================================================================
create or replace function public._t12() returns text language plpgsql as $$
declare msg text;
begin
  perform public._as_user('22222222-2222-4222-8222-222222222222');
  begin
    perform public.admin_grant_badge('22222222-2222-4222-8222-222222222222','official', null);
    msg := 'FAIL — non-admin granted a badge';
  exception when others then
    msg := 'PASS — admin_grant_badge refused (' || sqlerrm || ')';
  end;
  perform public._as_root();
  return msg;
end $$;

-- ---------- run ------------------------------------------------------------
insert into public._rls_results (test, result) values
 ('T1 self-badge blocked',                 public._t1()),
 ('T2 self-promotion blocked',             public._t2()),
 ('T3 client payment forgery blocked',     public._t3()),
 ('T4 self exemption blocked',             public._t4()),
 ('T5 impersonated work blocked',          public._t5()),
 ('T6 foreign draft invisible',            public._t6()),
 ('T7 publish consumes quota',             public._t7()),
 ('T8 review gate enforced',               public._t8()),
 ('T9 can_publish policy engine',          public._t9()),
 ('T10 rating aggregate',                  public._t10()),
 ('T11 self-unban blocked',                public._t11()),
 ('T12 admin RPC authorization',           public._t12());

select seq, test, result from public._rls_results order by seq;

-- ---------- cleanup --------------------------------------------------------
drop function if exists public._t1(); drop function if exists public._t2(); drop function if exists public._t3();
drop function if exists public._t4(); drop function if exists public._t5(); drop function if exists public._t6();
drop function if exists public._t7(); drop function if exists public._t8(); drop function if exists public._t9();
drop function if exists public._t10(); drop function if exists public._t11(); drop function if exists public._t12();
drop function if exists public._as_user(uuid); drop function if exists public._as_anon(uuid); drop function if exists public._as_root();
delete from public.works where author_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
delete from auth.users where email like 'rls.%@saradtest.local';
update public.app_settings set require_work_review = false, publish_policy = 'free_quota', free_works_limit = 3 where id;
