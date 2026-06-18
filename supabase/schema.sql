-- Novadex Tid & Löner - Supabase Free starter schema
-- Kör hela filen i Supabase SQL Editor.
-- Efter detta: skapa första adminprofilen manuellt efter att du har loggat in första gången.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'owner', 'employee', 'customer');
create type public.approval_status as enum ('draft', 'submitted', 'approved', 'rejected', 'invoiced');
create type public.portal_status as enum ('open', 'waiting', 'submitted', 'done', 'rejected');
create type public.invoice_status as enum ('created', 'sent', 'customerApproved', 'changeRequested', 'paid', 'overdue', 'credited', 'reopened');
create type public.agreement_status as enum ('draft', 'sent', 'signed', 'archived', 'expired');
create type public.esign_status as enum ('draft', 'sent', 'signed', 'expired');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_number text,
  admin_email text,
  default_rate numeric not null default 950,
  invoice_prefix text not null default 'F',
  next_invoice_number integer not null default 1,
  payment_terms integer not null default 10,
  vat_rate numeric not null default 25,
  bankgiro text,
  invoice_footer text default 'Tack för förtroendet.',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid,
  full_name text not null,
  email text not null,
  role public.app_role not null default 'employee',
  title text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  requested_role public.app_role not null default 'employee',
  company text,
  note text,
  status text not null default 'pending',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  org_number text,
  email text,
  billing_email text,
  invoice_reference text,
  invoice_address text,
  owner_name text,
  payment_terms integer,
  vat_rate numeric,
  owner_profile_id uuid references public.profiles(id),
  rate numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  manager_profile_id uuid references public.profiles(id),
  status text not null default 'active',
  starts_on date,
  budget_hours numeric not null default 0,
  fixed_price numeric not null default 0,
  invoice_status text not null default 'preliminary',
  description text,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  employee_profile_id uuid references public.profiles(id) on delete set null,
  entry_date date not null,
  entry_type text not null default 'project',
  work_order text,
  task text not null,
  hours numeric not null check (hours >= 0),
  billable boolean not null default true,
  payroll boolean not null default true,
  status public.approval_status not null default 'draft',
  review_note text,
  description text,
  created_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  portal_task_id uuid,
  receipt_date date not null,
  supplier text not null,
  amount numeric not null default 0,
  vat numeric not null default 0,
  billable boolean not null default true,
  payroll boolean not null default false,
  status public.approval_status not null default 'draft',
  review_note text,
  file_path text,
  file_name text,
  file_type text,
  created_at timestamptz not null default now()
);

create table public.travels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  travel_date date not null,
  travel_type text not null default 'mileage',
  from_place text,
  to_place text,
  quantity numeric not null default 0,
  billable boolean not null default true,
  payroll boolean not null default true,
  status public.approval_status not null default 'draft',
  review_note text,
  created_at timestamptz not null default now()
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  number integer not null default 1,
  title text not null,
  agreement_type text not null default 'Kundavtal',
  client_email text,
  watch_date date,
  end_date date,
  owner_profile_id uuid references public.profiles(id),
  label text,
  permission text,
  scope text,
  price text,
  payment text,
  message text,
  status public.agreement_status not null default 'draft',
  sent_at timestamptz,
  signed_at timestamptz,
  archived_at timestamptz,
  document_path text,
  created_at timestamptz not null default now()
);

create table public.esignatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  agreement_id uuid references public.agreements(id) on delete set null,
  number integer not null default 1000,
  title text not null,
  document_type text not null default 'Avtal',
  owner_profile_id uuid references public.profiles(id),
  reminder_date date,
  due_date date,
  message text,
  status public.esign_status not null default 'draft',
  sent_at timestamptz,
  reminder_sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  number text not null,
  created_on date not null default current_date,
  due_on date,
  payment_terms integer not null default 10,
  vat_rate numeric not null default 25,
  total numeric not null default 0,
  vat numeric not null default 0,
  total_incl_vat numeric not null default 0,
  billing_email text,
  invoice_reference text,
  invoice_address text,
  bankgiro text,
  status public.invoice_status not null default 'created',
  entry_ids uuid[] not null default '{}',
  receipt_ids uuid[] not null default '{}',
  travel_ids uuid[] not null default '{}',
  document_html text,
  sent_at timestamptz,
  customer_approved_at timestamptz,
  change_requested_at timestamptz,
  change_request_message text,
  paid_at timestamptz,
  credited_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.portal_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  task_type text not null default 'Underlag',
  status public.portal_status not null default 'waiting',
  owner_profile_id uuid references public.profiles(id),
  due_date date,
  message text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.receipts
  add constraint receipts_portal_task_id_fkey foreign key (portal_task_id) references public.portal_tasks(id) on delete set null;

