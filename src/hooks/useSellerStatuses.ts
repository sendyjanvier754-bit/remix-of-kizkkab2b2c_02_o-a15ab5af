import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SellerStatus {
  id: string;
  store_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
}

export function useSellerStatuses(storeId: string | null) {
  const [statuses, setStatuses] = useState<SellerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStatuses = async () => {
    if (!storeId) {
      setStatuses([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('seller_statuses')
        .select('*')
        .eq('store_id', storeId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, [storeId]);

  const uploadStatus = async (file: File, caption?: string) => {
    if (!storeId) return null;

    try {
      // Upload image
      const fileExt = file.name.split('.').pop();
      const fileName = `statuses/${storeId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Create status record
      const { data, error } = await (supabase as any)
        .from('seller_statuses')
        .insert({
          store_id: storeId,
          seller_id: storeId,
          image_url: publicUrl.publicUrl,
          caption: caption || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      setStatuses(prev => [data, ...prev]);
      toast({
        title: 'Estado publicado',
        description: 'Tu estado estará visible por 24 horas',
      });

      return data;
    } catch (error) {
      console.error('Error uploading status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo publicar el estado',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteStatus = async (statusId: string) => {
    try {
      const { error } = await supabase
        .from('seller_statuses')
        .delete()
        .eq('id', statusId);

      if (error) throw error;

      setStatuses(prev => prev.filter(s => s.id !== statusId));
      toast({
        title: 'Estado eliminado',
        description: 'El estado ha sido eliminado',
      });
    } catch (error) {
      console.error('Error deleting status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el estado',
        variant: 'destructive',
      });
    }
  };

  return {
    statuses,
    loading,
    uploadStatus,
    deleteStatus,
    refetch: fetchStatuses,
  };
}
