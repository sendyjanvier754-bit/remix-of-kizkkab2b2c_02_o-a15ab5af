import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AssetItem {
  id?: string;
  skuInterno: string;
  originalUrl: string;
  rowIndex: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  publicUrl?: string;
  error?: string;
}

export interface AssetProcessingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalAssets: number;
  processedAssets: number;
  failedAssets: number;
}

export interface AssetProcessingState {
  isProcessing: boolean;
  job: AssetProcessingJob | null;
  items: AssetItem[];
  progress: number;
  currentItemIndex: number;
}

// Ensure the caller's JWT is forwarded to the edge function (it requires admin auth)
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Debes iniciar sesión como administrador para procesar imágenes');
  return { Authorization: `Bearer ${token}` };
}

export function useAssetProcessing() {
  const [state, setState] = useState<AssetProcessingState>({
    isProcessing: false,
    job: null,
    items: [],
    progress: 0,
    currentItemIndex: 0
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create a new processing job
  const createJob = useCallback(async (
    items: Array<{ skuInterno: string; originalUrl: string; rowIndex: number }>
  ): Promise<{ jobId: string; items: AssetItem[] }> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));

      const { data, error } = await supabase.functions.invoke('process-product-images', {
        body: { action: 'create_job', items },
        headers: await getAuthHeaders()
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const jobId: string = data.jobId;
      console.log('Job created:', jobId);

      // Fetch the items from database instead of relying on the response
      const { data: createdItems, error: fetchError } = await supabase
        .from('asset_processing_items')
        .select('*')
        .eq('job_id', jobId);

      if (fetchError) {
        console.error('Error fetching items:', fetchError);
        throw fetchError;
      }

      const mappedItems: AssetItem[] = (createdItems || []).map((item: any) => ({
        id: item.id,
        skuInterno: item.sku_interno,
        originalUrl: item.original_url,
        rowIndex: item.row_index,
        status: item.status as 'pending' | 'processing' | 'completed' | 'failed',
        publicUrl: item.public_url || undefined,
        error: item.error_message || undefined,
      }));

      setState(prev => ({
        ...prev,
        job: {
          id: jobId,
          status: 'processing',
          totalAssets: mappedItems.length || items.length,
          processedAssets: 0,
          failedAssets: 0,
        },
        items: mappedItems,
      }));

      return { jobId, items: mappedItems };
    } catch (error) {
      console.error('Error creating job:', error);
      setState(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  }, []);

  // Process a single item
  const processItem = useCallback(async (itemId: string): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
    try {
      console.log(`Starting to process item ${itemId}`);
      
      const { error } = await supabase.functions.invoke('process-product-images', {
        body: { action: 'process_item', itemId },
        headers: await getAuthHeaders()
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }
      
      // Wait a moment for the database to be updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check the item status in the database
      const { data: item, error: fetchError } = await supabase
        .from('asset_processing_items')
        .select('*')
        .eq('id', itemId)
        .single();
      
      if (fetchError) {
        console.error('Error fetching item status:', fetchError);
        return { success: false, error: fetchError.message };
      }
      
      console.log('Item status after processing:', item);
      
      return {
        success: item?.status === 'completed',
        publicUrl: item?.public_url || undefined,
        error: item?.error_message || undefined
      };
    } catch (error) {
      console.error('Error processing item:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }, []);

  // Process all items sequentially with progress updates
  const processAllItems = useCallback(async (
    itemsOverride?: AssetItem[],
    onItemComplete?: (item: AssetItem, index: number) => void
  ): Promise<{ completed: number; failed: number; urlMap: Record<string, string> }> => {
    abortControllerRef.current = new AbortController();

    const urlMap: Record<string, string> = {};
    let completed = 0;
    let failed = 0;

    const currentItems = [...(itemsOverride ?? state.items)];
    const total = currentItems.length;

    // If caller passes an explicit list (e.g. right after createJob), sync it into state first
    if (itemsOverride) {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        progress: 0,
        currentItemIndex: 0,
        items: currentItems,
        job: prev.job ? { ...prev.job, totalAssets: total } : prev.job,
      }));
    }

    console.log('Processing items:', currentItems);

    if (total === 0) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100,
        job: prev.job ? { ...prev.job, status: 'completed', processedAssets: 0, failedAssets: 0 } : null,
      }));
      return { completed: 0, failed: 0, urlMap };
    }

    for (let i = 0; i < total; i++) {
      if (abortControllerRef.current?.signal.aborted) break;

      const item = currentItems[i];
      console.log(`Processing item ${i}:`, item);

      if (!item.id) {
        console.error(`Item ${i} has no ID, skipping. Item:`, item);
        failed++;
        continue;
      }

      // Update current item to processing
      setState(prev => ({
        ...prev,
        currentItemIndex: i,
        progress: Math.round((i / total) * 100),
        items: prev.items.map((it, idx) =>
          idx === i ? { ...it, status: 'processing' as const } : it
        )
      }));

      const result = await processItem(item.id);
      console.log(`Result for item ${i}:`, result);

      if (result.success && result.publicUrl) {
        completed++;
        urlMap[item.skuInterno] = result.publicUrl;
        urlMap[item.originalUrl] = result.publicUrl;

        console.log(`Mapped URLs for item ${i}:`, {
          skuInterno: item.skuInterno,
          originalUrl: item.originalUrl,
          publicUrl: result.publicUrl,
        });

        setState(prev => ({
          ...prev,
          items: prev.items.map((it, idx) =>
            idx === i ? { ...it, status: 'completed' as const, publicUrl: result.publicUrl } : it
          ),
          job: prev.job ? { ...prev.job, processedAssets: completed, failedAssets: failed } : null
        }));
      } else {
        failed++;

        setState(prev => ({
          ...prev,
          items: prev.items.map((it, idx) =>
            idx === i ? { ...it, status: 'failed' as const, error: result.error } : it
          ),
          job: prev.job ? { ...prev.job, processedAssets: completed, failedAssets: failed } : null
        }));
      }

      onItemComplete?.(
        { ...item, status: result.success ? 'completed' : 'failed', publicUrl: result.publicUrl, error: result.error },
        i
      );
    }

    // Final state update
    setState(prev => ({
      ...prev,
      isProcessing: false,
      progress: 100,
      job: prev.job ? {
        ...prev.job,
        status: failed === total ? 'failed' : 'completed',
        processedAssets: completed,
        failedAssets: failed,
      } : null
    }));

    console.log('Processing complete:', { completed, failed });
    return { completed, failed, urlMap };
  }, [state.items, processItem]);

  // Retry a failed item
  const retryItem = useCallback(async (itemId: string) => {
    try {
      // Reset item status
      await supabase.functions.invoke('process-product-images', {
        body: { action: 'retry_item', itemId },
        headers: await getAuthHeaders()
      });
      
      // Update local state
      setState(prev => ({
        ...prev,
        items: prev.items.map(it => 
          it.id === itemId ? { ...it, status: 'pending' as const, error: undefined } : it
        )
      }));
      
      // Process the item
      const result = await processItem(itemId);
      
      setState(prev => ({
        ...prev,
        items: prev.items.map(it => 
          it.id === itemId ? { 
            ...it, 
            status: result.success ? 'completed' as const : 'failed' as const,
            publicUrl: result.publicUrl,
            error: result.error
          } : it
        )
      }));
      
      return result;
    } catch (error) {
      console.error('Error retrying item:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, [processItem]);

  // Abort processing
  const abortProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(prev => ({ ...prev, isProcessing: false }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      isProcessing: false,
      job: null,
      items: [],
      progress: 0,
      currentItemIndex: 0
    });
  }, []);

  // Get job status
  const refreshJobStatus = useCallback(async () => {
    if (!state.job?.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('process-product-images', {
        body: { action: 'get_job_status', jobId: state.job.id },
        headers: await getAuthHeaders()
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setState(prev => ({
        ...prev,
        job: data.job,
        items: data.items?.map((item: any) => ({
          id: item.id,
          skuInterno: item.skuInterno,
          originalUrl: prev.items.find(i => i.id === item.id)?.originalUrl || '',
          rowIndex: prev.items.find(i => i.id === item.id)?.rowIndex || 0,
          status: item.status,
          publicUrl: item.publicUrl,
          error: item.error
        })) || prev.items
      }));
    } catch (error) {
      console.error('Error refreshing job status:', error);
    }
  }, [state.job?.id]);

  return {
    state,
    createJob,
    processAllItems,
    retryItem,
    abortProcessing,
    reset,
    refreshJobStatus,
    // Computed values
    isComplete: state.job?.status === 'completed' || state.job?.status === 'failed',
    hasFailures: state.items.some(i => i.status === 'failed'),
    allCompleted: state.items.length > 0 && state.items.every(i => i.status === 'completed'),
    pendingItems: state.items.filter(i => i.status === 'pending' || i.status === 'failed'),
    completedItems: state.items.filter(i => i.status === 'completed')
  };
}
