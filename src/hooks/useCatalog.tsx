import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { syncBatchEntityTranslations, syncEntityTranslations } from '@/lib/translationSync';

export interface Product {
  id: string;
  sku_interno: string;
  nombre: string;
  descripcion_corta: string | null;
  descripcion_larga: string | null;
  categoria_id: string | null;
  proveedor_id: string | null;
  precio_mayorista_base: number;
  precio_sugerido_venta: number | null;
  moq: number;
  stock_fisico: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  peso_kg: number | null; // DEPRECATED: Usar peso_g
  peso_g: number | null; // Peso en gramos (nuevo)
  dimensiones_cm: { largo?: number; ancho?: number; alto?: number } | null;
  imagen_principal: string | null;
  galeria_imagenes: string[] | null;
  url_origen: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: Category | null;
  suppliers?: Supplier | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
}

export interface ProductFilters {
  category?: string;
  supplier?: string;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'all';
  search?: string;
}

export const useCatalog = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products with filters
  const useProducts = (filters?: ProductFilters) => {
    return useQuery({
      queryKey: ['products', filters],
      queryFn: async () => {
        let query = supabase
          .from('products')
          .select(`
            *,
            categories (id, name, slug),
            suppliers (id, name)
          `)
          .order('created_at', { ascending: false });

        if (filters?.category && filters.category !== 'all') {
          query = query.eq('categoria_id', filters.category);
        }
        if (filters?.supplier && filters.supplier !== 'all') {
          query = query.eq('proveedor_id', filters.supplier);
        }
        if (filters?.stockStatus && filters.stockStatus !== 'all') {
          query = query.eq('stock_status', filters.stockStatus);
        }
        if (filters?.search) {
          query = query.or(`nombre.ilike.%${filters.search}%,sku_interno.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as unknown as Product[];
      },
    });
  };

  // Fetch single product
  const useProduct = (id: string) => {
    return useQuery({
      queryKey: ['product', id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            categories (id, name, slug),
            suppliers (id, name)
          `)
          .eq('id', id)
          .single();
        if (error) throw error;
        return data as unknown as Product;
      },
      enabled: !!id,
    });
  };

  // Fetch categories
  const useCategories = () => {
    return useQuery({
      queryKey: ['categories'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');
        if (error) throw error;
        return data as Category[];
      },
    });
  };

  // Fetch suppliers
  const useSuppliers = () => {
    return useQuery({
      queryKey: ['suppliers'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('name');
        if (error) throw error;
        return data as Supplier[];
      },
    });
  };

  // Catalog KPIs
  const useCatalogKPIs = () => {
    return useQuery({
      queryKey: ['catalog-kpis'],
      queryFn: async () => {
        const { data: products, error } = await supabase
          .from('products')
          .select('stock_fisico, stock_status, moq, is_active');
        
        if (error) throw error;

        const activeProducts = products?.filter(p => p.is_active) || [];
        const totalStock = activeProducts.reduce((sum, p) => sum + (p.stock_fisico || 0), 0);
        const lowMoqAlerts = activeProducts.filter(p => p.stock_fisico < p.moq).length;
        const outOfStock = activeProducts.filter(p => p.stock_status === 'out_of_stock').length;

        return {
          totalSKUs: activeProducts.length,
          totalStock,
          lowMoqAlerts,
          outOfStock,
        };
      },
    });
  };

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: async (product: Omit<Partial<Product>, 'categories' | 'suppliers'> & { sku_interno: string; nombre: string }) => {
      const { data, error } = await supabase
        .from('products')
        .insert([{ ...product, dimensiones_cm: product.dimensiones_cm as any }])
        .select()
        .single();
      if (error) throw error;

      await syncEntityTranslations('product', data.id, {
        nombre: data.nombre,
        descripcion_corta: data.descripcion_corta,
        descripcion_larga: data.descripcion_larga,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-kpis'] });
      toast({ title: 'Producto creado exitosamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al crear producto', description: error.message, variant: 'destructive' });
    },
  });

  // Update product mutation with history tracking
  const updateProduct = useMutation({
    mutationFn: async ({ id, updates, userId }: { id: string; updates: Partial<Product>; userId?: string }) => {
      // Get current product for history
      const { data: current } = await supabase
        .from('products')
        .select('precio_mayorista_base, moq')
        .eq('id', id)
        .single();

      // Track price/MOQ changes
      const historyEntries = [];
      if (current && updates.precio_mayorista_base !== undefined && updates.precio_mayorista_base !== current.precio_mayorista_base) {
        historyEntries.push({
          product_id: id,
          campo_modificado: 'precio_mayorista_base',
          valor_anterior: String(current.precio_mayorista_base),
          valor_nuevo: String(updates.precio_mayorista_base),
          modificado_por: userId,
        });
      }
      if (current && updates.moq !== undefined && updates.moq !== current.moq) {
        historyEntries.push({
          product_id: id,
          campo_modificado: 'moq',
          valor_anterior: String(current.moq),
          valor_nuevo: String(updates.moq),
          modificado_por: userId,
        });
      }

      // Insert history if any changes
      if (historyEntries.length > 0) {
        await supabase.from('product_price_history').insert(historyEntries);
      }

      // Update product
      const { data, error } = await supabase
        .from('products')
        .update({ ...updates, dimensiones_cm: updates.dimensiones_cm as any })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      await syncEntityTranslations('product', id, {
        nombre: data.nombre,
        descripcion_corta: data.descripcion_corta,
        descripcion_larga: data.descripcion_larga,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-kpis'] });
      toast({ title: 'Producto actualizado exitosamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar producto', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk import products
  const bulkImportProducts = useMutation({
    mutationFn: async (products: Array<{ sku_interno: string; nombre: string; [key: string]: unknown }>) => {
      const { data, error } = await supabase
        .from('products')
        .insert(products)
        .select();
      if (error) throw error;

      await syncBatchEntityTranslations(
        (data || []).map((row: any) => ({
          entityType: 'product',
          entityId: row.id,
          fields: {
            nombre: row.nombre,
            descripcion_corta: row.descripcion_corta,
            descripcion_larga: row.descripcion_larga,
          },
        }))
      );

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-kpis'] });
      toast({ title: `${data.length} productos importados exitosamente` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error en importación masiva', description: error.message, variant: 'destructive' });
    },
  });

  // Delete product
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-kpis'] });
      toast({ title: 'Producto eliminado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar producto', description: error.message, variant: 'destructive' });
    },
  });

  // Upload image to storage
  const uploadImage = async (file: File, productId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${productId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  // Download and store external image
  const downloadAndStoreImage = async (imageUrl: string, productId: string): Promise<string> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${productId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  };

  // Create category
  const createCategory = useMutation({
    mutationFn: async (category: { name: string; slug: string; parent_id?: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert(category)
        .select()
        .single();
      if (error) throw error;

      await syncEntityTranslations('category', data.id, {
        name: data.name,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría creada exitosamente' });
    },
  });

  // Create supplier
  const createSupplier = useMutation({
    mutationFn: async (supplier: { name: string; contact_email?: string | null; contact_phone?: string | null; country?: string | null; notes?: string | null }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplier])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Proveedor creado exitosamente' });
    },
  });

  // Update supplier
  const updateSupplier = useMutation({
    mutationFn: async (supplier: { id: string; name: string; contact_email?: string | null; contact_phone?: string | null; country?: string | null; notes?: string | null }) => {
      const { id, ...updateData } = supplier;
      const { data, error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Proveedor actualizado exitosamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar proveedor', description: error.message, variant: 'destructive' });
    },
  });

  // Delete supplier
  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Proveedor eliminado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar proveedor', description: error.message, variant: 'destructive' });
    },
  });

  return {
    useProducts,
    useProduct,
    useCategories,
    useSuppliers,
    useCatalogKPIs,
    createProduct,
    updateProduct,
    bulkImportProducts,
    deleteProduct,
    uploadImage,
    downloadAndStoreImage,
    createCategory,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
};
