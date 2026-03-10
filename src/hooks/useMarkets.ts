import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

// ============ INTERFACES ============

// A single country entry inside a market (from market_destination_countries)
export interface MarketCountry {
  id: string;
  name: string;
  code: string;
  is_primary: boolean;
  route_id?: string | null; // assigned route for this country within the market
}

export interface Market {
  id: string;
  name: string;
  code: string;
  description: string | null;
  destination_country_id: string | null; // primary country (backward compat)
  shipping_route_id: string | null;
  currency: string;
  is_active: boolean;
  timezone: string | null;
  sort_order: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface MarketDashboard extends Market {
  destination_country_name: string | null;
  destination_country_code: string | null;
  route_id: string | null;
  transit_hub_name: string | null;
  transit_hub_code: string | null;
  product_count: number;
  payment_method_count: number;
  seller_count: number;
  // Multi-country support (TICKET #10 v2)
  countries: MarketCountry[];   // all countries assigned to this market
  country_count: number;        // number of active countries
  tier_count: number;           // active tiers across all market countries
  route_count: number;          // active routes across all market countries
  route_names: { id: string; name: string | null; is_direct: boolean; transit_hub_name: string | null }[] | null;
  is_ready: boolean;            // true when ≥1 country has route + tier configured
}

export interface MarketPaymentMethod {
  id: string;
  market_id: string;
  name: string;
  method_type: string;
  currency: string;
  account_number: string | null;
  account_holder: string | null;
  bank_name: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ProductMarket {
  id: string;
  product_id: string;
  market_id: string;
  price_override: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CategoryMarket {
  id: string;
  category_id: string;
  market_id: string;
  is_active: boolean;
  created_at: string;
}

export interface SellerMarket {
  id: string;
  seller_id: string;
  market_id: string;
  is_primary: boolean;
  created_at: string;
}

// ============ MARKETS HOOK ============

export const useMarkets = () => {
  const queryClient = useQueryClient();

  // Fetch all markets (dashboard view)
  const { data: markets, isLoading, error } = useQuery({
    queryKey: ['markets-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets_dashboard')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as unknown as MarketDashboard[];
    },
  });

  // Fetch active markets only (for selectors)
  const { data: activeMarkets } = useQuery({
    queryKey: ['markets-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as Market[];
    },
  });

  // Ready markets: active + properly configured (country + route + at least 1 tier)
  // These are the only ones shown to sellers
  const readyMarkets = (markets ?? []).filter(
    (m): m is MarketDashboard => m.is_active && m.is_ready === true
  );

  // Helper: get all countries for a specific market
  const getMarketCountries = (marketId: string): MarketCountry[] => {
    const market = (markets ?? []).find(m => m.id === marketId) as MarketDashboard | undefined;
    return market?.countries ?? [];
  };

  // Create market
  const createMarket = useMutation({
    mutationFn: async (market: Omit<Market, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('markets')
        .insert(market)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['markets-active'] });
      toast.success('Mercado creado exitosamente');
    },
    onError: (error: Error) => {
      toast.error('Error al crear mercado: ' + error.message);
    },
  });

  // Update market
  const updateMarket = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Market> & { id: string }) => {
      const { data, error } = await supabase
        .from('markets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['markets-active'] });
      toast.success('Mercado actualizado');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar mercado: ' + error.message);
    },
  });

  // Delete market
  const deleteMarket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('markets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['markets-active'] });
      toast.success('Mercado eliminado');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar mercado: ' + error.message);
    },
  });

  // Toggle market active status
  const toggleMarketActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('markets')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['markets-active'] });
    },
  });

  return {
    markets,
    activeMarkets,
    readyMarkets,
    getMarketCountries,
    isLoading,
    error,
    createMarket,
    updateMarket,
    deleteMarket,
    toggleMarketActive,
  };
};

// ============ MARKET PAYMENT METHODS HOOK ============

