import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminLayout } from '@/components/admin/AdminLayout';
import ProductCardB2B from '@/components/b2b/ProductCardB2B';
import { useProductsB2B } from '@/hooks/useProductsB2B';
import { useB2BCartSupabase } from '@/hooks/useB2BCartSupabase';
import { B2BFilters } from '@/types/b2b';
import { supabase } from '@/integrations/supabase/client';
import { buildPOBuyingListHtml } from '@/services/pdfGenerators';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, History, Loader2, Plus, Printer, RefreshCw, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminZletiLogisticsPage() {
  const [filters, setFilters] = useState<B2BFilters>({ searchQuery: '', category: null, stockStatus: 'all', sortBy: 'newest' });
  const [notes, setNotes] = useState('');
  const [page, setPage] = useState(0);
  const { cart, updateQuantity, removeItem, clearCart, refetch } = useB2BCartSupabase();
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [editingNotes, setEditingNotes] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useProductsB2B(filters, page, 24);
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

  useEffect(() => setPage(0), [filters]);

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
          variant_name: [item.color, item.size].filter(Boolean).join(' / ') || null,
          color: item.color || null,
          size: item.size || null,
          image_url: item.imagen || product?.imagen_principal || null,
          source_url: product?.url_origen || null,
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
    onSuccess: ({ result, payload }) => {
      setPdfTitle(`Lista de compra · ${result.po_number}`);
      setPdfHtml(buildPOBuyingListHtml({
        po_number: result.po_number,
        market_name: 'ZleTI México',
        brand_identity: 'zleti',
        generated_at: new Date().toISOString(),
        items: payload.map(item => ({ sku: item.sku, nombre: item.product_name, variantName: item.variant_name, image: item.image_url, cantidad: item.quantity, url_origen: item.source_url, unit_cost: item.unit_cost })),
      }));
      setPdfOpen(true);
      clearCart();
      setNotes('');
      toast.success(`PO ${result.po_number} creada`, { description: 'Vista previa del documento lista para imprimir o guardar.' });
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
    onSuccess: ({ result, payload }) => {
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history'] });
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history-detail', selectedPoId] });
      setPdfTitle(`Lista de compra · ${result.po_number}`);
      setPdfHtml(buildPOBuyingListHtml({ po_number: result.po_number, market_name: 'ZleTI Mexico', brand_identity: 'zleti', generated_at: new Date().toISOString(), items: payload.map(item => ({ sku: item.sku, nombre: item.product_name, variantName: item.variant_name, image: item.image_url, cantidad: item.quantity, url_origen: item.source_url, unit_cost: item.unit_cost })) }));
      setPdfOpen(true);
      toast.success(`${result.po_number} actualizada`);
    },
    onError: (error: any) => toast.error(error?.message || 'Could not update the PO'),
  });

  return (
    <AdminLayout title="Logística ZleTI" subtitle="Creación manual de Purchase Orders para ZleTI México">
      <div className="space-y-6">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Compra para PO manual ZleTI</CardTitle>
                <CardDescription>Selecciona productos y variantes como en el catálogo mayorista. El carrito se convertirá en un Manifest ZleTI.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { refetch(); setCartOpen(true); }} variant="outline" className="gap-2"><ShoppingCart className="h-4 w-4" /> Carrito <Badge>{cart.totalItems}</Badge></Button>
                <Button onClick={() => setHistoryOpen(true)} variant="outline" className="gap-2"><History className="h-4 w-4" /> PO History</Button>
                <Button onClick={() => refetch()} variant="ghost" size="icon" title="Actualizar carrito"><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={filters.searchQuery} onChange={event => setFilters(current => ({ ...current, searchQuery: event.target.value }))} placeholder="Buscar por nombre o SKU" className="pl-9" /></div>
              <Select value={filters.stockStatus} onValueChange={value => setFilters(current => ({ ...current, stockStatus: value as B2BFilters['stockStatus'] }))}><SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Disponibilidad" /></SelectTrigger><SelectContent><SelectItem value="all">Todo el stock</SelectItem><SelectItem value="in_stock">En stock</SelectItem><SelectItem value="low_stock">Stock bajo</SelectItem><SelectItem value="out_of_stock">Agotado</SelectItem></SelectContent></Select>
              <Select value={filters.sortBy} onValueChange={value => setFilters(current => ({ ...current, sortBy: value as B2BFilters['sortBy'] }))}><SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Ordenar" /></SelectTrigger><SelectContent><SelectItem value="newest">Más recientes</SelectItem><SelectItem value="price_asc">Precio menor</SelectItem><SelectItem value="price_desc">Precio mayor</SelectItem><SelectItem value="moq_asc">MOQ menor</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? <div className="py-16 text-center text-muted-foreground">Cargando Catalogue Maître B2B...</div> : data?.products?.length ? <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.products.map(product => <ProductCardB2B key={product.id} product={product} />)}
          </div>
          <div className="flex justify-center gap-3"><Button variant="outline" disabled={page === 0 || isFetching} onClick={() => setPage(current => current - 1)}>Anterior</Button><Button variant="outline" disabled={data.products.length < 24 || isFetching} onClick={() => setPage(current => current + 1)}>Siguiente</Button></div>
        </> : <Card><CardContent className="py-16 text-center text-muted-foreground">No se encontraron productos en el Catalogue Maître B2B.</CardContent></Card>}

        <Card>
          <CardHeader><CardTitle>Generar Manifest / PO</CardTitle><CardDescription>El contenido del carrito se guardará como PO-ZLT y abrirá su vista imprimible.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label htmlFor="zleti-notes">Notas para el agente (opcional)</Label><Textarea id="zleti-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Instrucciones de compra, empaque o consolidación..." className="mt-1" /></div>
            <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{cart.totalItems} productos · {cart.totalQuantity} unidades · ${Number(cart.subtotal || 0).toFixed(2)}</span><Button onClick={() => createPO.mutate()} disabled={cart.items.length === 0 || createPO.isPending} className="gap-2">{createPO.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{createPO.isPending ? 'Creando PO...' : 'Generar Manifest / PO'}</Button></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] overflow-y-auto">
          <DialogHeader><div className="flex flex-wrap items-center gap-3"><Button onClick={() => { setCartOpen(false); createPO.mutate(); }} disabled={cart.items.length === 0 || createPO.isPending} size="sm" className="gap-2"><FileDown className="h-4 w-4" />{createPO.isPending ? 'Generating...' : 'Generate Manifest / PO'}</Button><DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> ZleTI Shopping Cart <Badge>{cart.totalItems}</Badge></DialogTitle></div></DialogHeader>
          <div className="space-y-3">
            {cart.items.length === 0 ? <p className="py-8 text-center text-muted-foreground">Your cart is empty.</p> : cart.items.map(item => <div key={item.id} className="flex items-center gap-4 rounded-lg border p-3"><div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted"><img src={item.imagen || '/placeholder.svg'} alt={item.nombre} className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.nombre}</p><p className="break-all text-xs text-muted-foreground">{item.sku} {item.color || item.size ? `· ${[item.color, item.size].filter(Boolean).join(' / ')}` : ''}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className="mt-1 block break-all text-xs text-primary underline hover:text-primary/80 select-all">{item.sourceUrl}</a>}</div><Input type="number" min={item.moq} value={item.quantity} onChange={event => updateQuantity(item.id, Math.max(item.moq, Number(event.target.value) || item.moq))} className="w-20" /><span className="w-24 text-right text-sm font-semibold">${Number(item.totalPrice || 0).toFixed(2)}</span><Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}
            <div className="flex justify-end border-t pt-3 text-sm font-semibold">Subtotal: ${Number(cart.subtotal || 0).toFixed(2)}</div>
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
