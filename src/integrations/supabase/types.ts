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
      ad_copies: {
        Row: {
          adapted_from_id: string | null
          body: string | null
          campaign_id: string
          created_at: string
          cta: string | null
          framework_applied: string | null
          headline: string | null
          id: string
          locale: string
          platform: string
          rationale: string | null
          status: string
          variant_label: string | null
        }
        Insert: {
          adapted_from_id?: string | null
          body?: string | null
          campaign_id: string
          created_at?: string
          cta?: string | null
          framework_applied?: string | null
          headline?: string | null
          id?: string
          locale?: string
          platform: string
          rationale?: string | null
          status?: string
          variant_label?: string | null
        }
        Update: {
          adapted_from_id?: string | null
          body?: string | null
          campaign_id?: string
          created_at?: string
          cta?: string | null
          framework_applied?: string | null
          headline?: string | null
          id?: string
          locale?: string
          platform?: string
          rationale?: string | null
          status?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_copies_adapted_from_id_fkey"
            columns: ["adapted_from_id"]
            isOneToOne: false
            referencedRelation: "ad_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_copies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_log: {
        Row: {
          cost_estimate: number | null
          created_at: string
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          owner_id: string | null
          project_id: string | null
          provider: string
          task: string
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          owner_id?: string | null
          project_id?: string | null
          provider: string
          task: string
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          owner_id?: string | null
          project_id?: string | null
          provider?: string
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          available_channels: Json
          brand_colors: Json | null
          content_pillars: Json | null
          id: string
          personas: Json | null
          project_id: string
          tone_of_voice: string | null
          updated_at: string
          usps: Json | null
        }
        Insert: {
          available_channels?: Json
          brand_colors?: Json | null
          content_pillars?: Json | null
          id?: string
          personas?: Json | null
          project_id: string
          tone_of_voice?: string | null
          updated_at?: string
          usps?: Json | null
        }
        Update: {
          available_channels?: Json
          brand_colors?: Json | null
          content_pillars?: Json | null
          id?: string
          personas?: Json | null
          project_id?: string
          tone_of_voice?: string | null
          updated_at?: string
          usps?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          archived: boolean
          campaign_plan: Json | null
          channels: Json
          cloned_from_id: string | null
          created_at: string
          end_date: string | null
          id: string
          is_template: boolean
          objective: string
          project_id: string
          start_date: string | null
          status: string
        }
        Insert: {
          archived?: boolean
          campaign_plan?: Json | null
          channels?: Json
          cloned_from_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_template?: boolean
          objective: string
          project_id: string
          start_date?: string | null
          status?: string
        }
        Update: {
          archived?: boolean
          campaign_plan?: Json | null
          channels?: Json
          cloned_from_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_template?: boolean
          objective?: string
          project_id?: string
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_sites: {
        Row: {
          created_at: string
          error_message: string | null
          expires_at: string | null
          id: string
          label: string
          last_connected_at: string | null
          login_url: string
          project_id: string
          session_data_encrypted: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          label: string
          last_connected_at?: string | null
          login_url: string
          project_id: string
          session_data_encrypted?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          last_connected_at?: string | null
          login_url?: string
          project_id?: string
          session_data_encrypted?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          adapted_from_id: string | null
          campaign_id: string
          content_type: string | null
          copy: string | null
          created_at: string
          external_post_id: string | null
          framework_applied: string | null
          id: string
          image_source: string | null
          image_url: string | null
          locale: string
          media_brief: string | null
          platform: string
          publish_error: string | null
          published_at: string | null
          rationale: string | null
          scheduled_date: string | null
          status: string
        }
        Insert: {
          adapted_from_id?: string | null
          campaign_id: string
          content_type?: string | null
          copy?: string | null
          created_at?: string
          external_post_id?: string | null
          framework_applied?: string | null
          id?: string
          image_source?: string | null
          image_url?: string | null
          locale?: string
          media_brief?: string | null
          platform: string
          publish_error?: string | null
          published_at?: string | null
          rationale?: string | null
          scheduled_date?: string | null
          status?: string
        }
        Update: {
          adapted_from_id?: string | null
          campaign_id?: string
          content_type?: string | null
          copy?: string | null
          created_at?: string
          external_post_id?: string | null
          framework_applied?: string | null
          id?: string
          image_source?: string | null
          image_url?: string | null
          locale?: string
          media_brief?: string | null
          platform?: string
          publish_error?: string | null
          published_at?: string | null
          rationale?: string | null
          scheduled_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_adapted_from_id_fkey"
            columns: ["adapted_from_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          captured_at: string
          clicks: number | null
          comments: number | null
          content_item_id: string
          conversions: number | null
          created_at: string
          id: string
          impressions: number | null
          likes: number | null
          period_end: string | null
          period_start: string | null
          raw: Json | null
          reach: number | null
          saves: number | null
          shares: number | null
          source: string
          spend: number | null
        }
        Insert: {
          captured_at?: string
          clicks?: number | null
          comments?: number | null
          content_item_id: string
          conversions?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          likes?: number | null
          period_end?: string | null
          period_start?: string | null
          raw?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          source?: string
          spend?: number | null
        }
        Update: {
          captured_at?: string
          clicks?: number | null
          comments?: number | null
          content_item_id?: string
          conversions?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          likes?: number | null
          period_end?: string | null
          period_start?: string | null
          raw?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          source?: string
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          website_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          website_url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          website_url?: string
        }
        Relationships: []
      }
      publish_jobs: {
        Row: {
          attempts: number
          content_item_id: string
          created_at: string
          id: string
          last_error: string | null
          scheduled_for: string
          status: string
        }
        Insert: {
          attempts?: number
          content_item_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          scheduled_for: string
          status?: string
        }
        Update: {
          attempts?: number
          content_item_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_jobs_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token_encrypted: string | null
          account_name: string | null
          account_ref: string | null
          connection_type: string
          created_at: string
          expires_at: string | null
          id: string
          platform: string
          project_id: string
          refresh_token_encrypted: string | null
          scopes: Json | null
          status: string
        }
        Insert: {
          access_token_encrypted?: string | null
          account_name?: string | null
          account_ref?: string | null
          connection_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          platform: string
          project_id: string
          refresh_token_encrypted?: string | null
          scopes?: Json | null
          status?: string
        }
        Update: {
          access_token_encrypted?: string | null
          account_name?: string | null
          account_ref?: string | null
          connection_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          platform?: string
          project_id?: string
          refresh_token_encrypted?: string | null
          scopes?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          owner_id: string
          plan: string
          provider: string | null
          provider_ref: string | null
          status: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          owner_id: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          owner_id?: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          ai_tokens_used: number
          campaigns_generated: number
          created_at: string
          id: string
          images_generated: number
          owner_id: string
          period_month: string
        }
        Insert: {
          ai_tokens_used?: number
          campaigns_generated?: number
          created_at?: string
          id?: string
          images_generated?: number
          owner_id: string
          period_month: string
        }
        Update: {
          ai_tokens_used?: number
          campaigns_generated?: number
          created_at?: string
          id?: string
          images_generated?: number
          owner_id?: string
          period_month?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_analysis: {
        Row: {
          ai_analysis: Json | null
          analyzed_at: string
          error_message: string | null
          id: string
          pages_scraped: Json | null
          project_id: string
          status: string
        }
        Insert: {
          ai_analysis?: Json | null
          analyzed_at?: string
          error_message?: string | null
          id?: string
          pages_scraped?: Json | null
          project_id: string
          status?: string
        }
        Update: {
          ai_analysis?: Json | null
          analyzed_at?: string
          error_message?: string | null
          id?: string
          pages_scraped?: Json | null
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_analysis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      owns_project: { Args: { _project_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
