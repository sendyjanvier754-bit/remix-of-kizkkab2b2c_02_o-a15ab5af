import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface B2CFavoriteItem {
  id: string;
  user_id: string;
  product_id: string | null;
  seller_catalog_id: string | null;
  created_at: string;
  // Enriched
  name: string;
  price: number;
  image: string;
  sku: string;
  store_id: string | null;
  store_name: string;
}

const resolveCatalogImage = (catalog: any): string => {
  const direct = catalog?.imagen_principal ?? catalog?.image;
  if (typeof direct === 'string' && direct) return direct;
  const images = catalog?.images;
  if (Array.isArray(images) && typeof images[0] === 'string') return images[0];
  return '/placeholder.svg';
};

export const useB2CFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['b2c_favorites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('b2c_favorites')
        .select(`
          id,
          user_id,
          product_id,
          seller_catalog_id,
          created_at,
          product:products!b2c_favorites_product_id_fkey (
            id, nombre, precio_mayorista_base, imagen_principal, sku_interno
          ),
          catalog:seller_catalog!b2c_favorites_seller_catalog_id_fkey (
            id, nombre, precio_venta, images, imagen_principal, sku,
            store:stores!seller_catalog_seller_store_id_fkey ( id, name )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching B2C favorites:', error);
        return [];
      }

      return (data || []).map((row: any): B2CFavoriteItem => {
        const product = row.product;
        const catalog = row.catalog;
        const hasCatalog = !!catalog;

        return {
          id: row.id,
          user_id: row.user_id,
          product_id: row.product_id,
          seller_catalog_id: row.seller_catalog_id,
          created_at: row.created_at,
          name: hasCatalog ? (catalog.nombre || 'Producto') : (product?.nombre || 'Producto'),
          price: hasCatalog ? (catalog.precio_venta || 0) : (product?.precio_mayorista_base || 0),
          image: hasCatalog ? resolveCatalogImage(catalog) : (product?.imagen_principal || '/placeholder.svg'),
          sku: hasCatalog ? (catalog.sku || '') : (product?.sku_interno || ''),
          store_id: hasCatalog ? (catalog.store?.id ?? null) : null,
          store_name: hasCatalog ? (catalog.store?.name || '') : '',
        };
      });
    },
    enabled: !!user?.id,
  });

  const addMutation = useMutation({
    mutationFn: async (params: { productId?: string; sellerCatalogId?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('b2c_favorites')
        .insert({
          user_id: user.id,
          product_id: params.productId || null,
          seller_catalog_id: params.sellerCatalogId || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2c_favorites', user?.id] });
      toast.success('Agregado a favoritos ❤️');
    },
    onError: (error: any) => {
      if (error.code === '23505') toast.info('Ya está en tus favoritos');
      else toast.error('Error al agregar a favoritos');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (params: { favoriteId?: string; productId?: string; sellerCatalogId?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      let query = supabase.from('b2c_favorites').delete().eq('user_id', user.id);
      if (params.favoriteId) query = query.eq('id', params.favoriteId);
      else if (params.productId) query = query.eq('product_id', params.productId);
      else if (params.sellerCatalogId) query = query.eq('seller_catalog_id', params.sellerCatalogId);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2c_favorites', user?.id] });
      toast.success('Eliminado de favoritos');
    },
    onError: () => toast.error('Error al eliminar de favoritos'),
  });

  const isInFavorites = (productId?: string, sellerCatalogId?: string): boolean => {
    if (productId) return items.some(i => i.product_id === productId);
    if (sellerCatalogId) return items.some(i => i.seller_catalog_id === sellerCatalogId);
    return false;
  };

  const toggle = (params: { productId?: string; sellerCatalogId?: string }) => {
    if (!user?.id) { toast.error('Inicia sesión para guardar favoritos'); return; }
    if (isInFavorites(params.productId, params.sellerCatalogId)) {
      removeMutation.mutate(params);
    } else {
      addMutation.mutate(params);
    }
  };

  return {
    items,
    isLoading,
    addFavorite: addMutation.mutate,
    removeFavorite: removeMutation.mutate,
    isInFavorites,
    toggle,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
};
