-- =============================================================================
-- HERCULES -> SUPABASE  |  03_multitenant.sql
-- Turns the single-workshop app into a multi-tenant SaaS: many isolated
-- workshops on one deployment. Run AFTER 01_schema.sql and 02_data.sql.
--
-- Model: each app_user belongs to ONE organization (app_users.org_id). Role
-- (admin/manager) is per organization. Every data row carries org_id and is
-- fenced off by RLS so a workshop can only ever see its own data. Your existing
-- snapshot is assigned to a first organization.
-- =============================================================================

-- ---------- organizations ----------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- which org the caller belongs to (security definer -> no RLS recursion)
create or replace function public.current_org_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin return (select org_id from public.app_users where auth_id = auth.uid()); end $$;

-- ---------- add org_id to every table ----------
alter table public.app_users       add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.staff           add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.customers       add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.stock           add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.jobs            add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.stock_movements add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.job_notes       add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- =============================================================================
-- BACKFILL: put all existing data into one founding organization.
-- Rename it later in the app (Settings) or here.
-- =============================================================================
do $$
declare default_org uuid;
begin
  if not exists (select 1 from public.organizations) then
    insert into public.organizations (name) values ('Nanak Mechanical Engineers')
      returning id into default_org;
  else
    select id into default_org from public.organizations order by created_at limit 1;
  end if;

  update public.app_users       set org_id = default_org where org_id is null;
  update public.staff           set org_id = default_org where org_id is null;
  update public.customers       set org_id = default_org where org_id is null;
  update public.stock           set org_id = default_org where org_id is null;
  update public.jobs            set org_id = default_org where org_id is null;
  update public.stock_movements set org_id = default_org where org_id is null;
  update public.job_notes       set org_id = default_org where org_id is null;
end $$;

-- now make org_id mandatory and auto-stamped on new rows
alter table public.staff           alter column org_id set not null, alter column org_id set default public.current_org_id();
alter table public.customers       alter column org_id set not null, alter column org_id set default public.current_org_id();
alter table public.stock           alter column org_id set not null, alter column org_id set default public.current_org_id();
alter table public.jobs            alter column org_id set not null, alter column org_id set default public.current_org_id();
alter table public.stock_movements alter column org_id set not null, alter column org_id set default public.current_org_id();
alter table public.job_notes       alter column org_id set not null, alter column org_id set default public.current_org_id();
-- app_users.org_id stays nullable: a brand-new signup has no org for the split
-- second before the trigger assigns one.

-- helpful indexes
create index if not exists app_users_org_idx       on public.app_users (org_id);
create index if not exists staff_org_idx           on public.staff (org_id);
create index if not exists customers_org_idx        on public.customers (org_id);
create index if not exists stock_org_idx            on public.stock (org_id);
create index if not exists jobs_org_idx             on public.jobs (org_id);
create index if not exists stock_movements_org_idx  on public.stock_movements (org_id);
-- job numbers are now unique PER organization, not globally
alter table public.jobs drop constraint if exists jobs_job_number_key;
create unique index if not exists jobs_org_jobnumber_uniq on public.jobs (org_id, job_number);

