import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminLayout } from '@/components/admin/AdminLayout';
import ProductCardB2B from '@/components/b2b/ProductCardB2B';
import { useProductsB2B } from '@/hooks/useProductsB2B';
import { useB2BCartSupabase } from '@/hooks/useB2BCartSupabase';
import { B2BFilters } from '@/types/b2b';
import { supabase } from '@/integrations/supabase/client';
import { generatePOBuyingListPDF } from '@/services/pdfGenerators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, History, Loader2, Plus, Printer, RefreshCw, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminZletiLogisticsPage() {
  const [filters, setFilters] = useState<B2BFilters>({ searchQuery: '', category: null, stockStatus: 'all', sortBy: 'newest' });
  const [notes, setNotes] = useState('');
  const { cart, updateQuantity, removeItem, clearCart, refetch } = useB2BCartSupabase();
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [editingNotes, setEditingNotes] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading } = useProductsB2B(filters, 0, null);
  const { data: poHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['zleti-po-history'],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from('master_purchase_orders')
        .select('id, po_number, status, total_items, total_quantity, total_amount, notes, created_at, updated_at')
        .eq('brand_identity', 'zleti')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return rows || [];
    },
  });
  const { data: selectedPo } = useQuery({
    queryKey: ['zleti-po-history-detail', selectedPoId],
    enabled: !!selectedPoId,
    queryFn: async () => {
      const { data: po, error: poError } = await (supabase as any)
        .from('master_purchase_orders').select('*').eq('id', selectedPoId).single();
      if (poError) throw poError;
      const { data: items, error: itemsError } = await (supabase as any)
        .from('zleti_manual_po_items').select('*').eq('po_id', selectedPoId).order('created_at');
      if (itemsError) throw itemsError;
      return { po, items: items || [] };
    },
  });

  useEffect(() => {
    if (selectedPo) {
      setEditingItems(selectedPo.items);
      setEditingNotes(selectedPo.po.notes || '');
    }
  }, [selectedPo]);

  const createPO = useMutation({
    mutationFn: async () => {
      if (cart.items.length === 0) throw new Error('Agrega productos al carrito antes de generar la PO');
      const productIds = [...new Set(cart.items.map(item => item.productId))];
      const { data: products, error: productsError } = await supabase.from('products').select('id, url_origen, imagen_principal, costo_base_excel').in('id', productIds);
      if (productsError) throw productsError;
      const productsMap = new Map((products || []).map(product => [product.id, product]));
      const payload = cart.items.map(item => {
        const product = productsMap.get(item.productId);
        return {
          product_id: item.productId,
          variant_id: item.variantId || null,
          sku: item.sku,
          product_name: item.nombre,
          variant_name: item.variantLabel || [item.color, item.size].filter(Boolean).join(' / ') || null,
          color: item.color || null,
          size: item.size || null,
          image_url: item.imagen_principal || product?.imagen_principal || null,
          source_url: product?.url_origen || item.sourceUrl || null,
          quantity: item.quantity,
          // Purchase orders use the factory cost imported from Excel,
          // never the B2B selling price stored in the cart.
          unit_cost: Number(product?.costo_base_excel || 0),
        };
      });

      const { data: result, error } = await (supabase as any).rpc('create_zleti_manual_po', { p_items: payload, p_notes: notes.trim() || null });
      if (error) throw error;
      return { result, payload };
    },
    onSuccess: async ({ result, payload }) => {
      await generatePOBuyingListPDF({
        po_number: result.po_number,
        market_name: 'ZleTI México',
        brand_identity: 'zleti',
        generated_at: new Date().toISOString(),
        items: payload.map(item => ({ sku: item.sku, nombre: item.product_name, variantName: item.variant_name, image: item.image_url, cantidad: item.quantity, url_origen: item.source_url, unit_cost: item.unit_cost })),
      }, { download: true });
      clearCart();
      setNotes('');
      toast.success(`PO ${result.po_number} creada`, { description: 'El PDF se descargó correctamente.' });
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo crear la PO ZleTI'),
  });

  const updatePO = useMutation({
    mutationFn: async () => {
      if (!selectedPoId || editingItems.length === 0) throw new Error('The PO must contain at least one item');
      const productIds = [...new Set(editingItems.map(item => item.product_id))];
      const { data: products, error } = await supabase.from('products').select('id, url_origen, imagen_principal, costo_base_excel').in('id', productIds);
      if (error) throw error;
      const productsMap = new Map((products || []).map(product => [product.id, product]));
      const payload = editingItems.map(item => ({
        product_id: item.product_id, variant_id: item.variant_id || null, sku: item.sku,
        product_name: item.product_name, variant_name: item.variant_name || null,
        color: item.color || null, size: item.size || null,
        image_url: item.image_url || productsMap.get(item.product_id)?.imagen_principal || null,
        source_url: item.source_url || productsMap.get(item.product_id)?.url_origen || null,
        quantity: Number(item.quantity),
        unit_cost: Number(productsMap.get(item.product_id)?.costo_base_excel || item.unit_cost || 0),
      }));
      const { data: result, error: rpcError } = await (supabase as any).rpc('update_zleti_manual_po', { p_po_id: selectedPoId, p_items: payload, p_notes: editingNotes.trim() || null });
      if (rpcError) throw rpcError;
      return { result, payload };
    },
    onSuccess: async ({ result, payload }) => {
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history'] });
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history-detail', selectedPoId] });
      await generatePOBuyingListPDF({ po_number: result.po_number, market_name: 'ZleTI Mexico', brand_identity: 'zleti', generated_at: new Date().toISOString(), items: payload.map(item => ({ sku: item.sku, nombre: item.product_name, variantName: item.variant_name, image: item.image_url, cantidad: item.quantity, url_origen: item.source_url, unit_cost: item.unit_cost })) }, { download: true });
      toast.success(`${result.po_number} updated`, { description: 'El PDF se descargó correctamente.' });
    },
    onError: (error: any) => toast.error(error?.message || 'Could not update the PO'),
  });

  return (
    <AdminLayout
      title="Logística ZleTI"
      headerActions={(
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="relative hidden w-44 md:block lg:w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.searchQuery} onChange={event => setFilters(current => ({ ...current, searchQuery: event.target.value }))} placeholder="Buscar producto o SKU" className="h-9 bg-background pl-8 text-xs" />
          </div>
          <Select value={filters.stockStatus} onValueChange={value => setFilters(current => ({ ...current, stockStatus: value as B2BFilters['stockStatus'] }))}>
            <SelectTrigger className="hidden h-9 w-32 bg-background text-xs lg:flex"><SelectValue placeholder="Stock" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todo el stock</SelectItem><SelectItem value="in_stock">En stock</SelectItem><SelectItem value="low_stock">Stock bajo</SelectItem><SelectItem value="out_of_stock">Agotado</SelectItem></SelectContent>
          </Select>
          <Select value={filters.sortBy} onValueChange={value => setFilters(current => ({ ...current, sortBy: value as B2BFilters['sortBy'] }))}>
            <SelectTrigger className="hidden h-9 w-32 bg-background text-xs xl:flex"><SelectValue placeholder="Ordenar" /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Más recientes</SelectItem><SelectItem value="price_asc">Precio menor</SelectItem><SelectItem value="price_desc">Precio mayor</SelectItem><SelectItem value="moq_asc">MOQ menor</SelectItem></SelectContent>
          </Select>
          <Button onClick={() => { refetch(); setCartOpen(true); }} variant="outline" size="sm" className="gap-1.5 border-primary/40 bg-background px-2.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Carrito</span>
            <Badge className="min-w-5 justify-center px-1.5">{cart.totalItems}</Badge>
          </Button>
          <Button onClick={() => setHistoryOpen(true)} variant="outline" size="sm" className="hidden gap-1.5 border-primary/40 bg-background px-2.5 sm:flex">
            <History className="h-4 w-4" />
            <span>PO History</span>
          </Button>
          <Button onClick={() => refetch()} variant="ghost" size="icon" title="Actualizar carrito" className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}
    >
      <div className="space-y-6">
        {isLoading ? <div className="py-16 text-center text-muted-foreground">Cargando Catalogue Maître B2B...</div> : data?.products?.length ? <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.products.map(product => <ProductCardB2B key={product.id} product={product} showExcelCost />)}
          </div>
        </> : <Card><CardContent className="py-16 text-center text-muted-foreground">No se encontraron productos en el Catalogue Maître B2B.</CardContent></Card>}
      </div>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="flex max-h-[90vh] flex-col">
            <div className="bg-gradient-to-r from-[#071d7f] to-[#1239a6] px-5 py-5 text-white sm:px-7">
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="flex items-center gap-2 text-xl text-white">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                        <ShoppingCart className="h-5 w-5" />
                      </span>
                      Carrito de compra ZleTI
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-blue-100">
                      Revisa los productos antes de generar el Manifest / PO.
                    </DialogDescription>
                  </div>
                  <Badge className="border-white/20 bg-white/15 px-3 py-1.5 text-white hover:bg-white/15">
                    {cart.totalItems} {cart.totalItems === 1 ? 'producto' : 'productos'}
                  </Badge>
                </div>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
              {cart.items.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#1239a6]">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <p className="font-semibold text-slate-800">Tu carrito está vacío</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Selecciona productos del catálogo para preparar una nueva orden de compra.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.items.map(item => (
                    <div key={item.id} className="grid gap-4 rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1fr)_120px_110px_auto] sm:items-center sm:p-4">
                      <div className="h-16 w-16 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                        <img src={item.imagen || '/placeholder.svg'} alt={item.nombre} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{item.nombre}</p>
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{item.sku}</p>
                        {(item.color || item.size) && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.color && <Badge variant="secondary" className="text-[10px]">Color: {item.color}</Badge>}
                            {item.size && <Badge variant="secondary" className="text-[10px]">Talla: {item.size}</Badge>}
                          </div>
                        )}
                        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className="mt-2 block max-w-full truncate text-[11px] text-primary underline underline-offset-2 hover:text-primary/80">Ver producto de origen</a>}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <span className="text-xs font-medium text-muted-foreground sm:block sm:pb-1">Cantidad</span>
                        <Input type="number" min={item.moq} value={item.quantity} onChange={event => updateQuantity(item.id, Math.max(item.moq, Number(event.target.value) || item.moq))} className="h-9 w-24 rounded-lg text-center sm:w-full" />
                      </div>
                      <div className="flex items-center justify-between sm:block sm:text-right">
                        <span className="text-xs font-medium text-muted-foreground sm:block sm:pb-1">Total</span>
                        <span className="text-sm font-bold text-slate-900">${Number(item.totalPrice || 0).toFixed(2)}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Eliminar producto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t bg-white px-5 py-4 sm:px-7">
              <div className="mb-4">
                <Label htmlFor="zleti-notes" className="text-xs font-semibold text-slate-700">Notas para el agente (opcional)</Label>
                <Textarea id="zleti-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Instrucciones de compra, empaque o consolidación..." className="mt-1.5 min-h-[72px] rounded-lg" />
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{cart.totalQuantity} unidades seleccionadas</p>
                  <p className="text-lg font-bold text-slate-900">Subtotal: ${Number(cart.subtotal || 0).toFixed(2)} <span className="text-xs font-medium text-muted-foreground">USD</span></p>
                </div>
                <Button onClick={() => { setCartOpen(false); createPO.mutate(); }} disabled={cart.items.length === 0 || createPO.isPending} className="h-11 gap-2 rounded-lg bg-[#071d7f] px-5 hover:bg-[#1239a6]">
                  {createPO.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  {createPO.isPending ? 'Generando PO...' : 'Generar Manifest / PO'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> PO History — ZleTI</DialogTitle></DialogHeader>
          {historyLoading ? <p className="py-8 text-center text-muted-foreground">Loading PO history...</p> : poHistory.length === 0 ? <p className="py-8 text-center text-muted-foreground">No ZleTI POs generated yet.</p> : <div className="space-y-2">{poHistory.map((po: any) => <div key={po.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{po.po_number}</p><p className="text-xs text-muted-foreground">{po.total_items || 0} products · {po.total_quantity || 0} units · ${Number(po.total_amount || 0).toFixed(2)}</p></div><Badge variant="outline">{po.status}</Badge><Button size="sm" variant="outline" onClick={() => { setHistoryOpen(false); setSelectedPoId(po.id); }}><Printer className="mr-1 h-4 w-4" /> View / Edit</Button></div>)}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPoId} onOpenChange={open => { if (!open) setSelectedPoId(null); }}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedPo?.po?.po_number || 'ZleTI PO'} — Products</DialogTitle></DialogHeader>
          {!selectedPo ? <p className="py-8 text-center text-muted-foreground">Loading PO...</p> : <div className="space-y-4">
            <div className="space-y-2">{editingItems.map((item, index) => <div key={item.id || `${item.sku}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.product_name}</p><p className="font-mono text-xs text-muted-foreground">{item.sku} {item.variant_name ? `· ${item.variant_name}` : ''}</p></div><Input className="w-24" type="number" min={1} value={item.quantity} onChange={event => setEditingItems(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Math.max(1, Number(event.target.value) || 1) } : line))} /><span className="w-24 text-right text-sm">${(Number(item.unit_cost || 0) * Number(item.quantity || 0)).toFixed(2)}</span><Button variant="ghost" size="icon" onClick={() => setEditingItems(current => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>
            {cart.items.length > 0 && <Button variant="outline" onClick={() => setEditingItems(current => [...current, ...cart.items.map(item => ({ product_id: item.productId, variant_id: item.variantId, sku: item.sku, product_name: item.nombre, variant_name: [item.color, item.size].filter(Boolean).join(' / '), quantity: item.quantity, unit_cost: item.unitPrice, image_url: item.imagen, color: item.color, size: item.size }))])} className="gap-2"><Plus className="h-4 w-4" /> Add current cart items</Button>}
            <Textarea value={editingNotes} onChange={event => setEditingNotes(event.target.value)} placeholder="Notes for purchasing agent" />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedPoId(null)}>Close</Button><Button onClick={() => updatePO.mutate()} disabled={editingItems.length === 0 || updatePO.isPending}>{updatePO.isPending ? 'Saving...' : 'Save and reprint PO'}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
