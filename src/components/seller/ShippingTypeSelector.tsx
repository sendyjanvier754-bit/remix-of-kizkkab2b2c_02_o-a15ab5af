import React, { useState, useEffect } from 'react';
import { useShippingTypes, ShippingType } from '@/hooks/useShippingTypes';
import { useCartShippingCost, CartItem, CartShippingSummary } from '@/hooks/useCartShippingCost';
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
import { Truck, DollarSign, Weight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ShippingTypeSelectorProps {
  routeId: string;
  cartItems: CartItem[];
  onShippingTypeChange?: (typeId: string | null, summary: CartShippingSummary | null) => void;
  compact?: boolean;
}

export const ShippingTypeSelector: React.FC<ShippingTypeSelectorProps> = ({
  routeId,
  cartItems,
  onShippingTypeChange,
  compact = false,
}) => {
  const { shippingTypes, selectedTypeId, setSelectedTypeId, isLoading: typesLoading } =
    useShippingTypes(routeId);
  const { summary, totalWeight, isLoading: costLoading, error } = useCartShippingCost(
    cartItems,
    routeId,
    selectedTypeId
  );

  const isLoading = typesLoading || costLoading;

  useEffect(() => {
    if (onShippingTypeChange && summary) {
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
                      {type.display_name}
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
              <span className="text-muted-foreground">Peso:</span>
              <span className="font-medium">{summary.weight_rounded_kg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo base:</span>
              <span className="font-medium">${summary.base_cost.toFixed(2)}</span>
            </div>
            {summary.extra_cost > 0 && (
              <div className="flex justify-between text-amber-600">
                <span className="text-muted-foreground">Surcharge:</span>
                <span className="font-medium">+${summary.extra_cost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t">
              <span className="font-semibold text-primary">Total:</span>
              <span className="font-bold text-primary">${summary.total_cost_with_type.toFixed(2)}</span>
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
          <Skeleton className="h-10 w-full" />
        ) : (
          <div>
            <label className="text-sm font-medium mb-2 block">Tipo de envío</label>
            <Select value={selectedTypeId || ''} onValueChange={setSelectedTypeId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un tipo de envío" />
              </SelectTrigger>
              <SelectContent>
                {shippingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      {type.display_name}
                      {type.extra_cost_fixed > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          +${type.extra_cost_fixed.toFixed(2)}
                        </Badge>
                      )}
                      {type.extra_cost_percent > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          +{type.extra_cost_percent}%
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Shipping Cost Summary */}
        {summary && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Weight className="h-4 w-4" />
                Peso total
              </div>
              <span className="font-semibold">{summary.weight_rounded_kg} kg</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo base</span>
              <span className="font-semibold">${summary.base_cost.toFixed(2)}</span>
            </div>

            {summary.extra_cost > 0 && (
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-amber-600">Cargo adicional</span>
                <span className="font-semibold text-amber-600">
                  +${summary.extra_cost.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-2 bg-white -mx-4 -mb-4 px-4 py-3 rounded-b">
              <div className="flex items-center gap-2 font-semibold text-lg text-primary">
                <DollarSign className="h-5 w-5" />
                Total de envío
              </div>
              <span className="text-xl font-bold text-primary">
                ${summary.total_cost_with_type.toFixed(2)}
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
