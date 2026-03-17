import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminBanner {
  id: string;
  title: string;
  image_url: string;
  desktop_image_url: string | null;
  link_url: string | null;
  target_audience: string;
  device_target: string;
  is_active: boolean | null;
  sort_order: number | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdminBanners(targetAudience?: string) {
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBanners = async () => {
    try {
      let query = supabase
        .from('admin_banners')
        .select('*')
        .order('sort_order', { ascending: true });

      if (targetAudience) {
        query = query.or(`target_audience.eq.${targetAudience},target_audience.eq.all`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, [targetAudience]);

  const createBanner = async (banner: Omit<AdminBanner, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const runInsert = async (payload: Record<string, unknown>) => {
        const { data, error } = await supabase
          .from('admin_banners')
          .insert(payload)
          .select()
          .single();
        return { data, error };
      };

      let { data, error } = await runInsert(banner as unknown as Record<string, unknown>);

      if (error) {
        const msg = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
        const looksLikeSchemaCacheIssue = error.code === 'PGRST204'
          || msg.includes('schema cache')
          || msg.includes('could not find the')
          || msg.includes('column');

        if (looksLikeSchemaCacheIssue) {
          const fallbackPayload = {
            title: banner.title,
            image_url: banner.image_url,
            link_url: banner.link_url,
            target_audience: banner.target_audience,
            is_active: banner.is_active,
            sort_order: banner.sort_order,
            starts_at: banner.starts_at,
            ends_at: banner.ends_at,
          };

          const retry = await runInsert(fallbackPayload);
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) throw error;

      setBanners(prev => [...prev, data]);
      toast({ title: 'Banner creado', description: 'El banner ha sido creado correctamente' });
      return data;
    } catch (error) {
      const err = error as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      console.error('Error creating banner:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });

      const detailParts = [err?.message, err?.details, err?.hint].filter(Boolean);
      toast({
        title: 'Error',
        description: detailParts.length > 0
          ? detailParts.join(' · ')
          : 'No se pudo crear el banner',
        variant: 'destructive'
      });
      return null;
    }
  };

  const updateBanner = async (id: string, updates: Partial<AdminBanner>) => {
    try {
      const { data, error } = await supabase
        .from('admin_banners')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setBanners(prev => prev.map(b => b.id === id ? data : b));
      toast({ title: 'Banner actualizado', description: 'Los cambios han sido guardados' });
      return data;
    } catch (error) {
      console.error('Error updating banner:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar el banner', variant: 'destructive' });
      return null;
    }
  };

  const deleteBanner = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBanners(prev => prev.filter(b => b.id !== id));
      toast({ title: 'Banner eliminado', description: 'El banner ha sido eliminado' });
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el banner', variant: 'destructive' });
    }
  };

  const uploadBannerImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banners/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: 'Error', description: 'No se pudo subir la imagen', variant: 'destructive' });
      return null;
    }
  };

  return {
    banners,
    loading,
    createBanner,
    updateBanner,
    deleteBanner,
    uploadBannerImage,
    refetch: fetchBanners,
  };
}
