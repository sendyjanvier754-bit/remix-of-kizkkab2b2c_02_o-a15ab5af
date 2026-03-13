import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PublishData } from '@/components/seller/PublishToB2CModal';

export function usePublishToB2C() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const publishMutation = useMutation({
    mutationFn: async (data: PublishData & { storeId: string }) => {
      const { storeId, productId, orderId, nombre, descripcion, categoryId, images, variantes, delivery_time_days, shipping_cost, is_preorder } = data;

      // Calcular el precio mínimo de las variantes a publicar (siempre > 0)
      const minVariantPrice = Math.min(
        ...variantes.map(v => v.precio_venta).filter(p => p > 0)
      );
      if (!minVariantPrice || minVariantPrice <= 0) {
        throw new Error('Todas las variantes deben tener un precio de venta válido mayor a $0');
      }

      // 1. Buscar o crear el registro principal en seller_catalog
      const { data: existingCatalog, error: searchError } = await supabase
        .from('seller_catalog')
        .select('id')
        .eq('seller_store_id', storeId)
        .eq('source_product_id', productId)
        .maybeSingle();

      if (searchError) throw searchError;

      let catalogId: string;

      if (existingCatalog) {
        // Actualizar catalog existente
        catalogId = existingCatalog.id;

        const { error: updateError } = await supabase
          .from('seller_catalog')
          .update({
            nombre,
            descripcion,
            category_id: categoryId,
            source_order_id: orderId,
            is_active: true,
            precio_venta: minVariantPrice, // Usar precio real del seller
            metadata: {
              delivery_time_days,
              shipping_cost,
              is_preorder,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', catalogId);

        if (updateError) throw updateError;
      } else {
        // Crear nuevo registro en seller_catalog
        const { data: newCatalog, error: insertError } = await supabase
          .from('seller_catalog')
          .insert({
            seller_store_id: storeId,
            source_product_id: productId,
            source_order_id: orderId,
            sku: variantes[0].sku,
            nombre,
            descripcion,
            category_id: categoryId,
            precio_venta: minVariantPrice, // Precio real del seller, nunca 0
            precio_costo: variantes[0].precio_original || 0,
            stock: 0, // Se maneja a nivel de variante
            images,
            is_active: true,
            metadata: {
              delivery_time_days,
              shipping_cost,
              is_preorder,
            },
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        if (!newCatalog) throw new Error('No se pudo crear el registro en seller_catalog');

        catalogId = newCatalog.id;
      }

      // 2. Insertar o actualizar todas las variantes seleccionadas
      for (const variante of variantes) {
        const { variant_id: variantId, sku, stock_a_publicar, precio_venta } = variante;
        
        // Buscar si ya existe esta variante
        const { data: existingVariant, error: variantSearchError } = await supabase
          .from('seller_catalog_variants')
          .select('id')
          .eq('seller_catalog_id', catalogId)
          .eq('variant_id', variantId)
          .maybeSingle();

        if (variantSearchError) throw variantSearchError;

        if (existingVariant) {
          // Actualizar variante existente
          const { error: updateVariantError } = await supabase
            .from('seller_catalog_variants')
            .update({
              sku,
              stock: stock_a_publicar, // Solo publicar la cantidad seleccionada
              precio_override: precio_venta,
              is_available: !is_preorder, // False si es preventa
              availability_status: is_preorder ? 'pending' : 'available',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingVariant.id);

          if (updateVariantError) throw updateVariantError;
        } else {
          // Crear nueva variante
          const { error: insertVariantError } = await supabase
            .from('seller_catalog_variants')
            .insert({
              seller_catalog_id: catalogId,
              variant_id: variantId,
              sku,
              stock: stock_a_publicar, // Solo publicar la cantidad seleccionada
              precio_override: precio_venta,
              is_available: !is_preorder, // False si es preventa
              availability_status: is_preorder ? 'pending' : 'available',
            });

          if (insertVariantError) throw insertVariantError;
        }
      }

      return { catalogId, success: true };
    },
    onSuccess: () => {
      // Invalidar queries relevantes
      queryClient.invalidateQueries({ queryKey: ['inventario-b2c'] });
      queryClient.invalidateQueries({ queryKey: ['seller-catalog'] });
      
      toast({
        title: '¡Producto publicado!',
        description: 'El producto ha sido publicado exitosamente en tu catálogo B2C.',
      });
    },
    onError: (error: any) => {
      console.error('Error publicando producto:', error);
      toast({
        title: 'Error al publicar',
        description: error.message || 'No se pudo publicar el producto. Intenta nuevamente.',
        variant: 'destructive',
      });
    },
  });

  return {
    publish: publishMutation.mutateAsync,
    isPublishing: publishMutation.isPending,
  };
}
