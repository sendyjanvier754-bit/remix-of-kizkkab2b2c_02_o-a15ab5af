import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSectionSetting } from "./useMarketplaceSectionSettings";

// Types
export interface MarketplaceProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  sku: string;
  stock: number;
  storeId?: string;
  storeName?: string;
  storeWhatsapp?: string;
  categoryId?: string;
  categoryName?: string;
  categorySlug?: string;
  salesCount?: number;
  viewCount?: number;
  rating?: number;
  reviewCount?: number;
  source_product_id?: string;
}

export interface TopStore {
  id: string;
  name: string;
  logo: string | null;
  banner: string | null;
  slug: string;
  description: string | null;
  productCount: number;
  salesCount: number;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
}

// Transform seller_catalog product to MarketplaceProduct
const transformProduct = (item: any): MarketplaceProduct => {
  const images = item.images as any;
  const mainImage = Array.isArray(images) && images.length > 0 
    ? images[0] 
    : typeof images === 'string' ? images : '';

  return {
    id: item.id,
    name: item.nombre,
    price: item.precio_venta,
    originalPrice: item.precio_costo > item.precio_venta ? item.precio_costo : undefined,
    image: mainImage,
    sku: item.sku,
    stock: item.stock,
    storeId: item.store?.id,
    storeName: item.store?.name,
    storeWhatsapp: item.store?.whatsapp || undefined,
    categoryId: item.source_product?.categoria_id,
    categoryName: item.source_product?.category?.name,
    categorySlug: item.source_product?.category?.slug,
    salesCount: item.sales_count || 0,
    viewCount: item.view_count || 0,
    rating: item.avg_rating || 0,
    reviewCount: item.review_count || 0,
    source_product_id: item.source_product?.id,
  };
};

/**
 * Hook para productos destacados - productos con mayor stock o más recientes
 */
