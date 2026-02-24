import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface B2BFavoriteItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  // Enriched
  name: string;
  /** Precio B2B dinámico calculado por v_productos_con_precio_b2b */
  price: number;
  precio_b2b: number;
  image: string;
  sku: string | null;
  moq: number;
  categoria_id: string | null;
  categoria_name: string | null;
}

export const useB2BFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['b2b_favorites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Step 1: get favorite rows
      const { data: favData, error: favError } = await supabase
        .from('b2b_favorites')
        .select('id, user_id, product_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (favError) {
        console.error('Error fetching B2B favorites:', favError);
        return [];
      }
      if (!favData?.length) return [];

      const productIds = favData.map(f => f.product_id);

      // Step 2: fetch dynamic B2B prices from view
      const { data: viewProducts, error: viewError } = await (supabase as any)
        .from('v_productos_con_precio_b2b')
        .select('id, nombre, precio_b2b, imagen_principal, galeria_imagenes, sku_interno, moq, categoria_id')
        .in('id', productIds);

      if (viewError) {
        console.error('Error fetching v_productos_con_precio_b2b:', viewError);
      }

      // Step 3: fetch category names
      const categoriaIds = [
        ...new Set((viewProducts || []).map((p: any) => p.categoria_id).filter(Boolean)),
      ] as string[];

      let catMap: Record<string, string> = {};
      if (categoriaIds.length) {
        const { data: cats } = await supabase
          .from('categories')
          .select('id, name')
          .in('id', categoriaIds);
        (cats || []).forEach((c: any) => { catMap[c.id] = c.name; });
      }

      const productMap = new Map<string, any>(
        (viewProducts || []).map((p: any) => [p.id, p])
      );

      return favData.map((row): B2BFavoriteItem => {
        const p = productMap.get(row.product_id);
        const preciob2b = p?.precio_b2b || 0;
        return {
          id: row.id,
          user_id: row.user_id,
          product_id: row.product_id,
          created_at: row.created_at,
          name: p?.nombre || 'Producto',
          price: preciob2b,
          precio_b2b: preciob2b,
          image: p?.imagen_principal || p?.galeria_imagenes?.[0] || '/placeholder.svg',
          sku: p?.sku_interno || '',
          moq: p?.moq || 1,
          categoria_id: p?.categoria_id ?? null,
          categoria_name: p?.categoria_id ? (catMap[p.categoria_id] ?? null) : null,
        };
      });
    },
    enabled: !!user?.id,
  });

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('b2b_favorites')
        .insert({ user_id: user.id, product_id: productId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_favorites', user?.id] });
      toast.success('Agregado a favoritos B2B ❤️');
    },
    onError: (error: any) => {
      if (error.code === '23505') toast.info('Ya está en tus favoritos');
      else toast.error('Error al agregar a favoritos');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (params: { favoriteId?: string; productId?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      let query = supabase.from('b2b_favorites').delete().eq('user_id', user.id);
      if (params.favoriteId) query = query.eq('id', params.favoriteId);
      else if (params.productId) query = query.eq('product_id', params.productId);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_favorites', user?.id] });
      toast.success('Eliminado de favoritos');
    },
    onError: () => toast.error('Error al eliminar de favoritos'),
  });

  const isInFavorites = (productId: string): boolean =>
    items.some(item => item.product_id === productId);

  const toggle = (productId: string) => {
    if (!user?.id) { toast.error('Inicia sesión para guardar favoritos'); return; }
    if (isInFavorites(productId)) removeMutation.mutate({ productId });
    else addMutation.mutate(productId);
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
