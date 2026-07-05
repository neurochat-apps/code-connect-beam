## Plan

### 1. Borrar todas las transacciones
- Nuevo botón "Borrar todas las transacciones" en `/settings/import` (rojo, con confirmación de doble paso escribiendo "BORRAR").
- Server fn `deleteAllTransactions({ workspace_id })` que hace `DELETE FROM transactions WHERE workspace_id = ?` (respeta RLS, solo owner/admin).
- Devuelve conteo eliminado y muestra toast.

### 2. Stripe → dinero queda en USD en cuenta de EE.UU.
- En el webhook (`src/routes/api/public/payments/webhook.ts`) y en el sync manual (`src/lib/stripe-sync.functions.ts`), los ingresos brutos y las comisiones se guardan con `account: "chase"` (cuenta USD en EE.UU.) en vez de `account: "stripe"`.
- La moneda sigue en USD. No se hace ninguna conversión automática a COP al recibir un charge.
- Ajustar también cualquier lógica de dedupe: solo cambia el campo `account`, los marcadores en `notes` (`ch_xxx:gross`, `:fee`) se mantienen.

### 3. Payout Stripe → Bancolombia como transferencia completa (sin duplicar flujo)
- Cuando Stripe emite `payout.paid`, crear **dos filas emparejadas** con `paired_transaction_id`:
  - **Egreso** en `chase` (USD), tipo `egreso`, categoría `00011 TRANSFERENCIA USD→COP`.
  - **Ingreso** en `bancolombia` (COP), tipo `ingreso`, categoría `00011`, monto = USD × TRM del workspace.
- Al ser categoría `00011` (neutra en el flujo de caja general), no se cuentan como ingreso/egreso operativo — solo mueven saldos entre cuentas.
- Ajustar `getDashboard` / KPIs para que las filas con categoría `00011` se excluyan de "ingresos" y "egresos" del período aunque su `type` sea ingreso/egreso (hoy el filtro se basa solo en `type`).
- Reemplaza el modelo actual de "1 fila neutra USD con `pair_amount_cop`" por el modelo de 2 filas emparejadas, consistente con el resto de transferencias manuales de la app.

### 4. Todas las transacciones visibles en Dashboard y con categoría
- Auditar `getDashboard` y `getCategoryBreakdown` en `src/lib/finanzas.functions.ts`:
  - Confirmar que **no** filtran por `category_id IS NOT NULL` ni excluyen `source='stripe'`.
  - Las transacciones sin categoría se agrupan bajo "Sin categoría" en el breakdown (en vez de omitirse).
- Backfill: para transacciones existentes sin `category_id`, asignar categoría por defecto según `type`:
  - `ingreso` sin categoría → `00001 INGRESOS POR VENTAS`
  - `egreso` sin categoría → `00004 GASTOS OPERATIVOS`
  - `neutro` sin categoría → `00011 TRANSFERENCIA USD→COP`
- En el `TransactionDialog` hacer `category_id` obligatorio (validación Zod).
- En el webhook / sync de Stripe garantizar categoría siempre asignada (ya lo hace, pero validar fallback si `findCat` devuelve `null`).

### 5. Chat IA con conocimiento de categorías nuevas y transacciones por mes
- En `src/lib/ai-tools.server.ts` / `ai.functions.ts`:
  - Nueva tool `list_categories(workspace_id)` que devuelve todas las categorías activas del workspace (incluye las que el usuario cree).
  - Nueva tool `list_transactions_by_month({ workspace_id, ym })` que devuelve las transacciones del mes con categoría, cuenta, monto, moneda.
  - Actualizar el system prompt del chat para que use estas tools y sepa que las categorías son dinámicas.

### 6. Filtros en `/transacciones`
- Añadir barra de filtros arriba de la lista:
  - **Mes** (selector YYYY-MM, opción "Todos").
  - **Rango de fechas** (from / to opcionales).
  - **Categoría** (select con las categorías del workspace + "Todas" + "Sin categoría").
  - **Cuenta** y **tipo** (bonus barato, mismo componente).
- Ampliar `listTransactions` para aceptar `{ from?, to?, category_id?, account?, type? }` y aplicarlos en la query.

### 7. Filtro "Mes pasado" en Dashboard
- Añadir botón "Mes pasado" en la fila de períodos junto a Hoy/Semana/Mes/Trimestre/Año/Todo.
- Extender `Period` en `src/lib/format.ts` con `"last_month"` y en `periodRange` calcular `[primerDíaMesAnterior, últimoDíaMesAnterior]`.

## Archivos a tocar

- `src/lib/finanzas.functions.ts` — `deleteAllTransactions`, filtros extendidos en `listTransactions`, `getDashboard`/`getCategoryBreakdown` (excluir cat `00011`, incluir "Sin categoría"), validación `category_id` requerido.
- `src/lib/format.ts` — nuevo período `last_month`.
- `src/routes/_authenticated/dashboard.tsx` — botón "Mes pasado".
- `src/routes/_authenticated/transacciones.tsx` — barra de filtros (mes / fecha / categoría / cuenta / tipo).
- `src/routes/_authenticated/settings/import.tsx` — botón "Borrar todas las transacciones".
- `src/routes/api/public/payments/webhook.ts` — `account: 'chase'` para ingresos/fees; payout como par egreso-chase + ingreso-bancolombia.
- `src/lib/stripe-sync.functions.ts` — mismo cambio que el webhook.
- `src/lib/ai-tools.server.ts` + `ai.functions.ts` — tools `list_categories`, `list_transactions_by_month`; actualizar prompt.
- **Migración SQL** — backfill de `category_id` para transacciones existentes sin categoría (asignar `00001`/`00004`/`00011` según `type`).
- `src/components/TransactionDialog.tsx` — categoría obligatoria en el form.

## Fuera de alcance

- Reconstruir históricos de Stripe automáticamente después del borrado (si quieres reimportar de Stripe, lo hacemos como paso aparte con el botón de resync existente).
- Cambiar la lógica de saldo del mes anterior (`00015`), que ya funciona.
