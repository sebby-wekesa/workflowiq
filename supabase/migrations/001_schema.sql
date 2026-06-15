-- =============================================================================
-- HERCULES WORKSHOP -> SUPABASE  |  01_schema.sql
-- Run this FIRST in the Supabase SQL Editor, then run 02_data.sql.
-- Translates the Convex schema + mutation logic into Postgres:
--   * enums for every Convex union type
--   * jsonb for nested objects (materials, status_history, invoice_data, delivery_record)
--   * RLS for the admin/manager roles
--   * SECURITY DEFINER functions for the transactional stock logic
--     (job create/update/collect/delete -> auto stock deduction & reversal)
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;     -- fuzzy name/phone search

-- ---------- ENUMS (from Convex v.union literals) ----------
do $$ begin
  create type user_role          as enum ('admin','manager');
  create type user_status        as enum ('active','pending','inactive');
  create type job_condition      as enum ('good','worn','heavily_worn','damaged');
  create type job_priority       as enum ('normal','urgent');
  create type job_status         as enum ('received','workshop','relining','qc','done','collected');
  create type stock_category     as enum ('lining_material','rivets','adhesive','hardware','consumable','other');
  create type movement_type      as enum ('in','out','adjustment');
  create type delivery_condition as enum ('good_ready','good_minor_remarks','requires_followup');
exception when duplicate_object then null; end $$;

-- ---------- AUTH HELPERS (defined early: used in column defaults below) ----------
-- plpgsql so the body is resolved at call time, allowing definition before app_users exists.
create or replace function public.current_app_user_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin return (select id from public.app_users where auth_id = auth.uid()); end $$;

create or replace function public.current_app_role()
returns user_role language plpgsql stable security definer set search_path = public as $$
begin return (select role from public.app_users where auth_id = auth.uid()); end $$;

-- ---------- TABLES ----------

-- app_users decouples your people from Supabase auth.users so existing rows
-- (with their roles) survive. On first login an account links by email.
create table if not exists public.app_users (
  id           uuid primary key default gen_random_uuid(),
  auth_id      uuid unique references auth.users(id) on delete set null,
  name         text,
  email        text,
  avatar       text,
  role         user_role   not null default 'manager',
  is_active    boolean     not null default true,
  status       user_status not null default 'active',
  invited_by   uuid references public.app_users(id) on delete set null,
  legacy_token text,        -- old Convex tokenIdentifier, reference only
  created_at   timestamptz not null default now()
);
create unique index if not exists app_users_email_lower_idx
  on public.app_users (lower(email)) where email is not null;

create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role_skill text not null,
  phone      text not null,
  is_active  boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null default '',
  location   text,
  notes      text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create index if not exists customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create index if not exists customers_phone_trgm on public.customers using gin (phone gin_trgm_ops);

