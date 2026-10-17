import { useState, useEffect, ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMarkets } from '@/hooks/useMarkets';
import { cn } from '@/lib/utils';

interface MarketSelectorProps {
  selectedMarketIds: string[];
  onSelectionChange: (marketIds: string[]) => void;
  disabled?: boolean;
  showCard?: boolean;
  title?: ReactNode;
  description?: string;
  compact?: boolean;
}

export const MarketSelector = ({
  selectedMarketIds,
  onSelectionChange,
  disabled = false,
  showCard = true,
  title = 'Mercados Disponibles',
  description = 'Selecciona los mercados donde estará disponible',
  compact = false,
}: MarketSelectorProps) => {
  const { activeMarkets, isLoading } = useMarkets();

  const toggleMarket = (marketId: string) => {
    if (disabled) return;
    
    if (selectedMarketIds.includes(marketId)) {
      onSelectionChange(selectedMarketIds.filter(id => id !== marketId));
    } else {
      onSelectionChange([...selectedMarketIds, marketId]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    onSelectionChange(activeMarkets?.map(m => m.id) || []);
  };

  const selectNone = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  if (isLoading) {
    return showCard ? (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!activeMarkets || activeMarkets.length === 0) {
    return showCard ? (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">No hay mercados activos configurados</span>
          </div>
        </CardContent>
      </Card>
    ) : (
      <div className="flex items-center gap-2 text-amber-600 py-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">No hay mercados activos configurados</span>
      </div>
    );
  }

  const content = (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Quick actions */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled}
          className="hover:text-primary hover:underline disabled:opacity-50"
        >
          Seleccionar todos
        </button>
        <span>|</span>
        <button
          type="button"
          onClick={selectNone}
          disabled={disabled}
          className="hover:text-primary hover:underline disabled:opacity-50"
        >
          Limpiar
        </button>
        {selectedMarketIds.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {selectedMarketIds.length} seleccionado(s)
          </Badge>
        )}
      </div>

      {/* Markets list (avoid Radix ScrollArea here to prevent ref/presence loops inside Dialog) */}
      <div
        className={cn(
          "pr-3 overflow-y-auto",
          compact ? "max-h-32" : "max-h-48",
        )}
      >
        <div className={cn("space-y-2", compact && "space-y-1")}>
          {activeMarkets.map((market) => {
            const isSelected = selectedMarketIds.includes(market.id);
            return (
              <div
                key={market.id}
                onClick={() => toggleMarket(market.id)}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer",
                  isSelected
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/50 hover:border-primary/30 hover:bg-muted/30",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                {/* NOTE: Use native checkbox here to avoid rare Radix ref/presence loops inside Dialogs */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  disabled={disabled}
                  aria-label={isSelected ? `Quitar ${market.name}` : `Agregar ${market.name}`}
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-sm border border-input bg-background",
                    "text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "pointer-events-none",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className={cn("font-medium truncate", compact && "text-sm")}>
                      {market.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {market.code}
                    </Badge>
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default MarketSelector;
