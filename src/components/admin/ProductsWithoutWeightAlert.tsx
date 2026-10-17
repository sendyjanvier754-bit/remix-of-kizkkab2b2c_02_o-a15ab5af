import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Weight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductWithoutWeight {
  id: string;
  sku_interno: string;
  nombre: string;
  categoria_nombre?: string;
  proveedor_nombre?: string;
  stock_fisico: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductsWithoutWeightAlertProps {
  /**
   * Si es true, muestra solo un resumen en formato Alert.
   * Si es false, muestra una tabla completa con todos los productos.
   */
  compact?: boolean;
  
  /**
   * Máximo de productos a mostrar en modo compacto
   */
  maxItems?: number;

  /**
   * Callback cuando se hace clic en "Ver Todos"
   */
  onViewAll?: () => void;
}

/**
 * Componente de alerta para productos sin peso configurado
 * 
 * IMPORTANTE: Productos sin peso no pueden usarse en el sistema B2B
 * porque el cálculo de envío requiere peso para funcionar.
 * 
 * Uso:
 * ```tsx
 * // Modo compacto (solo alerta)
 * <ProductsWithoutWeightAlert compact maxItems={5} />
 * 
 * // Modo completo (tabla)
 * <ProductsWithoutWeightAlert />
 * ```
 */
export function ProductsWithoutWeightAlert({
  compact = false,
  maxItems = 10,
  onViewAll,
}: ProductsWithoutWeightAlertProps) {
  const { data: productsWithoutWeight, isLoading } = useQuery({
    queryKey: ['products-without-weight'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_products_without_weight')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProductWithoutWeight[];
    },
    refetchInterval: 30000, // Refetch cada 30 segundos
  });

  const count = productsWithoutWeight?.length || 0;

  if (isLoading) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Cargando productos sin peso...</AlertTitle>
      </Alert>
    );
  }

  if (count === 0) {
    return null; // No mostrar nada si todos tienen peso
  }

  // Modo compacto: Solo alerta con resumen
  if (compact) {
    const displayItems = productsWithoutWeight?.slice(0, maxItems) || [];

    return (
      <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-600 dark:text-yellow-400">
          ⚠️ {count} {count === 1 ? 'Producto' : 'Productos'} sin Peso Configurado
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            Estos productos no pueden usarse en órdenes B2B hasta que se configure su peso en gramos.
          </p>
          
          <div className="space-y-1">
            {displayItems.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between text-sm p-2 rounded bg-card"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-xs">{product.sku_interno}</span>
                  <span className="text-foreground">{product.nombre}</span>
                </div>
                <Link to={`/admin/catalogo?product=${product.id}`}>
                  <Button variant="outline" size="sm">
                    Editar
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {count > maxItems && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={onViewAll}
            >
              Ver todos ({count})
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Modo completo: Tabla detallada
  return (
    <Card className="border-yellow-500/50">
      <CardHeader className="bg-yellow-500/10">
        <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-5 w-5" />
          Productos sin Peso Configurado ({count})
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Los siguientes productos activos no tienen peso configurado y <strong>no pueden ser vendidos</strong> en el sistema B2B
          hasta que se configure su peso en gramos. El peso es requerido para el cálculo de envío multitramo.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium">SKU</th>
                <th className="text-left p-3 text-sm font-medium">Producto</th>
                <th className="text-left p-3 text-sm font-medium">Categoría</th>
                <th className="text-left p-3 text-sm font-medium">Proveedor</th>
                <th className="text-center p-3 text-sm font-medium">Stock</th>
                <th className="text-center p-3 text-sm font-medium">Estado</th>
                <th className="text-right p-3 text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productsWithoutWeight?.map((product) => (
                <tr key={product.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {product.sku_interno}
                    </code>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Weight className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{product.nombre}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {product.categoria_nombre || '-'}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {product.proveedor_nombre || '-'}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant={product.stock_fisico > 0 ? 'default' : 'secondary'}>
                      {product.stock_fisico}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    {product.is_active ? (
                      <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link to={`/admin/catalogo?product=${product.id}`}>
                      <Button variant="default" size="sm">
                        <Weight className="h-3 w-3 mr-1" />
                        Configurar Peso
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProductsWithoutWeightAlert;
