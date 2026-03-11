import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import EmbeddingService from '@/services/ai/embeddingService';

interface Product {
  id: string;
  nombre: string;
  imagen_principal: string | null;
  embedding: string | null;
}

interface EmbeddingProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  currentProduct: string;
}

export const useProductEmbeddings = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<EmbeddingProgress>({
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    currentProduct: ''
  });
  const [errors, setErrors] = useState<string[]>([]);

  const generateEmbeddingsForProducts = useCallback(async (onlyMissing: boolean = true) => {
    setIsProcessing(true);
    setErrors([]);
    
    try {
      // Fetch products - only those with images
      let query = (supabase as any)
        .from('products')
        .select('id, nombre, imagen_principal, embedding')
        .not('imagen_principal', 'is', null)
        .eq('is_active', true);
      
      if (onlyMissing) {
        query = query.is('embedding', null);
      }

      const { data: products, error } = await query;

      if (error) throw error;

      if (!products || products.length === 0) {
        setProgress(prev => ({ ...prev, total: 0 }));
        setIsProcessing(false);
        return { success: 0, failed: 0, message: 'No hay productos para procesar' };
      }

      setProgress({
        total: products.length,
        processed: 0,
        success: 0,
        failed: 0,
        currentProduct: ''
      });

      let successCount = 0;
      let failedCount = 0;

      for (const product of products as Product[]) {
        setProgress(prev => ({
          ...prev,
          currentProduct: product.nombre
        }));

        try {
          if (!product.imagen_principal) {
            failedCount++;
            setErrors(prev => [...prev, `${product.nombre}: Sin imagen`]);
            continue;
          }

          // Generate embedding using CLIP model
          const embedding = await EmbeddingService.generateImageEmbedding(product.imagen_principal);
          
          // Convert to pgvector format
          const embeddingString = `[${embedding.join(',')}]`;

          // Update product with embedding
          const { error: updateError } = await (supabase as any)
            .from('products')
            .update({ embedding: embeddingString })
            .eq('id', product.id);

          if (updateError) {
            throw updateError;
          }

          successCount++;
        } catch (err) {
          failedCount++;
          const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
          setErrors(prev => [...prev, `${product.nombre}: ${errorMsg}`]);
        }

        setProgress(prev => ({
          ...prev,
          processed: prev.processed + 1,
          success: successCount,
          failed: failedCount
        }));

        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setIsProcessing(false);
      return { 
        success: successCount, 
        failed: failedCount,
        message: `Procesados: ${successCount} exitosos, ${failedCount} fallidos`
      };

    } catch (err) {
      setIsProcessing(false);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setErrors(prev => [...prev, errorMsg]);
      throw err;
    }
  }, []);

  const getEmbeddingStats = useCallback(async () => {
    const { count: total } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('imagen_principal', 'is', null);

    const { count: withEmbedding } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('imagen_principal', 'is', null)
      .not('embedding', 'is', null);

    return {
      total: total || 0,
      withEmbedding: withEmbedding || 0,
      missing: (total || 0) - (withEmbedding || 0)
    };
  }, []);

  return {
    isProcessing,
    progress,
    errors,
    generateEmbeddingsForProducts,
    getEmbeddingStats
  };
};
