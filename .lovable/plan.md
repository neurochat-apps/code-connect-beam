## Chat IA como Centro de Control Total

Usaremos **Gemini vía Lovable AI Gateway** (`google/gemini-3-flash-preview`) con tool-calling. Si no convence, migramos a Claude después.

### 1. Backend — Tool-calling con confirmación

**`src/lib/ai-tools.server.ts`** (nuevo)
- Define ~20 herramientas en formato OpenAI tools:
  - **Consultas** (ejecución directa): `get_period_summary`, `get_client_status`, `get_balance`, `compare_months`, `get_category_spending`, `get_fixed_costs`, `get_pending_invoices`
  - **Acciones** (requieren confirmación): `create_transaction`, `create_usd_cop_transfer`, `update_transaction`, `delete_transaction`, `create_client`, `update_client`, `mark_client_paid`, `create_category`, `create_fixed_cost`, `update_trm`, `update_monthly_goal`
- Cada acción tiene un `executor` server-side que usa `requireSupabaseAuth` + RLS.

**`src/lib/ai.functions.ts`** (refactor)
- `chatFinanciero`: llama al gateway con `tools`. Si el modelo invoca una tool de consulta → ejecuta y devuelve `{ type: 'message', reply }`. Si invoca una acción → devuelve `{ type: 'confirm', action: { name, args }, summary }` sin ejecutar.
- `executeAction`: recibe `{ name, args }` ya confirmado por el usuario, valida con Zod, ejecuta el executor correspondiente, devuelve resultado.
- `getChatAlerts`: detecta clientes vencidos, progreso de meta mensual, categorías +20% vs mes anterior.

**System prompt** incluye al inicio: workspace, TRM actual, meta mensual, resumen del mes en curso (ingresos/egresos/utilidad), top 5 clientes con saldo, categorías activas, costos fijos, saldos Stripe/Chase calculados.

### 2. Frontend — `src/components/AIChatDialog.tsx`

- Banner superior con `getChatAlerts` al abrir el chat.
- Mensajes tipo `pending_action` renderizan tarjeta con resumen + botones **✅ Confirmar / ✏️ Editar / ❌ Cancelar**.
  - ✅ → llama `executeAction`, muestra resultado.
  - ✏️ → coloca el resumen editable en el input.
  - ❌ → añade mensaje "Cancelado" y descarta la acción.
- **Voz**: `continuous=false`, `interimResults=false` (one-shot). Al terminar, llama `send(transcript)` directamente — sin mostrar el texto intermedio en el input.
- Markdown rendering ya existente se mantiene.

### 3. Sin cambios de DB

Todas las acciones operan sobre tablas existentes (`transactions`, `clients`, `categories`, `workspaces`, `fixed_costs`). RLS ya está activo.

### Modelo y limitaciones

- `gemini-3.1-flash-live-preview` (audio bidireccional WebSocket) **no está en el AI Gateway**. Usamos `google/gemini-3-flash-preview` que sí soporta tool-calling. La voz queda con Web Speech API (lo que ya hay).
- Si quieres voz nativa Live API más adelante, es otro stack (WebSocket directo con API key separada).

### Archivos tocados

- nuevo: `src/lib/ai-tools.server.ts`
- editado: `src/lib/ai.functions.ts`
- editado: `src/lib/ai.server.ts`
- editado: `src/components/AIChatDialog.tsx`
