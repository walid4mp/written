-- Creator earnings ledger. Only trusted server-side functions should insert/update rows.
alter table public.app_settings
  add column if not exists creator_platform_fee_percent numeric(5,2) not null default 15.00
  check (creator_platform_fee_percent >= 0 and creator_platform_fee_percent <= 100);

create table if not exists public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  work_id uuid references public.works(id) on delete set null,
  purchase_id uuid,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  platform_fee numeric(12,2) not null default 0 check (platform_fee >= 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','available','paid','refunded','reversed')),
  created_at timestamptz not null default now()
);
create index if not exists creator_earnings_creator_created
  on public.creator_earnings(creator_id, created_at desc);

alter table public.creator_earnings enable row level security;
drop policy if exists creator_earnings_owner_read on public.creator_earnings;
create policy creator_earnings_owner_read on public.creator_earnings
  for select to authenticated using (creator_id = auth.uid() or public.is_admin());

-- Deliberately no client INSERT/UPDATE/DELETE policies. Earnings must be written by
-- trusted Edge Functions after a verified payment event.
