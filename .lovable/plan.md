## Objetivo

Traer toda la actividad de Stripe (pagos brutos + comisiones + cargos + payouts/transferencias a Colombia) desde junio de 2026, en vivo y sin apretar botones. Cuando Stripe emita un payout (bajada de USD a la cuenta COP), registrarlo como transferencia con cruce USD↔COP para no duplicar ingresos.

## Qué falla hoy

1. `syncStripeAccount` guarda solo el **neto** de cada `balance_transaction` como un ingreso. No separa bruto de comisión → los totales no cuadran con Stripe.
2. El webhook solo escucha `charge.succeeded`, `checkout.session.completed`, `invoice.paid`. No captura reembolsos, disputas ni payouts, y guarda el bruto sin la fee.
3. Los payouts hoy se omiten (`skipped`) → no hay cruce automático a COP.
4. No existe una categoría dedicada a comisiones/cargos de Stripe: todo se mezcla con costos operativos genéricos.

## Plan

### 1. Nueva categoría del sistema

Crear categoría `00014 COMISIONES STRIPE` (tipo `egreso`, `is_system=true`) en todos los workspaces existentes y agregarla al trigger `handle_new_user` para futuros signups. Aquí van tanto las **comisiones** (fee por transacción) como los **cargos** (Stripe fees adicionales, chargebacks, adjustments): ambos suman en esta única categoría.

### 2. Modelo de filas por evento

Cada `charge` exitoso genera **2 filas** en `transactions`:
- Ingreso bruto (USD, categoría `00001`, cuenta `stripe`, `notes: "Stripe ch_xxx:gross · evt_yyy"`)
- Comisión Stripe (USD, categoría `00014`, cuenta `stripe`, tipo `egreso`, `notes: "Stripe ch_xxx:fee · bt_zzz"`)

Cada `payout` genera **1 fila neutra** con cruce:
- Categoría `00011 TRANSFERENCIA USD→COP`, tipo `neutro`, `amount` en USD, `pair_amount_cop` calculado con la TRM del workspace, `pair_account: 'bancolombia'`, `notes: "Stripe po_xxx:transfer"`.

Reembolsos, disputas y ajustes → egreso con categoría `00014` si son fees, o `00001` con signo negativo si son refunds del principal, todos con IDs sintéticos (`:refund`, `:dispute`, `:adjustment`) en `notes` para dedupe.

### 3. Webhook ampliado (tiempo real)

`src/routes/api/public/payments/webhook.ts` maneja además de lo actual:
- `charge.succeeded` → expandir `balance_transaction` para leer `amount` bruto + `fee` real, insertar 2 filas.
- `charge.refunded` → egreso por el reembolso.
- `charge.dispute.funds_withdrawn` → egreso con categoría `00014`.
- `payout.paid` → transferencia USD→COP con cruce.
- `balance_transaction.created` de tipo `stripe_fee` / `adjustment` → egreso `00014`.

Todos idempotentes por `notes LIKE %<external_id>:<kind>%`. Se conserva el registro en `stripe_events` para auditoría.

### 4. Sync manual reescrito (mismo formato)

`syncStripeAccount` recorre `balance_transactions` desde la fecha dada y produce filas con **exactamente el mismo formato de ID** que el webhook. Así, si un evento llegó por webhook y luego se corre sync, el dedupe por `notes` lo salta. Sirve solo como respaldo.

### 5. Reimportar junio limpio

Botón nuevo en `/settings/import` → "Reimportar Stripe (junio en adelante)":
1. Elimina `transactions WHERE source='stripe' AND date >= '2026-06-01'`.
2. Corre `syncStripeAccount({ since: '2026-06-01' })` con el nuevo desglose.
3. Muestra resumen: charges, comisiones, refunds, payouts, total bruto USD, total fees USD.

### 6. Registro del webhook en Stripe

Verificar que el endpoint `https://code-connect-beam.lovable.app/api/public/payments/webhook?env=live` esté activo en Stripe y suscrito a: `charge.succeeded`, `charge.refunded`, `charge.dispute.funds_withdrawn`, `payout.paid`. Si no, te indico los pasos exactos en el dashboard de Stripe (solo requiere un clic tuyo).

## Archivos a tocar

- **Migración SQL**: agregar `00014 COMISIONES STRIPE` a workspaces existentes y al trigger `handle_new_user`.
- `src/routes/api/public/payments/webhook.ts`: ampliar switch de eventos, insertar bruto+fee+payout con dedupe unificado.
- `src/lib/stripe-sync.functions.ts`: rehacer para producir 2 filas por charge + fila neutra por payout + fees/adjustments; nueva acción `resyncStripeSince(date)` que borra y reimporta.
- `src/routes/_authenticated/settings/import.tsx`: botón "Reimportar Stripe (junio+)" + copy de tiempo real.

## Fuera de alcance

- Reasignar históricos ya cargados desde Google Sheets — solo tocamos filas `source='stripe'`.
- Manejo de multi-currency dentro de Stripe (asumimos que todas las cuentas Stripe del usuario operan en USD).
