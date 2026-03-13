import { supabase } from '@/integrations/supabase/client';

/**
 * Resuelve un slug (nuevo o legacy) y retorna el store ID
 * Soporta sistema de alias para backward compatibility
 */
export async function resolveStoreBySlug(slug: string): Promise<string | null> {
  try {
    // Intentar con función SQL que maneja alias
    const { data, error } = await (supabase as any)
      .rpc('resolve_store_by_slug', { p_slug: slug });
    
    if (error) {
      console.error('Error resolving store by slug:', error);
      return null;
    }
    
    return data as unknown as string;
  } catch (err) {
    console.error('Exception resolving store:', err);
    return null;
  }
}

/**
 * Hook mejorado que soporta alias
 * Busca por slug en stores Y en store_slug_aliases
 */
export async function getStoreBySlugOrAlias(slug: string) {
  try {
    // 1. Intentar búsqueda directa por slug principal
    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    
    if (store) return store;
    
    // 2. Si no encuentra, buscar en alias
    const { data: alias } = await (supabase as any)
      .from('store_slug_aliases')
      .select('store_id')
      .eq('slug_alias', slug)
      .maybeSingle();
    
    const aliasData = alias as { store_id: string } | null;
    
    if (aliasData?.store_id) {
      // Obtener la tienda por ID
      const { data: storeFromAlias } = await supabase
        .from('stores')
        .select('*')
        .eq('id', aliasData.store_id)
        .single();
      
      return storeFromAlias;
    }
    
    return null;
  } catch (err) {
    console.error('Error getting store by slug or alias:', err);
    return null;
  }
}
