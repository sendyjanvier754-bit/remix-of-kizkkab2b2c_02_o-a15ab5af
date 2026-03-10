import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Product {
  id: string;
  nombre: string;
  sku_interno: string;
  precio_base: number;
  imagen_principal: string | null;
  peso_kg: number | null;
  moq: number | null;
  category_name?: string;
}

interface Variant {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  stock: number;
  price_override: number | null;
}

interface AgentProductSelectorProps {
  onAddProduct: (item: {
    product_id: string;
    variant_id: string | null;
    sku: string;
    nombre: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    peso_kg: number;
    color: string | null;
    size: string | null;
    image: string | null;
    moq: number;
  }) => void;
}

export default function AgentProductSelector({ onAddProduct }: AgentProductSelectorProps) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('id, nombre, sku_interno, precio_base, imagen_principal, peso_kg, moq')
        .or(`nombre.ilike.%${query}%,sku_interno.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(20);
      setProducts((data || []) as unknown as Product[]);
    } finally {
      setLoading(false);
    }
  };

  const loadVariants = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    const { data } = await supabase
      .from('product_variants')
      .select('id, sku, color, size, stock, price_override')
      .eq('product_id', productId)
      .eq('is_active', true);
    setVariants((data || []) as Variant[]);
  };

  const handleAddProduct = (product: Product, variant?: Variant) => {
    const key = variant ? `v-${variant.id}` : `p-${product.id}`;
    const qty = quantities[key] || product.moq || 1;
    const price = variant?.price_override || product.precio_base;

    onAddProduct({
      product_id: product.id,
      variant_id: variant?.id || null,
      sku: variant?.sku || product.sku_interno,
      nombre: product.nombre,
      unit_price: price,
      quantity: qty,
      total_price: price * qty,
      peso_kg: product.peso_kg || 0,
      color: variant?.color || null,
      size: variant?.size || null,
      image: product.imagen_principal,
      moq: product.moq || 1,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto por nombre o SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            className="pl-9"
          />
        </div>
        <Button onClick={search} disabled={loading} variant="secondary">
          Buscar
        </Button>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {product.imagen_principal ? (
                  <img
                    src={product.imagen_principal}
                    alt={product.nombre}
                    className="h-14 w-14 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.nombre}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku_interno}</p>
                  <p className="text-sm font-semibold text-primary">${Number(product.precio_base).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadVariants(product.id)}
                  >
                    Variantes
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAddProduct(product)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {expandedProduct === product.id && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {variants.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin variantes disponibles</p>
                  ) : (
                    variants.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 text-sm pl-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs">
                            {v.color && <Badge variant="outline" className="mr-1">{v.color}</Badge>}
                            {v.size && <Badge variant="outline">{v.size}</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            Stock: {v.stock} · {v.sku}
                          </span>
                        </div>
                        <Input
                          type="number"
                          min={product.moq || 1}
                          defaultValue={product.moq || 1}
                          className="w-16 h-7 text-xs"
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [`v-${v.id}`]: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7"
                          onClick={() => handleAddProduct(product, v)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