create table public.portal_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portal_task_id uuid not null references public.portal_tasks(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.portal_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portal_task_id uuid not null references public.portal_tasks(id) on delete cascade,
  receipt_id uuid references public.receipts(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_path text,
  file_name text,
  amount numeric default 0,
  created_at timestamptz not null default now()
);

create index clients_org_idx on public.clients(organization_id);
create index projects_client_idx on public.projects(client_id);
create index time_entries_client_idx on public.time_entries(client_id);
create index receipts_client_idx on public.receipts(client_id);
create index invoices_client_idx on public.invoices(client_id);
create index portal_tasks_client_idx on public.portal_tasks(client_id);
create index profiles_org_role_idx on public.profiles(organization_id, role);

create or replace function public.current_profile()
returns public.profiles
language sql
security definer
stable
set search_path = public
as $$
  select *
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('admin', 'owner')
  )
$$;

create or replace function public.can_access_client(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.clients c on c.id = target_client_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.organization_id = c.organization_id
      and (
        p.role = 'admin'
        or (p.role = 'owner' and c.owner_profile_id = p.id)
        or (p.role = 'customer' and p.client_id = target_client_id)
        or (p.role = 'employee' and exists (
          select 1
          from public.time_entries te
          where te.client_id = target_client_id
            and te.employee_profile_id = p.id
        ))
      )
  )
$$;

create or replace function public.approve_account_request(target_request_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_row public.account_requests;
  target_user_id uuid;
  admin_org_id uuid;
  activated_profile public.profiles;
begin
  if not public.is_admin_or_owner() then
    raise exception 'Only active admins and owners can approve account requests' using errcode = '42501';
  end if;

  admin_org_id := public.current_org_id();

  select *
  into request_row
  from public.account_requests
  where id = target_request_id
    and organization_id = admin_org_id
  for update;

  if not found then
    raise exception 'Account request was not found for this organization' using errcode = 'P0002';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(request_row.email)
  order by created_at desc
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase Auth user exists for %', request_row.email using errcode = 'P0002';
  end if;

  insert into public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role,
    title,
    is_active
  )
  values (
    target_user_id,
    admin_org_id,
    request_row.full_name,
    request_row.email,
    request_row.requested_role,
    case request_row.requested_role
      when 'admin' then 'Admin'
      when 'owner' then 'Kundansvarig'
      when 'customer' then 'Kund'
      else 'Medarbetare'
    end,
    true
  )
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    title = excluded.title,
    is_active = true
  returning * into activated_profile;

  update public.account_requests
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      rejected_at = null,
      organization_id = admin_org_id
  where id = target_request_id;

  return activated_profile;
end;
$$;

create or replace function public.reject_account_request(target_request_id uuid)
returns public.account_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_org_id uuid;
  rejected_request public.account_requests;
begin
  if not public.is_admin_or_owner() then
    raise exception 'Only active admins and owners can reject account requests' using errcode = '42501';
  end if;

  admin_org_id := public.current_org_id();

  update public.account_requests
  set status = 'rejected',
      rejected_at = now(),
      approved_at = null,
      approved_by = null
  where id = target_request_id
    and organization_id = admin_org_id
  returning * into rejected_request;

  if not found then
    raise exception 'Account request was not found for this organization' using errcode = 'P0002';
  end if;

  return rejected_request;
end;
$$;

grant execute on function public.approve_account_request(uuid) to authenticated;
grant execute on function public.reject_account_request(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.account_requests enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.time_entries enable row level security;
alter table public.receipts enable row level security;
alter table public.travels enable row level security;
alter table public.agreements enable row level security;
alter table public.esignatures enable row level security;
alter table public.invoices enable row level security;
alter table public.portal_tasks enable row level security;
alter table public.portal_comments enable row level security;
alter table public.portal_uploads enable row level security;

create policy "profiles_select_own_org" on public.profiles
  for select using (organization_id = public.current_org_id() or id = auth.uid());

create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin_or_owner()) with check (organization_id = public.current_org_id());

create policy "org_select_members" on public.organizations
  for select using (id = public.current_org_id());

create policy "org_admin_update" on public.organizations
  for update using (public.is_admin_or_owner()) with check (id = public.current_org_id());

create policy "account_requests_public_insert" on public.account_requests
  for insert with check (true);

create policy "account_requests_admin_select" on public.account_requests
  for select using (public.is_admin_or_owner() and organization_id = public.current_org_id());

