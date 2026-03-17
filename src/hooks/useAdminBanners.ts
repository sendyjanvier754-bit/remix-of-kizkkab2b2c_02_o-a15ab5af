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
  device_target: 'all' | 'desktop' | 'mobile';
  mobile_position_x: number;
  mobile_position_y: number;
  mobile_scale: number;
  desktop_position_x: number;
  desktop_position_y: number;
  desktop_scale: number;
  is_active: boolean;
  sort_order: number;
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
      const { data, error } = await supabase
        .from('admin_banners')
        .insert(banner)
        .select()
        .single();

      if (error) throw error;

      setBanners(prev => [...prev, data]);
      toast({ title: 'Banner creado', description: 'El banner ha sido creado correctamente' });
      return data;
    } catch (error) {
      console.error('Error creating banner:', error);
      toast({ title: 'Error', description: 'No se pudo crear el banner', variant: 'destructive' });
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
