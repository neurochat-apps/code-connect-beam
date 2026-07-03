
-- 1. Add category to existing workspaces
insert into public.categories (workspace_id, code, name, type, is_system)
select id, '00015', 'SALDO MES ANTERIOR', 'ingreso', true from public.workspaces
on conflict do nothing;

-- 2. Update handle_new_user to seed 00015
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _ws_id uuid;
  _has_invite boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  _has_invite := coalesce(nullif(new.raw_user_meta_data->>'pending_invite_token',''), null) is not null;
  if _has_invite then return new; end if;

  insert into public.workspaces (name, owner_id, telegram_group_id)
  values (coalesce(new.raw_user_meta_data->>'workspace_name','Mi espacio'), new.id, '5187124619')
  returning id into _ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (_ws_id, new.id, 'owner');

  insert into public.categories (workspace_id, code, name, type, is_system) values
    (_ws_id,'00001','INGRESOS POR VENTAS','ingreso',true),
    (_ws_id,'00002','INYECCIÓN DE CAPITAL','ingreso',true),
    (_ws_id,'00003','COSTOS OPERATIVOS','egreso',true),
    (_ws_id,'00004','GASTOS OPERATIVOS','egreso',true),
    (_ws_id,'00005','GASTOS ADMINISTRATIVOS','egreso',true),
    (_ws_id,'00006','GASTOS PUBLICIDAD','egreso',true),
    (_ws_id,'00007','PAGO A PROVEEDORES','egreso',true),
    (_ws_id,'00008','NÓMINA YEF Y JHON','egreso',true),
    (_ws_id,'00009','NÓMINA EXTERNA','egreso',true),
    (_ws_id,'00010','PROVISIONES','egreso',true),
    (_ws_id,'00011','TRANSFERENCIA USD→COP','neutro',true),
    (_ws_id,'00012','PRÉSTAMOS RECIBIDOS','ingreso',true),
    (_ws_id,'00013','PAGO DE PRÉSTAMOS','egreso',true),
    (_ws_id,'00014','COMISIONES STRIPE','egreso',true),
    (_ws_id,'00015','SALDO MES ANTERIOR','ingreso',true);

  insert into public.clients (workspace_id, name, type, currency, monthly_amount, status) values
    (_ws_id,'IaChat / NeuroCHAT','recurrente','USD',1200,'activo'),
    (_ws_id,'Sospinagu','recurrente','USD',400,'activo'),
    (_ws_id,'Juanchi','recurrente','USD',850,'activo'),
    (_ws_id,'Merecu','recurrente','COP',1000000,'activo'),
    (_ws_id,'Santiago Ospina','recurrente','COP',1400000,'activo');
  insert into public.clients (workspace_id, name, type, currency, project_total, status) values
    (_ws_id,'Panadería San Juan','cuota','COP',9000000,'activo'),
    (_ws_id,'Ecofly','proyecto','COP',4000000,'activo');

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
$function$;

-- 3. Function to generate monthly carryover for a single workspace and target month
--    target_month = first day of month to insert the carryover into (e.g. 2026-07-01 uses June net)
create or replace function public.generate_monthly_carryover(_workspace_id uuid, _target_month date)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _prev_start date := (_target_month - interval '1 month')::date;
  _prev_end date := _target_month;
  _trm numeric;
  _cat_id uuid;
  _net numeric;
  _tag text;
  _existing uuid;
  _new_id uuid;
begin
  _tag := 'carryover:' || to_char(_target_month, 'YYYY-MM');

  -- dedupe
  select id into _existing from public.transactions
  where workspace_id = _workspace_id and notes like '%' || _tag || '%'
  limit 1;
  if _existing is not null then return _existing; end if;

  select usd_cop_rate into _trm from public.workspaces where id = _workspace_id;
  select id into _cat_id from public.categories
    where workspace_id = _workspace_id and code = '00015' limit 1;

  -- Net: ingresos - egresos of prev month, USD converted at TRM, excluding neutro
  select coalesce(sum(
    case when type = 'ingreso' then (case when currency = 'USD' then amount * _trm else amount end)
         when type = 'egreso' then -1 * (case when currency = 'USD' then amount * _trm else amount end)
         else 0 end
  ), 0) into _net
  from public.transactions
  where workspace_id = _workspace_id
    and date >= _prev_start and date < _prev_end;

  if _net = 0 then return null; end if;

  insert into public.transactions (workspace_id, date, concept, type, amount, currency, category_id, account, source, notes)
  values (
    _workspace_id,
    _target_month,
    'Saldo del mes ' || to_char(_prev_start, 'YYYY-MM'),
    case when _net >= 0 then 'ingreso'::txn_type else 'egreso'::txn_type end,
    abs(_net),
    'COP',
    _cat_id,
    'bancolombia',
    'manual',
    _tag
  )
  returning id into _new_id;

  return _new_id;
end;
$$;

-- 4. Runner: called by cron on the 1st of each month, creates carryover for all workspaces
create or replace function public.run_monthly_carryover()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _ws record;
  _target date := date_trunc('month', now())::date;
  _count integer := 0;
  _id uuid;
begin
  for _ws in select id from public.workspaces loop
    _id := public.generate_monthly_carryover(_ws.id, _target);
    if _id is not null then _count := _count + 1; end if;
  end loop;
  return _count;
end;
$$;

revoke execute on function public.generate_monthly_carryover(uuid, date) from anon;
revoke execute on function public.run_monthly_carryover() from anon;
grant execute on function public.generate_monthly_carryover(uuid, date) to authenticated, service_role;
grant execute on function public.run_monthly_carryover() to service_role;
