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
      active_promos: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number
          discount_type: string
          expiry_timestamp: string
          id: string
          label: string
          promo_code: string | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          discount_type?: string
          expiry_timestamp?: string
          id?: string
          label: string
          promo_code?: string | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          discount_type?: string
          expiry_timestamp?: string
          id?: string
          label?: string
          promo_code?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_promos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          category: string | null
          confidence: string
          context_tags: string[]
          cooking_method: string | null
          created_at: string
          cuisine_region: string | null
          description: string | null
          dietary_tags: string[]
          diet_class: string
          dietary_modifiers: string[]
          contains_dairy: boolean
          contains_eggs: boolean
          contains_nuts: boolean
          gluten_free: boolean
          dosha_fit: string | null
          energy_tags: string[]
          glycemic_load: string | null
          grain_class: string
          id: string
          inflammation_score: number | null
          last_verified_at: string | null
          name: string
          oil_profile: string
          price: number | null
          purity_tier: string
          restaurant_id: string
          source_url: string | null
        }
        Insert: {
          category?: string | null
          confidence?: string
          context_tags?: string[]
          cooking_method?: string | null
          created_at?: string
          cuisine_region?: string | null
          description?: string | null
          dietary_tags?: string[]
          diet_class?: string
          dietary_modifiers?: string[]
          contains_dairy?: boolean
          contains_eggs?: boolean
          contains_nuts?: boolean
          gluten_free?: boolean
          dosha_fit?: string | null
          energy_tags?: string[]
          glycemic_load?: string | null
          grain_class?: string
          id?: string
          inflammation_score?: number | null
          last_verified_at?: string | null
          name: string
          oil_profile?: string
          price?: number | null
          purity_tier?: string
          restaurant_id: string
          source_url?: string | null
        }
        Update: {
          category?: string | null
          confidence?: string
          context_tags?: string[]
          cooking_method?: string | null
          created_at?: string
          cuisine_region?: string | null
          description?: string | null
          dietary_tags?: string[]
          diet_class?: string
          dietary_modifiers?: string[]
          contains_dairy?: boolean
          contains_eggs?: boolean
          contains_nuts?: boolean
          gluten_free?: boolean
          dosha_fit?: string | null
          energy_tags?: string[]
          glycemic_load?: string | null
          grain_class?: string
          id?: string
          inflammation_score?: number | null
          last_verified_at?: string | null
          name?: string
          oil_profile?: string
          price?: number | null
          purity_tier?: string
          restaurant_id?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes_feedback: {
        Row: {
          created_at: string
          dials_snapshot: Json
          dish_id: string
          id: string
          note: string | null
          persona: string | null
          thumbs: string
        }
        Insert: {
          created_at?: string
          dials_snapshot?: Json
          dish_id: string
          id?: string
          note?: string | null
          persona?: string | null
          thumbs: string
        }
        Update: {
          created_at?: string
          dials_snapshot?: Json
          dish_id?: string
          id?: string
          note?: string | null
          persona?: string | null
          thumbs?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_feedback_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_selections: {
        Row: {
          carrier: string | null
          checkin_at: string | null
          checkin_digestion: string | null
          checkin_energy: string | null
          checkin_reorder: boolean | null
          checkin_status: string | null
          chose_outcome_rank: number | null
          created_at: string
          device_id: string
          dials_snapshot: Json
          dish: string
          id: string
          path: string
          restaurant_id: string
          restaurant_name: string
          vitality_score: number | null
        }
        Insert: {
          carrier?: string | null
          checkin_at?: string | null
          checkin_digestion?: string | null
          checkin_energy?: string | null
          checkin_reorder?: boolean | null
          checkin_status?: string | null
          chose_outcome_rank?: number | null
          created_at?: string
          device_id: string
          dials_snapshot?: Json
          dish: string
          id?: string
          path: string
          restaurant_id: string
          restaurant_name: string
          vitality_score?: number | null
        }
        Update: {
          carrier?: string | null
          checkin_at?: string | null
          checkin_digestion?: string | null
          checkin_energy?: string | null
          checkin_reorder?: boolean | null
          checkin_status?: string | null
          chose_outcome_rank?: number | null
          created_at?: string
          device_id?: string
          dials_snapshot?: Json
          dish?: string
          id?: string
          path?: string
          restaurant_id?: string
          restaurant_name?: string
          vitality_score?: number | null
        }
        Relationships: []
      }
      restaurant_sources: {
        Row: {
          id: string
          notes: string | null
          parse_confidence: string
          restaurant_id: string
          scraped_at: string
          source_url: string
        }
        Insert: {
          id?: string
          notes?: string | null
          parse_confidence?: string
          restaurant_id: string
          scraped_at?: string
          source_url: string
        }
        Update: {
          id?: string
          notes?: string | null
          parse_confidence?: string
          restaurant_id?: string
          scraped_at?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_sources_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          anti_inflammatory: boolean
          base_purity_tier: string | null
          context_tags: string[]
          created_at: string
          cuisine: string
          dish_outcome: string
          doordash_url: string | null
          energy_tags: string[]
          grain_profile: string
          id: string
          location_neighborhood: string | null
          dietary_certifications: string[]
          menu_items: Json
          name: string
          oil_profile: string
          price_tier: number
          purity_tier: string
          signature_dish: string
          sovereign_seal: boolean
          ubereats_url: string | null
          verified_clean_oils: boolean
        }
        Insert: {
          anti_inflammatory?: boolean
          base_purity_tier?: string | null
          context_tags?: string[]
          created_at?: string
          cuisine: string
          dish_outcome: string
          doordash_url?: string | null
          energy_tags?: string[]
          grain_profile?: string
          id?: string
          location_neighborhood?: string | null
          dietary_certifications?: string[]
          menu_items?: Json
          name: string
          oil_profile?: string
          price_tier?: number
          purity_tier: string
          signature_dish: string
          sovereign_seal?: boolean
          ubereats_url?: string | null
          verified_clean_oils?: boolean
        }
        Update: {
          anti_inflammatory?: boolean
          base_purity_tier?: string | null
          context_tags?: string[]
          created_at?: string
          cuisine?: string
          dish_outcome?: string
          doordash_url?: string | null
          energy_tags?: string[]
          grain_profile?: string
          id?: string
          location_neighborhood?: string | null
          dietary_certifications?: string[]
          menu_items?: Json
          name?: string
          oil_profile?: string
          price_tier?: number
          purity_tier?: string
          signature_dish?: string
          sovereign_seal?: boolean
          ubereats_url?: string | null
          verified_clean_oils?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_outcome_checkin: {
        Args: {
          p_device_id: string
          p_digestion: string
          p_energy: string
          p_id: string
          p_reorder: boolean
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
