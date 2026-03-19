import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateUniqueStoreSlug } from '@/utils/storeSlugGenerator';
import { toast } from "sonner";

export interface AccountProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string;
}

export const useAdminAccounts = () => {
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Fetch all user_roles
      const userIds = profiles?.map(p => p.id) ?? [];
      if (userIds.length === 0) return [];

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const roleMap = new Map<string, string>();
      roles?.forEach(r => roleMap.set(r.user_id, r.role));

      return profiles?.map(p => ({
        ...p,
        role: roleMap.get(p.id) || 'user',
      })) as AccountProfile[];
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole, userEmail, userName }: {
      userId: string;
      newRole: string;
      userEmail?: string | null;
      userName?: string | null;
    }) => {
      // 1. Delete existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // 2. Insert new role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole as any });

      if (roleError) throw roleError;

      // 3. If upgrading to seller, create store + seller record
      if (newRole === 'seller') {
        // Check if store exists
        const { data: existingStore } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_user_id', userId)
          .maybeSingle();

        if (existingStore) {
          // Reactivate existing store
          await supabase.from('stores').update({ is_active: true }).eq('id', existingStore.id);
        } else {
          // Wait for trigger to create store
          let storeCreated = false;
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 300));
            const { data: store } = await supabase.from('stores').select('id').eq('owner_user_id', userId).maybeSingle();
            if (store) { storeCreated = true; break; }
          }

          // Fallback: create manually
          if (!storeCreated) {
            const storeName = userName || 'Mi Tienda';
            const slug = await generateUniqueStoreSlug(async (candidate) => {
              const { data } = await supabase.from('stores').select('id').eq('slug', candidate).maybeSingle();
              return data === null;
            });
            if (slug) {
              await supabase.from('stores').insert({
                owner_user_id: userId,
                name: storeName,
                description: `Tienda de ${storeName}`,
                slug,
                is_active: true,
                is_accepting_orders: true,
                show_stock: true,
                country: 'Haiti',
              });
            }
          }
        }

        // Create seller record if not exists
        const { data: existingSeller } = await supabase.from('sellers').select('id').eq('user_id', userId).maybeSingle();
        if (!existingSeller) {
          await supabase.from('sellers').insert({
            user_id: userId,
            email: userEmail || '',
            name: userName || 'Vendedor',
            is_verified: false,
          });
        }

        // Create onboarding progress
        await supabase.from('seller_onboarding_progress').upsert({
          user_id: userId,
          current_step: 'store_info',
          steps_completed: {},
          is_complete: false,
        }, { onConflict: 'user_id' });
      }

      // 4. If downgrading from seller, deactivate store
      if (newRole !== 'seller') {
        const { data: store } = await supabase.from('stores').select('id').eq('owner_user_id', userId).maybeSingle();
        if (store) {
          await supabase.from('stores').update({ is_active: false }).eq('id', store.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success('Rol actualizado correctamente');
    },
    onError: (error) => {
      toast.error('Error al cambiar rol: ' + error.message);
    },
  });

  return { accounts, isLoading, changeRole };
};
