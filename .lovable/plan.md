## Tres correcciones

### 1) Sesión se cierra al refrescar
**Causa:** `src/routes/_authenticated.tsx` hace `supabase.auth.getUser()` dentro de `beforeLoad` con SSR activo. En el servidor no hay `localStorage`, así que no encuentra sesión y redirige a `/login`. Cada refresh pasa por SSR → siempre te saca.

**Fix:** Añadir `ssr: false` al route `_authenticated` (patrón canónico de la integración Supabase + TanStack). El gate corre solo en cliente, donde sí está la sesión persistida.

### 2) Invitaciones no enlazan al invitado
**Causa:** El trigger `handle_new_user` crea automáticamente un workspace nuevo para cada signup. El invitado se registra → queda en su propio workspace → al aceptar el token se añade al tuyo, pero `getMyWorkspaces` devuelve ambos y `workspaces[0]` puede tomar el suyo vacío. Además si abre el link sin cuenta, se va a `/signup` y pierde el token.

**Fix:**
- Modificar `handle_new_user` para **no** crear workspace si el `raw_user_meta_data` contiene `pending_invite_token` (o si simplemente es invitado).
- En la página `/accept-invite/$token`: si no hay sesión, redirigir a `/signup?invite=<token>` (no a `/login` genérico). El signup pasa el token en `options.data.pending_invite_token` y, tras registrarse, llama `acceptInvitation` automáticamente.
- Ordenar `getMyWorkspaces` por `joined_at` y priorizar workspaces donde el usuario **no es owner** si vino de una invitación; o más simple: que el dashboard recuerde el último workspace usado en `localStorage`.

### 3) Stripe — tiempo real + categoría correcta + sin duplicados
**Estado actual:**
- Webhook `/api/public/payments/webhook` ya existe y procesa `charge.succeeded`, `checkout.session.completed`, `invoice.paid` en tiempo real ✅
- Pero: no asigna `category_id`, solo pone `account: "stripe"`. Por eso aparece todo como "Stripe" suelto.
- El botón "Actualizar" trae todo porque `syncStripeAccount` deduplica por `stripe_events.id = "bt_<id>"` pero los eventos reales del webhook usan `evt_<id>` → no colisionan y reimporta.

**Fix:**
- **Webhook:** asignar `category_id` automático = categoría con `code = '00001'` (INGRESOS POR VENTAS) del workspace. Guardar también `client_id` si el `customer.email` coincide con algún cliente registrado.
- **Dedupe unificado:** en `syncStripeAccount`, antes de insertar, hacer `SELECT id FROM transactions WHERE source='stripe' AND notes LIKE '%<bt_id>%'` para evitar reimportar lo que ya entró por webhook.
- **Botón "Actualizar" opcional:** se queda como respaldo (por si el webhook falló), pero el flujo principal es tiempo real. Mostrar nota: "Las transacciones de Stripe se registran automáticamente. Usa este botón solo si falta algo."
- Verificar que el webhook de Stripe esté efectivamente configurado apuntando a la URL del proyecto (si no, te ayudo a configurarlo en el dashboard de Stripe).

### Archivos a tocar
- `src/routes/_authenticated.tsx` — añadir `ssr: false`
- Migración SQL — actualizar `handle_new_user` para saltarse la creación de workspace cuando hay invite
- `src/routes/signup.tsx` — leer `?invite=`, pasarlo en metadata, llamar accept tras signup
- `src/routes/accept-invite.$token.tsx` — redirigir a `/signup?invite=...` si no hay sesión
- `src/routes/api/public/payments/webhook.ts` — asignar `category_id` (00001) y `client_id` por email
- `src/lib/stripe-sync.functions.ts` — dedupe contra `transactions` (no solo `stripe_events`)
- `src/routes/_authenticated/settings/import.tsx` — copy del botón

¿Procedo?
