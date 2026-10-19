import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SponsoredPlacementType = "category" | "trends" | "news";

export interface SponsoredItem {
  id: string;
  placementId: string;
  sku: string;
  nombre: string;
  imagen_principal: string;
  precio_b2b: number;
  storeName: string | null;
  sponsored: true;
}

const db = supabase as any;

const firstImage = (images: unknown): string | null => {
  const list = Array.isArray(images) ? images : typeof images === "string" ? [images] : [];
  const img = list.find((i) => typeof i === "string" && i && i !== "null");
  return (img as string) || null;
};

const PLACEMENT_SELECT = `id, placement, priority, starts_at, ends_at, is_active, amount_paid, currency, notes, category_id,
  seller_catalog:seller_catalog(id, sku, nombre, precio_venta, images, store:stores!seller_catalog_seller_store_id_fkey(id, name)),
  product:products(id, sku_interno, nombre, imagen_principal, precio_sugerido_venta, precio_mayorista_base),
  store:stores(id, name), category:categories(id, name)`;

const toItem = (row: any, isB2B = false): SponsoredItem | null => {
  if (row.seller_catalog) {
    const sc = row.seller_catalog;
    const img = firstImage(sc.images);
    if (!img) return null;
    return { id: sc.id, placementId: row.id, sku: sc.sku, nombre: sc.nombre ?? "", imagen_principal: img, precio_b2b: Number(sc.precio_venta ?? 0), storeName: sc.store?.name ?? row.store?.name ?? null, sponsored: true };
  }
  if (row.product) {
    const p = row.product;
    if (!p.imagen_principal || p.imagen_principal === "null") return null;
    const price = isB2B ? p.precio_mayorista_base : p.precio_sugerido_venta ?? p.precio_mayorista_base;
    return { id: p.id, placementId: row.id, sku: p.sku_interno, nombre: p.nombre ?? "", imagen_principal: p.imagen_principal, precio_b2b: Number(price ?? 0), storeName: "Kizkka", sponsored: true };
  }
  return null;
};

/** Live sponsored items for a public placement (RLS only returns active, in-date rows). */
export const fetchSponsoredItems = async (placement: SponsoredPlacementType, categoryId: string | null, isB2B = false) => {
  const { data, error } = await db
    .from("sponsored_placements")
    .select(PLACEMENT_SELECT)
    .eq("placement", placement)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(30);
  if (error) return [] as SponsoredItem[];
  return ((data || []) as any[])
    .filter((r) => !r.category_id || !categoryId || r.category_id === categoryId)
    .map((r) => toItem(r, isB2B))
    .filter(Boolean) as SponsoredItem[];
};

export const useSponsoredItems = (placement: SponsoredPlacementType, categoryId: string | null = null) =>
  useQuery({
    queryKey: ["sponsored-items", placement, categoryId],
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchSponsoredItems(placement, categoryId),
  });

/* ---------------- Admin ---------------- */

export interface AdminPlacementRow {
  id: string;
  placement: SponsoredPlacementType;
  priority: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  amount_paid: number | null;
  currency: string | null;
  notes: string | null;
  categoryName: string | null;
  item: SponsoredItem | null;
}

export const useAdminSponsoredPlacements = () => {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-sponsored-placements"],
    queryFn: async (): Promise<AdminPlacementRow[]> => {
      const { data, error } = await db
        .from("sponsored_placements")
        .select(PLACEMENT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        placement: r.placement,
        priority: r.priority,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        is_active: r.is_active,
        amount_paid: r.amount_paid,
        currency: r.currency,
        notes: r.notes,
        categoryName: r.category?.name ?? null,
        item: toItem(r),
      }));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-sponsored-placements"] });
    qc.invalidateQueries({ queryKey: ["sponsored-items"] });
    qc.invalidateQueries({ queryKey: ["promoted-products"] });
  };

  const create = useMutation({
    mutationFn: async (v: {
      placements: SponsoredPlacementType[];
      sellerCatalogId?: string | null;
      productId?: string | null;
      storeId?: string | null;
      categoryId?: string | null;
      days: number | null;
      priority: number;
      amountPaid: number;
      notes: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const ends_at = v.days ? new Date(Date.now() + v.days * 86_400_000).toISOString() : null;
      const rows = v.placements.map((placement) => ({
        placement,
        seller_catalog_id: v.sellerCatalogId ?? null,
        product_id: v.productId ?? null,
        store_id: v.storeId ?? null,
        category_id: placement === "category" ? v.categoryId ?? null : null,
        ends_at,
        priority: v.priority,
        amount_paid: v.amountPaid,
        notes: v.notes || null,
        created_by: user?.id,
      }));
      const { error } = await db.from("sponsored_placements").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Producto patrocinado"); invalidate(); },
    onError: (e: Error) => toast.error(`No se pudo patrocinar: ${e.message}`),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from("sponsored_placements").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("sponsored_placements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Anuncio eliminado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { rows: list.data || [], isLoading: list.isLoading, create, toggle, remove };
};

export interface SearchResult {
  key: string;
  source: "seller" | "kizkka";
  id: string;
  storeId: string | null;
  storeName: string;
  nombre: string;
  sku: string;
  image: string | null;
  price: number;
}

export const useSponsorProductSearch = (term: string) =>
  useQuery({
    queryKey: ["sponsor-product-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      const t = term.trim().replace(/[%,]/g, "");
      const [sc, pr] = await Promise.all([
        db.from("seller_catalog")
          .select("id, sku, nombre, precio_venta, images, seller_store_id, store:stores!seller_catalog_seller_store_id_fkey(id, name)")
          .eq("is_active", true)
          .or(`nombre.ilike.%${t}%,sku.ilike.%${t}%`)
          .limit(15),
        db.from("products")
          .select("id, sku_interno, nombre, imagen_principal, precio_sugerido_venta")
          .eq("is_active", true)
          .or(`nombre.ilike.%${t}%,sku_interno.ilike.%${t}%`)
          .limit(15),
      ]);
      const sellers: SearchResult[] = ((sc.data || []) as any[]).map((r) => ({
        key: `s-${r.id}`, source: "seller", id: r.id, storeId: r.seller_store_id, storeName: r.store?.name ?? "Tienda",
        nombre: r.nombre, sku: r.sku, image: firstImage(r.images), price: Number(r.precio_venta ?? 0),
      }));
      const kizkka: SearchResult[] = ((pr.data || []) as any[]).map((r) => ({
        key: `k-${r.id}`, source: "kizkka", id: r.id, storeId: null, storeName: "Kizkka",
        nombre: r.nombre, sku: r.sku_interno, image: r.imagen_principal && r.imagen_principal !== "null" ? r.imagen_principal : null, price: Number(r.precio_sugerido_venta ?? 0),
      }));
      return [...sellers, ...kizkka];
    },
  });