export const useMarketPaymentMethods = (marketId?: string) => {
  const queryClient = useQueryClient();

  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['market-payment-methods', marketId],
    queryFn: async () => {
      let query = supabase
        .from('market_payment_methods')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (marketId) {
        query = query.eq('market_id', marketId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MarketPaymentMethod[];
    },
    enabled: !!marketId || marketId === undefined,
  });

  const createPaymentMethod = useMutation({
    mutationFn: async (method: Omit<MarketPaymentMethod, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('market_payment_methods')
        .insert(method)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      toast.success('Método de pago agregado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const updatePaymentMethod = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketPaymentMethod> & { id: string }) => {
      const { data, error } = await supabase
        .from('market_payment_methods')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      toast.success('Método de pago actualizado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const deletePaymentMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('market_payment_methods')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      toast.success('Método de pago eliminado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  return {
    paymentMethods,
    isLoading,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
  };
};

// ============ PRODUCT MARKETS HOOK ============

export const useProductMarkets = (productId?: string) => {
  const queryClient = useQueryClient();

  const { data: productMarkets, isLoading } = useQuery({
    queryKey: ['product-markets', productId],
    queryFn: async () => {
      let query = supabase
        .from('product_markets')
        .select(`
          *,
          markets:market_id (
            id,
            name,
            code,
            is_active
          )
        `);
      
      if (productId) {
        query = query.eq('product_id', productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const assignProductToMarkets = useMutation({
    mutationFn: async ({ productId, marketIds }: { productId: string; marketIds: string[] }) => {
      // First delete existing assignments
      const { error: deleteError } = await supabase
        .from('product_markets')
        .delete()
        .eq('product_id', productId);
      
      if (deleteError) throw deleteError;

      // Then insert new assignments
      if (marketIds.length > 0) {
        const inserts = marketIds.map(marketId => ({
          product_id: productId,
          market_id: marketId,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from('product_markets')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-markets'] });
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      toast.success('Mercados asignados al producto');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const bulkAssignProductsToMarkets = useMutation({
    mutationFn: async ({ productIds, marketIds }: { productIds: string[]; marketIds: string[] }) => {
      const inserts: { product_id: string; market_id: string; is_active: boolean }[] = [];
      
      for (const productId of productIds) {
        for (const marketId of marketIds) {
          inserts.push({
            product_id: productId,
            market_id: marketId,
            is_active: true,
          });
        }
      }

      // Upsert to avoid duplicates
      const { error } = await supabase
        .from('product_markets')
        .upsert(inserts, { onConflict: 'product_id,market_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-markets'] });
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      toast.success('Productos asignados a mercados');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  return {
    productMarkets,
    isLoading,
    assignProductToMarkets,
    bulkAssignProductsToMarkets,
  };
};

// ============ CATEGORY MARKETS HOOK ============

export const useCategoryMarkets = (categoryId?: string) => {
  const queryClient = useQueryClient();

  const { data: categoryMarkets, isLoading } = useQuery({
    queryKey: ['category-markets', categoryId],
    queryFn: async () => {
      let query = supabase
        .from('category_markets')
        .select(`
          *,
          markets:market_id (
            id,
            name,
            code,
            is_active
          )
        `);
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });

  const assignCategoryToMarkets = useMutation({
    mutationFn: async ({ categoryId, marketIds }: { categoryId: string; marketIds: string[] }) => {
      // First delete existing assignments
      const { error: deleteError } = await supabase
        .from('category_markets')
        .delete()
        .eq('category_id', categoryId);
      
      if (deleteError) throw deleteError;

      // Then insert new assignments
      if (marketIds.length > 0) {
        const inserts = marketIds.map(marketId => ({
          category_id: categoryId,
          market_id: marketId,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from('category_markets')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-markets'] });
      queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
      toast.success('Mercados asignados a la categoría');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  return {
    categoryMarkets,
    isLoading,
    assignCategoryToMarkets,
  };
};

// ============ VALIDATION HELPERS ============

export const useMarketValidation = () => {
  // Check if a destination country has valid routes
  const checkDestinationRoutes = async (destinationCountryId: string) => {
    const { data, error } = await supabase
      .from('shipping_routes')
      .select('id, is_active')
      .eq('destination_country_id', destinationCountryId)
      .eq('is_active', true);
    
    if (error) throw error;
    return data || [];
  };

  // Check if markets have payment methods
  const checkMarketPaymentMethods = async (marketId: string) => {
    const { data, error } = await supabase
      .from('market_payment_methods')
      .select('id')
      .eq('market_id', marketId)
      .eq('is_active', true);
    
    if (error) throw error;
    return data || [];
  };

  // Get destinations without markets
  const getDestinationsWithoutMarkets = async () => {
    const { data: countries, error: countriesError } = await supabase
      .from('destination_countries')
      .select('id, name, code')
      .eq('is_active', true);
    
    if (countriesError) throw countriesError;

    const { data: markets, error: marketsError } = await supabase
      .from('market_destination_countries')
      .select('destination_country_id')
      .eq('is_active', true);
    
    if (marketsError) throw marketsError;

    const marketCountryIds = new Set(markets?.map((m: any) => m.destination_country_id) || []);
    return countries?.filter(c => !marketCountryIds.has(c.id)) || [];
  };

  // Get markets without payment methods
  const getMarketsWithoutPayments = async () => {
    const { data, error } = await supabase
      .from('markets_dashboard')
      .select('*')
      .eq('is_active', true)
      .eq('payment_method_count', 0);
    
    if (error) throw error;
    return data as unknown as MarketDashboard[];
  };

  return {
    checkDestinationRoutes,
    checkMarketPaymentMethods,
    getDestinationsWithoutMarkets,
    getMarketsWithoutPayments,
  };
};