-- =============================================================================
-- SIGNUP / INVITE: create or claim an org on first login
-- =============================================================================
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare existing public.app_users%rowtype; new_org uuid;
begin
  -- 1) Invited or returning user: match by email, keep their org + role.
  select * into existing from public.app_users where lower(email) = lower(new.email) limit 1;
  if found then
    update public.app_users
       set auth_id = new.id, is_active = true, status = 'active',
           name   = coalesce(nullif(new.raw_user_meta_data->>'full_name',''), name),
           avatar = coalesce(new.raw_user_meta_data->>'avatar_url', avatar)
     where id = existing.id;
    return new;
  end if;

  -- 2) Brand-new self-signup: spin up a fresh workshop, make them its admin.
  insert into public.organizations (name)
  values (coalesce(nullif(new.raw_user_meta_data->>'workshop_name',''),
                   coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)) || '''s Workshop'))
  returning id into new_org;

  insert into public.app_users (auth_id, org_id, name, email, avatar, role, is_active, status)
  values (new.id, new_org, new.raw_user_meta_data->>'full_name', new.email,
          new.raw_user_meta_data->>'avatar_url', 'admin', true, 'active');
  return new;
end $$;

-- =============================================================================
-- RLS: re-scope every table to the caller's organization
-- =============================================================================

-- organizations: you can see and rename only your own org.
drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_update on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (id = current_org_id());
create policy organizations_update on public.organizations for update to authenticated
  using (id = current_org_id() and current_app_role() = 'admin')
  with check (id = current_org_id() and current_app_role() = 'admin');
-- inserts happen via the signup trigger (security definer), so no insert policy.

-- app_users: see only teammates in your org; admins manage within the org.
drop policy if exists app_users_select    on public.app_users;
drop policy if exists app_users_admin_ins on public.app_users;
drop policy if exists app_users_admin_upd on public.app_users;
drop policy if exists app_users_admin_del on public.app_users;
create policy app_users_select on public.app_users for select to authenticated
  using (org_id = current_org_id() or auth_id = auth.uid());
create policy app_users_admin_ins on public.app_users for insert to authenticated
  with check (current_app_role() = 'admin' and org_id = current_org_id());
create policy app_users_admin_upd on public.app_users for update to authenticated
  using (current_app_role() = 'admin' and org_id = current_org_id())
  with check (current_app_role() = 'admin' and org_id = current_org_id());
create policy app_users_admin_del on public.app_users for delete to authenticated
  using (current_app_role() = 'admin' and org_id = current_org_id());

-- the six data tables: read/write only within your org; admin-only delete.
do $$
declare t text;
begin
  foreach t in array array['staff','customers','stock','jobs','stock_movements','job_notes']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);
    execute format($f$
      create policy %1$s_select on public.%1$s for select to authenticated
        using (org_id = current_org_id());
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check (org_id = current_org_id() and current_app_user_id() is not null);
      create policy %1$s_update on public.%1$s for update to authenticated
        using (org_id = current_org_id())
        with check (org_id = current_org_id());
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using (org_id = current_org_id() and current_app_role() = 'admin');
    $f$, t);
  end loop;
end $$;

-- =============================================================================
-- FUNCTIONS: add org guards + per-org job numbering
-- (SECURITY DEFINER bypasses RLS, so each function must fence itself to the
--  caller's org. org_id on inserts is auto-stamped by the column defaults.)
-- =============================================================================

create or replace function public.create_job(
  p_customer_id uuid, p_customer_name text, p_customer_phone text,
  p_description text, p_quantity numeric, p_condition job_condition,
  p_intake_notes text, p_date_received text, p_priority job_priority,
  p_materials jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; org uuid; cid uuid; next_num int; jnum text; new_id uuid; now_iso text;
begin
  me := current_app_user_id(); org := current_org_id();
  if me is null or org is null then raise exception 'User not logged in'; end if;

  if p_customer_id is not null then
    -- ensure the customer belongs to the caller's org
    select id into cid from public.customers where id = p_customer_id and org_id = org;
    if cid is null then raise exception 'Customer not found in your workshop'; end if;
  else
    insert into public.customers (name, phone) values (p_customer_name, p_customer_phone)
      returning id into cid;  -- org_id auto-stamped
  end if;

  select coalesce(max(nullif(regexp_replace(job_number,'\D','','g'),'')::int),0)+1
    into next_num from public.jobs where org_id = org;          -- per-org numbering
  jnum := 'JB' || lpad(next_num::text, 4, '0');
  now_iso := to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  insert into public.jobs (job_number, customer_id, description, quantity, condition,
    intake_notes, date_received, priority, status, status_history, materials)
  values (jnum, cid, p_description, p_quantity, p_condition, p_intake_notes, p_date_received,
    p_priority, 'received',
    jsonb_build_array(jsonb_build_object('status','received','timestamp',now_iso)),
    p_materials)
  returning id into new_id;  -- org_id + created_by auto-stamped

  if p_materials is not null and jsonb_array_length(p_materials) > 0 then
    perform public._apply_material_deductions(new_id, p_materials, me, 'Job materials');
  end if;
  return new_id;
end $$;

-- guard helper used by the rest: raises unless the job is in the caller's org
create or replace function public._assert_job_in_org(p_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.jobs where id = p_id and org_id = current_org_id()) then
    raise exception 'Job not found';
  end if;
end $$;

create or replace function public._assert_stock_in_org(p_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.stock where id = p_id and org_id = current_org_id()) then
    raise exception 'Stock item not found';
  end if;
end $$;

-- Re-point the material helpers to stamp org on the movements they create.
create or replace function public._apply_material_deductions(
  p_job_id uuid, p_materials jsonb, p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m jsonb; sid uuid; qty numeric; item public.stock%rowtype; jnum text; org uuid;
begin
  if p_materials is null then return; end if;
  select job_number, org_id into jnum, org from public.jobs where id = p_job_id;
  for m in select * from jsonb_array_elements(p_materials) loop
    sid := (m->>'stockId')::uuid; qty := (m->>'quantity')::numeric;
    if qty is null or qty <= 0 then continue; end if;
    select * into item from public.stock where id = sid and org_id = org;
    if not found then raise exception 'Stock item not found for material deduction'; end if;
    if item.current_qty - qty < 0 then
      raise exception 'Insufficient stock for "%". Available: % %, required: %',
        item.name, item.current_qty, item.unit, qty;
    end if;
    update public.stock set current_qty = current_qty - qty where id = sid;
    insert into public.stock_movements (org_id, stock_id, type, quantity, reason, performed_by, job_id)
    values (org, sid, 'out', qty, p_reason || ': ' || coalesce(jnum,''), p_user, p_job_id);
  end loop;
end $$;

create or replace function public._reverse_job_stock_movements(
  p_job_id uuid, p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare mv public.stock_movements%rowtype; jnum text; org uuid;
begin
  select job_number, org_id into jnum, org from public.jobs where id = p_job_id;
  for mv in select * from public.stock_movements where job_id = p_job_id loop
    if exists (select 1 from public.stock where id = mv.stock_id) then
      if mv.type = 'out' then
        update public.stock set current_qty = current_qty + mv.quantity where id = mv.stock_id;
        insert into public.stock_movements (org_id, stock_id, type, quantity, reason, performed_by)
        values (org, mv.stock_id, 'in', mv.quantity, p_reason || ': ' || coalesce(jnum,''), p_user);
      elsif mv.type = 'in' then
        update public.stock set current_qty = greatest(0, current_qty - mv.quantity) where id = mv.stock_id;
        insert into public.stock_movements (org_id, stock_id, type, quantity, reason, performed_by)
        values (org, mv.stock_id, 'out', mv.quantity, p_reason || ': ' || coalesce(jnum,''), p_user);
      end if;
    end if;
    delete from public.stock_movements where id = mv.id;
  end loop;
end $$;

-- Add org guards to the remaining job functions (bodies otherwise unchanged).
create or replace function public.update_job(
  p_id uuid, p_description text, p_quantity numeric, p_condition job_condition,
  p_intake_notes text, p_priority job_priority, p_materials jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid; old_materials jsonb; changed boolean;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  perform public._assert_job_in_org(p_id);
  select materials into old_materials from public.jobs where id = p_id;
  changed := coalesce(old_materials,'[]'::jsonb) is distinct from coalesce(p_materials,'[]'::jsonb);
  if changed then
    perform public._reverse_job_stock_movements(p_id, me, 'Job materials updated');
    if p_materials is not null and jsonb_array_length(p_materials) > 0 then
      perform public._apply_material_deductions(p_id, p_materials, me, 'Job materials');
    end if;
  end if;
  update public.jobs set description=p_description, quantity=p_quantity, condition=p_condition,
    intake_notes=p_intake_notes, priority=p_priority, materials=p_materials where id = p_id;
end $$;

create or replace function public.advance_job(p_id uuid)
returns job_status language plpgsql security definer set search_path = public as $$
declare cur job_status; nxt job_status; now_iso text;
  order_arr job_status[] := array['received','workshop','relining','qc','done','collected']; idx int;
begin
  if current_app_user_id() is null then raise exception 'User not logged in'; end if;
  perform public._assert_job_in_org(p_id);
  select status into cur from public.jobs where id = p_id;
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
  perform public._assert_job_in_org(p_id);
  select status into cur from public.jobs where id = p_id;
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
  perform public._assert_job_in_org(p_id);
  select status, status_history into cur, hist from public.jobs where id = p_id;
  if cur <> 'done' then raise exception 'Job is not in Done status'; end if;
  n := jsonb_array_length(hist);
  prev := coalesce(hist->(n-2)->>'status','received');
  now_iso := to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.jobs set status = prev::job_status,
    status_history = status_history || jsonb_build_object('status',prev,'timestamp',now_iso)
  where id = p_id;
  return prev::job_status;
end $$;

create or replace function public.collect_job(
  p_id uuid, p_collection_date text, p_collected_by text, p_what_delivered text,
  p_condition delivery_condition, p_notes text default null, p_materials jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid; cur job_status; old_materials jsonb; changed boolean; now_iso text;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  perform public._assert_job_in_org(p_id);
  select status, materials into cur, old_materials from public.jobs where id = p_id;
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
    delivery_record = jsonb_build_object('collectionDate',p_collection_date,'collectedBy',p_collected_by,
      'whatDelivered',p_what_delivered,'condition',p_condition::text,'notes',p_notes)
  where id = p_id;
end $$;

create or replace function public.delete_job(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  me := current_app_user_id();
  if me is null then raise exception 'User not logged in'; end if;
  if current_app_role() <> 'admin' then raise exception 'Only admins can delete jobs'; end if;
  perform public._assert_job_in_org(p_id);
  perform public._reverse_job_stock_movements(p_id, me, 'Job deleted');
  delete from public.jobs where id = p_id;
end $$;

create or replace function public.adjust_stock(
  p_id uuid, p_type movement_type, p_quantity numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid; org uuid; item public.stock%rowtype; new_qty numeric;
begin
  me := current_app_user_id(); org := current_org_id();
  if me is null then raise exception 'User not logged in'; end if;
  select * into item from public.stock where id = p_id and org_id = org;
  if not found then raise exception 'Stock item not found'; end if;
  if p_type = 'in' then new_qty := item.current_qty + p_quantity;
  elsif p_type = 'out' then
    new_qty := item.current_qty - p_quantity;
    if new_qty < 0 then raise exception 'Cannot remove % %. Only % in stock.', p_quantity, item.unit, item.current_qty; end if;
  else new_qty := p_quantity; end if;
  update public.stock set current_qty = new_qty where id = p_id;
  insert into public.stock_movements (org_id, stock_id, type, quantity, reason, performed_by)
  values (org, p_id, p_type, p_quantity, p_reason, me);
end $$;

create or replace function public.delete_stock(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_app_user_id() is null then raise exception 'User not logged in'; end if;
  if current_app_role() <> 'admin' then raise exception 'Only admins can delete stock items'; end if;
  perform public._assert_stock_in_org(p_id);
  delete from public.stock where id = p_id;
end $$;

-- create_stock auto-stamps org via the column default; just keep the user check.
-- (No body change needed beyond what 01_schema.sql defined.)

-- Done. Your existing data now lives in one organization; every new signup
-- starts its own isolated workshop.
