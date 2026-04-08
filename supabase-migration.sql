-- ═══════════════════════════════════════════
-- Steiner Trading Terminal — Supabase Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- 1. TRADES TABLE
create table public.trades (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  entry numeric not null,
  stop numeric not null,
  target numeric,
  shares integer not null,
  thesis text,
  date date not null,
  type text not null check (type in ('swing', 'position', 'etf')),
  status text not null default 'open' check (status in ('open', 'closed')),
  risk_per_share numeric not null,
  total_risk numeric not null,
  position_size numeric not null,
  rr numeric default 0,
  close_date date,
  close_price numeric,
  pnl numeric,
  journal_lessons text,
  journal_mistakes text,
  followed_rules boolean,
  emotion text,
  created_at timestamptz default now()
);

-- 2. WATCHLIST TABLE
create table public.watchlist (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  notes text,
  setup text not null check (setup in ('breakout', 'pullback', 'bounce', 'etf', 'other')),
  alert numeric,
  date date not null,
  status text not null default 'watching' check (status in ('watching', 'ready', 'triggered')),
  created_at timestamptz default now()
);

-- 3. SETTINGS TABLE
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  capital numeric default 10000,
  max_risk_pct numeric default 1,
  max_positions integer default 3,
  max_pos_pct numeric default 20,
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY (each user sees only their data)
-- ═══════════════════════════════════════════

alter table public.trades enable row level security;
alter table public.watchlist enable row level security;
alter table public.settings enable row level security;

-- Trades policies
create policy "Users can view own trades"
  on public.trades for select using (auth.uid() = user_id);
create policy "Users can insert own trades"
  on public.trades for insert with check (auth.uid() = user_id);
create policy "Users can update own trades"
  on public.trades for update using (auth.uid() = user_id);
create policy "Users can delete own trades"
  on public.trades for delete using (auth.uid() = user_id);

-- Watchlist policies
create policy "Users can view own watchlist"
  on public.watchlist for select using (auth.uid() = user_id);
create policy "Users can insert own watchlist"
  on public.watchlist for insert with check (auth.uid() = user_id);
create policy "Users can update own watchlist"
  on public.watchlist for update using (auth.uid() = user_id);
create policy "Users can delete own watchlist"
  on public.watchlist for delete using (auth.uid() = user_id);

-- Settings policies
create policy "Users can view own settings"
  on public.settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings"
  on public.settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on public.settings for update using (auth.uid() = user_id);