export const useFeaturedProducts = (defaultLimit = 10) => {
  const { data: sectionConfig } = useSectionSetting('featured_products');
  const limit = sectionConfig?.item_limit ?? defaultLimit;
  const isEnabled = sectionConfig?.is_enabled ?? true;

  return useQuery({
    queryKey: ["marketplace-featured", limit, isEnabled],
    queryFn: async (): Promise<MarketplaceProduct[]> => {
      if (!isEnabled) return [];

      const { data, error } = await supabase
        .from("seller_catalog")
        .select(`
          id, sku, nombre, descripcion, precio_venta, precio_costo, stock, images, metadata,
          store:stores!seller_catalog_seller_store_id_fkey(id, name, whatsapp, logo, slug),
          source_product:products!seller_catalog_source_product_id_fkey(
            id, categoria_id, 
            category:categories!products_categoria_id_fkey(id, name, slug)
          )
        `)
        .eq("is_active", true)
        .gt("stock", 0)
        .order("stock", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching featured products:", error);
        return [];
      }

      return (data || []).map(transformProduct);
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para productos más vendidos - basado en órdenes B2C completadas
 */
export const useBestSellers = (defaultLimit = 10) => {
  const { data: sectionConfig } = useSectionSetting('best_sellers');
  const limit = sectionConfig?.item_limit ?? defaultLimit;
  const isEnabled = sectionConfig?.is_enabled ?? true;

  return useQuery({
    queryKey: ["marketplace-bestsellers", limit, isEnabled],
    queryFn: async (): Promise<MarketplaceProduct[]> => {
      if (!isEnabled) return [];

      const { data: catalogData, error } = await supabase
        .from("seller_catalog")
        .select(`
          id, sku, nombre, descripcion, precio_venta, precio_costo, stock, images, metadata,
          store:stores!seller_catalog_seller_store_id_fkey(id, name, whatsapp, logo, slug),
          source_product:products!seller_catalog_source_product_id_fkey(
            id, categoria_id, 
            category:categories!products_categoria_id_fkey(id, name, slug)
          )
        `)
        .eq("is_active", true)
        .gt("stock", 0)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching bestsellers:", error);
        return [];
      }

      return (catalogData || []).map(transformProduct);
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para productos nuevos - los más recientes
 */
export const useNewArrivals = (defaultLimit = 10) => {
  const { data: sectionConfig } = useSectionSetting('new_arrivals');
  const limit = sectionConfig?.item_limit ?? defaultLimit;
  const isEnabled = sectionConfig?.is_enabled ?? true;

  return useQuery({
    queryKey: ["marketplace-new-arrivals", limit, isEnabled],
    queryFn: async (): Promise<MarketplaceProduct[]> => {
      if (!isEnabled) return [];

      const { data, error } = await supabase
        .from("seller_catalog")
        .select(`
          id, sku, nombre, descripcion, precio_venta, precio_costo, stock, images, metadata,
          store:stores!seller_catalog_seller_store_id_fkey(id, name, whatsapp, logo, slug),
          source_product:products!seller_catalog_source_product_id_fkey(
            id, categoria_id, 
            category:categories!products_categoria_id_fkey(id, name, slug)
          )
        `)
        .eq("is_active", true)
        .gt("stock", 0)
        .order("imported_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching new arrivals:", error);
        return [];
      }

      return (data || []).map(transformProduct);
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para ofertas - productos con descuento
 */
export const useDeals = (defaultLimit = 10) => {
  const { data: sectionConfig } = useSectionSetting('deals');
  const limit = sectionConfig?.item_limit ?? defaultLimit;
  const isEnabled = sectionConfig?.is_enabled ?? true;

  return useQuery({
    queryKey: ["marketplace-deals", limit, isEnabled],
    queryFn: async (): Promise<MarketplaceProduct[]> => {
      if (!isEnabled) return [];

      const { data, error } = await supabase
        .from("seller_catalog")
        .select(`
          id, sku, nombre, descripcion, precio_venta, precio_costo, stock, images, metadata,
          store:stores!seller_catalog_seller_store_id_fkey(id, name, whatsapp, logo, slug),
          source_product:products!seller_catalog_source_product_id_fkey(
            id, categoria_id, 
            category:categories!products_categoria_id_fkey(id, name, slug)
          )
        `)
        .eq("is_active", true)
        .gt("stock", 0)
        .order("precio_venta", { ascending: true })
        .limit(limit);

      if (error) {
        console.error("Error fetching deals:", error);
        return [];
      }

      return (data || []).map(transformProduct);
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para tiendas destacadas
 */
export const useTopStores = (defaultLimit = 6) => {
  const { data: sectionConfig } = useSectionSetting('top_stores');
  const limit = sectionConfig?.item_limit ?? defaultLimit;
  const isEnabled = sectionConfig?.is_enabled ?? true;
  return useQuery({
    queryKey: ["marketplace-top-stores", limit, isEnabled],
    queryFn: async (): Promise<TopStore[]> => {
      if (!isEnabled) return [];

      const { data, error } = await supabase
        .from("stores")
        .select(`
          id, name, logo, banner, slug, description, is_active
        `)
        .eq("is_active", true)
        .limit(limit);

      if (error) {
        console.error("Error fetching top stores:", error);
        return [];
      }

      // Get product counts for each store
      const storesWithStats = await Promise.all(
        (data || []).map(async (store) => {
          const { count } = await supabase
            .from("seller_catalog")
            .select("id", { count: "exact", head: true })
            .eq("seller_store_id", store.id)
            .eq("is_active", true);

          return {
            id: store.id,
            name: store.name,
            logo: store.logo,
            banner: store.banner,
            slug: store.slug,
            description: store.description,
            productCount: count || 0,
            salesCount: 0, // Can be updated when we have sales data
            rating: 0, // Can be updated when we have reviews
            reviewCount: 0,
            isVerified: false, // No seller relationship in current query
          };
        })
      );

      return storesWithStats.filter(s => s.productCount > 0);
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para productos por categoría
 */
export const useProductsByCategory = (categoryId: string | null, limit = 10) => {
  return useQuery({
    queryKey: ["marketplace-category-products", categoryId, limit],
    queryFn: async (): Promise<MarketplaceProduct[]> => {
      if (!categoryId) return [];

      // Get child categories too
      const { data: childCategories } = await supabase
        .from("categories")
        .select("id")
        .eq("parent_id", categoryId);

      const categoryIds = [categoryId, ...(childCategories?.map(c => c.id) || [])];

      const { data, error } = await supabase
        .from("seller_catalog")
        .select(`
          id, sku, nombre, descripcion, precio_venta, precio_costo, stock, images, metadata,
          store:stores!seller_catalog_seller_store_id_fkey(id, name, whatsapp, logo, slug),
          source_product:products!seller_catalog_source_product_id_fkey(
            id, categoria_id, 
            category:categories!products_categoria_id_fkey(id, name, slug)
          )
        `)
        .eq("is_active", true)
        .gt("stock", 0)
        .limit(limit * 3); // Get more to filter

      if (error) {
        console.error("Error fetching category products:", error);
        return [];
      }

      // Filter by category
      const filtered = (data || []).filter(item => {
        const prodCatId = (item.source_product as any)?.categoria_id;
        return prodCatId && categoryIds.includes(prodCatId);
      });

      return filtered.slice(0, limit).map(transformProduct);
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para productos recomendados basados en un producto actual
 */
export const useRecommendedProducts = (productId: string | null, categoryId: string | null, limit = 8) => {
  return useQuery({
    queryKey: ["marketplace-recommended", productId, categoryId, limit],
    queryFn: async (): Promise<MarketplaceProduct[]> => {
      // Strategy: Get products from the same category, excluding the current product
      let query = supabase
        .from("seller_catalog")
        .select(`
          id, sku, nombre, descripcion, precio_venta, precio_costo, stock, images, metadata,
          store:stores!seller_catalog_seller_store_id_fkey(id, name, whatsapp, logo, slug),
          source_product:products!seller_catalog_source_product_id_fkey(
            id, categoria_id, 
            category:categories!products_categoria_id_fkey(id, name, slug)
          )
        `)
        .eq("is_active", true)
        .gt("stock", 0)
        .limit(limit * 2);

      if (productId) {
        query = query.neq("id", productId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching recommended products:", error);
        return [];
      }

      let products = data || [];

      // If we have a categoryId, prioritize products from the same category
      if (categoryId) {
        const sameCategory = products.filter(
          p => (p.source_product as any)?.categoria_id === categoryId
        );
        const otherCategory = products.filter(
          p => (p.source_product as any)?.categoria_id !== categoryId
        );
        products = [...sameCategory, ...otherCategory];
      }

      return products.slice(0, limit).map(transformProduct);
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para banners del marketplace (B2C)
 */
export const useMarketplaceBanners = () => {
  return useQuery({
    queryKey: ["marketplace-banners"],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("admin_banners")
        .select("*")
        .eq("is_active", true)
        .or(`target_audience.eq.b2c,target_audience.eq.all`)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching banners:", error);
        return [];
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para estadísticas generales del marketplace
 */
export const useMarketplaceStats = () => {
  return useQuery({
    queryKey: ["marketplace-stats"],
    queryFn: async () => {
      const [productsResult, storesResult, categoriesResult] = await Promise.all([
        supabase
          .from("seller_catalog")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .gt("stock", 0),
        supabase
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("categories")
          .select("id", { count: "exact", head: true })
          .eq("is_visible_public", true),
      ]);

      return {
        totalProducts: productsResult.count || 0,
        totalStores: storesResult.count || 0,
        totalCategories: categoriesResult.count || 0,
      };
    },
    staleTime: 10 * 60 * 1000,
  });
};
