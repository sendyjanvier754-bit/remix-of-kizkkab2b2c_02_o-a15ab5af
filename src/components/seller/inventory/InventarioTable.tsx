import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Edit, 
  Package, 
  Eye, 
  EyeOff,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { SellerCatalogItem } from "@/hooks/useSellerCatalog";

interface InventarioTableProps {
  items: SellerCatalogItem[];
  getMargin: (item: SellerCatalogItem) => number;
  onEditPrice: (item: SellerCatalogItem) => void;
  onAdjustStock: (item: SellerCatalogItem) => void;
  onToggleActive: (itemId: string) => void;
}

type SortField = 'nombre' | 'stock' | 'precioVenta' | 'margin';
type SortDirection = 'asc' | 'desc';

export function InventarioTable({ 
  items, 
  getMargin, 
  onEditPrice, 
  onAdjustStock,
  onToggleActive 
}: InventarioTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedItems = items
    .filter(item => 
      item.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'nombre':
          comparison = a.nombre.localeCompare(b.nombre);
          break;
        case 'stock':
          comparison = a.stock - b.stock;
          break;
        case 'precioVenta':
          comparison = a.precioVenta - b.precioVenta;
          break;
        case 'margin':
          comparison = getMargin(a) - getMargin(b);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Imagen</TableHead>
              <TableHead>
                <SortButton field="nombre">Producto</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="stock">Stock</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex flex-col items-end">
                  <span>Costo Total</span>
                  <span className="text-xs text-muted-foreground font-normal">(B2B + Logística)</span>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="precioVenta">Precio Venta</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="margin">Margen</SortButton>
              </TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[80px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No se encontraron productos" : "No tienes productos en tu inventario"}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedItems.map((item) => {
                const margin = getMargin(item);
                const isLoss = margin < 0;
                const isLowMargin = margin >= 0 && margin < 10;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.images[0] ? (
                        <img
                          src={item.images[0]}
                          alt={item.nombre}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{item.nombre}</p>
                        <p className="text-sm text-muted-foreground">{item.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.stock === 0 ? "destructive" : item.stock < 5 ? "secondary" : "default"}>
                        {item.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm">${item.precioCosto.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          ${item.precioB2B.toFixed(2)} + ${item.costoLogistica.toFixed(2)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-right">
                      ${item.precioVenta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1">
                        {isLoss ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <TrendingUp className={`h-4 w-4 ${isLowMargin ? 'text-yellow-500' : 'text-green-500'}`} />
                        )}
                        <span className={isLoss ? 'text-red-600' : isLowMargin ? 'text-yellow-600' : 'text-green-600'}>
                          {margin.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? (
                          <><Eye className="h-3 w-3 mr-1" /> Publicado</>
                        ) : (
                          <><EyeOff className="h-3 w-3 mr-1" /> Oculto</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditPrice(item)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar Precio
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAdjustStock(item)}>
                            <Package className="h-4 w-4 mr-2" />
                            Ajustar Stock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggleActive(item.id)}>
                            {item.isActive ? (
                              <><EyeOff className="h-4 w-4 mr-2" /> Ocultar</>
                            ) : (
                              <><Eye className="h-4 w-4 mr-2" /> Publicar</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredAndSortedItems.length} de {items.length} productos
      </p>
    </div>
  );
}
