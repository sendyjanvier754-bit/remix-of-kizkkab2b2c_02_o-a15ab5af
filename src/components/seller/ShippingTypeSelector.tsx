import React, { useState, useEffect, useMemo } from 'react';
import { useShippingTypes, ShippingType } from '@/hooks/useShippingTypes';
import { useCartShippingCost, CartItem, CartShippingSummary } from '@/hooks/useCartShippingCost';
import { useCartShippingCostView } from '@/hooks/useCartShippingCostView';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, DollarSign, Weight, Loader2, Clock, Plane, Ship } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ShippingTypeSelectorProps {
  /** 
   * Optional: Route ID to filter shipping types
   * If not provided, shows all available shipping tiers
   */
  routeId?: string;
  /** 
   * Cart items for weight calculation (only used when itemIds is not provided)
   * When using DB-saved items, use itemIds instead and this becomes optional
   */
  cartItems?: CartItem[];
  /** 
   * Optional: IDs of cart items saved in DB
   * If provided, uses the orchestrator function (calculate_shipping_cost_for_selected_items)
   * which is more secure and accurate. Otherwise uses the calculation engine directly.
   */
  itemIds?: string[];
  onShippingTypeChange?: (typeId: string | null, summary: CartShippingSummary | null) => void;
  compact?: boolean;
}