create table if not exists public.stock (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      stock_category not null,
  unit          text not null,
  current_qty   numeric not null default 0,
  min_threshold numeric not null default 0,
  supplier      text,
  notes         text,
  created_by    uuid references public.app_users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists stock_name_trgm on public.stock using gin (name gin_trgm_ops);
create index if not exists stock_category_idx on public.stock (category);

create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  job_number      text not null unique,
  customer_id     uuid not null references public.customers(id) on delete restrict,
  description     text not null,
  quantity        numeric not null default 1,
  condition       job_condition not null,
  intake_notes    text,
  date_received   text not null,          -- kept as ISO string to match the app
  priority        job_priority not null default 'normal',
  status          job_status not null default 'received',
  materials       jsonb,                  -- [{ "stockId": uuid, "quantity": n }]
  status_history  jsonb not null default '[]'::jsonb,
  invoice_data    jsonb,
  delivery_record jsonb,
  created_by      uuid references public.app_users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists jobs_customer_idx on public.jobs (customer_id);
create index if not exists jobs_status_idx   on public.jobs (status);

create table if not exists public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  stock_id     uuid not null references public.stock(id) on delete cascade,
  type         movement_type not null,
  quantity     numeric not null,
  reason       text not null default '',
  performed_by uuid references public.app_users(id) on delete set null,
  job_id       uuid references public.jobs(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists stock_movements_stock_idx on public.stock_movements (stock_id);
create index if not exists stock_movements_job_idx   on public.stock_movements (job_id);

create table if not exists public.job_notes (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  text       text not null,
  photo_path text,                        -- Supabase Storage path (was Convex _storage)
  author_id  uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists job_notes_job_idx on public.job_notes (job_id);

-- =============================================================================
-- AUTH HELPERS (current_app_user_id / current_app_role defined near the top)
-- =============================================================================
-- On first Supabase login, link the auth user to an existing app_users row by
-- email (claims the pre-assigned role). If none exists, create one; the very
-- first account ever becomes admin, everyone else a manager. Mirrors the old
-- Convex updateCurrentUser / invite-claim behaviour.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing public.app_users%rowtype;
  total int;
begin
  select * into existing
  from public.app_users
  where lower(email) = lower(new.email)
  limit 1;

  if found then
    update public.app_users
       set auth_id   = new.id,
           is_active = true,
           status    = 'active',
           name      = coalesce(nullif(new.raw_user_meta_data->>'full_name',''), name),
           avatar    = coalesce(new.raw_user_meta_data->>'avatar_url', avatar)
     where id = existing.id;
    return new;
  end if;

  select count(*) into total from public.app_users;
  insert into public.app_users (auth_id, name, email, avatar, role, is_active, status)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    case when total = 0 then 'admin'::user_role else 'manager'::user_role end,
    true,
    'active'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =============================================================================
-- TRANSACTIONAL BUSINESS LOGIC  (ported from convex/jobs.ts & convex/stock.ts)
-- These run as SECURITY DEFINER and enforce their own role checks.
-- =============================================================================

-- Deduct materials from stock and log linked "out" movements. Raises on shortfall.
create or replace function public._apply_material_deductions(
  p_job_id uuid, p_materials jsonb, p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m jsonb; sid uuid; qty numeric; item public.stock%rowtype; jnum text;
begin
  if p_materials is null then return; end if;
  select job_number into jnum from public.jobs where id = p_job_id;
  for m in select * from jsonb_array_elements(p_materials) loop
    sid := (m->>'stockId')::uuid;
    qty := (m->>'quantity')::numeric;
    if qty is null or qty <= 0 then continue; end if;
    select * into item from public.stock where id = sid;
    if not found then raise exception 'Stock item not found for material deduction'; end if;
    if item.current_qty - qty < 0 then
      raise exception 'Insufficient stock for "%". Available: % %, required: %',
        item.name, item.current_qty, item.unit, qty;
    end if;
    update public.stock set current_qty = current_qty - qty where id = sid;
    insert into public.stock_movements (stock_id, type, quantity, reason, performed_by, job_id)
    values (sid, 'out', qty, p_reason || ': ' || coalesce(jnum,''), p_user, p_job_id);
  end loop;
end $$;

-- Reverse every movement linked to a job, restoring stock and writing an
-- audit-trail reversing movement, then delete the originals (no double reversal).
create or replace function public._reverse_job_stock_movements(
  p_job_id uuid, p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare mv public.stock_movements%rowtype; jnum text;
begin
  select job_number into jnum from public.jobs where id = p_job_id;
  for mv in select * from public.stock_movements where job_id = p_job_id loop
    if exists (select 1 from public.stock where id = mv.stock_id) then
      if mv.type = 'out' then
        update public.stock set current_qty = current_qty + mv.quantity where id = mv.stock_id;
        insert into public.stock_movements (stock_id, type, quantity, reason, performed_by)
        values (mv.stock_id, 'in', mv.quantity, p_reason || ': ' || coalesce(jnum,''), p_user);
      elsif mv.type = 'in' then
        update public.stock set current_qty = greatest(0, current_qty - mv.quantity) where id = mv.stock_id;
        insert into public.stock_movements (stock_id, type, quantity, reason, performed_by)
        values (mv.stock_id, 'out', mv.quantity, p_reason || ': ' || coalesce(jnum,''), p_user);
      end if;
    end if;
    delete from public.stock_movements where id = mv.id;
  end loop;
end $$;

-- Create a job (optionally creating the customer), deducting any materials.
create or replace function public.create_job(
  p_customer_id   uuid,
  p_customer_name text,
  p_customer_phone text,
  p_description   text,
  p_quantity      numeric,
  p_condition     job_condition,
  p_intake_notes  text,
  p_date_received text,
  p_priority      job_priority,
  p_materials     jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; cid uuid; next_num int; jnum text; new_id uuid; now_iso text;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;

  if p_customer_id is not null then
    cid := p_customer_id;
  else
    insert into public.customers (name, phone, created_by)
    values (p_customer_name, p_customer_phone, me) returning id into cid;
  end if;

  select coalesce(max(nullif(regexp_replace(job_number,'\D','','g'),'')::int),0)+1
    into next_num from public.jobs;
  jnum := 'JB' || lpad(next_num::text, 4, '0');
  now_iso := to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  insert into public.jobs (job_number, customer_id, description, quantity, condition,
    intake_notes, date_received, priority, status, status_history, materials, created_by)
  values (jnum, cid, p_description, p_quantity, p_condition, p_intake_notes, p_date_received,
    p_priority, 'received',
    jsonb_build_array(jsonb_build_object('status','received','timestamp',now_iso)),
    p_materials, me)
  returning id into new_id;

  if p_materials is not null and jsonb_array_length(p_materials) > 0 then
    perform public._apply_material_deductions(new_id, p_materials, me, 'Job materials');
  end if;
  return new_id;
end $$;

-- Update editable job fields; if materials changed, reverse + re-apply stock.
create or replace function public.update_job(
  p_id uuid, p_description text, p_quantity numeric, p_condition job_condition,
  p_intake_notes text, p_priority job_priority, p_materials jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid; old_materials jsonb; changed boolean;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  select materials into old_materials from public.jobs where id = p_id;
  if not found then raise exception 'Job not found'; end if;

  changed := coalesce(old_materials, '[]'::jsonb) is distinct from coalesce(p_materials, '[]'::jsonb);
  if changed then
    perform public._reverse_job_stock_movements(p_id, me, 'Job materials updated');
    if p_materials is not null and jsonb_array_length(p_materials) > 0 then
      perform public._apply_material_deductions(p_id, p_materials, me, 'Job materials');
    end if;
  end if;

  update public.jobs set description=p_description, quantity=p_quantity, condition=p_condition,
    intake_notes=p_intake_notes, priority=p_priority, materials=p_materials
  where id = p_id;
end $$;

-- Advance a job to the next pipeline status (received->...->collected, except 'done').
create or replace function public.advance_job(p_id uuid)
returns job_status language plpgsql security definer set search_path = public as $$
declare cur job_status; nxt job_status; now_iso text;
  order_arr job_status[] := array['received','workshop','relining','qc','done','collected'];
  idx int;
begin
  if current_app_user_id() is null then raise exception 'User not logged in'; end if;
  select status into cur from public.jobs where id = p_id;
  if not found then raise exception 'Job not found'; end if;
  if cur = 'done' then raise exception 'Use the collection flow to mark this job as collected'; end if;
  idx := array_position(order_arr, cur);
  if idx is null or idx >= array_length(order_arr,1) then raise exception 'Job cannot be advanced further'; end if;
  nxt := order_arr[idx+1];
  now_iso := to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.jobs set status = nxt,
    status_history = status_history || jsonb_build_object('status',nxt::text,'timestamp',now_iso)
  where id = p_id;
  return nxt;
end $$;

create or replace function public.mark_job_done(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cur job_status; now_iso text;
begin
  if current_app_user_id() is null then raise exception 'User not logged in'; end if;
  select status into cur from public.jobs where id = p_id;
  if not found then raise exception 'Job not found'; end if;
  if cur = 'done' then raise exception 'Job is already marked as done'; end if;
  if cur = 'collected' then raise exception 'Cannot change status of a collected job'; end if;
  now_iso := to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.jobs set status='done',
    status_history = status_history || jsonb_build_object('status','done','timestamp',now_iso)
  where id = p_id;
end $$;

create or replace function public.undo_mark_done(p_id uuid)
returns job_status language plpgsql security definer set search_path = public as $$
declare cur job_status; hist jsonb; prev text; now_iso text; n int;
begin
  if current_app_user_id() is null then raise exception 'User not logged in'; end if;
  select status, status_history into cur, hist from public.jobs where id = p_id;
  if not found then raise exception 'Job not found'; end if;
  if cur <> 'done' then raise exception 'Job is not in Done status'; end if;
  n := jsonb_array_length(hist);                       -- entry before the last ("done")
  prev := coalesce(hist->(n-2)->>'status', 'received');
  now_iso := to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.jobs set status = prev::job_status,
    status_history = status_history || jsonb_build_object('status',prev,'timestamp',now_iso)
  where id = p_id;
  return prev::job_status;
end $$;

-- Mark a 'done' job collected, reconciling materials if a new list is supplied.
create or replace function public.collect_job(
  p_id uuid, p_collection_date text, p_collected_by text, p_what_delivered text,
  p_condition delivery_condition, p_notes text default null, p_materials jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid; cur job_status; old_materials jsonb; changed boolean; now_iso text;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  select status, materials into cur, old_materials from public.jobs where id = p_id;
  if not found then raise exception 'Job not found'; end if;
  if cur <> 'done' then raise exception 'Only jobs with Done status can be collected'; end if;

  if p_materials is not null then
    changed := coalesce(old_materials,'[]'::jsonb) is distinct from p_materials;
    if changed then
      perform public._reverse_job_stock_movements(p_id, me, 'Collection materials updated');
      if jsonb_array_length(p_materials) > 0 then
        perform public._apply_material_deductions(p_id, p_materials, me, 'Job materials');
      end if;
      update public.jobs set materials = p_materials where id = p_id;
    end if;
  end if;

  now_iso := to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.jobs set status='collected',
    status_history = status_history || jsonb_build_object('status','collected','timestamp',now_iso),
    delivery_record = jsonb_build_object(
      'collectionDate', p_collection_date, 'collectedBy', p_collected_by,
      'whatDelivered', p_what_delivered, 'condition', p_condition::text, 'notes', p_notes)
  where id = p_id;
end $$;

-- Delete a job (admin only), restoring all stock it consumed.
create or replace function public.delete_job(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  if current_app_role() <> 'admin' then raise exception 'Only admins can delete jobs'; end if;
  if not exists (select 1 from public.jobs where id = p_id) then raise exception 'Job not found'; end if;
  perform public._reverse_job_stock_movements(p_id, me, 'Job deleted');
  delete from public.jobs where id = p_id;
end $$;

-- Create a stock item, logging the opening balance as an "in" movement.
create or replace function public.create_stock(
  p_name text, p_category stock_category, p_unit text, p_current_qty numeric,
  p_min_threshold numeric, p_supplier text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; sid uuid;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  insert into public.stock (name, category, unit, current_qty, min_threshold, supplier, notes, created_by)
  values (p_name, p_category, p_unit, p_current_qty, p_min_threshold, p_supplier, p_notes, me)
  returning id into sid;
  if p_current_qty > 0 then
    insert into public.stock_movements (stock_id, type, quantity, reason, performed_by)
    values (sid, 'in', p_current_qty, 'Initial stock entry', me);
  end if;
  return sid;
end $$;

-- Manual stock adjustment (in / out / set-absolute), logged as a movement.
create or replace function public.adjust_stock(
  p_id uuid, p_type movement_type, p_quantity numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid; item public.stock%rowtype; new_qty numeric;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  select * into item from public.stock where id = p_id;
  if not found then raise exception 'Stock item not found'; end if;
  if p_type = 'in' then
    new_qty := item.current_qty + p_quantity;
  elsif p_type = 'out' then
    new_qty := item.current_qty - p_quantity;
    if new_qty < 0 then
      raise exception 'Cannot remove % %. Only % in stock.', p_quantity, item.unit, item.current_qty;
    end if;
  else
    new_qty := p_quantity;  -- adjustment = absolute set
  end if;
  update public.stock set current_qty = new_qty where id = p_id;
  insert into public.stock_movements (stock_id, type, quantity, reason, performed_by)
  values (p_id, p_type, p_quantity, p_reason, me);
end $$;

create or replace function public.delete_stock(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_app_user_id() is null then raise exception 'User not logged in'; end if;
  if current_app_role() <> 'admin' then raise exception 'Only admins can delete stock items'; end if;
  delete from public.stock where id = p_id;  -- movements cascade
end $$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Everyone signed-in can read & write day-to-day data; only admins delete.
-- The functions above are SECURITY DEFINER and do their own role checks.
-- =============================================================================
alter table public.app_users       enable row level security;
alter table public.staff           enable row level security;
alter table public.customers       enable row level security;
alter table public.stock           enable row level security;
alter table public.jobs            enable row level security;
alter table public.stock_movements enable row level security;
alter table public.job_notes       enable row level security;

-- app_users: anyone signed-in can read; only admins manage.
create policy app_users_select on public.app_users for select to authenticated using (true);
create policy app_users_admin_ins on public.app_users for insert to authenticated
  with check (current_app_role() = 'admin');
create policy app_users_admin_upd on public.app_users for update to authenticated
  using (current_app_role() = 'admin') with check (current_app_role() = 'admin');
create policy app_users_admin_del on public.app_users for delete to authenticated
  using (current_app_role() = 'admin');

-- Generic helper: signed-in linked user.
-- (Re-used as a predicate below.)

do $$
declare t text;
begin
  foreach t in array array['staff','customers','stock','jobs','stock_movements','job_notes']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$s for select to authenticated using (true);
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check (current_app_user_id() is not null);
      create policy %1$s_update on public.%1$s for update to authenticated
        using (current_app_user_id() is not null)
        with check (current_app_user_id() is not null);
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using (current_app_role() = 'admin');
    $f$, t);
  end loop;
end $$;

-- Done. Now run 02_data.sql to load your snapshot.
