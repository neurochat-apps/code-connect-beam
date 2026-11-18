import { auth, defineMcp } from "@lovable.dev/mcp-js";
import t_get_period_summary from "./tools/get-period-summary";
import t_list_pending_invoices from "./tools/list-pending-invoices";
import t_get_category_breakdown from "./tools/get-category-breakdown";
import t_compare_months from "./tools/compare-months";
import t_list_categories from "./tools/list-categories";
import t_list_transactions_by_month from "./tools/list-transactions-by-month";
import t_get_account_balance from "./tools/get-account-balance";
import t_create_transaction from "./tools/create-transaction";
import t_create_usd_cop_transfer from "./tools/create-usd-cop-transfer";
import t_delete_transaction from "./tools/delete-transaction";
import t_mark_transaction_paid from "./tools/mark-transaction-paid";
import t_create_client from "./tools/create-client";
import t_update_trm from "./tools/update-trm";
import t_update_monthly_goal from "./tools/update-monthly-goal";
import t_create_fixed_cost from "./tools/create-fixed-cost";
import t_list_workspaces from "./tools/list-workspaces";
import t_search_transactions from "./tools/search-transactions";
import t_update_transaction from "./tools/update-transaction";
import t_list_clients from "./tools/list-clients";
import t_update_client from "./tools/update-client";
import t_list_fixed_costs from "./tools/list-fixed-costs";
import t_create_category from "./tools/create-category";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "neurofinanzas",
  title: "Neurofinanzas",
  version: "0.1.0",
  instructions: "Herramientas de Neurofinanzas: consultar resúmenes, saldos, cartera, categorías, clientes y transacciones; registrar ingresos, egresos y transferencias USD→COP; editar clientes, transacciones, TRM y meta. Usa list_categories antes de registrar para elegir el código correcto. Montos en COP salvo que se indique USD.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [t_get_period_summary, t_list_pending_invoices, t_get_category_breakdown, t_compare_months, t_list_categories, t_list_transactions_by_month, t_get_account_balance, t_create_transaction, t_create_usd_cop_transfer, t_delete_transaction, t_mark_transaction_paid, t_create_client, t_update_trm, t_update_monthly_goal, t_create_fixed_cost, t_list_workspaces, t_search_transactions, t_update_transaction, t_list_clients, t_update_client, t_list_fixed_costs, t_create_category],
});
