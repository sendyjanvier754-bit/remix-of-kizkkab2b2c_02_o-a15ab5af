import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface FavoriteItem {
  id: string;
  seller_catalog_id: string;
  store_id: string | null;
  name: string;
  price: number;
  image: string;
  sku: string;
  store_name?: string;
}

export const useFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch favorites from database
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          id,
          seller_catalog_id,
          store_id,
          seller_catalog:seller_catalog_id (
            id,
            nombre,
            precio_venta,
            imagen_principal,
            sku,
            store:store_id (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .not('seller_catalog_id', 'is', null);

      if (error) {
        console.error('Error fetching favorites:', error);
        return [];
      }

      // Transform to FavoriteItem format
      return (data || []).map((fav: any) => ({
        id: fav.id,
        seller_catalog_id: fav.seller_catalog_id,
        store_id: fav.store_id,
        name: fav.seller_catalog?.nombre || 'Producto',
        price: fav.seller_catalog?.precio_venta || 0,
        image: fav.seller_catalog?.imagen_principal || '/placeholder.svg',
        sku: fav.seller_catalog?.sku || '',
        store_name: fav.seller_catalog?.store?.name || '',
      }));
    },
    enabled: !!user?.id,
  });

  // Add favorite mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async (params: { sellerCatalogId: string; storeId?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          seller_catalog_id: params.sellerCatalogId,
          store_id: params.storeId || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
      toast.success('Agregado a favoritos');
    },
    onError: (error: any) => {
      console.error('Error adding favorite:', error);
      if (error.code === '23505') {
        toast.info('Ya está en tus favoritos');
      } else {
        toast.error('Error al agregar a favoritos');
      }
    },
  });

  // Remove favorite mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async (sellerCatalogId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('seller_catalog_id', sellerCatalogId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
      toast.success('Eliminado de favoritos');
    },
    onError: (error) => {
      console.error('Error removing favorite:', error);
      toast.error('Error al eliminar de favoritos');
    },
  });

  // Check if item is favorite
  const isFavorite = (sellerCatalogId: string): boolean => {
    return items.some(item => item.seller_catalog_id === sellerCatalogId);
  };

  // Toggle favorite
  const toggleFavorite = (params: { sellerCatalogId: string; storeId?: string }) => {
    if (!user?.id) {
      toast.error('Inicia sesión para guardar favoritos');
      return;
    }

    if (isFavorite(params.sellerCatalogId)) {
      removeFavoriteMutation.mutate(params.sellerCatalogId);
    } else {
      addFavoriteMutation.mutate(params);
    }
  };

  // Legacy methods for backwards compatibility
  const addFavorite = (item: { id: string; name: string; price: number; image: string; sku: string }) => {
    addFavoriteMutation.mutate({ sellerCatalogId: item.id });
  };

  const removeFavorite = (id: string) => {
    // Find the seller_catalog_id from the item
    const item = items.find(i => i.id === id || i.seller_catalog_id === id);
    if (item) {
      removeFavoriteMutation.mutate(item.seller_catalog_id);
    }
  };

  return {
    items,
    isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    isAdding: addFavoriteMutation.isPending,
    isRemoving: removeFavoriteMutation.isPending,
  };
};
