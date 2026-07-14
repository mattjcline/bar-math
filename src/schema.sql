-- Bar Math — Supabase Schema
-- Run this in your Supabase SQL editor

create table bars (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  webhook_url              text,
  webhook_delta_threshold  numeric default 20,
  kitchen_tip_percentage   numeric default 12
);

alter table bars add constraint kitchen_tip_percentage_range
  check (kitchen_tip_percentage between 0 and 100);

create table users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text check (role in ('bartender', 'manager', 'admin')) default 'bartender',
  is_active  boolean default true,
  created_at timestamptz default now()
);

create table user_bars (
  user_id uuid references users(id),
  bar_id  uuid references bars(id),
  primary key (user_id, bar_id)
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  shift_date   date not null,
  version      int not null,
  is_current   boolean default true,
  is_void      boolean default false,
  bar_id       uuid references bars(id) not null,
  created_by   uuid references users(id),
  cc_tips      numeric,
  cash_tips    numeric,
  till         numeric,
  cash_sales   numeric,
  credit_sales numeric,
  am_bank      numeric,
  staff        jsonb,
  total_tips   numeric,
  hourly_rate  numeric,
  till_delta   numeric,
  notes        text,
  webhook_sent boolean default false,
  kitchen_tip_percentage numeric,
  total_sales  numeric generated always as (
    coalesce(cash_sales, 0) + coalesce(credit_sales, 0)
  ) stored,
  tip_percentage numeric generated always as (
    case when (coalesce(cash_sales, 0) + coalesce(credit_sales, 0)) > 0
    then (coalesce(cc_tips, 0) + coalesce(cash_tips, 0)) /
         (coalesce(cash_sales, 0) + coalesce(credit_sales, 0)) * 100
    else null end
  ) stored,
  kitchen_tip_amount numeric generated always as (
    coalesce(total_tips, 0) * coalesce(kitchen_tip_percentage, 0) / 100
  ) stored
);

alter table reports add constraint till_delta_floor
  check (till_delta between -400 and 400);

create unique index one_current_report_per_bar_date
  on reports(bar_id, shift_date)
  where is_current = true and is_void = false;

create index on users(is_active) where is_active = true;
create index on reports(bar_id, shift_date);
create index on reports(shift_date);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger reports_updated_at
  before update on reports
  for each row execute function update_updated_at();

-- Update these with your actual bar names before running
insert into bars (name) values
  ('Bar One'),
  ('Bar Two'),
  ('Bar Three'),
  ('Bar Four');

