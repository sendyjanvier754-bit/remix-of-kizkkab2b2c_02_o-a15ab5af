import { useState, useEffect } from 'react';
import { Package, Zap, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShippingOption } from '@/types/b2b-shipping';

interface B2BShippingSelectorProps {
  options: ShippingOption[];
  selectedTier: 'standard' | 'express';
  onTierChange: (tier: 'standard' | 'express') => void;
  hasOversizeProducts?: boolean;
  hasSensitiveProducts?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function B2BShippingSelector({
  options,
  selectedTier,
  onTierChange,
  hasOversizeProducts = false,
  hasSensitiveProducts = false,
  disabled = false,
  loading = false,
}: B2BShippingSelectorProps) {
  const standardOption = options.find(o => o.tier_type === 'standard');
  const expressOption = options.find(o => o.tier_type === 'express');

  // Express no disponible para oversize
  const expressDisabled = hasOversizeProducts || (expressOption && !expressOption.allows_oversize && hasOversizeProducts);

  const renderOption = (
    option: ShippingOption | undefined,
    type: 'standard' | 'express'
  ) => {
    if (!option) return null;

    const isSelected = selectedTier === type;
    const isDisabled = disabled || (type === 'express' && expressDisabled);
    const isExpress = type === 'express';

    return (
      <Card
        className={cn(
          'relative cursor-pointer transition-all duration-200 border-2',
          isSelected 
            ? 'border-primary bg-primary/5 shadow-md' 
            : 'border-border hover:border-primary/50',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !isDisabled && onTierChange(type)}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {isExpress ? (
                <div className="p-2 rounded-full bg-amber-100">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-blue-100">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
              )}
              <div>
                <h4 className="font-semibold text-foreground">
                  {option.tier_name}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isExpress ? 'Prioritario' : 'Consolidado'}
                </p>
              </div>
            </div>
            
            {isSelected && (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            )}
          </div>

          {/* Precios por tramo */}
          <div className="space-y-1 mb-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Tramo A (China→USA)</span>
              <span className="font-medium text-foreground">
                ${option.tramo_a_cost_per_kg.toFixed(2)}/kg
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tramo B (USA→Destino)</span>
              <span className="font-medium text-foreground">
                ${option.tramo_b_cost_per_lb.toFixed(2)}/lb
              </span>
            </div>
          </div>

          {/* ETA */}
          <div className="flex items-center gap-2 text-sm mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Entrega estimada:</span>
            <span className="font-semibold text-foreground">
              {option.eta_min}-{option.eta_max} días
            </span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {option.allows_oversize && (
              <Badge variant="secondary" className="text-xs">
                ✓ Productos grandes
              </Badge>
            )}
            {option.allows_sensitive && (
              <Badge variant="secondary" className="text-xs">
                ✓ Productos sensibles
              </Badge>
            )}
            {option.zone_surcharge_percent > 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                +{option.zone_surcharge_percent}% recargo zona
              </Badge>
            )}
          </div>

          {/* Advertencia Express + Oversize */}
          {isExpress && expressDisabled && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <AlertTriangle className="h-4 w-4" />
              <span>No disponible para productos oversize</span>
            </div>
          )}

          {/* Badge de selección */}
          {isExpress && !expressDisabled && (
            <div className="absolute -top-2 -right-2">
              <Badge className="bg-amber-500 text-white text-xs">
                ⚡ RÁPIDO
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Tipo de Envío</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="animate-pulse">
            <CardContent className="p-4 h-48 bg-muted/50" />
          </Card>
          <Card className="animate-pulse">
            <CardContent className="p-4 h-48 bg-muted/50" />
          </Card>
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Sin cobertura logística en esta zona</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Por favor, selecciona una dirección diferente o contacta soporte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Tipo de Envío</h3>
        {hasSensitiveProducts && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            ⚠️ Contiene productos sensibles
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderOption(standardOption, 'standard')}
        {renderOption(expressOption, 'express')}
      </div>
    </div>
  );
}

export default B2BShippingSelector;
