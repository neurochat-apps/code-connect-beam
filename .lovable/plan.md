## Objetivo
1. Conectar Stripe (pagos nativos de Lovable) para registrar ingresos reales desde junio.
2. Importar el consolidado histórico del año desde un Google Sheet al módulo de transacciones.

## Parte 1 — Stripe (pagos nativos)

1. Ejecutar `recommend_payment_provider` para validar elegibilidad.
2. Ejecutar `enable_stripe_payments` (sin cuenta propia ni API keys).
3. Crear tabla `stripe_events` para registrar webhooks (idempotencia por `event_id`).
4. Crear server route pública `/api/public/stripe/webhook` que:
   - Verifica firma del webhook.
   - En eventos `checkout.session.completed` / `invoice.paid` / `charge.succeeded`, inserta automáticamente una transacción tipo `ingreso` en el workspace correspondiente (categoría "Ventas / Servicios", cuenta `stripe`, fuente `stripe`).
5. Agregar valor `stripe` al enum `txn_account` y `txn_source` vía migración.
6. UI: indicador en el dashboard "Stripe conectado" + filtro por fuente.

> Nota: la sincronización de ingresos pasados de Stripe (junio en adelante) la haremos con un botón "Importar desde Stripe" que recorre `charges.list` y crea transacciones — opcional, lo activamos cuando confirmes que ya hay cobros reales.

## Parte 2 — Importar Google Sheet histórico

1. Conectar el connector **Google Sheets** vía `standard_connectors--connect`.
2. Crear página `/settings/import` con:
   - Input para pegar la URL del Google Sheet.
   - Selector de hoja y rango (autodetectado).
   - Vista previa de las primeras 20 filas.
   - Mapeo de columnas → campos de `transactions` (fecha, concepto, tipo, monto, moneda, categoría, cliente, cuenta, notas). Se intenta auto-mapear por nombre de cabecera.
   - Botón "Importar" que llama a un server fn que:
     - Lee el rango vía gateway de Google Sheets.
     - Normaliza fechas (DD/MM/YYYY, YYYY-MM-DD), montos (quita `$`, `.`, `,`), tipo (ingreso/egreso/income/expense).
     - Resuelve categoría por nombre (crea si no existe) y cliente por nombre (crea si no existe).
     - Inserta en lote con `source = 'import'` y un `import_batch_id` para poder revertir.
3. Migración: agregar `import_batch_id uuid` a `transactions` + valor `import` al enum `txn_source`.
4. Mostrar resumen post-import: X filas importadas, Y omitidas con motivos.

## Orden de ejecución
1. Migraciones (enums + columnas + tabla `stripe_events`).
2. Habilitar Stripe + webhook.
3. Conectar Google Sheets + pantalla de importación.
4. Probar: envías el link del Sheet y hacemos el primer import.

## Detalles técnicos
- Stripe webhook usa `supabaseAdmin` tras verificar firma con `STRIPE_WEBHOOK_SECRET`.
- Para mapear Stripe → workspace, guardamos `stripe_account_id` por workspace al habilitar.
- Google Sheets se llama vía `https://connector-gateway.lovable.dev/google_sheets/v4/...` con headers `LOVABLE_API_KEY` + `GOOGLE_SHEETS_API_KEY`.
- Toda la importación corre en un `createServerFn` con `requireSupabaseAuth` (respeta RLS, sólo importa al workspace del usuario).
