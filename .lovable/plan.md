# Plan: Importación fiable del Google Sheet Cóndor

## Problema
1. Los totales importados no cuadran con el sheet real.
2. No hay forma de revisar mes por mes antes de insertar.
3. Las transferencias **USD→COP** (código `00010 TRANSFERENCIA CUENTA LLC`) se cuentan dos veces: como egreso en la hoja USD y como ingreso en la hoja COP.

## Solución

### 1. Parser por hoja (más estricto)
- Detectar pareja de hojas por mes: `Flujo de caja {Mes} {Año}` (COP) y `Flujo de caja {Mes} {Año} Dolares` (USD).
- Leer columnas B..G desde fila 8 (igual que hoy) **pero también** capturar la columna C (código `Cod`) para identificar el `00010`.
- Marcar cada movimiento con `cop_code` (ej. "00010") en `notes` para auditoría.

### 2. Cruce de transferencias USD↔COP
- Cualquier fila con código `00010` se marca como `transfer` y NO suma como ingreso/egreso operativo.
- En la base se insertan igual (para trazabilidad), pero con `category_id` apuntando a la categoría sistema "TRANSFERENCIA USD→COP" (`00011` existente) y se emparejan vía `paired_transaction_id`:
  - Match por mes + monto USD × `usd_cop_rate` del workspace, tolerancia ±5%.
  - Si no hay match exacto, queda sin pareja pero etiquetada como transferencia (no infla ingresos del dashboard).
- El dashboard ya puede filtrar `category.code = '00011'` para excluirlas de ingresos reales.

### 3. Preview mensual antes de insertar (clave)
Nuevo flujo en `/settings/import`:

```text
[ Cargar sheet Cóndor ]
        ↓
Tabla resumen por mes (sin insertar nada):
┌─────────┬──────┬──────────┬─────────┬─────────────┬──────────┐
│ Mes     │ Mon. │ Ingresos │ Egresos │ Transfers   │ Sheet ≟  │
├─────────┼──────┼──────────┼─────────┼─────────────┼──────────┤
│ Ene 26  │ COP  │ 12.5M    │ 9.1M    │ +3.2M (in)  │ ✅ cuadra│
│ Ene 26  │ USD  │ 4,200    │ 3,800   │ -800 (out)  │ ⚠ Δ $50 │
│ Feb 26  │ COP  │ ...      │ ...     │ ...         │ ...      │
└─────────┴──────┴──────────┴─────────┴─────────────┴──────────┘

☑ Ene 26    ☑ Feb 26    ☐ Mar 26   ...
[ Importar meses seleccionados ]
```

- Cada fila compara el total calculado vs el **SALDO** final de la columna G del sheet (o suma de la columna ENTRADAS/SALIDAS), mostrando la diferencia.
- Checkboxes para elegir qué meses importar.
- Solo al confirmar se ejecuta el insert (idempotente por `import_batch_id` + hash fecha+concepto+monto para evitar duplicados si se reimporta).

### 4. Idempotencia y reimport
- Antes de insertar un mes, eliminar transacciones previas del mismo mes con `source='import'` y misma moneda (o usar hash único). Así puedes reimportar sin duplicar.

## Cambios técnicos

**Backend** (`src/lib/condor-import.functions.ts`):
- Dividir en 2 server fns:
  - `previewCondorSheet` → devuelve resumen mensual (sin insertar) con totales calculados, total del sheet, transferencias detectadas y diferencia.
  - `importCondorMonths` → recibe lista de `{year, month, currency}` aprobada, hace el cruce de transferencias y inserta.
- Helper `pairTransfers(rowsUSD, rowsCOP, rate)` que empareja por monto y fecha.

**Frontend** (`src/routes/_authenticated/settings/import.tsx`):
- Reemplazar el botón único por: paso 1 "Analizar sheet" → tabla resumen con checkboxes → paso 2 "Importar seleccionados".
- Mostrar diferencias en rojo/verde.

**No requiere** cambios de esquema (ya existen `paired_transaction_id`, `import_batch_id`, categorías sistema).

## Para el histórico del año
- Con el preview mensual puedes subir mes por mes (Ene, Feb, Mar…) revisando que cada uno cuadre contra el sheet antes de confirmar — sin trabajo manual fila por fila.
