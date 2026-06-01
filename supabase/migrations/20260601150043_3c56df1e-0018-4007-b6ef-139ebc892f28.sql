
-- ============================================================
-- NEURO FINANZAS - Fase 1 schema
-- ============================================================

-- ---------- ENUMS ----------
create type public.workspace_role as enum ('owner','admin','member');
create type public.txn_type as enum ('ingreso','egreso');
create type public.txn_currency as enum ('COP','USD');
create type public.txn_account as enum ('bancolombia','stripe','chase','efectivo','otra');
create type public.txn_source as enum ('manual','telegram','stripe','ai_chat');
create type public.fixed_cost_category as enum ('payroll','platform','other');

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- ---------- WORKSPACES ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  usd_cop_rate numeric(10,2) not null default 4000,
  telegram_group_id text,
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.workspace_members enable row level security;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspace_members to service_role;

-- security definer helpers (avoid recursive RLS)
create or replace function public.is_workspace_member(_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = auth.uid()
  )
$$;

create or replace function public.has_workspace_role(_workspace_id uuid, _role public.workspace_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = auth.uid() and role = _role
  )
$$;

create policy "workspaces_select_member" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "workspaces_insert_self" on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());
create policy "workspaces_update_owner" on public.workspaces
  for update to authenticated using (owner_id = auth.uid());
create policy "workspaces_delete_owner" on public.workspaces
  for delete to authenticated using (owner_id = auth.uid());

create policy "members_select_same_ws" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members_insert_owner" on public.workspace_members
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
    or user_id = auth.uid()
  );
create policy "members_delete_owner" on public.workspace_members
  for delete to authenticated using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- ---------- INVITATIONS ----------
create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  role public.workspace_role not null default 'member',
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.workspace_invitations enable row level security;
grant select, insert, update, delete on public.workspace_invitations to authenticated;
grant all on public.workspace_invitations to service_role;

create policy "inv_select_ws_admin" on public.workspace_invitations
  for select to authenticated using (
    public.has_workspace_role(workspace_id,'owner')
    or public.has_workspace_role(workspace_id,'admin')
  );
create policy "inv_insert_ws_admin" on public.workspace_invitations
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id,'owner')
    or public.has_workspace_role(workspace_id,'admin')
  );
create policy "inv_delete_ws_admin" on public.workspace_invitations
  for delete to authenticated using (
    public.has_workspace_role(workspace_id,'owner')
    or public.has_workspace_role(workspace_id,'admin')
  );

-- ---------- CATEGORIES ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  type public.txn_type not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, code)
);
alter table public.categories enable row level security;
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;

create policy "cat_select_member" on public.categories
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "cat_modify_admin" on public.categories
  for all to authenticated
  using (public.has_workspace_role(workspace_id,'owner') or public.has_workspace_role(workspace_id,'admin'))
  with check (public.has_workspace_role(workspace_id,'owner') or public.has_workspace_role(workspace_id,'admin'));

-- ---------- CLIENTS ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.clients enable row level security;
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

create policy "cli_all_member" on public.clients
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ---------- FIXED COSTS ----------
create table public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null default 0,
  currency public.txn_currency not null default 'COP',
  category public.fixed_cost_category not null default 'other',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fixed_costs enable row level security;
grant select, insert, update, delete on public.fixed_costs to authenticated;
grant all on public.fixed_costs to service_role;

create policy "fc_all_member" on public.fixed_costs
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ---------- TRANSACTIONS ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date date not null default current_date,
  concept text not null,
  type public.txn_type not null,
  amount numeric(14,2) not null,
  currency public.txn_currency not null default 'COP',
  category_id uuid references public.categories(id) on delete set null,
  account public.txn_account not null default 'bancolombia',
  source public.txn_source not null default 'manual',
  client_id uuid references public.clients(id) on delete set null,
  notes text,
  attachment_url text,
  paired_transaction_id uuid references public.transactions(id) on delete set null,
  telegram_message_id bigint,
  is_pending boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_txn_ws_date on public.transactions(workspace_id, date desc);
create index idx_txn_telegram on public.transactions(telegram_message_id) where telegram_message_id is not null;
alter table public.transactions enable row level security;
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;

create policy "txn_all_member" on public.transactions
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ---------- TRIGGER: nuevo usuario ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  _ws_id uuid;
begin
  -- profile
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  -- workspace personal
  insert into public.workspaces (name, owner_id, telegram_group_id)
  values (coalesce(new.raw_user_meta_data->>'workspace_name','Mi espacio'), new.id, '5187124619')
  returning id into _ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (_ws_id, new.id, 'owner');

  -- categorías sistema
  insert into public.categories (workspace_id, code, name, type, is_system) values
    (_ws_id,'00001','Ventas / Servicios','ingreso',true),
    (_ws_id,'00002','Otros ingresos','ingreso',true),
    (_ws_id,'00003','Nómina','egreso',true),
    (_ws_id,'00004','Plataformas','egreso',true),
    (_ws_id,'00005','Publicidad','egreso',true),
    (_ws_id,'00006','Honorarios','egreso',true),
    (_ws_id,'00007','Servicios públicos','egreso',true),
    (_ws_id,'00008','Arriendo','egreso',true),
    (_ws_id,'00009','Suministros','egreso',true),
    (_ws_id,'00010','Impuestos','egreso',true),
    (_ws_id,'00011','Transferencia USD↔COP','egreso',true),
    (_ws_id,'00012','Comisiones bancarias','egreso',true),
    (_ws_id,'00013','Otros gastos','egreso',true);

  -- clientes seed
  insert into public.clients (workspace_id, name) values
    (_ws_id,'IaChat'),(_ws_id,'Sospinagu'),(_ws_id,'Juanchi'),
    (_ws_id,'Merecu'),(_ws_id,'Santiago Ospina'),(_ws_id,'Panadería San Juan'),(_ws_id,'Ecofly');

  -- costos fijos seed
  insert into public.fixed_costs (workspace_id, name, amount, currency, category, sort_order) values
    (_ws_id,'Nómina Yef y Jhon',0,'COP','payroll',1),
    (_ws_id,'Claude',76000,'COP','platform',2),
    (_ws_id,'ChatGPT',76000,'COP','platform',3),
    (_ws_id,'Funnelish',295000,'COP','platform',4),
    (_ws_id,'ManyChat',150000,'COP','platform',5),
    (_ws_id,'ChatRace',499,'USD','platform',6),
    (_ws_id,'Google',50000,'COP','platform',7);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_txn_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger trg_fc_updated_at before update on public.fixed_costs
  for each row execute function public.set_updated_at();
