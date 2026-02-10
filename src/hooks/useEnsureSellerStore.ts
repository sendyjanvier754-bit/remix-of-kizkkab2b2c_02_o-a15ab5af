import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useNavigate } from 'react-router-dom';

interface StoreStatus {
  hasStore: boolean;
  isConfigured: boolean;
  isActive: boolean;
  storeId?: string;
}

/**
 * Hook para validar estado de la tienda del seller
 * - Si NO tiene tienda: Crea placeholder vacío (debería tenerlo al asignar rol)
 * - Si tiene tienda pero INCOMPLETA: Redirige a SellerOnboardingPage
 * - Si está COMPLETADA y ACTIVA: Permite acceso normal
 */
export const useEnsureSellerStore = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [storeStatus, setStoreStatus] = useState<StoreStatus>({
    hasStore: false,
    isConfigured: false,
    isActive: false,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [shouldRedirectToOnboarding, setShouldRedirectToOnboarding] = useState(false);

  useEffect(() => {
    const validateStoreStatus = async () => {
      // Only run for sellers
      if (role !== 'seller' || !user?.id) {
        return;
      }

      setIsValidating(true);

      try {
        // 1. Check if seller has a store
        const { data: store, error: fetchError } = await supabase
          .from('stores')
          .select('id, name, is_active')
          .eq('owner_user_id', user.id)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching store:', fetchError);
          setIsValidating(false);
          return;
        }

        // If NO store exists, create empty placeholder (fallback)
        if (!store) {
          console.warn(`⚠️ No store found for seller ${user.id}, creating placeholder...`);
          
          // Generate slug: KZ + 6 random numbers + year (no hyphen)
          const generateStoreSlug = () => {
            const randomNumbers = Math.floor(Math.random() * 900000) + 100000; // 100000-999999
            const currentYear = new Date().getFullYear();
            return `KZ${randomNumbers}${currentYear}`;
          };
          
          const { data: newStore, error: createError } = await supabase
            .from('stores')
            .insert({
              owner_user_id: user.id,
              slug: generateStoreSlug(),
              is_active: false,
              is_accepting_orders: true,
              show_stock: true,
              country: 'Haiti',
              // Leaving name, description, logo as NULL
              // Seller MUST configure via SellerOnboardingPage
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating store placeholder:', createError);
            setIsValidating(false);
            return;
          }

          if (newStore) {
            console.log(`✅ Created empty store placeholder ${newStore.id} for seller ${user.id}`);
            setStoreStatus({
              hasStore: true,
              isConfigured: false,
              isActive: false,
              storeId: newStore.id,
            });
            setShouldRedirectToOnboarding(true);
            setIsValidating(false);
            return;
          }
        }

        // Store exists - check if it's configured
        const isConfigured = store.name !== null && store.name !== '';
        const isActive = store.is_active === true;

        setStoreStatus({
          hasStore: true,
          isConfigured,
          isActive,
          storeId: store.id,
        });

        // If store exists but NOT configured, need to redirect to onboarding
        if (!isConfigured) {
          console.log(`⚠️ Store ${store.id} is incomplete, redirecting to onboarding...`);
          setShouldRedirectToOnboarding(true);
        }

      } catch (err) {
        console.error('Unexpected error in validateStoreStatus:', err);
      } finally {
        setIsValidating(false);
      }
    };

    // Small delay to avoid race conditions
    const timer = setTimeout(validateStoreStatus, 100);
    return () => clearTimeout(timer);
  }, [user?.id, role]);

  // Auto-redirect to onboarding if store is incomplete
  useEffect(() => {
    if (shouldRedirectToOnboarding && !isValidating) {
      // Don't redirect if already on onboarding page
      if (!window.location.pathname.includes('/seller/onboarding')) {
        console.log('🔄 Redirecting to SellerOnboardingPage...');
        navigate('/seller/onboarding', { replace: true });
      }
    }
  }, [shouldRedirectToOnboarding, isValidating, navigate]);

  return {
    storeStatus,
    isValidating,
    shouldRedirectToOnboarding,
  };
};