create policy "account_requests_admin_update" on public.account_requests
  for update using (public.is_admin_or_owner()) with check (organization_id = public.current_org_id());

create policy "clients_select_visible" on public.clients
  for select using (public.can_access_client(id));

create policy "clients_admin_owner_write" on public.clients
  for all using (public.is_admin_or_owner() and organization_id = public.current_org_id())
  with check (public.is_admin_or_owner() and organization_id = public.current_org_id());

create policy "projects_select_visible" on public.projects
  for select using (public.can_access_client(client_id));

create policy "projects_admin_owner_write" on public.projects
  for all using (public.is_admin_or_owner() and organization_id = public.current_org_id())
  with check (public.is_admin_or_owner() and organization_id = public.current_org_id());

create policy "time_entries_select_visible" on public.time_entries
  for select using (
    public.can_access_client(client_id)
    or employee_profile_id = auth.uid()
  );

create policy "time_entries_employee_insert" on public.time_entries
  for insert with check (
    organization_id = public.current_org_id()
    and employee_profile_id = auth.uid()
  );

create policy "time_entries_owner_admin_update" on public.time_entries
  for update using (
    public.is_admin_or_owner()
    or employee_profile_id = auth.uid()
  ) with check (organization_id = public.current_org_id());

create policy "receipts_select_visible" on public.receipts
  for select using (public.can_access_client(client_id));

create policy "receipts_write_visible" on public.receipts
  for all using (public.can_access_client(client_id))
  with check (organization_id = public.current_org_id() and public.can_access_client(client_id));

create policy "travels_select_visible" on public.travels
  for select using (public.can_access_client(client_id));

create policy "travels_write_visible" on public.travels
  for all using (public.can_access_client(client_id))
  with check (organization_id = public.current_org_id() and public.can_access_client(client_id));

create policy "agreements_select_visible" on public.agreements
  for select using (public.can_access_client(client_id));

create policy "agreements_admin_owner_write" on public.agreements
  for all using (public.is_admin_or_owner() and organization_id = public.current_org_id())
  with check (public.is_admin_or_owner() and organization_id = public.current_org_id());

create policy "esign_select_visible" on public.esignatures
  for select using (public.can_access_client(client_id));

create policy "esign_admin_owner_write" on public.esignatures
  for all using (public.is_admin_or_owner() and organization_id = public.current_org_id())
  with check (public.is_admin_or_owner() and organization_id = public.current_org_id());

create policy "invoices_select_visible" on public.invoices
  for select using (public.can_access_client(client_id));

create policy "invoices_admin_owner_write" on public.invoices
  for all using (public.is_admin_or_owner() and organization_id = public.current_org_id())
  with check (public.is_admin_or_owner() and organization_id = public.current_org_id());

create policy "invoices_customer_update_status" on public.invoices
  for update using (
    public.can_access_client(client_id)
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'customer'
        and client_id = invoices.client_id
        and is_active = true
    )
  ) with check (
    status in ('customerApproved', 'changeRequested')
  );

create policy "portal_tasks_select_visible" on public.portal_tasks
  for select using (public.can_access_client(client_id));

create policy "portal_tasks_write_visible" on public.portal_tasks
  for all using (public.can_access_client(client_id))
  with check (organization_id = public.current_org_id() and public.can_access_client(client_id));

create policy "portal_comments_select_visible" on public.portal_comments
  for select using (
    exists (
      select 1 from public.portal_tasks pt
      where pt.id = portal_task_id
        and public.can_access_client(pt.client_id)
    )
  );

create policy "portal_comments_insert_visible" on public.portal_comments
  for insert with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.portal_tasks pt
      where pt.id = portal_task_id
        and public.can_access_client(pt.client_id)
    )
  );

create policy "portal_uploads_select_visible" on public.portal_uploads
  for select using (
    exists (
      select 1 from public.portal_tasks pt
      where pt.id = portal_task_id
        and public.can_access_client(pt.client_id)
    )
  );

create policy "portal_uploads_insert_visible" on public.portal_uploads
  for insert with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.portal_tasks pt
      where pt.id = portal_task_id
        and public.can_access_client(pt.client_id)
    )
  );

insert into storage.buckets (id, name, public)
values ('novadex-documents', 'novadex-documents', false)
on conflict (id) do nothing;

create policy "documents_select_own_org" on storage.objects
  for select using (
    bucket_id = 'novadex-documents'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and split_part(name, '/', 1) = p.organization_id::text
    )
  );

create policy "documents_insert_own_org" on storage.objects
  for insert with check (
    bucket_id = 'novadex-documents'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and split_part(name, '/', 1) = p.organization_id::text
    )
  );
