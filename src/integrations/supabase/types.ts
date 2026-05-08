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
      acertos: {
        Row: {
          created_at: string
          data: string
          de_socio_id: string
          id: string
          observacoes: string | null
          para_socio_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          de_socio_id: string
          id?: string
          observacoes?: string | null
          para_socio_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          de_socio_id?: string
          id?: string
          observacoes?: string | null
          para_socio_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "acertos_de_socio_id_fkey"
            columns: ["de_socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acertos_para_socio_id_fkey"
            columns: ["para_socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_transacao"]
        }
        Insert: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_transacao"]
        }
        Update: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
        }
        Relationships: []
      }
      gastos_fixos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          dia_mes: number
          empresa: string | null
          id: string
          nome: string
          socio_padrao_id: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          dia_mes: number
          empresa?: string | null
          id?: string
          nome: string
          socio_padrao_id?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          dia_mes?: number
          empresa?: string | null
          id?: string
          nome?: string
          socio_padrao_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_fixos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_fixos_socio_padrao_id_fkey"
            columns: ["socio_padrao_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      quadro_itens: {
        Row: {
          created_at: string
          descricao: string | null
          empresa: string | null
          id: string
          ordem: number
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          status: string
          tags: string[]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa?: string | null
          id?: string
          ordem?: number
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tags?: string[]
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa?: string | null
          id?: string
          ordem?: number
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tags?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      socios: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          acertada: boolean
          acerto_id: string | null
          categoria_id: string | null
          created_at: string
          data: string
          descricao: string
          empresa: string | null
          id: string
          observacoes: string | null
          origem: string
          socio_id: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          updated_at: string
          valor: number
        }
        Insert: {
          acertada?: boolean
          acerto_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data?: string
          descricao: string
          empresa?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          socio_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          updated_at?: string
          valor: number
        }
        Update: {
          acertada?: boolean
          acerto_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          empresa?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          socio_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      tipo_transacao: "despesa" | "receita"
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
      tipo_transacao: ["despesa", "receita"],
    },
  },
} as const
