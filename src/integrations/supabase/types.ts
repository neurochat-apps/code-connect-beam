export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          type: Database["public"]["Enums"]["txn_type"]
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          type: Database["public"]["Enums"]["txn_type"]
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          type?: Database["public"]["Enums"]["txn_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact: string | null
          created_at: string
          currency: Database["public"]["Enums"]["txn_currency"]
          id: string
          monthly_amount: number | null
          name: string
          next_payment_date: string | null
          notes: string | null
          project_total: number | null
          status: Database["public"]["Enums"]["client_status"]
          stripe_customer_id: string | null
          type: Database["public"]["Enums"]["client_type"]
          workspace_id: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["txn_currency"]
          id?: string
          monthly_amount?: number | null
          name: string
          next_payment_date?: string | null
          notes?: string | null
          project_total?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          stripe_customer_id?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          workspace_id: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["txn_currency"]
          id?: string
          monthly_amount?: number | null
          name?: string
          next_payment_date?: string | null
          notes?: string | null
          project_total?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          stripe_customer_id?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["fixed_cost_category"]
          created_at: string
          currency: Database["public"]["Enums"]["txn_currency"]
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          category?: Database["public"]["Enums"]["fixed_cost_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["txn_currency"]
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["fixed_cost_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["txn_currency"]
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          payload: Json
          processed_at: string
          type: string
          workspace_id: string | null
        }
        Insert: {
          id: string
          payload: Json
          processed_at?: string
          type: string
          workspace_id?: string | null
        }
        Update: {
          id?: string
          payload?: Json
          processed_at?: string
          type?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account: Database["public"]["Enums"]["txn_account"]
          amount: number
          attachment_url: string | null
          category_id: string | null
          client_id: string | null
          concept: string
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["txn_currency"]
          date: string
          id: string
          import_batch_id: string | null
          is_pending: boolean
          notes: string | null
          paired_transaction_id: string | null
          source: Database["public"]["Enums"]["txn_source"]
          telegram_message_id: number | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account?: Database["public"]["Enums"]["txn_account"]
          amount: number
          attachment_url?: string | null
          category_id?: string | null
          client_id?: string | null
          concept: string
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["txn_currency"]
          date?: string
          id?: string
          import_batch_id?: string | null
          is_pending?: boolean
          notes?: string | null
          paired_transaction_id?: string | null
          source?: Database["public"]["Enums"]["txn_source"]
          telegram_message_id?: number | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account?: Database["public"]["Enums"]["txn_account"]
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          client_id?: string | null
          concept?: string
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["txn_currency"]
          date?: string
          id?: string
          import_batch_id?: string | null
          is_pending?: boolean
          notes?: string | null
          paired_transaction_id?: string | null
          source?: Database["public"]["Enums"]["txn_source"]
          telegram_message_id?: number | null
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paired_transaction_id_fkey"
            columns: ["paired_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          telegram_group_id: string | null
          usd_cop_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          telegram_group_id?: string | null
          usd_cop_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          telegram_group_id?: string | null
          usd_cop_rate?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["workspace_role"]
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
    }
    Enums: {
      client_status: "activo" | "pausado" | "completado"
      client_type: "recurrente" | "proyecto" | "cuota"
      fixed_cost_category: "payroll" | "platform" | "other"
      txn_account: "bancolombia" | "stripe" | "chase" | "efectivo" | "otra"
      txn_currency: "COP" | "USD"
      txn_source: "manual" | "telegram" | "stripe" | "ai_chat" | "import"
      txn_type: "ingreso" | "egreso" | "neutro"
      workspace_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_status: ["activo", "pausado", "completado"],
      client_type: ["recurrente", "proyecto", "cuota"],
      fixed_cost_category: ["payroll", "platform", "other"],
      txn_account: ["bancolombia", "stripe", "chase", "efectivo", "otra"],
      txn_currency: ["COP", "USD"],
      txn_source: ["manual", "telegram", "stripe", "ai_chat", "import"],
      txn_type: ["ingreso", "egreso", "neutro"],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const
