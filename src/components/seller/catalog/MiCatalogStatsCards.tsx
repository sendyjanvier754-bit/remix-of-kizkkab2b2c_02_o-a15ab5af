import { Card, CardContent } from '@/components/ui/card';
import { Package, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { SellerCatalogStats } from '@/hooks/useSellerCatalog';

interface MiCatalogStatsCardsProps {
  stats: SellerCatalogStats;
}

export function MiCatalogStatsCards({ stats }: MiCatalogStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Productos - Total SKUs */}
      <Card className="bg-blue-50 border-blue-200 hover:border-blue-300 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">Productos</p>
              <div className="text-3xl font-bold text-blue-600">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground mt-2">SKUs en catálogo</p>
            </div>
            <Package className="h-8 w-8 text-blue-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Valor - Total Value */}
      <Card className="bg-green-50 border-green-200 hover:border-green-300 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">Valor</p>
              <div className="text-3xl font-bold text-green-600">
                ${stats.totalValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Inventario total</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Stock - Total Units */}
      <Card className="bg-cyan-50 border-cyan-200 hover:border-cyan-300 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">Stock</p>
              <div className="text-3xl font-bold text-cyan-600">{stats.totalStock.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-2">Unidades disponibles</p>
            </div>
            <Package className="h-8 w-8 text-cyan-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Margen - Average Margin */}
      <Card className="bg-amber-50 border-amber-200 hover:border-amber-300 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">Margen Promedio</p>
              <div className="text-3xl font-bold text-amber-600">
                {stats.avgMargin.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">Ganancia promedio</p>
            </div>
            <TrendingUp className="h-8 w-8 text-amber-600 opacity-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
