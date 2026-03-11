import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// EAV Attribute Combination type
export interface AttributeCombination {
  color?: string;
  size?: string;
  age?: string;
  model?: string;
  voltage?: string;
  watts?: string;
  material?: string;
  [key: string]: string | undefined;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  option_type: string;
  option_value: string;
  price: number | null;
  precio_b2b_final?: number; // ✅ Precio B2B calculado desde vista (para sellers)
  precio_promocional: number | null;
  cost_price?: number | null;
  stock: number;
  moq: number;
  images: string[];
  is_active: boolean;
  sort_order: number;
  attribute_combination?: AttributeCombination | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export const useProductVariants = (productId: string | undefined, isB2B: boolean = false) => {
  return useQuery({
    queryKey: ["product-variants", productId, isB2B],
    queryFn: async (): Promise<ProductVariant[]> => {
      if (!productId) return [];

      // ✅ Si es B2B, usar vista con precio_b2b_final calculado
      const table = isB2B ? "v_variantes_con_precio_b2b" : "product_variants";
      
      const selectFields = isB2B 
        ? "id, product_id, sku, name, price, precio_b2b_final, stock, moq, images, is_active, attribute_combination"
        : "*";

      const { data, error } = await (supabase as any)
        .from(table)
        .select(selectFields)
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sku", { ascending: true });

      if (error) {
        console.error(`Error fetching product variants from ${table}:`, error);
        throw error;
      }

      return (data || []).map((v: any) => ({
        ...v,
        option_type: v.attribute_combination ? Object.keys(v.attribute_combination)[0] : 'variant',
        option_value: v.attribute_combination ? Object.values(v.attribute_combination)[0] : '',
        images: Array.isArray(v.images) ? (v.images as string[]) : [],
        attribute_combination: v.attribute_combination as AttributeCombination | null,
        metadata: v.metadata as Record<string, any> || {},
        sort_order: 0,
      })) as ProductVariant[];
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
};

// Get ALL variants including inactive (for admin)
export const useAllProductVariants = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product-variants-all", productId],
    queryFn: async (): Promise<ProductVariant[]> => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("option_type", { ascending: true })
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching all product variants:", error);
        throw error;
      }

      return (data || []).map((v) => ({
        ...v,
        images: Array.isArray(v.images) ? (v.images as string[]) : [],
        attribute_combination: v.attribute_combination as AttributeCombination | null,
        metadata: v.metadata as Record<string, any> || {},
      })) as ProductVariant[];
    },
    enabled: !!productId,
  });
};

// Get attribute display names from the attributes table
export const useAttributeDisplayNames = () => {
  return useQuery({
    queryKey: ["attribute-display-names"],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("attributes")
        .select("slug, display_name, name");

      if (error) {
        console.error("Error fetching attribute names:", error);
        return {};
      }

      const map: Record<string, string> = {};
      data?.forEach(attr => {
        // Map both slug and name to display_name
        if (attr.slug) map[attr.slug] = attr.display_name;
        if (attr.name) map[attr.name] = attr.display_name;
        // Also map lowercase versions
        if (attr.slug) map[attr.slug.toLowerCase()] = attr.display_name;
        if (attr.name) map[attr.name.toLowerCase()] = attr.display_name;
      });
      return map;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });
};

// Get variants grouped by option_type
export const useGroupedVariants = (productId: string | undefined) => {
  const { data: variants, ...rest } = useProductVariants(productId);
  const { data: attrDisplayNames } = useAttributeDisplayNames();

  const grouped = variants?.reduce((acc, variant) => {
    const type = variant.option_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(variant);
    return acc;
  }, {} as Record<string, ProductVariant[]>) || {};

  return { grouped, variants, attrDisplayNames: attrDisplayNames || {}, ...rest };
};

// Get variant stock summary
export const useVariantStockSummary = (productId: string | undefined) => {
  const { data: variants } = useProductVariants(productId);
  
  if (!variants || variants.length === 0) {
    return { totalStock: 0, variantCount: 0, lowStockCount: 0, outOfStockCount: 0 };
  }

  return {
    totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
    variantCount: variants.length,
    lowStockCount: variants.filter(v => v.stock > 0 && v.stock < v.moq).length,
    outOfStockCount: variants.filter(v => v.stock === 0).length,
  };
};
