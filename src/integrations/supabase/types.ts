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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_banners: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          sort_order: number | null
          starts_at: string | null
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_visible_public: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_visible_public?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_visible_public?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_section_settings: {
        Row: {
          created_at: string
          custom_config: Json | null
          description: string | null
          display_mode: string | null
          id: string
          is_enabled: boolean | null
          item_limit: number | null
          section_key: string
          sort_order: number | null
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_config?: Json | null
          description?: string | null
          display_mode?: string | null
          id?: string
          is_enabled?: boolean | null
          item_limit?: number | null
          section_key: string
          sort_order?: number | null
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_config?: Json | null
          description?: string | null
          display_mode?: string | null
          id?: string
          is_enabled?: boolean | null
          item_limit?: number | null
          section_key?: string
          sort_order?: number | null
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          categoria_id: string | null
          created_at: string
          descripcion: string | null
          descripcion_corta: string | null
          id: string
          imagen_principal: string | null
          images: string[] | null
          is_active: boolean | null
          metadata: Json | null
          nombre: string
          precio_mayorista: number
          precio_venta: number | null
          sku_interno: string
          stock: number | null
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          descripcion_corta?: string | null
          id?: string
          imagen_principal?: string | null
          images?: string[] | null
          is_active?: boolean | null
          metadata?: Json | null
          nombre: string
          precio_mayorista?: number
          precio_venta?: number | null
          sku_interno: string
          stock?: number | null
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          descripcion_corta?: string | null
          id?: string
          imagen_principal?: string | null
          images?: string[] | null
          is_active?: boolean | null
          metadata?: Json | null
          nombre?: string
          precio_mayorista?: number
          precio_venta?: number | null
          sku_interno?: string
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_catalog: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          images: string[] | null
          imported_at: string | null
          is_active: boolean | null
          metadata: Json | null
          nombre: string
          precio_costo: number | null
          precio_venta: number
          seller_id: string
          seller_store_id: string | null
          sku: string
          source_product_id: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          images?: string[] | null
          imported_at?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          nombre: string
          precio_costo?: number | null
          precio_venta: number
          seller_id: string
          seller_store_id?: string | null
          sku: string
          source_product_id?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          images?: string[] | null
          imported_at?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          nombre?: string
          precio_costo?: number | null
          precio_venta?: number
          seller_id?: string
          seller_store_id?: string | null
          sku?: string
          source_product_id?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_catalog_seller_store_id_fkey"
            columns: ["seller_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_catalog_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          banner: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          logo: string | null
          name: string
          owner_id: string
          slug: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          banner?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo?: string | null
          name: string
          owner_id: string
          slug: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          banner?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo?: string | null
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
          whatsapp?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "seller" | "staff_pickup"
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
      app_role: ["admin", "moderator", "user", "seller", "staff_pickup"],
    },
  },
} as const
