import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import { Truck, DollarSign, Loader2, Clock, Plane, Ship, Check, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ShippingTypeSelectorProps {
  /** 
   * Optional: Route ID to filter shipping types to one specific route
   */
  routeId?: string;
  /**
   * Optional: Destination country ID — shows all tiers across all routes to that country
   * Preferred over routeId when a market has multiple routes (maritime + aereo)
   */
  countryId?: string;
  /**
   * Whether to render the internal "Método de Envío" header.
   * Set to false when the parent already has its own title.
   */
  showHeader?: boolean;
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
  /** Fires whenever the raw cart weight is known (even without a tier selected) */
  onTotalWeightChange?: (totalWeightKg: number) => void;
  compact?: boolean;
}

export const ShippingTypeSelector: React.FC<ShippingTypeSelectorProps> = ({
  routeId,
  countryId,
  cartItems = [],
  itemIds,
  onShippingTypeChange,
  onTotalWeightChange,
  compact = false,
  showHeader = true,
}) => {
  const { shippingTypes, selectedTypeId, setSelectedTypeId, isLoading: typesLoading } =
    useShippingTypes(routeId, countryId);
  
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

  // Notify parent of raw cart weight as soon as it's available (independent of tier)
  useEffect(() => {
    if (onTotalWeightChange && totalWeight > 0) {
      onTotalWeightChange(totalWeight);
    }
  }, [totalWeight, onTotalWeightChange]);
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
        ) : !countryId ? (
          <p className="text-xs text-muted-foreground py-1">
            <Link to="/seller/account" className="underline text-primary">
              Configura tu mercado
            </Link>{' '}
            para ver opciones de envío.
          </p>
        ) : shippingTypes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">
            No hay métodos de envío para tu país.
          </p>
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
            <div className="flex justify-between pt-1">
              <span className="font-semibold text-primary">Envío:</span>
              <span className="font-bold text-primary">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  `$${summary.total_cost_with_type.toFixed(2)}`
                )}
              </span>
            </div>
            {summary.extra_cost > 0 && (
              <div className="flex justify-between text-amber-600">
                <span className="text-muted-foreground">Cargo adicional:</span>
                <span className="font-medium">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    `+$${summary.extra_cost.toFixed(2)}`
                  )}
                </span>
              </div>
            )}

          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>
    );
  }

  // Helper: format a date as "5 Mar" in locale-neutral short form
  const formatShortDate = (d: Date) =>
    d.toLocaleDateString('es', { day: 'numeric', month: 'short' });

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-bold text-base">Método de Envío</h3>
        </div>
      )}

      {/* Option cards — one per shipping type */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : !countryId ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            No hay mercado configurado para tu tienda.
          </p>
          <p className="text-xs text-muted-foreground">
            Ve a{' '}
            <Link to="/seller/account" className="underline text-primary hover:text-primary/80">
              Cuenta → Mi Tienda
            </Link>{' '}
            para seleccionar tu mercado de destino y ver las opciones de envío.
          </p>
        </div>
      ) : shippingTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            No hay métodos de envío disponibles para tu país.
          </p>
          <p className="text-xs text-muted-foreground">
            Contacta al administrador para que configure las rutas de envío.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shippingTypes.map((type) => {
            const isSelected = selectedTypeId === type.id;
            const etaMin = (type.tramo_a_eta_min ?? 0) + (type.tramo_b_eta_min ?? 0);
            const etaMax = (type.tramo_a_eta_max ?? 0) + (type.tramo_b_eta_max ?? 0);
            const today = new Date();
            const minDate = new Date(today);
            minDate.setDate(today.getDate() + etaMin);
            const maxDate = new Date(today);
            maxDate.setDate(today.getDate() + etaMax);

            // Show cost only when this type is selected and summary is ready
            const costStr =
              isSelected && summary && !isLoading
                ? `$${summary.total_cost_with_type.toFixed(2)}`
                : null;

            const TransportIcon =
              type.transport_type === 'aereo'
                ? Plane
                : type.transport_type === 'maritimo'
                ? Ship
                : Truck;

            return (
              <div
                key={type.id}
                onClick={() => setSelectedTypeId(type.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer select-none transition-all ${
                  isSelected
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400 bg-white'
                }`}
              >
                {/* Row 1: name + price (left) | radio circle (right) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <TransportIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                    <span className="font-bold text-sm leading-tight">
                      {type.display_name}
                      {costStr ? (
                        <span className="text-primary">: {costStr}</span>
                      ) : null}
                    </span>
                    {type.tier_type === 'express' && (
                      <Badge variant="default" className="text-xs py-0 px-1.5 flex-shrink-0">
                        Express
                      </Badge>
                    )}
                  </div>

                  {/* Radio indicator */}
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-gray-900 border-gray-900'
                        : 'border-gray-400 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                </div>

                {/* Row 2: delivery date range */}
                <p className="text-sm text-gray-600 mt-1.5 flex items-center gap-1">
                  <span>
                    Entrega: {formatShortDate(minDate)} – {formatShortDate(maxDate)}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span>{etaMin}–{etaMax} días hábiles</span>
                  <ChevronRight className="h-3 w-3 text-gray-400 ml-auto flex-shrink-0" />
                </p>


              </div>
            );
          })}
        </div>
      )}

      {/* Cost summary bar */}
      {summary && !isLoading && (
        <div className="flex items-center justify-end text-sm pt-2 border-t border-gray-100">
          <span className="font-bold text-primary text-base">
            Envío: ${summary.total_cost_with_type.toFixed(2)}
          </span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          <p className="font-medium">Error calculando envío</p>
          <p className="text-xs">{error}</p>
        </div>
      )}
    </div>
  );
};
