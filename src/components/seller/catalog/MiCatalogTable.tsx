import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductoConVariantes, SellerCatalogItem } from '@/hooks/useSellerCatalog';

/** Per-tier badge colors — add more entries for new tier types as needed */
const TIER_COLORS: Record<string, string> = {
  standard:  'bg-blue-50   text-blue-700   border-blue-200',
  express:   'bg-orange-50 text-orange-700 border-orange-200',
  economy:   'bg-green-50  text-green-700  border-green-200',
  fast:      'bg-purple-50 text-purple-700 border-purple-200',
  priority:  'bg-red-50    text-red-700    border-red-200',
  overnight: 'bg-pink-50   text-pink-700   border-pink-200',
};
const DEFAULT_TIER_COLOR = 'bg-gray-50 text-gray-700 border-gray-200';

function TierCostBadge({ tierType, cost }: { tierType: string; cost: number }) {
  const colorClass = TIER_COLORS[tierType.toLowerCase()] ?? DEFAULT_TIER_COLOR;
  const label = tierType.charAt(0).toUpperCase() + tierType.slice(1);
  return (
    <Badge variant="outline" className={`${colorClass} text-xs whitespace-nowrap`}>
      ${cost.toFixed(2)} <span className="opacity-60 ml-0.5">{label}</span>
    </Badge>
  );
}

function TierCostCell({ tierCosts, fallback }: { tierCosts?: Record<string, number>; fallback: number }) {
  if (!tierCosts || Object.keys(tierCosts).length === 0) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        ${fallback > 0 ? fallback.toFixed(2) : '—'}
      </Badge>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      {Object.entries(tierCosts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tierType, cost]) => (
          <TierCostBadge key={tierType} tierType={tierType} cost={cost} />
        ))}
    </div>
  );
}

interface MiCatalogTableProps {
  productos: ProductoConVariantes[];
  isLoading: boolean;
  onEditProduct: (item: SellerCatalogItem) => void;
  onImportVariants: (productId: string, availableVariants: ProductoConVariantes['variantes_disponibles']) => void;
}

export function MiCatalogTable({
  productos,
  isLoading,
  onEditProduct,
  onImportVariants,
}: MiCatalogTableProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleExpanded = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'bg-green-100 text-green-800 border-green-200';
    if (margin >= 15) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getMarginLabel = (margin: number) => {
    if (margin >= 30) return '✓ Bueno';
    if (margin >= 15) return '◐ Normal';
    return '✗ Bajo';
  };

  const getStockBadge = (stock: number) => {
    if (stock === 0) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Sin Stock</Badge>;
    }
    return <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">{stock.toLocaleString()} unid.</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="text-center py-12 border border-border rounded-lg bg-muted/30">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="font-semibold text-lg mb-2">Sin productos en tu catálogo</h3>
        <p className="text-muted-foreground mb-4">
          Compra lotes mayoristas en el catálogo B2B para agregar productos a tu tienda.
        </p>
        <Button asChild variant="default">
          <a href="/seller/adquisicion-lotes">Comprar Lotes</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-b">
            <TableHead className="w-10 text-center">Expandir</TableHead>
            <TableHead className="min-w-[250px]">Producto</TableHead>
            <TableHead className="text-right min-w-[120px]">Precio Compra</TableHead>
            <TableHead className="text-center min-w-[100px]">Logística</TableHead>
            <TableHead className="text-right min-w-[120px]">Precio Venta</TableHead>
            <TableHead className="text-center min-w-[100px]">Margen</TableHead>
            <TableHead className="text-center min-w-[120px]">Stock</TableHead>
            <TableHead className="text-center w-20">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productos.map((producto) => {
            const isExpanded = expandedProducts.has(producto.productId);
            const hasAvailableVariants = (producto.variantes_disponibles || []).length > 0;

            return (
              <div key={producto.productId} className="contents">
                {/* FILA PADRE - PRODUCTO PRINCIPAL */}
                <TableRow className="hover:bg-muted/30 font-medium border-b">
                  <TableCell className="text-center">
                    <button
                      onClick={() => toggleExpanded(producto.productId)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {producto.imagenPrincipal && (
                        <img
                          src={producto.imagenPrincipal}
                          alt={producto.nombreProducto}
                          className="h-12 w-12 rounded object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{producto.nombreProducto}</p>
                        {producto.marcaProducto && (
                          <p className="text-xs text-muted-foreground">{producto.marcaProducto}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="font-medium">${producto.costoMinimo.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">promedio</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <TierCostCell
                      tierCosts={producto.shippingCostsByTierMin}
                      fallback={producto.precioLogisticaMinimo ?? 0}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="font-medium text-green-600">${producto.precioMaximo.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">máximo</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={getMarginColor(
                      ((producto.precioMaximo - producto.costoMinimo) / producto.costoMinimo) * 100
                    )}>
                      {getMarginLabel(((producto.precioMaximo - producto.costoMinimo) / producto.costoMinimo) * 100)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStockBadge(producto.totalStock)}
                  </TableCell>
                  <TableCell className="text-center">
                    <p className="text-xs text-muted-foreground">{producto.variantes.length} var.</p>
                  </TableCell>
                </TableRow>

                {/* FILAS HIJO - VARIANTES DEL VENDEDOR */}
                {isExpanded && producto.variantes.map((variante, idx) => (
                  <TableRow
                    key={variante.id}
                    className="bg-muted/20 hover:bg-muted/40 border-b text-sm"
                  >
                    <TableCell></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 pl-4">
                        <div className="text-xs text-muted-foreground">└─</div>
                        {variante.images && variante.images[0] && (
                          <img
                            src={variante.images[0]}
                            alt={variante.nombre}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-sm">{variante.nombre}</p>
                          <p className="text-xs text-muted-foreground">{variante.sku}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-medium">${variante.precioCosto.toFixed(2)}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <TierCostCell
                        tierCosts={variante.shippingCostsByTier}
                        fallback={variante.costoLogisticaCalculado || variante.costoLogistica}
                      />
                    </TableCell>
                    <TableCell className="text-right">\n                      <p className="font-medium text-green-600">${variante.precioVenta.toFixed(2)}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={getMarginColor(variante.margenPorcentaje)}
                      >
                        {variante.margenPorcentaje.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStockBadge(variante.stock)}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => onEditProduct(variante)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* FILA SEPARADORA - VARIANTES DISPONIBLES */}
                {isExpanded && hasAvailableVariants && (
                  <TableRow className="bg-green-50 border-b-2 border-green-300">
                    <TableCell colSpan={8}>
                      <div className="flex items-center gap-2 py-2 px-4">
                        <Plus className="h-4 w-4 text-green-600" />
                        <p className="font-medium text-green-700 text-sm">Variantes disponibles en Catálogo Admin</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* FILAS DE VARIANTES DISPONIBLES */}
                {isExpanded &&
                  (producto.variantes_disponibles || []).map((variant) => (
                    <TableRow
                      key={`available-${variant.id}`}
                      className="bg-green-50/50 hover:bg-green-50 border-b text-sm"
                    >
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 pl-4">
                          <div className="text-xs text-green-700">├─</div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate text-sm">{variant.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              No importado • Peso: {variant.weight_kg ? `${variant.weight_kg}kg` : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => onImportVariants(producto.productId, producto.variantes_disponibles || [])}
                          className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-green-200 transition-colors text-green-600"
                          title="Importar"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
              </div>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
