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
          de_socio_id: string | null
          id: string
          observacoes: string | null
          para_socio_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          de_socio_id?: string | null
          id?: string
          observacoes?: string | null
          para_socio_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          de_socio_id?: string | null
          id?: string
          observacoes?: string | null
          para_socio_id?: string | null
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
      agente_config: {
        Row: {
          chave: string
          valor: string
        }
        Insert: {
          chave: string
          valor: string
        }
        Update: {
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      agente_conversas: {
        Row: {
          atualizado_em: string
          criado_em: string
          estado: string
          followups_enviados: number
          humano_ate: string | null
          nome: string | null
          optout: boolean
          resumo: string | null
          ultima_msg_cliente_at: string | null
          ultima_msg_sony_at: string | null
          ultimo_followup_at: string | null
          whatsapp: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          estado?: string
          followups_enviados?: number
          humano_ate?: string | null
          nome?: string | null
          optout?: boolean
          resumo?: string | null
          ultima_msg_cliente_at?: string | null
          ultima_msg_sony_at?: string | null
          ultimo_followup_at?: string | null
          whatsapp: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          estado?: string
          followups_enviados?: number
          humano_ate?: string | null
          nome?: string | null
          optout?: boolean
          resumo?: string | null
          ultima_msg_cliente_at?: string | null
          ultima_msg_sony_at?: string | null
          ultimo_followup_at?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      agente_eventos: {
        Row: {
          criado_em: string
          dados: Json
          enviado_em: string | null
          erro: string | null
          id: number
          reserva_id: string | null
          reservado_em: string | null
          tentativas: number
          tipo: string
        }
        Insert: {
          criado_em?: string
          dados?: Json
          enviado_em?: string | null
          erro?: string | null
          id?: number
          reserva_id?: string | null
          reservado_em?: string | null
          tentativas?: number
          tipo: string
        }
        Update: {
          criado_em?: string
          dados?: Json
          enviado_em?: string | null
          erro?: string | null
          id?: number
          reserva_id?: string | null
          reservado_em?: string | null
          tentativas?: number
          tipo?: string
        }
        Relationships: []
      }
      agente_feriados: {
        Row: {
          data: string
          nome: string
        }
        Insert: {
          data: string
          nome: string
        }
        Update: {
          data?: string
          nome?: string
        }
        Relationships: []
      }
      agente_mensagens: {
        Row: {
          criado_em: string
          id: number
          papel: string
          texto: string
          tipo: string
          wa_id: string | null
          whatsapp: string
        }
        Insert: {
          criado_em?: string
          id?: number
          papel: string
          texto: string
          tipo?: string
          wa_id?: string | null
          whatsapp: string
        }
        Update: {
          criado_em?: string
          id?: number
          papel?: string
          texto?: string
          tipo?: string
          wa_id?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      alertas: {
        Row: {
          ativo: boolean
          created_at: string
          data: string
          hora: string
          id: string
          nome: string
          observacao: string | null
          recorrencia: string
          somente_dia_util: boolean
          ultimo_disparo_at: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data: string
          hora?: string
          id?: string
          nome: string
          observacao?: string | null
          recorrencia?: string
          somente_dia_util?: boolean
          ultimo_disparo_at?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data?: string
          hora?: string
          id?: string
          nome?: string
          observacao?: string | null
          recorrencia?: string
          somente_dia_util?: boolean
          ultimo_disparo_at?: string | null
          updated_at?: string
        }
        Relationships: []
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
      cobrancas: {
        Row: {
          cliente_email: string | null
          cliente_nome: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          itens: Json
          observacoes: string | null
          paid_at: string | null
          pix_chave: string
          pix_nome: string
          slug: string
          status: string
          titulo: string
          total: number
          updated_at: string
        }
        Insert: {
          cliente_email?: string | null
          cliente_nome: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          paid_at?: string | null
          pix_chave: string
          pix_nome: string
          slug: string
          status?: string
          titulo: string
          total?: number
          updated_at?: string
        }
        Update: {
          cliente_email?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          paid_at?: string | null
          pix_chave?: string
          pix_nome?: string
          slug?: string
          status?: string
          titulo?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      gastos_fixos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          dia_mes: number
          dia_semana: number | null
          empresa: string | null
          frequencia: string
          id: string
          mes: number | null
          nome: string
          parcelas_pagas: number
          parcelas_total: number | null
          socio_padrao_id: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          dia_mes: number
          dia_semana?: number | null
          empresa?: string | null
          frequencia?: string
          id?: string
          mes?: number | null
          nome: string
          parcelas_pagas?: number
          parcelas_total?: number | null
          socio_padrao_id?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          dia_mes?: number
          dia_semana?: number | null
          empresa?: string | null
          frequencia?: string
          id?: string
          mes?: number | null
          nome?: string
          parcelas_pagas?: number
          parcelas_total?: number | null
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
      notificacoes_log: {
        Row: {
          chave: string
          corpo: string | null
          created_at: string
          id: string
          titulo: string | null
        }
        Insert: {
          chave: string
          corpo?: string | null
          created_at?: string
          id?: string
          titulo?: string | null
        }
        Update: {
          chave?: string
          corpo?: string | null
          created_at?: string
          id?: string
          titulo?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          last_seen_reservas_at: string
          must_change_password: boolean
          socio_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_seen_reservas_at?: string
          must_change_password?: boolean
          socio_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_seen_reservas_at?: string
          must_change_password?: boolean
          socio_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          socio_id: string | null
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          socio_id?: string | null
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          socio_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
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
          responsavel_ids: string[]
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
          responsavel_ids?: string[]
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
          responsavel_ids?: string[]
          status?: string
          tags?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservas: {
        Row: {
          cliente_lembrete_1h_at: string | null
          cliente_lembrete_24h_at: string | null
          cliente_nome: string
          cliente_whatsapp: string
          cobranca_id: string | null
          created_at: string
          data: string
          duracao_minutos: number
          empreendimento: string | null
          fora_horario: boolean
          hora_inicio: string
          id: string
          lembrete_1h_enviado_at: string | null
          lembrete_24h_enviado_at: string | null
          numero_proposta: number
          observacoes: string | null
          origem: string
          paid_at: string | null
          remarcacoes: number
          status: string
          tipo: string
          tipo_pagamento: string | null
          updated_at: string
          valor_pago: number | null
          valor_sinal: number
          valor_total: number
        }
        Insert: {
          cliente_lembrete_1h_at?: string | null
          cliente_lembrete_24h_at?: string | null
          cliente_nome: string
          cliente_whatsapp: string
          cobranca_id?: string | null
          created_at?: string
          data: string
          duracao_minutos: number
          empreendimento?: string | null
          fora_horario?: boolean
          hora_inicio: string
          id?: string
          lembrete_1h_enviado_at?: string | null
          lembrete_24h_enviado_at?: string | null
          numero_proposta?: number
          observacoes?: string | null
          origem?: string
          paid_at?: string | null
          remarcacoes?: number
          status?: string
          tipo?: string
          tipo_pagamento?: string | null
          updated_at?: string
          valor_pago?: number | null
          valor_sinal: number
          valor_total: number
        }
        Update: {
          cliente_lembrete_1h_at?: string | null
          cliente_lembrete_24h_at?: string | null
          cliente_nome?: string
          cliente_whatsapp?: string
          cobranca_id?: string | null
          created_at?: string
          data?: string
          duracao_minutos?: number
          empreendimento?: string | null
          fora_horario?: boolean
          hora_inicio?: string
          id?: string
          lembrete_1h_enviado_at?: string | null
          lembrete_24h_enviado_at?: string | null
          numero_proposta?: number
          observacoes?: string | null
          origem?: string
          paid_at?: string | null
          remarcacoes?: number
          status?: string
          tipo?: string
          tipo_pagamento?: string | null
          updated_at?: string
          valor_pago?: number | null
          valor_sinal?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
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
          participantes_ids: string[]
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
          participantes_ids?: string[]
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
          participantes_ids?: string[]
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
      _agente_auth: { Args: { p_token: string }; Returns: undefined }
      _agente_dia: { Args: { p_data: string }; Returns: string }
      _agente_doc_chave: { Args: { p_reserva: string }; Returns: string }
      _agente_fone: { Args: { p: string }; Returns: string }
      _agente_janela: {
        Args: { p_data: string }
        Returns: Record<string, unknown>
      }
      _agente_livres: { Args: { p_data: string; p_dur: number }; Returns: Json }
      _agente_reserva_json: { Args: { p_id: string }; Returns: Json }
      _mb_slugify: { Args: { _txt: string }; Returns: string }
      agente_agenda: {
        Args: {
          p_de?: string
          p_dias?: number
          p_duracao?: number
          p_token: string
        }
        Returns: Json
      }
      agente_alterar_reserva: {
        Args: {
          p_nova_data: string
          p_nova_hora: string
          p_reserva: string
          p_token: string
          p_whatsapp: string
        }
        Returns: Json
      }
      agente_cancelar_reserva: {
        Args: {
          p_motivo?: string
          p_reserva: string
          p_token: string
          p_whatsapp: string
        }
        Returns: Json
      }
      agente_criar_reserva: {
        Args: {
          p_data: string
          p_duracao: number
          p_empreendimento?: string
          p_hora: string
          p_nome: string
          p_observacoes?: string
          p_pacote?: string
          p_qtd_marcas?: number
          p_token: string
          p_whatsapp: string
        }
        Returns: Json
      }
      agente_documento_dados: {
        Args: { p_chave: string; p_slug: string }
        Returns: Json
      }
      agente_documento_url: {
        Args: { p_reserva: string; p_token: string }
        Returns: Json
      }
      agente_evento_criar: {
        Args: {
          p_dados?: Json
          p_tipo: string
          p_token: string
          p_whatsapp?: string
        }
        Returns: Json
      }
      agente_evento_resultado: {
        Args: { p_erro?: string; p_id: number; p_ok: boolean; p_token: string }
        Returns: Json
      }
      agente_eventos_pegar: {
        Args: { p_limite?: number; p_token: string }
        Returns: Json
      }
      agente_followups_pegar: {
        Args: { p_limite?: number; p_token: string }
        Returns: Json
      }
      agente_historico: {
        Args: { p_limite?: number; p_token: string; p_whatsapp: string }
        Returns: Json
      }
      agente_horarios: {
        Args: { p_data: string; p_duracao?: number; p_token: string }
        Returns: Json
      }
      agente_lead_atualizar: {
        Args: {
          p_estado?: string
          p_nome?: string
          p_optout?: boolean
          p_resumo?: string
          p_token: string
          p_whatsapp: string
        }
        Returns: Json
      }
      agente_lembretes_pegar: { Args: { p_token: string }; Returns: Json }
      agente_minhas_reservas: {
        Args: { p_token: string; p_whatsapp: string }
        Returns: Json
      }
      agente_msg_registrar: {
        Args: {
          p_nome: string
          p_papel: string
          p_texto: string
          p_tipo?: string
          p_token: string
          p_wa_id?: string
          p_whatsapp: string
        }
        Returns: Json
      }
      calc_preco_reserva: { Args: { _minutos: number }; Returns: number }
      confirmar_pagamento_cobranca: {
        Args: { _slug: string; _tipo: string; _valor: number }
        Returns: {
          cobranca_id: string
          paid_at: string
          reserva_id: string
        }[]
      }
      criar_reserva: {
        Args: {
          _cliente_nome: string
          _cliente_whatsapp: string
          _data: string
          _duracao_minutos: number
          _hora_inicio: string
        }
        Returns: {
          cobranca_slug: string
          reserva_id: string
          valor_sinal: number
          valor_total: number
        }[]
      }
      criar_reserva_pacote: {
        Args: {
          _cliente_nome: string
          _cliente_whatsapp: string
          _data: string
          _empreendimento: string
          _hora_inicio: string
          _qtd_marcas?: number
        }
        Returns: {
          cobranca_slug: string
          reserva_id: string
          valor_sinal: number
          valor_total: number
        }[]
      }
      criar_reserva_producao: {
        Args: {
          _cliente_nome: string
          _cliente_whatsapp: string
          _data: string
          _empreendimento?: string
          _hora_inicio: string
          _pacote: string
        }
        Returns: {
          cobranca_slug: string
          reserva_id: string
          valor_sinal: number
          valor_total: number
        }[]
      }
      get_cobranca_by_slug: {
        Args: { _slug: string }
        Returns: {
          cliente_nome: string
          descricao: string
          id: string
          itens: Json
          observacoes: string
          paid_at: string
          pix_chave: string
          pix_nome: string
          slug: string
          status: string
          titulo: string
          total: number
        }[]
      }
      get_horarios_ocupados: {
        Args: { _data: string }
        Returns: {
          duracao_minutos: number
          hora_inicio: string
        }[]
      }
      get_reserva_por_slug: {
        Args: { _slug: string }
        Returns: {
          cliente_nome: string
          cliente_whatsapp: string
          data: string
          duracao_minutos: number
          empreendimento: string
          hora_inicio: string
          id: string
          numero_proposta: number
          paid_at: string
          status: string
          tipo: string
          tipo_pagamento: string
          valor_pago: number
          valor_sinal: number
          valor_total: number
        }[]
      }
      is_team_member: { Args: never; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
