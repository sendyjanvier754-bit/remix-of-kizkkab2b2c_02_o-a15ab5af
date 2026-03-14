import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type WishlistType = 'B2B' | 'B2C';

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string | null;
  seller_catalog_id: string | null;
  variant_id: string | null;
  store_id: string | null;
  type: WishlistType;
  created_at: string;
  // Enriched data
  name?: string;
  price?: number;
  image?: string;
  sku?: string;
  store_name?: string;
  moq?: number;
  // Category data (for grouping/filtering)
  categoria_id?: string | null;
  categoria_name?: string | null;
}

const resolveCatalogImage = (catalog: any): string => {
  // seller_catalog schema uses `images` (jsonb). Some legacy code expects `imagen_principal`.
  const direct = catalog?.imagen_principal ?? catalog?.image;
  if (typeof direct === 'string' && direct) return direct;

  const images = catalog?.images;
  if (Array.isArray(images) && typeof images[0] === 'string') return images[0];
  if (images && typeof images === 'object') {
    const maybeArray = (images.urls ?? images.images ?? images.items) as unknown;
    if (Array.isArray(maybeArray) && typeof maybeArray[0] === 'string') return maybeArray[0];
  }

  return '/placeholder.svg';
};

interface AddToWishlistParams {
  productId?: string;
  sellerCatalogId?: string;
  variantId?: string;
  storeId?: string;
  type: WishlistType;
}

export const useWishlist = (type?: WishlistType) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch wishlist items from database
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['wishlist', user?.id, type],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('user_favorites')
        .select(`
          id,
          user_id,
          product_id,
          seller_catalog_id,
          variant_id,
          store_id,
          type,
          created_at,
          products:product_id (
            id,
            nombre,
            precio_mayorista_base,
            imagen_principal,
            sku_interno,
            moq,
            categoria_id,
            categories:categoria_id (
              id,
              name
            )
          ),
          seller_catalog:seller_catalog_id (
            id,
            nombre,
            precio_venta,
            sku,
            images,
            seller_store_id
          )
        `)
        .eq('user_id', user.id);

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching wishlist:', error);
        return [];
      }

      // Transform to WishlistItem format
      return (data || []).map((item: any): WishlistItem => {
        const isB2B = item.type === 'B2B';
        const product = item.products;
        const catalog = item.seller_catalog;

        return {
          id: item.id,
          user_id: item.user_id,
          product_id: item.product_id,
          seller_catalog_id: item.seller_catalog_id,
          variant_id: item.variant_id,
          store_id: item.store_id,
          type: item.type,
          created_at: item.created_at,
          // Enriched data depends on type
          name: isB2B
            ? (product?.nombre || 'Producto')
            : (catalog?.nombre || product?.nombre || 'Producto'),
          price: isB2B
            ? (product?.precio_mayorista || 0)
            : (catalog?.precio_venta || product?.precio_mayorista || 0),
          image: isB2B
            ? (product?.imagen_principal || '/placeholder.svg')
            : (resolveCatalogImage(catalog) !== '/placeholder.svg'
                ? resolveCatalogImage(catalog)
                : (product?.imagen_principal || '/placeholder.svg')),
          sku: isB2B
            ? (product?.sku_interno || '')
            : (catalog?.sku || product?.sku_interno || ''),
          // seller_catalog doesn't have a reliable FK relationship cached for nested store joins.
          store_name: '',
          moq: product?.moq || 1,
          // Category for grouping/filtering
          categoria_id: product?.categoria_id ?? null,
          categoria_name: (product?.categories as any)?.name ?? null,
        };
      });
    },
    enabled: !!user?.id,
  });

  // Add to wishlist mutation
  const addMutation = useMutation({
    mutationFn: async (params: AddToWishlistParams) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          product_id: params.productId || null,
          seller_catalog_id: params.sellerCatalogId || null,
          variant_id: params.variantId || null,
          store_id: params.storeId || null,
          type: params.type,
        });

      if (error) throw error;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] }); // Legacy compatibility
      toast.success('Agregado a favoritos ❤️');
    },
    onError: (error: any) => {
      console.error('Error adding to wishlist:', error);
      if (error.code === '23505') {
        toast.info('Ya está en tus favoritos');
      } else {
        toast.error('Error al agregar a favoritos');
      }
    },
  });

  // Remove from wishlist mutation
  const removeMutation = useMutation({
    mutationFn: async (params: { productId?: string; sellerCatalogId?: string; wishlistItemId?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      let query = supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id);

      if (params.wishlistItemId) {
        query = query.eq('id', params.wishlistItemId);
      } else if (params.productId) {
        query = query.eq('product_id', params.productId);
      } else if (params.sellerCatalogId) {
        query = query.eq('seller_catalog_id', params.sellerCatalogId);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] }); // Legacy compatibility
      toast.success('Eliminado de favoritos');
    },
    onError: (error) => {
      console.error('Error removing from wishlist:', error);
      toast.error('Error al eliminar de favoritos');
    },
  });

  // Check if item is in wishlist
  const isInWishlist = (productId?: string, sellerCatalogId?: string): boolean => {
    if (productId) {
      return items.some(item => item.product_id === productId);
    }
    if (sellerCatalogId) {
      return items.some(item => item.seller_catalog_id === sellerCatalogId);
    }
    return false;
  };

  // Toggle wishlist item
  const toggleWishlist = (params: AddToWishlistParams) => {
    if (!user?.id) {
      toast.error('Inicia sesión para guardar favoritos');
      return;
    }

    const isAlreadyInWishlist = params.productId 
      ? isInWishlist(params.productId)
      : isInWishlist(undefined, params.sellerCatalogId);

    if (isAlreadyInWishlist) {
      removeMutation.mutate({ 
        productId: params.productId, 
        sellerCatalogId: params.sellerCatalogId 
      });
    } else {
      addMutation.mutate(params);
    }
  };

  return {
    items,
    isLoading,
    addToWishlist: addMutation.mutate,
    removeFromWishlist: removeMutation.mutate,
    isInWishlist,
    toggleWishlist,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    refetch,
  };
};

// Hook específico para B2B (Sellers)
export const useB2BWishlist = () => useWishlist('B2B');

// Hook específico para B2C (Clientes)
export const useB2CWishlist = () => useWishlist('B2C');
