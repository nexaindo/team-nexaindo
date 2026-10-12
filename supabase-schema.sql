-- NEXAINDO WiFi Operations
-- Jalankan seluruh SQL ini di Supabase Dashboard > SQL Editor.
-- Buat akun admin dari Authentication > Users terlebih dahulu,
-- lalu salin UUID user tersebut untuk bagian INSERT paling bawah.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table if not exists public.internet_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  speed_mbps integer not null check (speed_mbps > 0),
  price_monthly numeric(12,2) not null default 0 check (price_monthly >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  address text not null default '',
  package_name text not null default 'Custom',
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  connection_status text not null default 'active' check (connection_status in ('active','offline')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  created_at timestamptz not null default now(),
  unique(customer_id, period)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.is_nexaindo_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_nexaindo_admin() from public;
grant execute on function public.is_nexaindo_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.internet_packages enable row level security;
alter table public.customers enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;

drop policy if exists "admin reads own role" on public.admin_users;
create policy "admin reads own role" on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "admins manage packages" on public.internet_packages;
create policy "admins manage packages" on public.internet_packages for all to authenticated
using (public.is_nexaindo_admin()) with check (public.is_nexaindo_admin());

drop policy if exists "admins manage customers" on public.customers;
create policy "admins manage customers" on public.customers for all to authenticated
using (public.is_nexaindo_admin()) with check (public.is_nexaindo_admin());

drop policy if exists "admins manage bills" on public.bills;
create policy "admins manage bills" on public.bills for all to authenticated
using (public.is_nexaindo_admin()) with check (public.is_nexaindo_admin());

drop policy if exists "admins manage payments" on public.payments;
create policy "admins manage payments" on public.payments for all to authenticated
using (public.is_nexaindo_admin()) with check (public.is_nexaindo_admin());

grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.internet_packages to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.bills to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

insert into public.internet_packages (name, speed_mbps, price_monthly)
values ('Home 20 Mbps', 20, 150000), ('Home 30 Mbps', 30, 200000), ('Business 50 Mbps', 50, 350000)
on conflict (name) do nothing;

-- Setelah membuat user melalui Authentication > Users, ganti UUID di bawah:
-- insert into public.admin_users (user_id, role)
-- values ('PASTE-AUTH-USER-UUID-HERE', 'admin')
-- on conflict (user_id) do nothing;