export const ShippingTypeSelector: React.FC<ShippingTypeSelectorProps> = ({
  routeId,
  cartItems = [],
  itemIds,
  onShippingTypeChange,
  compact = false,
}) => {
  const { shippingTypes, selectedTypeId, setSelectedTypeId, isLoading: typesLoading } =
    useShippingTypes(routeId);
  
  const selectedType = shippingTypes.find(t => t.id === selectedTypeId);

  // OPCIÓN A: Si tenemos itemIds, usar el orquestador (más seguro, BD hace todo)
  const itemIdsSet = useMemo(() => 
    itemIds ? new Set(itemIds) : undefined, 
    [itemIds]
  );

  // NO necesitamos itemsWithQuantities - el orquestador lee cantidades desde la BD
  const { 
    data: orchestratorData, 
    isLoading: orchestratorLoading 
  } = useCartShippingCostView(
    itemIdsSet,
    undefined, // ✅ No pasar cantidades - el orquestador las lee de la BD
    selectedTypeId
  );

  // OPCIÓN B: Si NO tenemos itemIds, usar el motor directo (para preview)
  const { 
    summary: engineSummary, 
    totalWeight: engineWeight, 
    isLoading: engineLoading 
  } = useCartShippingCost(
    cartItems,
    routeId,
    selectedTypeId,
    selectedType ? {
      tramo_a_eta_min: selectedType.tramo_a_eta_min,
      tramo_a_eta_max: selectedType.tramo_a_eta_max,
      tramo_b_eta_min: selectedType.tramo_b_eta_min,
      tramo_b_eta_max: selectedType.tramo_b_eta_max
    } : null
  );

  // Usar datos del orquestador si están disponibles, sino usar motor directo
  const summary = itemIds && orchestratorData ? {
    weight_rounded_kg: orchestratorData.weight_rounded_kg || 0,
    base_cost: orchestratorData.shipping_cost || 0,  // ✅ Usar shipping_cost (total calculado) en lugar de base_cost
    extra_cost: orchestratorData.extra_cost || 0,
    total_cost_with_type: orchestratorData.shipping_cost || 0,
    shipping_type_name: orchestratorData.shipping_type_name,
    shipping_type_display: orchestratorData.shipping_type_display,
    eta_min: selectedType ? selectedType.tramo_a_eta_min + selectedType.tramo_b_eta_min : undefined,
    eta_max: selectedType ? selectedType.tramo_a_eta_max + selectedType.tramo_b_eta_max : undefined,
  } : engineSummary;

  console.log('📊 ShippingTypeSelector - SUMMARY VALUES:', {
    usando: itemIds && orchestratorData ? 'ORCHESTRATOR' : 'ENGINE',
    orchestratorData: orchestratorData ? {
      shipping_cost: orchestratorData.shipping_cost,  // ✅ Este es el que se usa para base_cost
      base_cost_from_db: orchestratorData.base_cost,  // Solo referencia
      extra_cost: orchestratorData.extra_cost,
      weight_rounded_kg: orchestratorData.weight_rounded_kg,
      total_weight_kg: orchestratorData.total_weight_kg
    } : 'N/A',
    summary: summary ? {
      base_cost: summary.base_cost,  // Ahora muestra shipping_cost del orquestador
      extra_cost: summary.extra_cost,
      total_cost_with_type: summary.total_cost_with_type,
      weight_rounded_kg: summary.weight_rounded_kg
    } : 'N/A'
  });

  const totalWeight = itemIds && orchestratorData ? orchestratorData.total_weight_kg : engineWeight;
  const costLoading = itemIds ? orchestratorLoading : engineLoading;
  const isLoading = typesLoading || costLoading;
  const error = null; // orchestrator doesn't expose error directly

  // Notify parent when shipping type or summary changes
  useEffect(() => {
    console.log('🚢 ShippingTypeSelector - state changed:', {
      selectedTypeId,
      hasSummary: !!summary,
      summaryData: summary,
      orchestratorData,
      engineSummary
    });
    
    if (onShippingTypeChange) {
      onShippingTypeChange(selectedTypeId, summary);
    }
  }, [selectedTypeId, summary, onShippingTypeChange]);

  if (compact) {
    return (
      <div className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de envío</label>
              <Select value={selectedTypeId || ''} onValueChange={setSelectedTypeId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shippingTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        {type.transport_type === 'aereo' ? (
                          <Plane className="h-3 w-3" />
                        ) : (
                          <Ship className="h-3 w-3" />
                        )}
                        <span>{type.display_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({type.tramo_a_eta_min + type.tramo_b_eta_min}-{type.tramo_a_eta_max + type.tramo_b_eta_max} días)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {summary && (
          <div className="text-sm space-y-1 p-2 bg-slate-50 rounded">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entrega:</span>
              <span className="font-medium flex items-center gap-1">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  <>
                    <Clock className="w-3 h-3" />
                    {summary.eta_min}-{summary.eta_max} días
                  </>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso:</span>
              <span className="font-medium">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  `${summary.weight_rounded_kg} kg`
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo de envío:</span>
              <span className="font-medium">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  `$${summary.base_cost.toFixed(2)}`
                )}
              </span>
            </div>
            {summary.extra_cost > 0 && (
              <div className="flex justify-between text-amber-600">
                <span className="text-muted-foreground">Surcharge:</span>
                <span className="font-medium">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    `+$${summary.extra_cost.toFixed(2)}`
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t">
              <span className="font-semibold text-primary">Total:</span>
              <span className="font-bold text-primary">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  `$${summary.total_cost_with_type.toFixed(2)}`
                )}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Opciones de envío
        </CardTitle>
        <CardDescription>Selecciona el tipo de envío para tu pedido</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shipping Type Selector */}
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div>
            <label className="text-sm font-medium">Tipo de envío</label>
            <Select value={selectedTypeId || ''} onValueChange={setSelectedTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tipo de envío" />
              </SelectTrigger>
              <SelectContent>
                {shippingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {type.transport_type === 'aereo' ? (
                          <Plane className="h-4 w-4" />
                        ) : type.transport_type === 'maritimo' ? (
                          <Ship className="h-4 w-4" />
                        ) : (
                          <Truck className="h-4 w-4" />
                        )}
                        <span className="font-medium">{type.display_name}</span>
                        {type.tier_type === 'express' && (
                          <Badge variant="default" className="text-xs">Express</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {type.tramo_a_eta_min + type.tramo_b_eta_min}-{type.tramo_a_eta_max + type.tramo_b_eta_max} días
                        <span className="ml-auto">
                          Tramo A: ${type.tramo_a_cost_per_kg}/kg | Tramo B: ${type.tramo_b_cost_per_lb}/lb
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tiempo de entrega */}
        {summary && summary.eta_min && summary.eta_max && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Tiempo de entrega
            </div>
            <span className="font-semibold">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin inline" />
              ) : (
                `${summary.eta_min}-${summary.eta_max} días`
              )}
            </span>
          </div>
        )}

        {/* Shipping Cost Summary */}
        {summary && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Weight className="h-4 w-4" />
                )}
                Peso total
              </div>
              <span className="font-semibold">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  `${summary.weight_rounded_kg} kg`
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo de envío</span>
              <span className="font-semibold">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  `$${summary.base_cost.toFixed(2)}`
                )}
              </span>
            </div>

            {summary.extra_cost > 0 && (
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-amber-600">Cargo adicional</span>
                <span className="font-semibold text-amber-600">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    `+$${summary.extra_cost.toFixed(2)}`
                  )}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-2 bg-white -mx-4 -mb-4 px-4 py-3 rounded-b">
              <div className="flex items-center gap-2 font-semibold text-lg text-primary">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <DollarSign className="h-5 w-5" />
                )}
                Total de envío
              </div>
              <span className="text-xl font-bold text-primary">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                ) : (
                  `$${summary.total_cost_with_type.toFixed(2)}`
                )}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            <p className="font-medium">Error calculando envío</p>
            <p className="text-xs">{error}</p>
          </div>
        )}

        {!summary && !isLoading && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Selecciona un tipo de envío para ver los costos
          </div>
        )}
      </CardContent>
    </Card>
  );
};
