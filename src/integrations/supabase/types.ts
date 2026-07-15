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
      alerts: {
        Row: {
          alert_reason: string | null
          alert_type: string
          article_id: string
          created_at: string
          id: string
          priority: string
          sent_at: string | null
        }
        Insert: {
          alert_reason?: string | null
          alert_type?: string
          article_id: string
          created_at?: string
          id?: string
          priority?: string
          sent_at?: string | null
        }
        Update: {
          alert_reason?: string | null
          alert_type?: string
          article_id?: string
          created_at?: string
          id?: string
          priority?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_tags: {
        Row: {
          article_id: string
          id: string
          tag_name: string
        }
        Insert: {
          article_id: string
          id?: string
          tag_name: string
        }
        Update: {
          article_id?: string
          id?: string
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_tags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      buy_ai_corporate_memory: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          metadata: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_response_log_id: string | null
          source_thread_id: string | null
          status: Database["public"]["Enums"]["buy_ai_corp_memory_status"]
          suggested_by: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_response_log_id?: string | null
          source_thread_id?: string | null
          status?: Database["public"]["Enums"]["buy_ai_corp_memory_status"]
          suggested_by?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_response_log_id?: string | null
          source_thread_id?: string | null
          status?: Database["public"]["Enums"]["buy_ai_corp_memory_status"]
          suggested_by?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ai_corporate_memory_source_response_log_id_fkey"
            columns: ["source_response_log_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_response_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_ai_corporate_memory_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_ai_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: Database["public"]["Enums"]["buy_ai_feedback_rating"]
          response_log_id: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: Database["public"]["Enums"]["buy_ai_feedback_rating"]
          response_log_id?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: Database["public"]["Enums"]["buy_ai_feedback_rating"]
          response_log_id?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ai_feedback_response_log_id_fkey"
            columns: ["response_log_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_response_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_ai_feedback_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_ai_response_logs: {
        Row: {
          answer: string | null
          confidence_score: number | null
          created_at: string
          error_message: string | null
          external_ai_provider: string | null
          had_error: boolean
          id: string
          intent: string | null
          internal_sources: Json
          library_documents: Json
          metadata: Json
          model: string | null
          module: string | null
          question: string
          question_category: string | null
          response_time_ms: number | null
          thread_id: string | null
          tokens_input: number | null
          tokens_output: number | null
          used_external_ai: boolean
          user_id: string
        }
        Insert: {
          answer?: string | null
          confidence_score?: number | null
          created_at?: string
          error_message?: string | null
          external_ai_provider?: string | null
          had_error?: boolean
          id?: string
          intent?: string | null
          internal_sources?: Json
          library_documents?: Json
          metadata?: Json
          model?: string | null
          module?: string | null
          question: string
          question_category?: string | null
          response_time_ms?: number | null
          thread_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          used_external_ai?: boolean
          user_id: string
        }
        Update: {
          answer?: string | null
          confidence_score?: number | null
          created_at?: string
          error_message?: string | null
          external_ai_provider?: string | null
          had_error?: boolean
          id?: string
          intent?: string | null
          internal_sources?: Json
          library_documents?: Json
          metadata?: Json
          model?: string | null
          module?: string | null
          question?: string
          question_category?: string | null
          response_time_ms?: number | null
          thread_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          used_external_ai?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ai_response_logs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_ai_sensitive_access_audit: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          resource_id: string | null
          resource_type: string
          response_log_id: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          resource_type: string
          response_log_id?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
          response_log_id?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ai_sensitive_access_audit_response_log_id_fkey"
            columns: ["response_log_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_response_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_ai_sensitive_access_audit_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_ai_thread_context: {
        Row: {
          avg_confidence: number | null
          consulted_documents: Json
          consulted_sources: Json
          created_at: string
          current_intent: string | null
          id: string
          intent_history: Json
          last_entities: Json
          last_model: string | null
          message_count: number
          metadata: Json
          module: string | null
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_confidence?: number | null
          consulted_documents?: Json
          consulted_sources?: Json
          created_at?: string
          current_intent?: string | null
          id?: string
          intent_history?: Json
          last_entities?: Json
          last_model?: string | null
          message_count?: number
          metadata?: Json
          module?: string | null
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_confidence?: number | null
          consulted_documents?: Json
          consulted_sources?: Json
          created_at?: string
          current_intent?: string | null
          id?: string
          intent_history?: Json
          last_entities?: Json
          last_model?: string | null
          message_count?: number
          metadata?: Json
          module?: string | null
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ai_thread_context_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "buy_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_ai_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      buy_ai_tool_calls: {
        Row: {
          args_preview: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          kind: string
          result_preview: string | null
          server: string | null
          status: string
          step: number
          thread_id: string
          tool_name: string
          user_id: string
        }
        Insert: {
          args_preview?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind?: string
          result_preview?: string | null
          server?: string | null
          status?: string
          step?: number
          thread_id: string
          tool_name: string
          user_id: string
        }
        Update: {
          args_preview?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind?: string
          result_preview?: string | null
          server?: string | null
          status?: string
          step?: number
          thread_id?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ai_tool_calls_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "buy_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      commodities: {
        Row: {
          created_at: string
          crescimento: number
          id: string
          nome: string
          tipo: string
          toneladas_2025: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          crescimento: number
          id?: string
          nome: string
          tipo: string
          toneladas_2025: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          crescimento?: number
          id?: string
          nome?: string
          tipo?: string
          toneladas_2025?: number
          updated_at?: string
        }
        Relationships: []
      }
      container_ranking: {
        Row: {
          created_at: string
          crescimento: number
          id: string
          terminal: string
          teu: number
          uf: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crescimento: number
          id?: string
          terminal: string
          teu: number
          uf: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crescimento?: number
          id?: string
          terminal?: string
          teu?: number
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_briefings: {
        Row: {
          briefing_date: string
          created_at: string
          id: string
          summary: string | null
          title: string | null
          top_articles_json: Json | null
        }
        Insert: {
          briefing_date: string
          created_at?: string
          id?: string
          summary?: string | null
          title?: string | null
          top_articles_json?: Json | null
        }
        Update: {
          briefing_date?: string
          created_at?: string
          id?: string
          summary?: string | null
          title?: string | null
          top_articles_json?: Json | null
        }
        Relationships: []
      }
      fiis: {
        Row: {
          categoria: string
          created_at: string
          id: string
          nome: string
          patrimonio_liquido: number | null
          ticker: string
          updated_at: string
          valor_cota: number | null
          valor_m2_area_propria: number | null
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          nome: string
          patrimonio_liquido?: number | null
          ticker: string
          updated_at?: string
          valor_cota?: number | null
          valor_m2_area_propria?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          nome?: string
          patrimonio_liquido?: number | null
          ticker?: string
          updated_at?: string
          valor_cota?: number | null
          valor_m2_area_propria?: number | null
        }
        Relationships: []
      }
      kpis_nacionais: {
        Row: {
          ano_referencia: number
          chave: string
          created_at: string
          crescimento: number | null
          fonte: string | null
          id: string
          unidade: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano_referencia?: number
          chave: string
          created_at?: string
          crescimento?: number | null
          fonte?: string | null
          id?: string
          unidade: string
          updated_at?: string
          valor: number
        }
        Update: {
          ano_referencia?: number
          chave?: string
          created_at?: string
          crescimento?: number | null
          fonte?: string | null
          id?: string
          unidade?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      library_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      library_document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          embedding_model: string | null
          id: string
          token_estimate: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          token_estimate?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          token_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "library_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      library_document_relations: {
        Row: {
          created_at: string
          document_id: string
          related_document_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          related_document_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          related_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_document_relations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "library_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_document_relations_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "library_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      library_document_versions: {
        Row: {
          author_id: string | null
          category_id: string | null
          change_note: string | null
          content: string
          created_at: string
          document_id: string
          id: string
          metadata: Json
          status: string
          summary: string | null
          tags: string[]
          title: string
          version_number: number
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          change_note?: string | null
          content?: string
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          version_number: number
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          change_note?: string | null
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "library_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      library_documents: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json
          search_vector: unknown
          slug: string
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          search_vector?: unknown
          slug: string
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          search_vector?: unknown
          slug?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      library_indexing_queue: {
        Row: {
          attempts: number
          document_id: string
          last_error: string | null
          queued_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          document_id: string
          last_error?: string | null
          queued_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          document_id?: string
          last_error?: string | null
          queued_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_indexing_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "library_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_connections: {
        Row: {
          auth_type: string
          auth_url: string | null
          bearer_token: string | null
          bearer_token_encrypted: string | null
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          name: string
          oauth_client: Json | null
          oauth_tokens: Json | null
          preset: string | null
          state: string
          tools_cache: Json | null
          transport: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          auth_type?: string
          auth_url?: string | null
          bearer_token?: string | null
          bearer_token_encrypted?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          name: string
          oauth_client?: Json | null
          oauth_tokens?: Json | null
          preset?: string | null
          state?: string
          tools_cache?: Json | null
          transport?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          auth_type?: string
          auth_url?: string | null
          bearer_token?: string | null
          bearer_token_encrypted?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          name?: string
          oauth_client?: Json | null
          oauth_tokens?: Json | null
          preset?: string | null
          state?: string
          tools_cache?: Json | null
          transport?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      monitoring_keywords: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          keyword_group: string
          priority_level: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          keyword_group?: string
          priority_level?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          keyword_group?: string
          priority_level?: number
        }
        Relationships: []
      }
      movimentacao_regional: {
        Row: {
          color: string
          created_at: string
          crescimento: number
          id: string
          participacao: number
          regiao: string
          toneladas: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          crescimento: number
          id?: string
          participacao: number
          regiao: string
          toneladas: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          crescimento?: number
          id?: string
          participacao?: number
          regiao?: string
          toneladas?: number
          updated_at?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          adherence_score: number | null
          author_name: string | null
          cleaned_content: string | null
          created_at: string
          duplicate_group_id: string | null
          executive_summary_pt: string | null
          fetched_at: string
          geographic_scope: string | null
          id: string
          image_url: string | null
          importance_level: string | null
          is_classified: boolean
          is_duplicate: boolean
          is_featured: boolean
          market_impact_label: string | null
          original_category: string | null
          original_url: string
          published_at: string | null
          raw_content: string | null
          relevance_score: number | null
          sentiment_label: string | null
          slug: string | null
          source_id: string | null
          strategic_analysis_json: Json | null
          subtitle: string | null
          title: string
          translated_content_pt: string | null
          updated_at: string
        }
        Insert: {
          adherence_score?: number | null
          author_name?: string | null
          cleaned_content?: string | null
          created_at?: string
          duplicate_group_id?: string | null
          executive_summary_pt?: string | null
          fetched_at?: string
          geographic_scope?: string | null
          id?: string
          image_url?: string | null
          importance_level?: string | null
          is_classified?: boolean
          is_duplicate?: boolean
          is_featured?: boolean
          market_impact_label?: string | null
          original_category?: string | null
          original_url: string
          published_at?: string | null
          raw_content?: string | null
          relevance_score?: number | null
          sentiment_label?: string | null
          slug?: string | null
          source_id?: string | null
          strategic_analysis_json?: Json | null
          subtitle?: string | null
          title: string
          translated_content_pt?: string | null
          updated_at?: string
        }
        Update: {
          adherence_score?: number | null
          author_name?: string | null
          cleaned_content?: string | null
          created_at?: string
          duplicate_group_id?: string | null
          executive_summary_pt?: string | null
          fetched_at?: string
          geographic_scope?: string | null
          id?: string
          image_url?: string | null
          importance_level?: string | null
          is_classified?: boolean
          is_duplicate?: boolean
          is_featured?: boolean
          market_impact_label?: string | null
          original_category?: string | null
          original_url?: string
          published_at?: string | null
          raw_content?: string | null
          relevance_score?: number | null
          sentiment_label?: string | null
          slug?: string | null
          source_id?: string | null
          strategic_analysis_json?: Json | null
          subtitle?: string | null
          title?: string
          translated_content_pt?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "news_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      news_sources: {
        Row: {
          base_url: string
          country: string
          created_at: string
          id: string
          is_active: boolean
          language: string
          last_fetch_at: string | null
          name: string
          priority_level: number
          refresh_interval_minutes: number
          sector_focus: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          base_url: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          last_fetch_at?: string | null
          name: string
          priority_level?: number
          refresh_interval_minutes?: number
          sector_focus?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          last_fetch_at?: string | null
          name?: string
          priority_level?: number
          refresh_interval_minutes?: number
          sector_focus?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      perfil_carga: {
        Row: {
          color: string
          created_at: string
          crescimento: number
          id: string
          participacao: number
          tipo: string
          toneladas_2025: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          crescimento: number
          id?: string
          participacao: number
          tipo: string
          toneladas_2025: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          crescimento?: number
          id?: string
          participacao?: number
          tipo?: string
          toneladas_2025?: number
          updated_at?: string
        }
        Relationships: []
      }
      portos: {
        Row: {
          created_at: string
          crescimento_yoy: number
          destaque: string | null
          hinterland: string | null
          id: string
          latitude: number | null
          longitude: number | null
          movimentacao_ton_2024: number
          movimentacao_ton_2025: number
          nome: string
          perfil_carga: string[]
          potencial_retro: string
          principais_mercadorias: string[]
          regiao: string
          teu_anual: number | null
          teu_crescimento: number | null
          tipo: string
          uf: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crescimento_yoy: number
          destaque?: string | null
          hinterland?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          movimentacao_ton_2024: number
          movimentacao_ton_2025: number
          nome: string
          perfil_carga?: string[]
          potencial_retro: string
          principais_mercadorias?: string[]
          regiao: string
          teu_anual?: number | null
          teu_crescimento?: number | null
          tipo: string
          uf: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crescimento_yoy?: number
          destaque?: string | null
          hinterland?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          movimentacao_ton_2024?: number
          movimentacao_ton_2025?: number
          nome?: string
          perfil_carga?: string[]
          potencial_retro?: string
          principais_mercadorias?: string[]
          regiao?: string
          teu_anual?: number | null
          teu_crescimento?: number | null
          tipo?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      portos_sc: {
        Row: {
          created_at: string
          crescimento_2024: number
          crescimento_2025: number
          destaque: string
          especialidade: string
          id: string
          movimentacao_ton_2024: number
          movimentacao_ton_2025: number
          nome: string
          teu_2025: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crescimento_2024: number
          crescimento_2025: number
          destaque: string
          especialidade: string
          id?: string
          movimentacao_ton_2024: number
          movimentacao_ton_2025: number
          nome: string
          teu_2025?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crescimento_2024?: number
          crescimento_2025?: number
          destaque?: string
          especialidade?: string
          id?: string
          movimentacao_ton_2024?: number
          movimentacao_ton_2025?: number
          nome?: string
          teu_2025?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      redex: {
        Row: {
          cidade: string
          created_at: string
          id: string
          nome: string
          regiao_fiscal: string
          tipo: string
          uf: string
          updated_at: string
        }
        Insert: {
          cidade: string
          created_at?: string
          id?: string
          nome: string
          regiao_fiscal: string
          tipo: string
          uf: string
          updated_at?: string
        }
        Update: {
          cidade?: string
          created_at?: string
          id?: string
          nome?: string
          regiao_fiscal?: string
          tipo?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      serie_historica: {
        Row: {
          ano: number
          cabotagem: number
          conteineres: number
          created_at: string
          id: string
          longo_curso: number
          teu: number
          total: number
          updated_at: string
        }
        Insert: {
          ano: number
          cabotagem: number
          conteineres: number
          created_at?: string
          id?: string
          longo_curso: number
          teu: number
          total: number
          updated_at?: string
        }
        Update: {
          ano?: number
          cabotagem?: number
          conteineres?: number
          created_at?: string
          id?: string
          longo_curso?: number
          teu?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          created_at: string
          id: string
          module_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      buy_ai_metrics_daily: {
        Row: {
          avg_confidence: number | null
          avg_response_ms: number | null
          day: string | null
          error_count: number | null
          external_ai_count: number | null
          feedback_negative: number | null
          feedback_positive: number | null
          library_backed_count: number | null
          total_questions: number | null
          unique_users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_key: string
          p_max: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      get_mcp_bearer: {
        Args: { p_connection_id: string; p_key: string }
        Returns: string
      }
      match_library_chunks: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          category_id: string
          chunk_id: string
          chunk_index: number
          content: string
          doc_slug: string
          doc_summary: string
          doc_tags: string[]
          doc_title: string
          document_id: string
          similarity: number
        }[]
      }
      restore_library_document_version: {
        Args: { p_note?: string; p_version_id: string }
        Returns: string
      }
      search_library: {
        Args: { p_query: string }
        Returns: {
          category_id: string
          id: string
          rank: number
          slug: string
          summary: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      set_mcp_bearer: {
        Args: { p_bearer: string; p_connection_id: string; p_key: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      buy_ai_corp_memory_status:
        | "pendente"
        | "aprovado"
        | "rejeitado"
        | "arquivado"
      buy_ai_feedback_rating:
        | "util"
        | "nao_util"
        | "incompleta"
        | "incorreta"
        | "precisa_revisar"
        | "virar_documento"
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
      app_role: ["admin", "user"],
      buy_ai_corp_memory_status: [
        "pendente",
        "aprovado",
        "rejeitado",
        "arquivado",
      ],
      buy_ai_feedback_rating: [
        "util",
        "nao_util",
        "incompleta",
        "incorreta",
        "precisa_revisar",
        "virar_documento",
      ],
    },
  },
} as const
