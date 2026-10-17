-- Buildings that can be pre-planned, and the pre-plans the agent produces for them.

create extension if not exists "pgcrypto";

create table if not exists public.buildings (
  id          uuid primary key default gen_random_uuid(),
  address     text not null,
  lat         double precision not null,
  lng         double precision not null,
  scan_url    text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.preplans (
  id               uuid primary key default gen_random_uuid(),
  building_id      uuid not null references public.buildings(id) on delete cascade,
  scenario_params  jsonb not null default '{}'::jsonb,
  report           jsonb not null,
  events           jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists preplans_building_id_idx on public.preplans (building_id);
create index if not exists preplans_created_at_idx on public.preplans (created_at desc);

alter table public.buildings enable row level security;
alter table public.preplans enable row level security;

drop policy if exists "buildings are readable" on public.buildings;
create policy "buildings are readable" on public.buildings for select using (true);

drop policy if exists "preplans are readable" on public.preplans;
create policy "preplans are readable" on public.preplans for select using (true);
