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
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean | null
          label: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          preferred_pickup_point_id: string | null
          state: string | null
          street_address: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean | null
          label?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_pickup_point_id?: string | null
          state?: string | null
          street_address: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean | null
          label?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_pickup_point_id?: string | null
          state?: string | null
          street_address?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_preferred_pickup_point_id_fkey"
            columns: ["preferred_pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_approval_requests: {
        Row: {
          admin_comments: string | null
          amount: number | null
          created_at: string
          id: string
          metadata: Json | null
          request_type: Database["public"]["Enums"]["approval_request_type"]
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          updated_at: string
        }
        Insert: {
          admin_comments?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          request_type: Database["public"]["Enums"]["approval_request_type"]
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string
        }
        Update: {
          admin_comments?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          request_type?: Database["public"]["Enums"]["approval_request_type"]
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
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
          target_audience: string
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
          target_audience?: string
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
          target_audience?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_processing_items: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          original_url: string
          public_url: string | null
          retry_count: number | null
          row_index: number
          sku_interno: string
          status: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          original_url: string
          public_url?: string | null
          retry_count?: number | null
          row_index: number
          sku_interno: string
          status?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          original_url?: string
          public_url?: string | null
          retry_count?: number | null
          row_index?: number
          sku_interno?: string
          status?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_processing_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "asset_processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_processing_jobs: {
        Row: {
          created_at: string
          failed_assets: number | null
          id: string
          metadata: Json | null
          processed_assets: number | null
          status: string | null
          total_assets: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          failed_assets?: number | null
          id?: string
          metadata?: Json | null
          processed_assets?: number | null
          status?: string | null
          total_assets?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          failed_assets?: number | null
          id?: string
          metadata?: Json | null
          processed_assets?: number | null
          status?: string | null
          total_assets?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      attribute_options: {
        Row: {
          attribute_id: string
          color_hex: string | null
          created_at: string | null
          display_value: string
          id: string
          image_url: string | null
          is_active: boolean | null
          metadata: Json | null
          sort_order: number | null
          value: string
        }
        Insert: {
          attribute_id: string
          color_hex?: string | null
          created_at?: string | null
          display_value: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          sort_order?: number | null
          value: string
        }
        Update: {
          attribute_id?: string
          color_hex?: string | null
          created_at?: string | null
          display_value?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          sort_order?: number | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          attribute_type: string
          category_hint: string | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          render_type: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          attribute_type?: string
          category_hint?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          render_type?: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          attribute_type?: string
          category_hint?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          render_type?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      b2b_batches: {
        Row: {
          batch_code: string
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_id: string | null
          purchase_date: string | null
          status: string | null
          supplier_id: string | null
          total_cost: number | null
          total_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          batch_code: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          purchase_date?: string | null
          status?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          total_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_code?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          purchase_date?: string | null
          status?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          total_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_batches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_cart_items: {
        Row: {
          cart_id: string
          color: string | null
          created_at: string | null
          id: string
          image: string | null
          metadata: Json | null
          nombre: string
          product_id: string | null
          quantity: number
          size: string | null
          sku: string
          total_price: number
          unit_price: number
          variant_attributes: Json | null
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          metadata?: Json | null
          nombre: string
          product_id?: string | null
          quantity: number
          size?: string | null
          sku: string
          total_price: number
          unit_price: number
          variant_attributes?: Json | null
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          metadata?: Json | null
          nombre?: string
          product_id?: string | null
          quantity?: number
          size?: string | null
          sku?: string
          total_price?: number
          unit_price?: number
          variant_attributes?: Json | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "b2b_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "b2b_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_variantes_con_precio_b2b"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_carts: {
        Row: {
          buyer_user_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          buyer_user_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          buyer_user_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      b2b_margin_ranges: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          margin_percent: number
          max_cost: number | null
          min_cost: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          margin_percent?: number
          max_cost?: number | null
          min_cost?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          margin_percent?: number
          max_cost?: number | null
          min_cost?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      b2b_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_number: string
          reference: string
          seller_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_number: string
          reference: string
          seller_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_number?: string
          reference?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      b2c_cart_items: {
        Row: {
          cart_id: string
          color: string | null
          created_at: string | null
          id: string
          image: string | null
          metadata: Json | null
          nombre: string
          quantity: number
          seller_catalog_id: string | null
          size: string | null
          sku: string
          store_id: string | null
          store_name: string | null
          store_whatsapp: string | null
          total_price: number
          unit_price: number
          variant_attributes: Json | null
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          metadata?: Json | null
          nombre: string
          quantity?: number
          seller_catalog_id?: string | null
          size?: string | null
          sku: string
          store_id?: string | null
          store_name?: string | null
          store_whatsapp?: string | null
          total_price: number
          unit_price: number
          variant_attributes?: Json | null
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          metadata?: Json | null
          nombre?: string
          quantity?: number
          seller_catalog_id?: string | null
          size?: string | null
          sku?: string
          store_id?: string | null
          store_name?: string | null
          store_whatsapp?: string | null
          total_price?: number
          unit_price?: number
          variant_attributes?: Json | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2c_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "b2c_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2c_cart_items_seller_catalog_id_fkey"
            columns: ["seller_catalog_id"]
            isOneToOne: false
            referencedRelation: "seller_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2c_cart_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      b2c_carts: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      batch_inventory: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          quantity_available: number | null
          quantity_purchased: number | null
          quantity_sold: number | null
          unit_cost: number | null
          updated_at: string | null
          variant_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          quantity_available?: number | null
          quantity_purchased?: number | null
          quantity_sold?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          variant_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          quantity_available?: number | null
          quantity_purchased?: number | null
          quantity_sold?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_inventory_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "b2b_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_variantes_con_precio_b2b"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_click_tracking: {
        Row: {
          clicked_at: string | null
          converted_at: string | null
          converted_to_cart: boolean | null
          device_type: string | null
          id: string
          ip_hash: string | null
          product_id: string | null
          seller_id: string | null
          source_campaign: string | null
          source_type: string | null
          user_agent: string | null
          variant_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          converted_at?: string | null
          converted_to_cart?: boolean | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          product_id?: string | null
          seller_id?: string | null
          source_campaign?: string | null
          source_type?: string | null
          user_agent?: string | null
          variant_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          converted_at?: string | null
          converted_to_cart?: boolean | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          product_id?: string | null
          seller_id?: string | null
          source_campaign?: string | null
          source_type?: string | null
          user_agent?: string | null
          variant_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_visible_public: boolean
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
          is_visible_public?: boolean
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
          is_visible_public?: boolean
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
      category_attribute_templates: {
        Row: {
          attribute_display_name: string
          attribute_name: string
          attribute_type: string | null
          category_id: string | null
          created_at: string | null
          id: string
          is_required: boolean | null
          render_type: string | null
          sort_order: number | null
          suggested_values: string[] | null
          updated_at: string | null
        }
        Insert: {
          attribute_display_name: string
          attribute_name: string
          attribute_type?: string | null
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          render_type?: string | null
          sort_order?: number | null
          suggested_values?: string[] | null
          updated_at?: string | null
        }
        Update: {
          attribute_display_name?: string
          attribute_name?: string
          attribute_type?: string | null
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          render_type?: string | null
          sort_order?: number | null
          suggested_values?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_attribute_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_shipping_rates: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          fixed_fee: number
          id: string
          is_active: boolean | null
          percentage_fee: number
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          fixed_fee?: number
          id?: string
          is_active?: boolean | null
          percentage_fee?: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          fixed_fee?: number
          id?: string
          is_active?: boolean | null
          percentage_fee?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_shipping_rates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_debts: {
        Row: {
          commission_amount: number
          created_at: string | null
          id: string
          is_paid: boolean | null
          metadata: Json | null
          order_id: string | null
          order_type: string | null
          paid_at: string | null
          paid_from_wallet: boolean | null
          payment_method: string
          sale_amount: number
          seller_id: string
          tax_amount: number | null
          total_debt: number
          wallet_id: string | null
        }
        Insert: {
          commission_amount: number
          created_at?: string | null
          id?: string
          is_paid?: boolean | null
          metadata?: Json | null
          order_id?: string | null
          order_type?: string | null
          paid_at?: string | null
          paid_from_wallet?: boolean | null
          payment_method: string
          sale_amount: number
          seller_id: string
          tax_amount?: number | null
          total_debt: number
          wallet_id?: string | null
        }
        Update: {
          commission_amount?: number
          created_at?: string | null
          id?: string
          is_paid?: boolean | null
          metadata?: Json | null
          order_id?: string | null
          order_type?: string | null
          paid_at?: string | null
          paid_from_wallet?: boolean | null
          payment_method?: string
          sale_amount?: number
          seller_id?: string
          tax_amount?: number | null
          total_debt?: number
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_debts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "seller_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_overrides: {
        Row: {
          category_id: string | null
          commission_rate: number
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          reason: string | null
          seller_id: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          category_id?: string | null
          commission_rate: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          seller_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          category_id?: string | null
          commission_rate?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          seller_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_overrides_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      communes: {
        Row: {
          code: string
          created_at: string | null
          delivery_fee: number
          department_id: string
          extra_department_fee: number
          id: string
          is_active: boolean | null
          name: string
          operational_fee: number
          rate_per_lb: number
          shipping_zone_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          delivery_fee?: number
          department_id: string
          extra_department_fee?: number
          id?: string
          is_active?: boolean | null
          name: string
          operational_fee?: number
          rate_per_lb?: number
          shipping_zone_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          delivery_fee?: number
          department_id?: string
          extra_department_fee?: number
          id?: string
          is_active?: boolean | null
          name?: string
          operational_fee?: number
          rate_per_lb?: number
          shipping_zone_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communes_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidation_settings: {
        Row: {
          consolidation_mode: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_auto_close_at: string | null
          next_scheduled_close_at: string | null
          notify_on_close: boolean | null
          notify_threshold_percent: number | null
          order_quantity_threshold: number | null
          time_interval_hours: number | null
          updated_at: string | null
        }
        Insert: {
          consolidation_mode?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_auto_close_at?: string | null
          next_scheduled_close_at?: string | null
          notify_on_close?: boolean | null
          notify_threshold_percent?: number | null
          order_quantity_threshold?: number | null
          time_interval_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          consolidation_mode?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_auto_close_at?: string | null
          next_scheduled_close_at?: string | null
          notify_on_close?: boolean | null
          notify_threshold_percent?: number | null
          order_quantity_threshold?: number | null
          time_interval_hours?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_movements: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          movement_type: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          movement_type: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          movement_type?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customer_discounts: {
        Row: {
          created_at: string | null
          created_by: string
          customer_user_id: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          reason: string | null
          store_id: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          customer_user_id: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          reason?: string | null
          store_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          customer_user_id?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          reason?: string | null
          store_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_discounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ratings: {
        Row: {
          created_at: string | null
          customer_user_id: string
          delivery_comment: string | null
          delivery_rating: number | null
          id: string
          is_anonymous: boolean | null
          metadata: Json | null
          order_delivery_id: string | null
          order_id: string
          order_type: string | null
          product_comment: string | null
          product_rating: number | null
          rated_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_user_id: string
          delivery_comment?: string | null
          delivery_rating?: number | null
          id?: string
          is_anonymous?: boolean | null
          metadata?: Json | null
          order_delivery_id?: string | null
          order_id: string
          order_type?: string | null
          product_comment?: string | null
          product_rating?: number | null
          rated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_user_id?: string
          delivery_comment?: string | null
          delivery_rating?: number | null
          id?: string
          is_anonymous?: boolean | null
          metadata?: Json | null
          order_delivery_id?: string | null
          order_id?: string
          order_type?: string | null
          product_comment?: string | null
          product_rating?: number | null
          rated_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      destination_countries: {
        Row: {
          code: string
          created_at: string
          currency: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_code_uses: {
        Row: {
          discount_applied: number
          discount_code_id: string
          id: string
          order_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          discount_applied: number
          discount_code_id: string
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          discount_applied?: number
          discount_code_id?: string
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_uses_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applicable_ids: string[] | null
          applies_to: string | null
          code: string
          created_at: string | null
          created_by: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_user: number | null
          min_purchase_amount: number | null
          store_id: string | null
          updated_at: string | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_ids?: string[] | null
          applies_to?: string | null
          code: string
          created_at?: string | null
          created_by: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_purchase_amount?: number | null
          store_id?: string | null
          updated_at?: string | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_ids?: string[] | null
          applies_to?: string | null
          code?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_purchase_amount?: number | null
          store_id?: string | null
          updated_at?: string | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_expenses: {
        Row: {
          applies_to: string | null
          created_at: string | null
          expense_name: string
          expense_type: string
          expense_value: number
          id: string
          is_active: boolean | null
          nombre_gasto: string | null
          operacion: string | null
          sort_order: number | null
          tipo: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          applies_to?: string | null
          created_at?: string | null
          expense_name: string
          expense_type?: string
          expense_value?: number
          id?: string
          is_active?: boolean | null
          nombre_gasto?: string | null
          operacion?: string | null
          sort_order?: number | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          applies_to?: string | null
          created_at?: string | null
          expense_name?: string
          expense_type?: string
          expense_value?: number
          id?: string
          is_active?: boolean | null
          nombre_gasto?: string | null
          operacion?: string | null
          sort_order?: number | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          change_amount: number
          created_at: string | null
          created_by: string | null
          id: string
          new_stock: number | null
          previous_stock: number | null
          product_id: string | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          seller_catalog_id: string | null
        }
        Insert: {
          change_amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_stock?: number | null
          previous_stock?: number | null
          product_id?: string | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          seller_catalog_id?: string | null
        }
        Update: {
          change_amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_stock?: number | null
          previous_stock?: number | null
          product_id?: string | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          seller_catalog_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_seller_catalog_id_fkey"
            columns: ["seller_catalog_id"]
            isOneToOne: false
            referencedRelation: "seller_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          address_proof_url: string | null
          admin_comments: string | null
          business_registration_url: string | null
          created_at: string
          document_back_url: string | null
          document_front_url: string | null
          document_number: string | null
          document_type: string | null
          id: string
          metadata: Json | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["verification_status"] | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_proof_url?: string | null
          admin_comments?: string | null
          business_registration_url?: string | null
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_type?: string | null
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_proof_url?: string | null
          admin_comments?: string | null
          business_registration_url?: string | null
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_type?: string | null
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_payment_methods: {
        Row: {
          account_holder: string | null
          account_number: string | null
          account_type: string | null
          bank_name: string | null
          created_at: string
          currency: string | null
          holder_name: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          market_id: string
          metadata: Json | null
          method_type: string
          name: string
          phone_number: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          holder_name?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          market_id: string
          metadata?: Json | null
          method_type: string
          name: string
          phone_number?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          holder_name?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          market_id?: string
          metadata?: Json | null
          method_type?: string
          name?: string
          phone_number?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_payment_methods_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_payment_methods_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["market_id"]
          },
          {
            foreignKeyName: "market_payment_methods_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["market_id"]
          },
        ]
      }
      marketplace_section_settings: {
        Row: {
          created_at: string | null
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
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
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
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
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
          updated_at?: string | null
        }
        Relationships: []
      }
      markets: {
        Row: {
          code: string
          created_at: string
          currency: string | null
          description: string | null
          destination_country_id: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          shipping_route_id: string | null
          sort_order: number | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_country_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          shipping_route_id?: string | null
          sort_order?: number | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_country_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          shipping_route_id?: string | null
          sort_order?: number | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "destination_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["destination_country_id"]
          },
          {
            foreignKeyName: "markets_shipping_route_id_fkey"
            columns: ["shipping_route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_shipping_route_id_fkey"
            columns: ["shipping_route_id"]
            isOneToOne: false
            referencedRelation: "v_rutas_logistica"
            referencedColumns: ["route_id"]
          },
        ]
      }
      master_purchase_orders: {
        Row: {
          auto_close_at: string | null
          china_tracking: string | null
          close_reason: string | null
          closed_at: string | null
          country_code: string | null
          created_at: string
          cycle_end_at: string | null
          cycle_start_at: string | null
          department_code: string | null
          has_express_orders: boolean | null
          has_oversize_orders: boolean | null
          has_sensitive_orders: boolean | null
          hub_code: string | null
          id: string
          metadata: Json | null
          notes: string | null
          orders_at_close: number | null
          po_number: string
          status: string | null
          total_amount: number | null
          total_orders: number | null
          total_quantity: number | null
          transit_tracking: string | null
          updated_at: string
        }
        Insert: {
          auto_close_at?: string | null
          china_tracking?: string | null
          close_reason?: string | null
          closed_at?: string | null
          country_code?: string | null
          created_at?: string
          cycle_end_at?: string | null
          cycle_start_at?: string | null
          department_code?: string | null
          has_express_orders?: boolean | null
          has_oversize_orders?: boolean | null
          has_sensitive_orders?: boolean | null
          hub_code?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          orders_at_close?: number | null
          po_number: string
          status?: string | null
          total_amount?: number | null
          total_orders?: number | null
          total_quantity?: number | null
          transit_tracking?: string | null
          updated_at?: string
        }
        Update: {
          auto_close_at?: string | null
          china_tracking?: string | null
          close_reason?: string | null
          closed_at?: string | null
          country_code?: string | null
          created_at?: string
          cycle_end_at?: string | null
          cycle_start_at?: string | null
          department_code?: string | null
          has_express_orders?: boolean | null
          has_oversize_orders?: boolean | null
          has_sensitive_orders?: boolean | null
          hub_code?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          orders_at_close?: number | null
          po_number?: string
          status?: string | null
          total_amount?: number | null
          total_orders?: number | null
          total_quantity?: number | null
          transit_tracking?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_email_sent: boolean | null
          is_read: boolean | null
          message: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_email_sent?: boolean | null
          is_read?: boolean | null
          message?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_email_sent?: boolean | null
          is_read?: boolean | null
          message?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_deliveries: {
        Row: {
          assigned_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          customer_qr_code: string | null
          delivery_code: string | null
          delivery_method: string | null
          escrow_release_at: string | null
          id: string
          notes: string | null
          order_id: string
          order_type: string | null
          pickup_point_id: string | null
          ready_at: string | null
          security_pin: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          customer_qr_code?: string | null
          delivery_code?: string | null
          delivery_method?: string | null
          escrow_release_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          order_type?: string | null
          pickup_point_id?: string | null
          ready_at?: string | null
          security_pin?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          customer_qr_code?: string | null
          delivery_code?: string | null
          delivery_method?: string | null
          escrow_release_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          order_type?: string | null
          pickup_point_id?: string | null
          ready_at?: string | null
          security_pin?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_deliveries_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items_b2b: {
        Row: {
          cantidad: number
          color: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          nombre: string
          order_id: string
          precio_total: number
          precio_unitario: number
          product_id: string | null
          size: string | null
          sku: string
          variant_attributes: Json | null
          variant_id: string | null
        }
        Insert: {
          cantidad: number
          color?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          nombre: string
          order_id: string
          precio_total: number
          precio_unitario: number
          product_id?: string | null
          size?: string | null
          sku: string
          variant_attributes?: Json | null
          variant_id?: string | null
        }
        Update: {
          cantidad?: number
          color?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          nombre?: string
          order_id?: string
          precio_total?: number
          precio_unitario?: number
          product_id?: string | null
          size?: string | null
          sku?: string
          variant_attributes?: Json | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_b2b_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_b2b_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_b2b_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_b2b_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_b2b_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_b2b_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_b2b_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_variantes_con_precio_b2b"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items_b2c: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          order_id: string
          product_name: string
          quantity: number
          seller_catalog_id: string | null
          sku: string | null
          total_price: number
          unit_price: number
          variant_info: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          product_name: string
          quantity: number
          seller_catalog_id?: string | null
          sku?: string | null
          total_price: number
          unit_price: number
          variant_info?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          product_name?: string
          quantity?: number
          seller_catalog_id?: string | null
          sku?: string | null
          total_price?: number
          unit_price?: number
          variant_info?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_b2c_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_b2c"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_b2c_seller_catalog_id_fkey"
            columns: ["seller_catalog_id"]
            isOneToOne: false
            referencedRelation: "seller_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_b2b: {
        Row: {
          admin_notes: string | null
          billable_weight_kg: number | null
          billable_weight_lb: number | null
          billing_address: Json | null
          buyer_id: string | null
          consolidation_status: string | null
          created_at: string
          currency: string | null
          discount_amount: number | null
          hybrid_tracking_id: string | null
          id: string
          is_express: boolean | null
          is_oversize: boolean | null
          is_sensitive: boolean | null
          master_po_id: string | null
          metadata: Json | null
          notes: string | null
          order_number: string | null
          packing_instructions: string | null
          payment_confirmed_at: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          po_id: string | null
          po_linked_at: string | null
          reservation_expires_at: string | null
          seller_id: string
          shipping_address: Json | null
          shipping_address_id: string | null
          shipping_cost: number | null
          shipping_tier_type: string | null
          status: string | null
          stock_reserved: boolean | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          total_quantity: number | null
          total_weight_g: number | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          billable_weight_kg?: number | null
          billable_weight_lb?: number | null
          billing_address?: Json | null
          buyer_id?: string | null
          consolidation_status?: string | null
          created_at?: string
          currency?: string | null
          discount_amount?: number | null
          hybrid_tracking_id?: string | null
          id?: string
          is_express?: boolean | null
          is_oversize?: boolean | null
          is_sensitive?: boolean | null
          master_po_id?: string | null
          metadata?: Json | null
          notes?: string | null
          order_number?: string | null
          packing_instructions?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          po_id?: string | null
          po_linked_at?: string | null
          reservation_expires_at?: string | null
          seller_id: string
          shipping_address?: Json | null
          shipping_address_id?: string | null
          shipping_cost?: number | null
          shipping_tier_type?: string | null
          status?: string | null
          stock_reserved?: boolean | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          total_quantity?: number | null
          total_weight_g?: number | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          billable_weight_kg?: number | null
          billable_weight_lb?: number | null
          billing_address?: Json | null
          buyer_id?: string | null
          consolidation_status?: string | null
          created_at?: string
          currency?: string | null
          discount_amount?: number | null
          hybrid_tracking_id?: string | null
          id?: string
          is_express?: boolean | null
          is_oversize?: boolean | null
          is_sensitive?: boolean | null
          master_po_id?: string | null
          metadata?: Json | null
          notes?: string | null
          order_number?: string | null
          packing_instructions?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          po_id?: string | null
          po_linked_at?: string | null
          reservation_expires_at?: string | null
          seller_id?: string
          shipping_address?: Json | null
          shipping_address_id?: string | null
          shipping_cost?: number | null
          shipping_tier_type?: string | null
          status?: string | null
          stock_reserved?: boolean | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          total_quantity?: number | null
          total_weight_g?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_b2b_master_po_id_fkey"
            columns: ["master_po_id"]
            isOneToOne: false
            referencedRelation: "master_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_b2b_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_b2c: {
        Row: {
          buyer_user_id: string
          commission_amount: number | null
          created_at: string
          currency: string | null
          delivery_method: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_number: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pickup_point_id: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          status: string | null
          store_id: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          buyer_user_id: string
          commission_amount?: number | null
          created_at?: string
          currency?: string | null
          delivery_method?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_number?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pickup_point_id?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string | null
          store_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string
          commission_amount?: number | null
          created_at?: string
          currency?: string | null
          delivery_method?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_number?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pickup_point_id?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string | null
          store_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_b2c_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_b2c_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean | null
          method_type: string
          name: string
          owner_id: string
          owner_type: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          method_type: string
          name: string
          owner_id: string
          owner_type: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          method_type?: string
          name?: string
          owner_id?: string
          owner_type?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_quotes: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          cart_snapshot: Json
          converted_to_order_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          quote_number: string
          responded_at: string | null
          seller_id: string
          seller_notes: string | null
          shipping_estimate: number | null
          status: string
          subtotal: number
          total: number
          total_amount: number | null
          total_quantity: number | null
          updated_at: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cart_snapshot?: Json
          converted_to_order_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          quote_number: string
          responded_at?: string | null
          seller_id: string
          seller_notes?: string | null
          shipping_estimate?: number | null
          status?: string
          subtotal?: number
          total?: number
          total_amount?: number | null
          total_quantity?: number | null
          updated_at?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cart_snapshot?: Json
          converted_to_order_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          quote_number?: string
          responded_at?: string | null
          seller_id?: string
          seller_notes?: string | null
          shipping_estimate?: number | null
          status?: string
          subtotal?: number
          total?: number
          total_amount?: number | null
          total_quantity?: number | null
          updated_at?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: []
      }
      pickup_point_staff: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          pickup_point_id: string
          role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pickup_point_id: string
          role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pickup_point_id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_point_staff_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_points: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          commune_id: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_official: boolean | null
          lat: number | null
          latitude: number | null
          lng: number | null
          longitude: number | null
          metadata: Json | null
          name: string
          opening_hours: Json | null
          phone: string | null
          point_code: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          commune_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_official?: boolean | null
          lat?: number | null
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          metadata?: Json | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          point_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          commune_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_official?: boolean | null
          lat?: number | null
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          metadata?: Json | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          point_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      po_order_links: {
        Row: {
          commune_code: string | null
          created_at: string
          current_status: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_user_id: string | null
          department_code: string | null
          hybrid_tracking_id: string | null
          id: string
          order_id: string
          order_type: string
          pickup_point_code: string | null
          po_id: string
          short_order_id: string | null
          source_type: string | null
          unit_count: number | null
          updated_at: string
        }
        Insert: {
          commune_code?: string | null
          created_at?: string
          current_status?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          department_code?: string | null
          hybrid_tracking_id?: string | null
          id?: string
          order_id: string
          order_type: string
          pickup_point_code?: string | null
          po_id: string
          short_order_id?: string | null
          source_type?: string | null
          unit_count?: number | null
          updated_at?: string
        }
        Update: {
          commune_code?: string | null
          created_at?: string
          current_status?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          department_code?: string | null
          hybrid_tracking_id?: string | null
          id?: string
          order_id?: string
          order_type?: string
          pickup_point_code?: string | null
          po_id?: string
          short_order_id?: string | null
          source_type?: string | null
          unit_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_order_links_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "master_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_picking_items: {
        Row: {
          created_at: string
          id: string
          is_picked: boolean | null
          notes: string | null
          picked_quantity: number | null
          po_id: string
          po_order_link_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number
          sku: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_picked?: boolean | null
          notes?: string | null
          picked_quantity?: number | null
          po_id: string
          po_order_link_id?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity: number
          sku: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_picked?: boolean | null
          notes?: string | null
          picked_quantity?: number | null
          po_id?: string
          po_order_link_id?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_picking_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "master_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_picking_items_po_order_link_id_fkey"
            columns: ["po_order_link_id"]
            isOneToOne: false
            referencedRelation: "po_order_links"
            referencedColumns: ["id"]
          },
        ]
      }
      price_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          key: string
          updated_at: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          updated_at?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_price: number
          old_price: number | null
          price_type: string
          product_id: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price: number
          old_price?: number | null
          price_type: string
          product_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number | null
          price_type?: string
          product_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          helpful_count: number | null
          id: string
          images: string[] | null
          is_approved: boolean | null
          is_verified_purchase: boolean | null
          parent_review_id: string | null
          product_id: string | null
          rating: number
          seller_catalog_id: string | null
          title: string | null
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          helpful_count?: number | null
          id?: string
          images?: string[] | null
          is_approved?: boolean | null
          is_verified_purchase?: boolean | null
          parent_review_id?: string | null
          product_id?: string | null
          rating: number
          seller_catalog_id?: string | null
          title?: string | null
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          helpful_count?: number | null
          id?: string
          images?: string[] | null
          is_approved?: boolean | null
          is_verified_purchase?: boolean | null
          parent_review_id?: string | null
          product_id?: string | null
          rating?: number
          seller_catalog_id?: string | null
          title?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_seller_catalog_id_fkey"
            columns: ["seller_catalog_id"]
            isOneToOne: false
            referencedRelation: "seller_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shipping_classes: {
        Row: {
          allows_express: boolean | null
          created_at: string | null
          id: string
          is_oversize: boolean | null
          is_sensitive: boolean | null
          oversize_surcharge_percent: number | null
          packing_instructions: string | null
          product_id: string | null
          requires_special_packing: boolean | null
          sensitive_surcharge_per_gram: number | null
          sensitivity_type: string | null
          updated_at: string | null
          volume_factor: number | null
        }
        Insert: {
          allows_express?: boolean | null
          created_at?: string | null
          id?: string
          is_oversize?: boolean | null
          is_sensitive?: boolean | null
          oversize_surcharge_percent?: number | null
          packing_instructions?: string | null
          product_id?: string | null
          requires_special_packing?: boolean | null
          sensitive_surcharge_per_gram?: number | null
          sensitivity_type?: string | null
          updated_at?: string | null
          volume_factor?: number | null
        }
        Update: {
          allows_express?: boolean | null
          created_at?: string | null
          id?: string
          is_oversize?: boolean | null
          is_sensitive?: boolean | null
          oversize_surcharge_percent?: number | null
          packing_instructions?: string | null
          product_id?: string | null
          requires_special_packing?: boolean | null
          sensitive_surcharge_per_gram?: number | null
          sensitivity_type?: string | null
          updated_at?: string | null
          volume_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_shipping_classes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shipping_classes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_shipping_classes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shipping_classes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attribute_combination: Json | null
          batch_id: string | null
          cost_price: number | null
          created_at: string
          id: string
          images: string[] | null
          is_active: boolean | null
          metadata: Json | null
          moq: number | null
          name: string | null
          option_type: string | null
          option_value: string | null
          precio_promocional: number | null
          price: number | null
          price_adjustment: number | null
          product_id: string
          sku: string
          sort_order: number | null
          stock: number | null
          stock_b2c: number | null
          updated_at: string
        }
        Insert: {
          attribute_combination?: Json | null
          batch_id?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          metadata?: Json | null
          moq?: number | null
          name?: string | null
          option_type?: string | null
          option_value?: string | null
          precio_promocional?: number | null
          price?: number | null
          price_adjustment?: number | null
          product_id: string
          sku: string
          sort_order?: number | null
          stock?: number | null
          stock_b2c?: number | null
          updated_at?: string
        }
        Update: {
          attribute_combination?: Json | null
          batch_id?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          metadata?: Json | null
          moq?: number | null
          name?: string | null
          option_type?: string | null
          option_value?: string | null
          precio_promocional?: number | null
          price?: number | null
          price_adjustment?: number | null
          product_id?: string
          sku?: string
          sort_order?: number | null
          stock?: number | null
          stock_b2c?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          seller_catalog_id: string | null
          session_id: string | null
          source: string | null
          user_id: string | null
          view_source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          seller_catalog_id?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
          view_source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          seller_catalog_id?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
          view_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_seller_catalog_id_fkey"
            columns: ["seller_catalog_id"]
            isOneToOne: false
            referencedRelation: "seller_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          categoria_id: string | null
          costo_base_excel: number | null
          created_at: string
          currency_code: string | null
          descripcion_corta: string | null
          descripcion_larga: string | null
          dimensiones_cm: string | null
          galeria_imagenes: string[] | null
          height_cm: number | null
          id: string
          imagen_principal: string | null
          is_active: boolean | null
          is_oversize: boolean | null
          is_parent: boolean | null
          last_calculated_at: string | null
          last_fee_calculation: Json | null
          length_cm: number | null
          moq: number | null
          nombre: string
          origin_country_id: string | null
          parent_product_id: string | null
          peso_kg: number | null
          precio_mayorista_base: number | null
          precio_promocional: number | null
          precio_sugerido_venta: number | null
          promo_active: boolean | null
          promo_ends_at: string | null
          promo_starts_at: string | null
          proveedor_id: string | null
          rating: number | null
          reviews_count: number | null
          shipping_mode: string | null
          sku_interno: string | null
          stock_fisico: number | null
          stock_status: Database["public"]["Enums"]["stock_status"] | null
          updated_at: string
          url_origen: string | null
          weight_g: number | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          categoria_id?: string | null
          costo_base_excel?: number | null
          created_at?: string
          currency_code?: string | null
          descripcion_corta?: string | null
          descripcion_larga?: string | null
          dimensiones_cm?: string | null
          galeria_imagenes?: string[] | null
          height_cm?: number | null
          id?: string
          imagen_principal?: string | null
          is_active?: boolean | null
          is_oversize?: boolean | null
          is_parent?: boolean | null
          last_calculated_at?: string | null
          last_fee_calculation?: Json | null
          length_cm?: number | null
          moq?: number | null
          nombre: string
          origin_country_id?: string | null
          parent_product_id?: string | null
          peso_kg?: number | null
          precio_mayorista_base?: number | null
          precio_promocional?: number | null
          precio_sugerido_venta?: number | null
          promo_active?: boolean | null
          promo_ends_at?: string | null
          promo_starts_at?: string | null
          proveedor_id?: string | null
          rating?: number | null
          reviews_count?: number | null
          shipping_mode?: string | null
          sku_interno?: string | null
          stock_fisico?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status"] | null
          updated_at?: string
          url_origen?: string | null
          weight_g?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          categoria_id?: string | null
          costo_base_excel?: number | null
          created_at?: string
          currency_code?: string | null
          descripcion_corta?: string | null
          descripcion_larga?: string | null
          dimensiones_cm?: string | null
          galeria_imagenes?: string[] | null
          height_cm?: number | null
          id?: string
          imagen_principal?: string | null
          is_active?: boolean | null
          is_oversize?: boolean | null
          is_parent?: boolean | null
          last_calculated_at?: string | null
          last_fee_calculation?: Json | null
          length_cm?: number | null
          moq?: number | null
          nombre?: string
          origin_country_id?: string | null
          parent_product_id?: string | null
          peso_kg?: number | null
          precio_mayorista_base?: number | null
          precio_promocional?: number | null
          precio_sugerido_venta?: number | null
          promo_active?: boolean | null
          promo_ends_at?: string | null
          promo_starts_at?: string | null
          proveedor_id?: string | null
          rating?: number | null
          reviews_count?: number | null
          shipping_mode?: string | null
          sku_interno?: string | null
          stock_fisico?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status"] | null
          updated_at?: string
          url_origen?: string | null
          weight_g?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_origin_country_id_fkey"
            columns: ["origin_country_id"]
            isOneToOne: false
            referencedRelation: "shipping_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      referral_settings: {
        Row: {
          bonus_per_referral: number | null
          created_at: string | null
          credit_increase_amount: number | null
          id: string
          is_active: boolean | null
          min_purchase_amount: number | null
          referrals_for_credit_increase: number | null
          referred_reward: number | null
          referrer_reward: number | null
          updated_at: string | null
        }
        Insert: {
          bonus_per_referral?: number | null
          created_at?: string | null
          credit_increase_amount?: number | null
          id?: string
          is_active?: boolean | null
          min_purchase_amount?: number | null
          referrals_for_credit_increase?: number | null
          referred_reward?: number | null
          referrer_reward?: number | null
          updated_at?: string | null
        }
        Update: {
          bonus_per_referral?: number | null
          created_at?: string | null
          credit_increase_amount?: number | null
          id?: string
          is_active?: boolean | null
          min_purchase_amount?: number | null
          referrals_for_credit_increase?: number | null
          referred_reward?: number | null
          referrer_reward?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_amount: number | null
          bonus_approved: boolean | null
          created_at: string
          first_purchase_at: string | null
          first_purchase_completed: boolean | null
          id: string
          referral_code: string | null
          referral_code_id: string | null
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          rewarded_at: string | null
          status: string | null
        }
        Insert: {
          bonus_amount?: number | null
          bonus_approved?: boolean | null
          created_at?: string
          first_purchase_at?: string | null
          first_purchase_completed?: boolean | null
          id?: string
          referral_code?: string | null
          referral_code_id?: string | null
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          rewarded_at?: string | null
          status?: string | null
        }
        Update: {
          bonus_amount?: number | null
          bonus_approved?: boolean | null
          created_at?: string
          first_purchase_at?: string | null
          first_purchase_completed?: boolean | null
          id?: string
          referral_code?: string | null
          referral_code_id?: string | null
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          rewarded_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_logistics_costs: {
        Row: {
          cost_per_cbm: number | null
          cost_per_kg: number
          created_at: string
          estimated_days_max: number | null
          estimated_days_min: number | null
          id: string
          is_active: boolean | null
          min_cost: number | null
          notes: string | null
          segment: string
          shipping_route_id: string
          updated_at: string
        }
        Insert: {
          cost_per_cbm?: number | null
          cost_per_kg?: number
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean | null
          min_cost?: number | null
          notes?: string | null
          segment: string
          shipping_route_id: string
          updated_at?: string
        }
        Update: {
          cost_per_cbm?: number | null
          cost_per_kg?: number
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean | null
          min_cost?: number | null
          notes?: string | null
          segment?: string
          shipping_route_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_logistics_costs_shipping_route_id_fkey"
            columns: ["shipping_route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_logistics_costs_shipping_route_id_fkey"
            columns: ["shipping_route_id"]
            isOneToOne: false
            referencedRelation: "v_rutas_logistica"
            referencedColumns: ["route_id"]
          },
        ]
      }
      seller_catalog: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          images: Json | null
          imported_at: string | null
          is_active: boolean | null
          metadata: Json | null
          nombre: string
          precio_costo: number | null
          precio_venta: number
          seller_store_id: string
          sku: string | null
          source_order_id: string | null
          source_product_id: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          images?: Json | null
          imported_at?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          nombre: string
          precio_costo?: number | null
          precio_venta: number
          seller_store_id: string
          sku?: string | null
          source_order_id?: string | null
          source_product_id?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          images?: Json | null
          imported_at?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          nombre?: string
          precio_costo?: number | null
          precio_venta?: number
          seller_store_id?: string
          sku?: string | null
          source_order_id?: string | null
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
          {
            foreignKeyName: "seller_catalog_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "seller_catalog_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_catalog_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_commission_overrides: {
        Row: {
          commission_fixed: number | null
          commission_percentage: number | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          reason: string | null
          seller_id: string
          tax_tca_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          commission_fixed?: number | null
          commission_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          seller_id: string
          tax_tca_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_fixed?: number | null
          commission_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          seller_id?: string
          tax_tca_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seller_credits: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          balance: number | null
          balance_debt: number | null
          created_at: string
          credit_limit: number | null
          credit_tier: string | null
          id: string
          is_active: boolean | null
          is_credit_active: boolean | null
          last_debt_payment_at: string | null
          max_cart_percentage: number | null
          total_earned: number | null
          total_used: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          balance?: number | null
          balance_debt?: number | null
          created_at?: string
          credit_limit?: number | null
          credit_tier?: string | null
          id?: string
          is_active?: boolean | null
          is_credit_active?: boolean | null
          last_debt_payment_at?: string | null
          max_cart_percentage?: number | null
          total_earned?: number | null
          total_used?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          balance?: number | null
          balance_debt?: number | null
          created_at?: string
          credit_limit?: number | null
          credit_tier?: string | null
          id?: string
          is_active?: boolean | null
          is_credit_active?: boolean | null
          last_debt_payment_at?: string | null
          max_cart_percentage?: number | null
          total_earned?: number | null
          total_used?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "seller_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_statuses: {
        Row: {
          caption: string | null
          content: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          seller_id: string
          store_id: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          caption?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          seller_id: string
          store_id: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          caption?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          seller_id?: string
          store_id?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: []
      }
      seller_wallets: {
        Row: {
          available_balance: number | null
          commission_debt: number | null
          created_at: string
          currency: string | null
          id: string
          pending_balance: number | null
          seller_id: string
          total_earned: number | null
          total_withdrawn: number | null
          updated_at: string
        }
        Insert: {
          available_balance?: number | null
          commission_debt?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          pending_balance?: number | null
          seller_id: string
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string
        }
        Update: {
          available_balance?: number | null
          commission_debt?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          pending_balance?: number | null
          seller_id?: string
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sellers: {
        Row: {
          business_name: string | null
          business_type: string | null
          commission_rate: number | null
          created_at: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          store_id: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          business_name?: string | null
          business_type?: string | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          store_id?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          business_name?: string | null
          business_type?: string | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          store_id?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "sellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_tracking: {
        Row: {
          carrier: string | null
          china_tracking: string | null
          created_at: string
          current_location: string | null
          current_status: string | null
          estimated_delivery: string | null
          events: Json | null
          hybrid_tracking_id: string | null
          id: string
          metadata: Json | null
          order_id: string
          order_type: string | null
          po_id: string | null
          tracking_number: string | null
          transit_tracking: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          china_tracking?: string | null
          created_at?: string
          current_location?: string | null
          current_status?: string | null
          estimated_delivery?: string | null
          events?: Json | null
          hybrid_tracking_id?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          order_type?: string | null
          po_id?: string | null
          tracking_number?: string | null
          transit_tracking?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          china_tracking?: string | null
          created_at?: string
          current_location?: string | null
          current_status?: string | null
          estimated_delivery?: string | null
          events?: Json | null
          hybrid_tracking_id?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          order_type?: string | null
          po_id?: string | null
          tracking_number?: string | null
          transit_tracking?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_origins: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      shipping_routes: {
        Row: {
          created_at: string
          destination_country_id: string | null
          id: string
          is_active: boolean | null
          is_direct: boolean | null
          transit_hub_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_country_id?: string | null
          id?: string
          is_active?: boolean | null
          is_direct?: boolean | null
          transit_hub_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_country_id?: string | null
          id?: string
          is_active?: boolean | null
          is_direct?: boolean | null
          transit_hub_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_routes_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "destination_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_routes_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["destination_country_id"]
          },
          {
            foreignKeyName: "shipping_routes_transit_hub_id_fkey"
            columns: ["transit_hub_id"]
            isOneToOne: false
            referencedRelation: "transit_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_tiers: {
        Row: {
          allows_oversize: boolean | null
          allows_sensitive: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          priority_order: number | null
          route_id: string | null
          tier_description: string | null
          tier_name: string
          tier_type: string
          tramo_a_cost_per_kg: number
          tramo_a_eta_max: number | null
          tramo_a_eta_min: number | null
          tramo_a_min_cost: number
          tramo_b_cost_per_lb: number
          tramo_b_eta_max: number | null
          tramo_b_eta_min: number | null
          tramo_b_min_cost: number
          updated_at: string | null
        }
        Insert: {
          allows_oversize?: boolean | null
          allows_sensitive?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority_order?: number | null
          route_id?: string | null
          tier_description?: string | null
          tier_name: string
          tier_type?: string
          tramo_a_cost_per_kg?: number
          tramo_a_eta_max?: number | null
          tramo_a_eta_min?: number | null
          tramo_a_min_cost?: number
          tramo_b_cost_per_lb?: number
          tramo_b_eta_max?: number | null
          tramo_b_eta_min?: number | null
          tramo_b_min_cost?: number
          updated_at?: string | null
        }
        Update: {
          allows_oversize?: boolean | null
          allows_sensitive?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority_order?: number | null
          route_id?: string | null
          tier_description?: string | null
          tier_name?: string
          tier_type?: string
          tramo_a_cost_per_kg?: number
          tramo_a_eta_max?: number | null
          tramo_a_eta_min?: number | null
          tramo_a_min_cost?: number
          tramo_b_cost_per_lb?: number
          tramo_b_eta_max?: number | null
          tramo_b_eta_min?: number | null
          tramo_b_min_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_tiers_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_tiers_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "v_rutas_logistica"
            referencedColumns: ["route_id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          country_id: string | null
          coverage_active: boolean | null
          created_at: string | null
          id: string
          is_capital: boolean | null
          is_remote: boolean | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          surcharge_percent: number
          updated_at: string | null
          zone_code: string
          zone_level: number
          zone_name: string
        }
        Insert: {
          country_id?: string | null
          coverage_active?: boolean | null
          created_at?: string | null
          id?: string
          is_capital?: boolean | null
          is_remote?: boolean | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          surcharge_percent?: number
          updated_at?: string | null
          zone_code: string
          zone_level?: number
          zone_name: string
        }
        Update: {
          country_id?: string | null
          coverage_active?: boolean | null
          created_at?: string | null
          id?: string
          is_capital?: boolean | null
          is_remote?: boolean | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          surcharge_percent?: number
          updated_at?: string | null
          zone_code?: string
          zone_level?: number
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "destination_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_zones_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["destination_country_id"]
          },
        ]
      }
      siver_match_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          commune_id: string | null
          created_at: string
          department_id: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          phone: string | null
          profile_type: string
          rating_avg: number | null
          total_invested: number | null
          total_sales: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          commune_id?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          phone?: string | null
          profile_type: string
          rating_avg?: number | null
          total_invested?: number | null
          total_sales?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          commune_id?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          phone?: string | null
          profile_type?: string
          rating_avg?: number | null
          total_invested?: number | null
          total_sales?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "siver_match_profiles_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      siver_match_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewed_profile_id: string
          reviewer_profile_id: string
          sale_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewed_profile_id: string
          reviewer_profile_id: string
          sale_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewed_profile_id?: string
          reviewer_profile_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "siver_match_reviews_reviewed_profile_id_fkey"
            columns: ["reviewed_profile_id"]
            isOneToOne: false
            referencedRelation: "siver_match_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_reviews_reviewer_profile_id_fkey"
            columns: ["reviewer_profile_id"]
            isOneToOne: false
            referencedRelation: "siver_match_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_reviews_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "siver_match_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      siver_match_sales: {
        Row: {
          commune_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          delivery_address: Json | null
          department_id: string | null
          final_price: number | null
          gestor_commission: number | null
          gestor_id: string
          id: string
          investor_id: string
          investor_profit: number | null
          metadata: Json | null
          notes: string | null
          payment_status: string | null
          pickup_code: string | null
          pickup_point_id: string | null
          platform_fee: number | null
          po_id: string | null
          product_cost: number
          product_id: string | null
          product_name: string
          quantity: number
          sale_number: string | null
          status: string | null
          suggested_price: number | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          commune_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: Json | null
          department_id?: string | null
          final_price?: number | null
          gestor_commission?: number | null
          gestor_id: string
          id?: string
          investor_id: string
          investor_profit?: number | null
          metadata?: Json | null
          notes?: string | null
          payment_status?: string | null
          pickup_code?: string | null
          pickup_point_id?: string | null
          platform_fee?: number | null
          po_id?: string | null
          product_cost: number
          product_id?: string | null
          product_name: string
          quantity: number
          sale_number?: string | null
          status?: string | null
          suggested_price?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          commune_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: Json | null
          department_id?: string | null
          final_price?: number | null
          gestor_commission?: number | null
          gestor_id?: string
          id?: string
          investor_id?: string
          investor_profit?: number | null
          metadata?: Json | null
          notes?: string | null
          payment_status?: string | null
          pickup_code?: string | null
          pickup_point_id?: string | null
          platform_fee?: number | null
          po_id?: string | null
          product_cost?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_number?: string | null
          status?: string | null
          suggested_price?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "siver_match_sales_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "siver_match_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "siver_match_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "master_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "siver_match_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siver_match_sales_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_variantes_con_precio_b2b"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          released_at: string | null
          reserved_at: string | null
          status: string | null
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          quantity: number
          released_at?: string | null
          reserved_at?: string | null
          status?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          released_at?: string | null
          reserved_at?: string | null
          status?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: []
      }
      store_followers: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_approved: boolean | null
          rating: number
          store_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          rating: number
          store_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          rating?: number
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          allow_comments: boolean | null
          banner: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          facebook: string | null
          id: string
          instagram: string | null
          is_accepting_orders: boolean | null
          is_active: boolean | null
          logo: string | null
          metadata: Json | null
          name: string
          owner_user_id: string
          return_policy: string | null
          shipping_policy: string | null
          show_stock: boolean | null
          slug: string | null
          tiktok: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          allow_comments?: boolean | null
          banner?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          is_accepting_orders?: boolean | null
          is_active?: boolean | null
          logo?: string | null
          metadata?: Json | null
          name: string
          owner_user_id: string
          return_policy?: string | null
          shipping_policy?: string | null
          show_stock?: boolean | null
          slug?: string | null
          tiktok?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          allow_comments?: boolean | null
          banner?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          is_accepting_orders?: boolean | null
          is_active?: boolean | null
          logo?: string | null
          metadata?: Json | null
          name?: string
          owner_user_id?: string
          return_policy?: string | null
          shipping_policy?: string | null
          show_stock?: boolean | null
          slug?: string | null
          tiktok?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      transit_hubs: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          seller_catalog_id: string | null
          store_id: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          seller_catalog_id?: string | null
          store_id?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          seller_catalog_id?: string | null
          store_id?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "user_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_seller_catalog_id_fkey"
            columns: ["seller_catalog_id"]
            isOneToOne: false
            referencedRelation: "seller_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          order_updates: boolean | null
          promotions: boolean | null
          push_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
          wallet_updates: boolean | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          order_updates?: boolean | null
          promotions?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          wallet_updates?: boolean | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          order_updates?: boolean | null
          promotions?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          wallet_updates?: boolean | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variant_attribute_values: {
        Row: {
          attribute_id: string
          attribute_option_id: string
          created_at: string | null
          id: string
          variant_id: string
        }
        Insert: {
          attribute_id: string
          attribute_option_id: string
          created_at?: string | null
          id?: string
          variant_id: string
        }
        Update: {
          attribute_id?: string
          attribute_option_id?: string
          created_at?: string | null
          id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_attribute_option_id_fkey"
            columns: ["attribute_option_id"]
            isOneToOne: false
            referencedRelation: "attribute_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_variantes_con_precio_b2b"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "seller_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          fee_amount: number | null
          id: string
          net_amount: number | null
          payment_details: Json | null
          payment_method: string
          processed_at: string | null
          seller_id: string
          status: string | null
          updated_at: string
          wallet_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          fee_amount?: number | null
          id?: string
          net_amount?: number | null
          payment_details?: Json | null
          payment_method: string
          processed_at?: string | null
          seller_id: string
          status?: string | null
          updated_at?: string
          wallet_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          fee_amount?: number | null
          id?: string
          net_amount?: number | null
          payment_details?: Json | null
          payment_method?: string
          processed_at?: string | null
          seller_id?: string
          status?: string | null
          updated_at?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "seller_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_roles_with_email: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Relationships: []
      }
      v_pricing_breakdown: {
        Row: {
          calculated_at: string | null
          costo_fabrica: number | null
          costo_tramo_a: number | null
          costo_tramo_b: number | null
          destination_country: string | null
          fee_plataforma: number | null
          market_id: string | null
          market_name: string | null
          nombre: string | null
          precio_b2b_final: number | null
          product_id: string | null
          sku_interno: string | null
        }
        Relationships: []
      }
      v_productos_con_precio_b2b: {
        Row: {
          applied_margin_percent: number | null
          categoria_id: string | null
          costo_base_excel: number | null
          created_at: string | null
          descripcion_corta: string | null
          id: string | null
          imagen_principal: string | null
          is_active: boolean | null
          nombre: string | null
          peso_kg: number | null
          precio_b2b: number | null
          sku_interno: string | null
          updated_at: string | null
        }
        Insert: {
          applied_margin_percent?: never
          categoria_id?: string | null
          costo_base_excel?: number | null
          created_at?: string | null
          descripcion_corta?: string | null
          id?: string | null
          imagen_principal?: string | null
          is_active?: boolean | null
          nombre?: string | null
          peso_kg?: number | null
          precio_b2b?: never
          sku_interno?: string | null
          updated_at?: string | null
        }
        Update: {
          applied_margin_percent?: never
          categoria_id?: string | null
          costo_base_excel?: number | null
          created_at?: string | null
          descripcion_corta?: string | null
          id?: string | null
          imagen_principal?: string | null
          is_active?: boolean | null
          nombre?: string | null
          peso_kg?: number | null
          precio_b2b?: never
          sku_interno?: string | null
          updated_at?: string | null
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
      v_productos_mercado_precio: {
        Row: {
          categoria_id: string | null
          costo_base_excel: number | null
          created_at: string | null
          destination_country_code: string | null
          destination_country_id: string | null
          destination_country_name: string | null
          id: string | null
          imagen_principal: string | null
          market_code: string | null
          market_currency: string | null
          market_id: string | null
          market_name: string | null
          moq: number | null
          nombre: string | null
          precio_b2b: number | null
          precio_mayorista_base: number | null
          sku_interno: string | null
          stock_fisico: number | null
          updated_at: string | null
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
      v_rutas_logistica: {
        Row: {
          country_code: string | null
          destination_country_id: string | null
          destination_country_name: string | null
          is_active: boolean | null
          is_direct: boolean | null
          route_id: string | null
          segment_a: Json | null
          segment_b: Json | null
          transit_hub_id: string | null
          transit_hub_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_routes_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "destination_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_routes_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["destination_country_id"]
          },
          {
            foreignKeyName: "shipping_routes_transit_hub_id_fkey"
            columns: ["transit_hub_id"]
            isOneToOne: false
            referencedRelation: "transit_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_variantes_con_precio_b2b: {
        Row: {
          applied_margin_percent: number | null
          attribute_combination: Json | null
          cost_price: number | null
          costo_base_efectivo: number | null
          created_at: string | null
          id: string | null
          images: string[] | null
          is_active: boolean | null
          moq: number | null
          name: string | null
          parent_sku: string | null
          precio_b2b_base: number | null
          precio_b2b_final: number | null
          price: number | null
          price_adjustment: number | null
          product_id: string | null
          product_name: string | null
          sku: string | null
          stock: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pricing_breakdown"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_con_precio_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mercado_precio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_b2b_price: {
        Args: {
          p_destination_country_id?: string
          p_market_id?: string
          p_product_id: string
        }
        Returns: number
      }
      calculate_b2b_price_multitramo: {
        Args: {
          p_address_id: string
          p_product_id: string
          p_quantity?: number
          p_tier_type?: string
        }
        Returns: Json
      }
      calculate_base_price_only: {
        Args: { p_margin_percent?: number; p_product_id: string }
        Returns: number
      }
      calculate_route_cost: {
        Args: { p_route_id: string; p_weight_cbm?: number; p_weight_kg: number }
        Returns: Json
      }
      close_po_and_open_new: {
        Args: { p_close_reason?: string; p_po_id: string }
        Returns: Json
      }
      generate_hybrid_tracking_id: {
        Args: { p_order_id: string }
        Returns: string
      }
      get_shipping_options_for_address: {
        Args: { p_address_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      sync_missing_profiles_and_roles: { Args: never; Returns: Json }
      validate_product_for_shipping: {
        Args: { p_product_id: string; p_tier_type?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "user" | "gestor" | "investor"
      approval_request_type:
        | "withdrawal"
        | "refund"
        | "credit_purchase"
        | "kyc_review"
        | "seller_upgrade"
        | "referral_bonus"
        | "credit_limit_increase"
        | "credit_activation"
      approval_status: "pending" | "approved" | "rejected"
      payment_method:
        | "bank_transfer"
        | "moncash"
        | "natcash"
        | "credit_card"
        | "crypto"
        | "cash_on_delivery"
      payment_status:
        | "pending"
        | "pending_validation"
        | "paid"
        | "failed"
        | "expired"
        | "refunded"
        | "cancelled"
      stock_status: "in_stock" | "low_stock" | "out_of_stock" | "discontinued"
      user_role: "admin" | "seller" | "buyer" | "gestor" | "investor"
      verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
        | "pending_verification"
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
      app_role: ["admin", "seller", "user", "gestor", "investor"],
      approval_request_type: [
        "withdrawal",
        "refund",
        "credit_purchase",
        "kyc_review",
        "seller_upgrade",
        "referral_bonus",
        "credit_limit_increase",
        "credit_activation",
      ],
      approval_status: ["pending", "approved", "rejected"],
      payment_method: [
        "bank_transfer",
        "moncash",
        "natcash",
        "credit_card",
        "crypto",
        "cash_on_delivery",
      ],
      payment_status: [
        "pending",
        "pending_validation",
        "paid",
        "failed",
        "expired",
        "refunded",
        "cancelled",
      ],
      stock_status: ["in_stock", "low_stock", "out_of_stock", "discontinued"],
      user_role: ["admin", "seller", "buyer", "gestor", "investor"],
      verification_status: [
        "unverified",
        "pending",
        "verified",
        "rejected",
        "pending_verification",
      ],
    },
  },
} as const
