## Confirmaciones

- GitHub: conectado ✅
- Telegram bot: conectado, grupo autorizado `chat_id = 5187124619` ✅
- Falta: habilitar **Lovable Cloud** (lo hago al iniciar la implementación — necesario para auth, base de datos y secretos)

---

## Plan Fase 1 (consolidado — listo para construir)

### 1. Backend (Lovable Cloud / Supabase)

Tablas con RLS por `is_workspace_member()`:

- `profiles` (id = auth.users.id, full_name, avatar_url)
- `workspaces` (id, name, owner_id, usd_cop_rate, telegram_group_id, created_at)
- `workspace_members` (workspace_id, user_id, role: owner/admin/member)
- `workspace_invitations` (workspace_id, email, token, role, expires_at, accepted_at)
- `categories` (workspace_id, code 00001–00013, name, type ingreso/egreso, is_system)
- `clients` (workspace_id, name, contact, notes)
- `transactions` (workspace_id, date, concept, type, amount, currency, category_id, account: bancolombia/stripe/chase, source: manual/telegram/stripe, client_id, notes, attachment_url, paired_transaction_id, telegram_message_id, created_by)
- `fixed_costs` (workspace_id, name, amount, currency, category: payroll/platform/other, is_active, sort_order)
- `labels` (workspace_id, name, color)

Trigger `on_auth_user_created` → crea profile + workspace personal + membership owner + seed de categorías + seed de costos fijos (lista abajo) + `telegram_group_id = 5187124619` por defecto en el primer workspace del owner inicial.

### 2. Seeds

**Categorías (13):** 00001 Ventas/Servicios, 00002 Otros ingresos, 00003 Nómina, 00004 Plataformas, 00005 Publicidad, 00006 Honorarios, 00007 Servicios públicos, 00008 Arriendo, 00009 Suministros, 00010 Impuestos, 00011 Transferencia USD↔COP, 00012 Comisiones bancarias, 00013 Otros gastos.

**Clientes (7):** IaChat, Sospinagu, Juanchi, Merecu, Santiago Ospina, Panadería San Juan, Ecofly.

**Costos fijos (7):**
- Nómina Yef y Jhon — 0 COP (a configurar por el usuario)
- Claude — 76.000 COP
- ChatGPT — 76.000 COP
- Funnelish — 295.000 COP
- ManyChat — 150.000 COP
- ChatRace — 499 USD
- Google — 50.000 COP

### 3. Auth

- Email + password con `supabase.auth` (sin confirmación en dev)
- Páginas públicas: `/login`, `/signup`, `/reset-password`, `/accept-invite/$token`
- Layout `_authenticated` que protege todo lo demás

### 4. Workspaces & equipo

- Selector de workspace en header
- `/settings/team`: invitar por email, listar miembros, revocar, cambiar rol
- `/settings/fixed-costs`: CRUD de costos fijos + total mensual COP/USD/convertido
- `/settings/general`: nombre del workspace, TRM USD→COP, `telegram_group_id`

### 5. Dashboard (`/`)

Mobile-first, fondo `#F7F5F2`, tarjetas blancas, acento `#2D7A4F`, Instrument Serif para números/títulos, DM Sans cuerpo, DM Mono datos.

- Header: "Neuro Finanzas" + selector workspace + botón **+ Registrar**
- Filtros: período (Hoy/Semana/Mes/Trimestre/Año) + moneda (COP/USD/Todo)
- 4 KPI COP: Ingresos, Gastos, Utilidad, Cartera pendiente
- 3 tarjetas USD: Stripe, Chase, Total USA
- Últimas 10 transacciones con badge de `source` (Manual/Telegram/Stripe)
- Panel derecho:
  - **Punto de equilibrio** con semáforo 🟢/🟡/🔴, monto, % alcanzado, desglose expandible de costos fijos
  - **Clientes con cartera pendiente**
- FAB 🧠 → abre chat IA con Gemini (ver §8)

### 6. CRUD transacciones

- Modal con: fecha, concepto, tipo, monto, moneda, categoría, cuenta, cliente, notas, adjunto
- Caso especial categoría 00011: genera automáticamente el par USD egreso + COP ingreso enlazados por `paired_transaction_id`
- Página `/transacciones` con tabla, filtros, edición inline y borrado

### 7. Integración Telegram (entrada de datos)

- Webhook público: `src/routes/api/public/telegram/webhook.ts`
- Filtra por `chat_id === 5187124619` (rechaza otros grupos)
- Cada mensaje del grupo se procesa con **Gemini** para extraer: `{ tipo, monto, moneda, concepto, categoría sugerida, cliente sugerido }`
- Si la extracción tiene confianza alta → inserta `transaction` con `source='telegram'` y responde al grupo con ✅ resumen
- Si confianza baja → responde con botones inline para confirmar/corregir
- `telegram_message_id` se guarda para idempotencia

Registro del webhook con `setWebhook` desde el sandbox al terminar el deploy.

### 8. Chat IA con Gemini (FAB 🧠)

- Server function `chatFinanciero` con `requireSupabaseAuth`
- Usa **GEMINI_API_KEY** (te pediré agregarla como secret de Lovable Cloud antes de codificar esta parte)
- Contexto inyectado: KPIs del mes, últimas 50 transacciones, costos fijos, clientes con cartera
- Puede responder preguntas y también **registrar transacciones por chat** (mismo extractor que Telegram)

### 9. Stripe

- Solo preparar campo `account='stripe'` y `source='stripe'` en transacciones (Fase 1)
- Integración real con webhook + reconciliación → **Fase 3** (separada, con preview)

### 10. Seguridad

- RLS en TODAS las tablas, scoped por `is_workspace_member(workspace_id)`
- Función SECURITY DEFINER `has_workspace_role()` para checks de admin
- GRANTs explícitos a `authenticated` y `service_role`
- `supabaseAdmin` solo en webhooks server-side
- Validación Zod en todas las server functions y rutas públicas

### 11. Stack técnico

TanStack Start + React 19 + Tailwind v4, Google Fonts (Instrument Serif / DM Sans / DM Mono), shadcn/ui, TanStack Query, `createServerFn` con `requireSupabaseAuth`.

### 12. Secretos necesarios (te los pediré en el orden correcto)

1. **GEMINI_API_KEY** — para extracción Telegram + chat IA
2. `TELEGRAM_API_KEY` — ya conectado vía connector
3. `STRIPE_SECRET_KEY` — solo en Fase 3

### Fuera de Fase 1 (van con preview separado)

- Fase 2: Vistas detalladas flujo de caja COP/USD + proyecciones + ROAS
- Fase 3: Stripe (webhook + reconciliación automática)
- Fase 4: Gestión completa de categorías custom + catálogo de productos
- Fase 5: Reportes exportables PDF/Excel

---

¿Apruebo y empiezo Fase 1? Al iniciar voy a:
1. Habilitar Lovable Cloud
2. Pedirte `GEMINI_API_KEY`
3. Crear toda la base de datos + auth + dashboard + CRUD + costos fijos + Telegram en un solo bloque, luego preview.
