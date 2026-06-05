
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _ws_id uuid;
  _has_invite boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  _has_invite := coalesce(nullif(new.raw_user_meta_data->>'pending_invite_token',''), null) is not null;
  if _has_invite then
    return new;
  end if;

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
    (_ws_id,'00013','PAGO DE PRÉSTAMOS','egreso',true);

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
