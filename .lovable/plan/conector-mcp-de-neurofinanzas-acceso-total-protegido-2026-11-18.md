# Conector MCP de Neurofinanzas (acceso total, protegido)

## Qué vas a obtener
Un conector que puedes agregar a ChatGPT, Claude u otras apps (incluso desde el celular). Inicias sesión una vez con tu cuenta de Neurofinanzas, apruebas el acceso, y desde ahí puedes consultar y registrar todo sin entrar a la app. Cada persona solo ve los datos de su propio espacio de trabajo.

## Funciones incluidas
**Consultas**
- Resumen del mes / rango (ingresos, gastos, utilidad, saldo anterior, meta)
- Saldos por cuenta (Bancolombia, Chase, Stripe, efectivo)
- Listar transacciones con filtros (mes, fechas, categoría, cuenta, tipo)
- Totales por categoría, comparación entre meses, top clientes
- Cartera pendiente y cobros vencidos
- Listar categorías, clientes y costos fijos

**Registros y cambios**
- Crear, editar y eliminar transacciones (ingreso, egreso, neutro)
- Registrar transferencias USD→COP y Stripe→Chase como par (sin duplicar)
- Crear y editar clientes, categorías y costos fijos
- Marcar cobros como pagados
- Actualizar TRM y meta mensual
- Generar saldo del mes anterior

Las funciones de borrar se marcan como "destructivas" para que la app externa pida confirmación.

## Seguridad
- Acceso con inicio de sesión (OAuth): pantalla de "Conectar <app> a Neurofinanzas" con Aprobar / Cancelar.
- Se respetan los permisos y roles actuales del equipo.
- No se usan claves maestras ni se abre información al público.

## Detalles técnicos
- Instalar `@lovable.dev/mcp-js` + plugin TanStack (`mcpPlugin()`, endpoint `/mcp`).
- `src/lib/mcp/index.ts` con `auth.oauth.issuer` (issuer directo supabase.co, `requireOAuthClientClaim`).
- `src/lib/mcp/supabase.ts` con `supabaseForUser` (token del usuario, RLS).
- Un archivo por tool en `src/lib/mcp/tools/`, reutilizando la lógica de `ai-tools.server.ts` (`executeTool`) y `getDashboard`; workspace resuelto desde la membresía del usuario (parámetro opcional `workspace_id` validado).
- Ruta de consentimiento `src/routes/[.]lovable.oauth.consent.tsx`; login/signup respetan `next` con `oauthReturnPath`.
- Activar servidor OAuth (`configure_oauth_server`), extraer manifiesto, luego republicar.
