import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useViewMode } from "@/contexts/ViewModeContext";
import { UserRole } from "@/types/auth";

export type SearchScope = "b2c" | "b2b";

export interface SearchProductResult {
  id: string;
  sku: string;
  name: string;
  price: number;
  image: string;
  stock?: number;
  storeId?: string;
  storeName?: string;
  categoryId?: string | null;
  createdAt?: string | null;
  moq?: number | null;
}

export interface SearchStoreResult {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  description: string | null;
}

export interface SearchFilters {
  categoryId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest";
}

export const RESULTS_PAGE_SIZE = 24;

/** Escapes characters that break PostgREST `or`/`ilike` filters. */
export const sanitizeSearchTerm = (raw: string): string =>
  raw
    .trim()
    .replace(/[%_]/g, (m) => `\\${m}`)
    .replace(/[,()]/g, " ")
    .replace(/\s+/g, " ");

const parseImages = (images: unknown): string[] => {
  if (Array.isArray(images)) {
    return images.filter((i): i is string => typeof i === "string" && i.trim().length > 0);
  }
  if (typeof images === "string" && images.trim()) {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed)
        ? parsed.filter((i): i is string => typeof i === "string" && i.trim().length > 0)
        : [images];
    } catch {
      return [images];
    }
  }
  return [];
};

/** Decides which catalog the current user should search in. */
export const useSearchScope = (): SearchScope => {
  const { role } = useAuth();
  const { isClientPreview } = useViewMode();
  if (isClientPreview) return "b2c";
  const b2bRoles = [UserRole.SELLER, UserRole.ADMIN, UserRole.GROSSISTE];
  return b2bRoles.includes(role as UserRole) ? "b2b" : "b2c";
};

const searchB2CProducts = async (
  term: string,
  filters: SearchFilters,
  page: number,
  pageSize: number
): Promise<{ items: SearchProductResult[]; total: number }> => {
  let query = supabase
    .from("seller_catalog")
    .select(
      `id, sku, nombre, precio_venta, stock, images, created_at,
       store:stores!seller_catalog_seller_store_id_fkey(id, name),
       source_product:products!seller_catalog_source_product_id_fkey(id, categoria_id)`,
      { count: "exact" }
    )
    .eq("is_active", true)
    .or(`nombre.ilike.%${term}%,sku.ilike.%${term}%,descripcion.ilike.%${term}%`);

  if (filters.minPrice != null) query = query.gte("precio_venta", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("precio_venta", filters.maxPrice);

  if (filters.sort === "price_asc") query = query.order("precio_venta", { ascending: true });
  else if (filters.sort === "price_desc") query = query.order("precio_venta", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;

  let items: SearchProductResult[] = (data || []).map((item: any) => ({
    id: item.id,
    sku: item.sku,
    name: item.nombre,
    price: Number(item.precio_venta) || 0,
    image: parseImages(item.images)[0] || "",
    stock: item.stock,
    storeId: item.store?.id,
    storeName: item.store?.name,
    categoryId: item.source_product?.categoria_id ?? null,
    createdAt: item.created_at,
  }));

  // Category lives on the joined product, so it is filtered client-side.
  if (filters.categoryId) {
    items = items.filter((i) => i.categoryId === filters.categoryId);
  }

  return { items, total: count || 0 };
};

const searchB2BProducts = async (
  term: string,
  filters: SearchFilters,
  page: number,
  pageSize: number
): Promise<{ items: SearchProductResult[]; total: number }> => {
  let query = supabase
    .from("v_productos_con_precio_b2b")
    .select(
      "id, nombre, sku_interno, imagen_principal, precio_b2b, stock, categoria_id, moq, created_at",
      { count: "exact" }
    )
    .eq("is_active", true)
    .or(`nombre.ilike.%${term}%,sku_interno.ilike.%${term}%,descripcion_corta.ilike.%${term}%`);

  if (filters.categoryId) query = query.eq("categoria_id", filters.categoryId);
  if (filters.minPrice != null) query = query.gte("precio_b2b", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("precio_b2b", filters.maxPrice);

  if (filters.sort === "price_asc") query = query.order("precio_b2b", { ascending: true });
  else if (filters.sort === "price_desc") query = query.order("precio_b2b", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;

  const items: SearchProductResult[] = (data || []).map((item: any) => ({
    id: item.id,
    sku: item.sku_interno || item.id,
    name: item.nombre,
    price: Number(item.precio_b2b) || 0,
    image: item.imagen_principal || "",
    stock: item.stock,
    categoryId: item.categoria_id ?? null,
    moq: item.moq ?? null,
    createdAt: item.created_at,
  }));

  return { items, total: count || 0 };
};

export const searchStores = async (term: string, limit = 24): Promise<SearchStoreResult[]> => {
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, slug, logo, description")
    .eq("is_active", true)
    .or(`name.ilike.%${term}%,slug.ilike.%${term}%,description.ilike.%${term}%`)
    .limit(limit);
  if (error) throw error;
  return (data || []) as SearchStoreResult[];
};

/** Paginated product results for the search page. */
export const useSearchProductsPage = (
  query: string,
  scope: SearchScope,
  filters: SearchFilters,
  page = 0,
  pageSize = RESULTS_PAGE_SIZE
) => {
  const term = sanitizeSearchTerm(query);
  return useQuery({
    queryKey: ["global-search", "products", scope, term, filters, page, pageSize],
    queryFn: () =>
      scope === "b2b"
        ? searchB2BProducts(term, filters, page, pageSize)
        : searchB2CProducts(term, filters, page, pageSize),
    enabled: term.length >= 2,
    staleTime: 60 * 1000,
  });
};

/** Store results for the search page. */
export const useSearchStores = (query: string) => {
  const term = sanitizeSearchTerm(query);
  return useQuery({
    queryKey: ["global-search", "stores", term],
    queryFn: () => searchStores(term),
    enabled: term.length >= 2,
    staleTime: 60 * 1000,
  });
};

/** Compact suggestions for the header dropdown. */
export const useSearchSuggestions = (query: string, scope: SearchScope) => {
  const term = sanitizeSearchTerm(query);
  return useQuery({
    queryKey: ["global-search", "suggestions", scope, term],
    queryFn: async () => {
      const [products, stores] = await Promise.all([
        scope === "b2b"
          ? searchB2BProducts(term, { sort: "relevance" }, 0, 6)
          : searchB2CProducts(term, { sort: "relevance" }, 0, 6),
        searchStores(term, 4),
      ]);
      return { products: products.items, stores };
    },
    enabled: term.length >= 2,
    staleTime: 30 * 1000,
  });
};

const RECENT_KEY = "recent_searches";
const RECENT_MAX = 8;

export const getRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
};

export const saveRecentSearch = (term: string) => {
  const clean = term.trim();
  if (!clean) return;
  try {
    const list = [clean, ...getRecentSearches().filter((s) => s.toLowerCase() !== clean.toLowerCase())];
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* storage unavailable */
  }
};

export const clearRecentSearches = () => {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* noop */
  }
};
