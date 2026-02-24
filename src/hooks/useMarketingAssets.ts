import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketingAssetType = 'pdf_catalog' | 'png_status';

export interface MarketingAsset {
  id: string;
  seller_id: string;
  store_id: string | null;
  type: MarketingAssetType;
  title: string;
  file_url: string | null;
  file_path: string | null;
  product_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SaveMarketingAssetParams {
  sellerId: string;
  storeId: string;
  type: MarketingAssetType;
  title: string;
  htmlContent: string; // contenido HTML del catálogo (para backup/preview)
  pdfBlob?: Blob;      // archivo PDF real (opcional, si no se provee solo guarda HTML)
  productCount: number;
  metadata?: Record<string, unknown>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketingAssets(storeId: string | null) {
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_marketing_assets')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAssets((data as MarketingAsset[]) || []);
    } catch (err) {
      console.error('[useMarketingAssets] fetchAssets error:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // ── Save a new asset ───────────────────────────────────────────────────────

  const saveAsset = async (params: SaveMarketingAssetParams): Promise<MarketingAsset | null> => {
    const { sellerId, storeId: sid, type, title, htmlContent, pdfBlob, productCount, metadata = {} } = params;

    let fileUrl: string | null = null;
    let filePath: string | null = null;

    try {
      const timestamp = Date.now();
      
      // If PDF blob is provided, upload PDF; otherwise upload HTML as before
      if (pdfBlob && type === 'pdf_catalog') {
        // Upload PDF file
        const pdfPath = `${sellerId}/${type}/${timestamp}.pdf`;
        
        const { error: uploadError } = await supabase.storage
          .from('marketing-assets')
          .upload(pdfPath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          console.warn('[useMarketingAssets] PDF upload failed (bucket missing?):', uploadError.message);
        } else {
          filePath = pdfPath;
          fileUrl = supabase.storage
            .from('marketing-assets')
            .getPublicUrl(pdfPath).data.publicUrl;
        }
        
        // Also upload HTML as backup/preview (optional)
        const htmlPath = `${sellerId}/${type}/${timestamp}.html`;
        await supabase.storage
          .from('marketing-assets')
          .upload(htmlPath, new Blob([htmlContent], { type: 'text/html; charset=utf-8' }), {
            contentType: 'text/html; charset=utf-8',
            upsert: false,
          });
      } else {
        // Fallback: Upload HTML only (original behavior)
        const path = `${sellerId}/${type}/${timestamp}.html`;
        const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });

        const { error: uploadError } = await supabase.storage
          .from('marketing-assets')
          .upload(path, blob, {
            contentType: 'text/html; charset=utf-8',
            upsert: false,
          });

        if (uploadError) {
          console.warn('[useMarketingAssets] Storage upload failed (bucket missing?):', uploadError.message);
        } else {
          filePath = path;
          fileUrl = supabase.storage
            .from('marketing-assets')
            .getPublicUrl(path).data.publicUrl;
        }
      }

      // 2. Insert row in seller_marketing_assets
      const { data, error: insertError } = await supabase
        .from('seller_marketing_assets')
        .insert({
          seller_id: sellerId,
          store_id: sid || null,
          type,
          title,
          file_url: fileUrl,
          file_path: filePath,
          product_count: productCount,
          metadata,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newAsset = data as MarketingAsset;
      setAssets(prev => [newAsset, ...prev]);
      return newAsset;
    } catch (err) {
      console.error('[useMarketingAssets] saveAsset error:', err);
      return null;
    }
  };

  // ── Delete an asset ────────────────────────────────────────────────────────

  const deleteAsset = async (asset: MarketingAsset): Promise<void> => {
    try {
      // Remove from storage first (if path exists)
      if (asset.file_path) {
        await supabase.storage
          .from('marketing-assets')
          .remove([asset.file_path]);
      }

      const { error } = await supabase
        .from('seller_marketing_assets')
        .delete()
        .eq('id', asset.id);

      if (error) throw error;
      setAssets(prev => prev.filter(a => a.id !== asset.id));
    } catch (err) {
      console.error('[useMarketingAssets] deleteAsset error:', err);
      throw err;
    }
  };

  return { assets, loading, saveAsset, deleteAsset, refetch: fetchAssets };
}
