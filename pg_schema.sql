-- ============================================================
--  BBC Ledger – FULL BACKEND SCHEMA
--  Tables, RLS, Policies, RPC, Triggers
-- ============================================================

-- ===========================
-- EXTENSIONS
-- ===========================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ===========================
-- PROFILES TABLE
-- ===========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_name text,
  phone text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select"
  on public.profiles
  for select
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id);

-- ===========================
-- REQUESTS TABLE
-- ===========================
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  notes text,
  status text not null check (status in ('open','accepted','completed','cancelled')),
  accepted_by uuid references auth.users(id),
  created_at timestamptz default now(),

  constraint valid_time_range check (end_time > start_time),

  constraint accepted_by_valid check (
    (status = 'accepted' and accepted_by is not null)
    or (status <> 'accepted' and accepted_by is null)
    or status = 'completed'
  )
);

create index if not exists requests_owner_idx on public.requests(owner);
create index if not exists requests_status_idx on public.requests(status);

alter table public.requests enable row level security;

create policy "requests_select"
  on public.requests
  for select
  using (true);

create policy "requests_insert"
  on public.requests
  for insert
  with check (auth.uid() = owner);

create policy "requests_update"
  on public.requests
  for update
  using (
    auth.uid() = owner
    or auth.uid() = accepted_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "requests_delete"
  on public.requests
  for delete
  using (auth.uid() = owner);

-- ===========================
-- LEDGER ENTRIES TABLE
-- ===========================
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  request uuid not null references public.requests(id) on delete cascade,
  from_user uuid not null references auth.users(id),
  to_user uuid not null references auth.users(id),
  hours numeric not null check (hours > 0),
  timestamp timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists ledger_request_idx on public.ledger_entries(request);
create index if not exists ledger_from_user_idx on public.ledger_entries(from_user);
create index if not exists ledger_to_user_idx on public.ledger_entries(to_user);

alter table public.ledger_entries enable row level security;

create policy "ledger_select"
  on public.ledger_entries
  for select
  using (true);

create policy "ledger_insert"
  on public.ledger_entries
  for insert
  with check (
    auth.uid() = from_user
    or auth.uid() = to_user
  );

-- No update/delete policies → immutable ledger

-- ===========================
-- TRIGGER FUNCTION: CREATE LEDGER ENTRY ON COMPLETION
-- ===========================
create or replace function public.create_ledger_on_completion()
returns trigger
language plpgsql
as $$
declare
  hours numeric;
begin
  if NEW.status = 'completed' and OLD.status <> 'completed' then
    hours := extract(epoch from (NEW.end_time - NEW.start_time)) / 3600;

    if hours <= 0 then
      raise exception 'Invalid time range for request %', NEW.id;
    end if;

    insert into public.ledger_entries (request, from_user, to_user, hours)
    values (
      NEW.id,
      NEW.owner,
      NEW.accepted_by,
      hours
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_create_ledger_on_completion on public.requests;

create trigger trg_create_ledger_on_completion
after update on public.requests
for each row
execute function public.create_ledger_on_completion();

-- ===========================
-- RPC FUNCTIONS
-- ===========================

-- Accept a request
create or replace function public.accept_request(p_request_id uuid)
returns void
language plpgsql
as $$
begin
  update public.requests
  set status = 'accepted',
      accepted_by = auth.uid()
  where id = p_request_id
    and status = 'open';
end;
$$;

-- Complete a request (ledger created by trigger)
create or replace function public.complete_request(p_request_id uuid)
returns void
language plpgsql
as $$
begin
  update public.requests
  set status = 'completed'
  where id = p_request_id
    and status = 'accepted';
end;
$$;
