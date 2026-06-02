
# Plan de cambios

Ejecuto por fases con preview entre cada una.

---

## FASE 1 — Selección masiva y borrado en /transacciones

En `src/routes/_authenticated/transacciones.tsx`:
- Columna nueva con checkbox por fila + checkbox en el header (seleccionar todo lo visible / todo el filtro).
- Barra de acciones flotante cuando hay selección: muestra cuántas y botón **Eliminar seleccionadas** (con confirmación AlertDialog).
- Botón **Eliminar TODAS las transacciones del workspace** en /settings/import (zona peligrosa, doble confirmación escribiendo "ELIMINAR").

Server functions nuevas en `src/lib/finanzas.functions.ts`:
- `deleteTransactions({ ids[] })` — borra por lote, valida workspace.
- `deleteAllTransactions({ workspace_id, confirm })` — borra todo del workspace.

---

## FASE 2 — Fusionar Categorías dentro del Dashboard

- Mover el contenido de `src/routes/_authenticated/categorias.tsx` como sección dentro de `dashboard.tsx`, debajo de las métricas y respetando el filtro de mes/rango existente.
- Quitar item "Categorías" del sidebar (`AppShell.tsx`).
- Eliminar la ruta `/categorias`.

---

## FASE 3 — Fase D: Importación Google Sheets robusta

Mejorar `src/lib/condor-import.functions.ts`:
- Mapeo exacto de columnas Cóndor: `FECHA | CONCEPTO | COD.VALOR | ENTRADAS | SALIDAS | SALDO`.
- Usar columna **COD.VALOR** para mapear directamente a la categoría por `code` (00001–00013…).
- Si el código no existe → acumular en un set de "categorías sugeridas".
- Devolver `{ inserted, perSheet, suggestedCategories: [{code, sampleConcepts[]}] }`.

En `/settings/import`:
- Tras el preview de importación, mostrar las categorías sugeridas con campo nombre + tipo (ingreso/egreso) y botón **Aprobar y crear**.
- Después de aprobar, re-ejecutar el insert para asociar las transacciones a las nuevas categorías (vía `import_batch_id`).
- Mostrar resumen por mes/hoja con totales (ingresos, egresos, neto) para comparar contra el Sheet.

---

## FASE 4 — Fase F: Stripe sync con comisiones

Mejorar `src/lib/stripe-sync.functions.ts` y el webhook `routes/api/public/payments/webhook.ts`:
- Por cada `balance_transaction` de tipo `charge`/`payment`:
  - Insertar **transacción de ingreso bruto** = `amount` (no `net`), categoría `INGRESOS POR VENTAS` (00001).
  - Insertar **transacción de egreso de comisión** = `fee`, categoría `GASTOS OPERATIVOS` (00004) o nueva categoría sistema **COMISIONES STRIPE** (sugerencia: crearla como `00014`), enlazada vía `paired_transaction_id`.
- Idempotencia por `bt_<id>` y `bt_<id>_fee`.
- Dashboard: tarjeta nueva "Comisiones acumuladas (Stripe)" usando categoría de comisiones en el rango filtrado.

Migración: agregar categoría sistema `00014 - COMISIONES STRIPE (egreso)` al seed y backfill para workspaces existentes.

---

## FASE 5 — Flujo de reset + resincronización (tu caso de uso)

Con lo anterior listo, el flujo será:
1. Settings → Importar → **Eliminar TODAS las transacciones** (doble confirmación).
2. Settings → Importar → pegar URL del Sheet → previsualizar → aprobar categorías sugeridas → importar.
3. Settings → Stripe → **Sincronizar desde 2026-06-01** (genera ingresos + comisiones).
4. Dashboard muestra totales por mes y categoría para validar contra el Sheet.

No agrego UI nueva para esto; reutiliza los botones de Fases 1, 3 y 4.

---

## Detalles técnicos

- Todas las server fns usan `requireSupabaseAuth` y validan `workspace_id` con `is_workspace_member`.
- Borrados respetan RLS (la policy `txn_all_member` ya cubre DELETE).
- Categorías nuevas creadas con `is_system=false` salvo `00014 COMISIONES STRIPE` que va como `is_system=true` vía migración.
- Mantener diseño: fondo crema `#F7F5F2`, verde `#2D7A4F`.

¿Apruebo y arranco por FASE 1?
