import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductB2BCard, B2BFilters, ProductVariantInfo, AttributeCombination, ProductVariantEAV, B2BLogisticsInfo } from "@/types/b2b";
import { useB2BMarginRanges, B2BMarginRange } from "./useB2BMarginRanges";

/**
 * Extract unique attribute options from variants' attribute_combination
 * Returns: { color: ['champagne', 'blue'], size: ['110', '120'], age: ['4T', '5T'] }
 */
const extractAttributeOptions = (variants: ProductVariantEAV[]): Record<string, string[]> => {
  const options: Record<string, Set<string>> = {};
  
  variants.forEach(variant => {
    const combo = variant.attribute_combination || {};
    Object.entries(combo).forEach(([key, value]) => {
      if (value) {
        if (!options[key]) {
          options[key] = new Set();
        }
        options[key].add(value);
      }
    });
  });
  
  // Convert Sets to sorted arrays
  const result: Record<string, string[]> = {};
  Object.entries(options).forEach(([key, valueSet]) => {
    result[key] = Array.from(valueSet).sort((a, b) => {
      // Sort numerically if possible
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  });
  
  return result;
};

/**
 * Get display name for attribute type
 */
const getAttributeDisplayName = (type: string): string => {
  const names: Record<string, string> = {
    color: 'Color',
    size: 'Talla',
    age: 'Edad',
    material: 'Material',
    style: 'Estilo',
  };
  return names[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
};

/**
 * Find applicable margin range for a cost
 */
const findMarginForCost = (baseCost: number, ranges: B2BMarginRange[]): { percent: number; range: B2BMarginRange | null } => {
  if (!ranges || ranges.length === 0) return { percent: 30, range: null };
  
  const range = ranges.find(r => {
    const minOk = baseCost >= r.min_cost;
    const maxOk = r.max_cost === null || baseCost < r.max_cost;
    return minOk && maxOk && r.is_active;
  });
  
  return { percent: range?.margin_percent ?? 30, range: range || null };
};

export const useProductsB2B = (filters: B2BFilters, page = 0, limit = 24, destinationCountryCode?: string) => {
  const { useActiveMarginRanges } = useB2BMarginRanges();
  const { data: marginRanges = [] } = useActiveMarginRanges();

  return useQuery({
    queryKey: ["products-b2b-eav", filters, page, limit, marginRanges.length],
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnMount: true, // Always refetch when component mounts
    queryFn: async () => {
      // Use v_productos_con_precio_b2b vista with calculated prices
      // Note: Vista doesn't have is_parent field - filter removed
      let query = supabase
        .from("v_productos_con_precio_b2b")
        .select("*", { count: "exact" })
        .eq("is_active", true);

      // Filter by category
      if (filters.category) {
        query = query.eq("categoria_id", filters.category);
      }

      // Filter by search query
      if (filters.searchQuery) {
        query = query.or(`nombre.ilike.%${filters.searchQuery}%,sku_interno.ilike.%${filters.searchQuery}%`);
      }

      // Apply sorting
      switch (filters.sortBy) {
        case "price_asc":
          query = query.order("precio_b2b", { ascending: true }); // ← Ordenar por precio de vista
          break;
        case "price_desc":
          query = query.order("precio_b2b", { ascending: false }); // ← Ordenar por precio de vista
          break;
        case "moq_asc":
          query = query.order("moq", { ascending: true });
          break;
        case "moq_desc":
          query = query.order("moq", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      const { data: parentProducts, error } = await query;

      if (error) {
        console.error("Error fetching B2B products:", error);
        throw new Error(error.message);
      }

      if (!parentProducts || parentProducts.length === 0) {
        return { products: [], total: 0 };
      }

      // Fetch all variants for parent products with attribute_combination
      const productIds = parentProducts.map(p => p.id);
      
      // Parallel fetch: variants WITH B2B prices, B2C market prices, routes, category rates, destinations
      const [variantsResult, marketPricesResult, routesResult, categoryRatesResult, destinationsResult] = await Promise.all([
        supabase
          .from("v_variantes_con_precio_b2b")
          .select("id, product_id, sku, name, price, precio_b2b_final, stock, moq, attribute_combination, is_active, images")
          .in("product_id", productIds)
          .eq("is_active", true),
        supabase
          .from("b2c_max_prices" as any)
          .select("source_product_id, max_b2c_price, num_sellers, min_b2c_price")
          .in("source_product_id", productIds),
        supabase
          .from("shipping_routes")
          .select(`*, destination_country:destination_countries(*), transit_hub:transit_hubs(*)`)
          .eq("is_active", true),
        supabase
          .from("category_shipping_rates")
          .select("*")
          .eq("is_active", true),
        supabase
          .from("destination_countries")
          .select("*")
          .eq("is_active", true)
      ]);

      if (variantsResult.error) {
        console.error("Error fetching variants:", variantsResult.error);
      }

      // Determine destination (default to Haiti if not specified)
      const destCode = destinationCountryCode || 'HT';
      const destination = (destinationsResult.data || []).find(d => d.code === destCode) || destinationsResult.data?.[0];

      // Find route for destination (used for display info only)
      const route = (routesResult.data || []).find(r => 
        r.destination_country?.code?.toUpperCase() === destCode.toUpperCase()
      );

      // Apply pagination early so we can fetch view data for only this page
      const paginatedProducts = parentProducts.slice(page * limit, (page + 1) * limit);
      const paginatedIds = paginatedProducts.map(p => p.id);

      // Fetch shipping costs from v_business_panel_data — same function as Mi Catálogo
      // Requires auth.uid() to resolve user's market country → returns NULL if not configured
      const { data: bpViewData } = await supabase
        .from('v_business_panel_data')
        .select('product_id, shipping_cost_per_unit, weight_kg')
        .in('product_id', paginatedIds)
        .is('variant_id', null);

      const bpMap = new Map<string, { shipping_cost_per_unit: number | null; weight_kg: number }>(
        (bpViewData || []).map(r => [r.product_id as string, r as { shipping_cost_per_unit: number | null; weight_kg: number }])
      );

      // Get category fees
      const getCategoryFees = (categoryId: string | null, baseCost: number): number => {
        if (!categoryId) return 0;
        const rate = (categoryRatesResult.data || []).find(r => r.category_id === categoryId);
        if (!rate) return 0;
        return Math.round(((rate.fixed_fee || 0) + (baseCost * (rate.percentage_fee || 0) / 100)) * 100) / 100;
      };

      // Create B2C market price lookup map
      const marketPriceMap = new Map<string, { max_b2c_price: number; num_sellers: number; min_b2c_price: number }>();
      (marketPricesResult.data || []).forEach(mp => {
        if (mp.source_product_id) {
          marketPriceMap.set(mp.source_product_id, {
            max_b2c_price: mp.max_b2c_price,
            num_sellers: mp.num_sellers,
            min_b2c_price: mp.min_b2c_price
          });
        }
      });

      // Group variants by product_id
      const variantsByProduct = new Map<string, ProductVariantEAV[]>();
      (variantsResult.data || []).forEach(v => {
        if (!variantsByProduct.has(v.product_id)) {
          variantsByProduct.set(v.product_id, []);
        }
        variantsByProduct.get(v.product_id)!.push({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: v.price || 0,
          precio_b2b_final: v.precio_b2b_final, // ✅ B2B price from vista
          stock: v.stock || 0,
          moq: v.moq || 1,
          attribute_combination: (v.attribute_combination as AttributeCombination) || {},
          product_id: v.product_id,
          is_active: v.is_active,
        });
      });

      // Apply pagination
      // (paginatedProducts already computed above before view fetch)

      // DEBUG: Log variant data
      console.log('🔍 DEBUG - Variants data:', {
        totalParentProducts: parentProducts.length,
        paginatedCount: paginatedProducts.length,
        variantsMapSize: variantsByProduct.size,
        sampleProduct: paginatedProducts[0] ? {
          id: paginatedProducts[0].id,
          sku: paginatedProducts[0].sku_interno,
          nombre: paginatedProducts[0].nombre,
          stock_fisico: paginatedProducts[0].stock_fisico,
          variantsForThis: variantsByProduct.get(paginatedProducts[0].id)?.length || 0,
          variantsSample: variantsByProduct.get(paginatedProducts[0].id)?.slice(0, 2).map(v => ({
            id: v.id,
            name: v.name,
            stock: v.stock,
            precio_b2b_final: v.precio_b2b_final
          }))
        } : null
      });

      // Map to B2B card format with EAV data, market reference AND price engine
      const products: ProductB2BCard[] = paginatedProducts.map((p, index) => {
        const variants = variantsByProduct.get(p.id) || [];
        
        // Extract attribute options from variants
        const attributeOptions = extractAttributeOptions(variants);
        const attributeTypes = Object.keys(attributeOptions);
        
        // Calculate aggregates
        const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        const variantPrices = variants.map(v => v.price).filter(price => price > 0);
        const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
        const maxVariantPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : 0;
        
        // Calculate final stock value
        const finalStock = variants.length > 0 ? totalStock : (p.stock_fisico || 0);
        
        // DEBUG: Log stock calculation for first product only
        if (index === 0) {
          console.log('📦 Stock calculation for first product:', {
            sku: p.sku_interno,
            nombre: p.nombre,
            hasVariants: variants.length > 0,
            variantCount: variants.length,
            totalStock,
            stock_fisico_padre: p.stock_fisico,
            finalStock,
            variantStocks: variants.slice(0, 3).map(v => ({ name: v.name, stock: v.stock }))
          });
        }
        
        // DEBUG: Warn only if really no stock
        if (finalStock === 0) {
          console.warn(`⚠️ Producto sin stock: ${p.nombre} (${p.sku_interno})`, {
            totalStock,
            stock_fisico: p.stock_fisico,
            variants: variants.length,
            variantStocks: variants.map(v => ({ id: v.id, name: v.name, stock: v.stock }))
          });
        }
        
        // Use precio_b2b from vista (already includes market margins and fees)
        const factoryCost = p.costo_base_excel || p.precio_mayorista_base || 0; // Base cost from Excel
        const finalB2BPrice = p.precio_b2b || minVariantPrice || 0; // Final calculated price from vista
        const imagen = p.imagen_principal || "/placeholder.svg";
        
        // Logistics cost from v_business_panel_data (uses user's market country → same as Mi Catálogo)
        const bpEntry = bpMap.get(p.id);
        const logisticsCost = bpEntry?.shipping_cost_per_unit ?? 0;
        const estimatedDays = { min: 0, max: 0 }; // Route segment days not available without legacy table
        
        // For breakdown display: extract components from vista fields if available
        // These are for UI display only - actual price comes from vista
        const marginPercent = 30; // Default display value
        const marginValue = Math.round((finalB2BPrice - factoryCost) * 0.3 * 100) / 100;
        const subtotalWithMargin = factoryCost + marginValue;

        // Get category fees - for display
        const categoryFees = getCategoryFees(p.categoria_id, factoryCost);
        
        // Convert to ProductVariantInfo format
        const variantInfos: ProductVariantInfo[] = variants.map(v => ({
          id: v.id,
          sku: v.sku,
          label: v.name,
          precio: v.price,
          precio_b2b_final: v.precio_b2b_final, // ✅ Precio B2B calculado desde vista
          stock: v.stock,
          option_type: Object.keys(v.attribute_combination)[0] || 'variant',
          parent_product_id: v.product_id,
          attribute_combination: v.attribute_combination,
        }));
        
        // DEBUG: Log variant prices for first product
        if (index === 0 && variantInfos.length > 0) {
          console.log('💰 Variant prices for first product:', {
            sku: p.sku_interno,
            sampleVariants: variantInfos.slice(0, 3).map(v => ({
              label: v.label,
              precio_old: v.precio,
              precio_b2b_final: v.precio_b2b_final,
              stock: v.stock
            }))
          });
        }

        // Get B2C market reference for PVP
        const marketData = marketPriceMap.get(p.id);
        const isMarketSynced = !!marketData?.max_b2c_price;
        
        // Calculate PVP: Priority = Market > Admin > Calculated (4x multiplier from category or default)
        // Use precio_b2b as base (already includes margins and fees)
        const defaultMultiplier = 4.0; // Default if no category multiplier set
        const pvpReference = marketData?.max_b2c_price || p.precio_sugerido_venta || Math.round(finalB2BPrice * defaultMultiplier * 100) / 100;
        const pvpSource = marketData?.max_b2c_price ? 'market' : (p.precio_sugerido_venta ? 'admin' : 'calculated');
        
        // Calculate profit metrics (based on final B2B price)
        const profitAmount = Math.round((pvpReference - finalB2BPrice) * 100) / 100;
        const roiPercent = finalB2BPrice > 0 ? Math.round((profitAmount / finalB2BPrice) * 100 * 10) / 10 : 0;

        // Build logistics info object
        const logistics: B2BLogisticsInfo | null = route ? {
          routeId: route.id,
          routeName: route.is_direct 
            ? `China → ${route.destination_country?.name || 'Destino'}`
            : `China → ${route.transit_hub?.name || 'Hub'} → ${route.destination_country?.name || 'Destino'}`,
          logisticsCost,
          estimatedDays,
          originCountry: 'China',
          destinationCountry: route.destination_country?.name || destination?.name || 'Destino',
        } : null;

        return {
          id: p.id,
          sku: p.sku_interno,
          nombre: p.nombre,
          
          // B2B Price Engine fields
          factory_cost: factoryCost,
          margin_percent: marginPercent,
          margin_value: marginValue,
          subtotal_with_margin: subtotalWithMargin,
          
          // Final B2B price (includes margin + logistics + fees)
          precio_b2b: finalB2BPrice,
          precio_b2b_max: maxVariantPrice > minVariantPrice ? Math.round((maxVariantPrice * (1 + marginPercent/100) + logisticsCost + categoryFees) * 100) / 100 : undefined,
          
          precio_sugerido: pvpReference,
          moq: p.moq || 1,
          // ✅ CORRECTO: Usar totalStock de variantes, fallback a stock_fisico de producto padre
          stock_fisico: finalStock,
          imagen_principal: imagen,
          categoria_id: p.categoria_id || "",
          rating: p.rating,
          variant_count: variants.length,
          variant_ids: variants.map(v => v.id),
          variants: variantInfos,
          source_product_id: p.id,
          
          // EAV-specific fields
          variant_type: attributeTypes[0] || 'unknown',
          variant_types: attributeTypes,
          has_grouped_variants: variants.length > 1,
          
          // Market reference fields
          pvp_reference: pvpReference,
          pvp_source: pvpSource as 'market' | 'admin' | 'calculated',
          is_market_synced: isMarketSynced,
          num_b2c_sellers: marketData?.num_sellers || 0,
          profit_amount: profitAmount,
          roi_percent: roiPercent,
          
          // Logistics fields
          logistics,
          logistics_cost: logisticsCost,
          category_fees: categoryFees,
          estimated_delivery_days: estimatedDays,
          weight_kg: bpEntry?.weight_kg ?? p.weight_kg ?? 0,
          
          // Store raw attribute options for the selector to use
          variants_by_type: Object.fromEntries(
            attributeTypes.map(type => [
              type,
              attributeOptions[type].map((value, idx) => ({
                productId: `${p.id}-${type}-${value}`,
                label: value,
                code: value.toLowerCase().replace(/\s+/g, '-'),
                image: imagen,
                price: minVariantPrice,
                stock: variants.filter(v => v.attribute_combination[type] === value)
                  .reduce((sum, v) => sum + v.stock, 0),
                type,
              }))
            ])
          ),
        };
      });

      return { products, total: parentProducts.length };
    },
  });
};

export const useFeaturedProductsB2B = (limit = 6) => {
  return useQuery({
    queryKey: ["products-b2b-featured-eav", limit],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      // Query only parent products from B2B pricing view
      const { data: parentProducts, error } = await supabase
        .from("v_productos_con_precio_b2b")
        .select("*")
        .eq("is_active", true)
        .eq("is_parent", true)
        .order("created_at", { ascending: false })
        .limit(limit * 2); // Get more to filter

      if (error) throw new Error(error.message);
      if (!parentProducts || parentProducts.length === 0) return [];

      // Fetch variants from B2B pricing view
      const productIds = parentProducts.map(p => p.id);
      const { data: variantsData } = await supabase
        .from("v_variantes_con_precio_b2b")
        .select("id, product_id, sku, name, option_type, option_value, price, precio_b2b_final, stock, moq, attribute_combination, is_active")
        .in("product_id", productIds)
        .eq("is_active", true);

      // Group variants
      const variantsByProduct = new Map<string, ProductVariantEAV[]>();
      (variantsData || []).forEach(v => {
        if (!variantsByProduct.has(v.product_id)) {
          variantsByProduct.set(v.product_id, []);
        }
        variantsByProduct.get(v.product_id)!.push({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: v.precio_b2b_final || v.price || 0, // ✅ Use precio_b2b_final from vista
          stock: v.stock || 0,
          moq: v.moq || 1,
          attribute_combination: (v.attribute_combination as AttributeCombination) || {},
          product_id: v.product_id,
          is_active: v.is_active,
        });
      });

      // Map to ProductB2BCard
      const products: ProductB2BCard[] = parentProducts.slice(0, limit).map((p) => {
        const variants = variantsByProduct.get(p.id) || [];
        const attributeOptions = extractAttributeOptions(variants);
        const attributeTypes = Object.keys(attributeOptions);
        
        const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
        const prices = variants.map(v => v.price).filter(price => price > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : p.precio_b2b || 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : minPrice;
        
        // Use precio_b2b from vista (already calculated with all margins)
        const precioMayorista = minPrice || p.precio_b2b || 0;
        const precioSugerido = p.precio_sugerido_venta || Math.round(precioMayorista * 2.5 * 100) / 100; // ✅ 2.5x for 150% margin
        const imagen = p.imagen_principal || "/placeholder.svg";

        const variantInfos: ProductVariantInfo[] = variants.map(v => ({
          id: v.id,
          sku: v.sku,
          label: v.name,
          precio: v.price,
          stock: v.stock,
          option_type: Object.keys(v.attribute_combination)[0] || 'variant',
          parent_product_id: v.product_id,
          attribute_combination: v.attribute_combination,
        }));

        return {
          id: p.id,
          sku: p.sku_interno,
          nombre: p.nombre,
          precio_b2b: precioMayorista,
          precio_b2b_max: maxPrice !== minPrice ? maxPrice : undefined,
          precio_sugerido: precioSugerido,
          moq: p.moq || 1,
          stock_fisico: totalStock > 0 ? totalStock : p.stock_fisico || 0,
          imagen_principal: imagen,
          categoria_id: p.categoria_id || "",
          rating: p.rating,
          variant_count: variants.length,
          variant_ids: variants.map(v => v.id),
          variants: variantInfos,
          source_product_id: p.id,
          variant_type: attributeTypes[0] || 'unknown',
          variant_types: attributeTypes,
          has_grouped_variants: variants.length > 1,
          weight_kg: p.weight_kg || 0,
          variants_by_type: Object.fromEntries(
            attributeTypes.map(type => [
              type,
              attributeOptions[type].map((value) => ({
                productId: `${p.id}-${type}-${value}`,
                label: value,
                code: value.toLowerCase().replace(/\s+/g, '-'),
                image: imagen,
                price: minPrice,
                stock: variants.filter(v => v.attribute_combination[type] === value)
                  .reduce((sum, v) => sum + v.stock, 0),
                type,
              }))
            ])
          ),
        };
      });

      return products;
    },
  });
};
