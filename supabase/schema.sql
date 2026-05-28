-- ============================================================
-- FLEA MARKET APP — SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- EVENTS
create table if not exists fm_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  location text,
  organizer_pin text not null,
  min_merchant_pct integer not null default 20,
  max_merchant_pct integer not null default 50,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- MERCHANTS
create table if not exists fm_merchants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references fm_events(id) on delete cascade,
  full_name text not null,
  shop_name text not null,
  description text,
  merchant_pct integer not null check (merchant_pct >= 20 and merchant_pct <= 50),
  pin text not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  photo_url text,
  created_at timestamptz default now()
);

-- EQUIPMENT
create table if not exists fm_equipment (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references fm_merchants(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  created_at timestamptz default now()
);

-- INVENTORY ITEMS
create table if not exists fm_items (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references fm_merchants(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null,
  quantity integer not null default 0,
  quantity_sold integer not null default 0,
  created_at timestamptz default now()
);

-- SALES TRANSACTIONS
create table if not exists fm_sales (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references fm_merchants(id) on delete cascade,
  item_id uuid references fm_items(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  payment_method text default 'cash' check (payment_method in ('cash','card','other')),
  is_undone boolean default false,
  sold_at timestamptz default now()
);

-- ANNOUNCEMENTS (organizer broadcasts)
create table if not exists fm_announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references fm_events(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

-- AUDIT LOG
create table if not exists fm_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references fm_events(id) on delete cascade,
  merchant_id uuid references fm_merchants(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table fm_events enable row level security;
alter table fm_merchants enable row level security;
alter table fm_equipment enable row level security;
alter table fm_items enable row level security;
alter table fm_sales enable row level security;
alter table fm_announcements enable row level security;
alter table fm_audit_log enable row level security;

-- Allow all operations via anon key (PIN-based auth handled app-side)
create policy "allow_all_events" on fm_events for all using (true) with check (true);
create policy "allow_all_merchants" on fm_merchants for all using (true) with check (true);
create policy "allow_all_equipment" on fm_equipment for all using (true) with check (true);
create policy "allow_all_items" on fm_items for all using (true) with check (true);
create policy "allow_all_sales" on fm_sales for all using (true) with check (true);
create policy "allow_all_announcements" on fm_announcements for all using (true) with check (true);
create policy "allow_all_audit" on fm_audit_log for all using (true) with check (true);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_merchants_event on fm_merchants(event_id);
create index if not exists idx_items_merchant on fm_items(merchant_id);
create index if not exists idx_sales_merchant on fm_sales(merchant_id);
create index if not exists idx_sales_item on fm_sales(item_id);
create index if not exists idx_sales_sold_at on fm_sales(sold_at);
create index if not exists idx_announcements_event on fm_announcements(event_id);
