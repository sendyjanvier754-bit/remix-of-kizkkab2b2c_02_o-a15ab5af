import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminLayout } from '@/components/admin/AdminLayout';
import ProductCardB2B from '@/components/b2b/ProductCardB2B';
import { useProductsB2B } from '@/hooks/useProductsB2B';
import { useB2BCartSupabase, ZLETI_MANUAL_CART_EVENT } from '@/hooks/useB2BCartSupabase';
import { B2BFilters, ProductB2BCard } from '@/types/b2b';
import { supabase } from '@/integrations/supabase/client';
import type { POBuyingListData } from '@/services/pdfGenerators';
import { POPreviewModal } from '@/components/logistics/POPreviewModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import useVariantDrawerStore from '@/stores/useVariantDrawerStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, History, Loader2, Plus, Printer, RefreshCw, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminZletiLogisticsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<B2BFilters>({ searchQuery: '', category: null, stockStatus: 'all', sortBy: 'newest' });
  const [notes, setNotes] = useState('');
  const { cart, updateQuantity, removeItem, clearCart, refetch } = useB2BCartSupabase();
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [poDetailOpen, setPoDetailOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [poPreviewOpen, setPoPreviewOpen] = useState(false);
  const [poPreviewData, setPoPreviewData] = useState<POBuyingListData | null>(null);
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [editingNotes, setEditingNotes] = useState('');
  const [poAddProductModalOpen, setPoAddProductModalOpen] = useState(false);
  const [selectedEstimateProductId, setSelectedEstimateProductId] = useState<string>('');
  const [zletiPricingModalOpen, setZletiPricingModalOpen] = useState(false);
  const [priceMarket, setPriceMarket] = useState<'mercado_libre' | 'amazon' | 'tienda_propia'>('mercado_libre');
  const [priceShippingCostInput, setPriceShippingCostInput] = useState<string>('0');
  const [targetBenefitInput, setTargetBenefitInput] = useState<string>('30');
  const [targetBenefitMode, setTargetBenefitMode] = useState<'percent' | 'amount'>('percent');
  const [estimateQuantityInput, setEstimateQuantityInput] = useState<string>('1');
  const [priceExpenseRows, setPriceExpenseRows] = useState<Array<{ id: string; label: string; amount: string; type: 'fixed' | 'percent' }>>([
    { id: 'default-expense-row', label: 'Gasto adicional', amount: '0', type: 'fixed' },
  ]);
  const queryClient = useQueryClient();
  const { data, isLoading } = useProductsB2B(filters, 0, null);
  const cartProductIds = Array.from(new Set(cart.items.map(item => item.productId).filter(Boolean)));
  const { data: cartSupplierInfo } = useQuery({
    queryKey: ['zleti-cart-supplier-info', cartProductIds],
    enabled: cartProductIds.length > 0,
    queryFn: async () => {
      const { data: products, error } = await (supabase as any)
        .from('products')
        .select('id, url_origen, costo_base_excel, proveedor_id')
        .in('id', cartProductIds);
      if (error) throw error;

      const supplierIds = Array.from(new Set((products || []).map((p: any) => p.proveedor_id).filter(Boolean)));
      let suppliersById = new Map<string, any>();
      if (supplierIds.length > 0) {
        const { data: suppliers } = await (supabase as any)
          .from('suppliers')
          .select('id, name, website')
          .in('id', supplierIds);
        suppliersById = new Map((suppliers || []).map((s: any) => [s.id, s]));
      }

      const map = new Map<string, { url: string | null; supplierName: string | null; excelCost: number }>();
      (products || []).forEach((product: any) => {
        const supplier = product.proveedor_id ? suppliersById.get(product.proveedor_id) : null;
        map.set(product.id, {
          url: product.url_origen || supplier?.website || null,
          supplierName: supplier?.name || null,
          excelCost: Number(product.costo_base_excel || 0),
        });
      });
      return map;
    },
  });
  const cartSupplierSubtotal = cart.items.reduce(
    (sum, item) => sum + (cartSupplierInfo?.get(item.productId)?.excelCost || 0) * item.quantity,
    0,
  );
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

      const productIds: string[] = Array.from(
        new Set((items || []).flatMap((item: any) => (item.product_id ? [String(item.product_id)] : [])))
      );
      let productsById = new Map<string, any>();

      if (productIds.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, peso_kg, weight_kg')
          .in('id', productIds);

        if (productsError) throw productsError;
        productsById = new Map((products || []).map((product: any) => [product.id, product]));
      }

      const normalizedItems = (items || []).map((item: any) => ({
        ...item,
        weight_kg: Number(productsById.get(item.product_id)?.weight_kg ?? productsById.get(item.product_id)?.peso_kg ?? 0),
      }));

      return { po, items: normalizedItems };
    },
  });

  useEffect(() => {
    if (selectedPo) {
      setEditingItems(selectedPo.items);
      setEditingNotes(selectedPo.po.notes || '');
    }
  }, [selectedPo]);

  useEffect(() => {
    if (!data?.products?.length) return;
    if (!selectedEstimateProductId || !data.products.some(product => product.id === selectedEstimateProductId)) {
      setSelectedEstimateProductId(data.products[0].id);
    }
  }, [data?.products, selectedEstimateProductId]);

  const selectedEstimateProduct = data?.products?.find(product => product.id === selectedEstimateProductId) ?? data?.products?.[0] ?? null;

  const createPriceExpenseRow = (label = '', amount = '0', type: 'fixed' | 'percent' = 'fixed') => ({
    id: `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    amount,
    type,
  });

  const updateExpenseRow = (id: string, field: 'label' | 'amount' | 'type', value: string) => {
    setPriceExpenseRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addPriceExpenseRow = () => {
    setPriceExpenseRows(current => [...current, createPriceExpenseRow('Gasto adicional', '0', 'fixed')]);
  };

  const removePriceExpenseRow = (rowId: string) => {
    setPriceExpenseRows(current => {
      if (current.length === 1) {
        return [createPriceExpenseRow('Gasto adicional', '0', 'fixed')];
      }
      return current.filter(row => row.id !== rowId);
    });
  };

  const loadSavedPriceEstimate = async (productId: string) => {
    if (!productId) return;

    try {
      const { data: productData, error } = await supabase
        .from('products')
        .select('last_fee_calculation')
        .eq('id', productId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const savedEstimate = (productData?.last_fee_calculation ?? null) as Record<string, any> | null;

      if (!savedEstimate) {
        setPriceMarket('mercado_libre');
        setPriceShippingCostInput('0');
        setTargetBenefitInput('30');
        setTargetBenefitMode('percent');
        setEstimateQuantityInput('1');
        setPriceExpenseRows([createPriceExpenseRow('Gasto adicional', '0', 'fixed')]);
        return;
      }

      const rows: Array<{ id: string; label: string; amount: string; type: 'fixed' | 'percent' }> = Array.isArray(savedEstimate.extra_expenses) && savedEstimate.extra_expenses.length > 0
        ? savedEstimate.extra_expenses.map((expense: any, index: number) => ({
            id: `saved-expense-${productId}-${index}`,
            label: expense?.label || `Gasto adicional ${index + 1}`,
            amount: String(expense?.amount ?? 0),
            type: expense?.type === 'percent' ? 'percent' : 'fixed',
          }))
        : [createPriceExpenseRow('Gasto adicional', '0', 'fixed')];

      setPriceMarket(savedEstimate.market || 'mercado_libre');
      setPriceShippingCostInput(String(savedEstimate.shipping_cost ?? 0));
      setTargetBenefitInput(String(savedEstimate.target_benefit_value ?? 30));
      setTargetBenefitMode(savedEstimate.target_benefit_mode === 'amount' ? 'amount' : 'percent');
      setEstimateQuantityInput(String(savedEstimate.quantity ?? 1));
      setPriceExpenseRows(rows);
    } catch (error) {
      console.error('No se pudo cargar la estimación guardada:', error);
      setPriceExpenseRows([createPriceExpenseRow('Gasto adicional', '0', 'fixed')]);
    }
  };

  useEffect(() => {
    if (selectedEstimateProductId) {
      void loadSavedPriceEstimate(selectedEstimateProductId);
    }
  }, [selectedEstimateProductId]);

  const baseCost = Number(
    selectedEstimateProduct?.costo_base_excel ??
    selectedEstimateProduct?.factory_cost ??
    selectedEstimateProduct?.precio_b2b ??
    0
  );
  const extraExpenses = priceExpenseRows.reduce((sum, expense) => {
    const amount = Number(expense.amount) || 0;
    if (expense.type === 'percent') {
      return sum + ((baseCost * amount) / 100);
    }

    return sum + amount;
  }, 0);
  const shippingCostForPrice = Number(priceShippingCostInput) || 0;
  const targetBenefitPercent = Number(targetBenefitInput) || 0;
  const quantity = Math.max(1, Number(estimateQuantityInput) || 1);

  const totalCostForPrice = baseCost + shippingCostForPrice + extraExpenses;
  const targetBenefitAmount = targetBenefitMode === 'amount' ? targetBenefitPercent : totalCostForPrice * (targetBenefitPercent / 100);
  const suggestedPvp = totalCostForPrice + targetBenefitAmount;
  const profitAmount = suggestedPvp - totalCostForPrice;

  const openPriceCalculatorModal = (product: ProductB2BCard) => {
    setSelectedEstimateProductId(product.id);
    setZletiPricingModalOpen(true);
  };

  const addEstimatedProductToFlow = () => {
    if (!selectedEstimateProduct) return;

    const detail = {
      productId: selectedEstimateProduct.id,
      variantId: selectedEstimateProduct.variants?.[0]?.id ?? null,
      sku: selectedEstimateProduct.sku,
      nombre: selectedEstimateProduct.nombre,
      unitPrice: baseCost || selectedEstimateProduct.precio_b2b || 0,
      quantity,
      color: undefined,
      size: undefined,
      imagen: selectedEstimateProduct.imagen_principal,
      sourceUrl: selectedEstimateProduct.source_url,
    };

    window.dispatchEvent(new CustomEvent(ZLETI_MANUAL_CART_EVENT, { detail }));

    if (selectedPoId) {
      const currentVariantId = detail.variantId || null;
      const alreadyExists = editingItems.some(item =>
        item.product_id === detail.productId && (item.variant_id || null) === currentVariantId
      );

      if (alreadyExists) {
        toast.info('El producto ya está en el PO', {
          description: `${detail.nombre} ya estaba incluido en este PO. Puedes editar la cantidad o retirarlo desde la lista.`,
        });
        return;
      }

      setEditingItems(current => [
        ...current,
        {
          product_id: detail.productId,
          variant_id: currentVariantId,
          sku: detail.sku,
          product_name: detail.nombre,
          variant_name: null,
          quantity,
          unit_cost: baseCost || detail.unitPrice || 0,
          image_url: detail.imagen || null,
          source_url: detail.sourceUrl || null,
          color: null,
          size: null,
        },
      ]);

      toast.success('Producto agregado al PO', { description: `Se añadió ${detail.nombre} como un producto nuevo en el PO seleccionado.` });
      return;
    }

    toast.success('Producto agregado al carrito ZleTI', { description: `Se añadió ${detail.nombre} con cálculo estimado listo para generar el PO.` });
  };

  const savePriceEstimateToProduct = useMutation({
    mutationFn: async () => {
      if (!selectedEstimateProductId) throw new Error('Selecciona primero un producto para guardar la estimación.');

      const payload = {
        source: 'zleti_suggested_price_estimate',
        generated_at: new Date().toISOString(),
        product_id: selectedEstimateProductId,
        product_name: selectedEstimateProduct?.nombre || null,
        sku: selectedEstimateProduct?.sku || null,
        market: priceMarket,
        quantity: Number(estimateQuantityInput) || 1,
        shipping_cost: Number(priceShippingCostInput) || 0,
        extra_expenses: priceExpenseRows
          .filter(expense => expense.label.trim() || Number(expense.amount) > 0)
          .map(expense => ({
            label: expense.label.trim() || 'Gasto adicional',
            amount: Number(expense.amount) || 0,
            type: expense.type === 'percent' ? 'percent' : 'fixed',
          })),
        target_benefit_mode: targetBenefitMode,
        target_benefit_value: Number(targetBenefitInput) || 0,
        total_cost: Number(totalCostForPrice) || 0,
        target_benefit_amount: Number(targetBenefitAmount) || 0,
        suggested_pvp: Number(suggestedPvp) || 0,
        profit_amount: Number(profitAmount) || 0,
      };

      const { error } = await supabase
        .from('products')
        .update({
          last_fee_calculation: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedEstimateProductId);

      if (error) throw error;

      return payload;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['products-b2b-eav'] });
      toast.success('Estimación guardada por producto', { description: 'Se guardó el cálculo en la base de datos y quedó listo para consultar o editar.' });
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo guardar la estimación del producto'),
  });

  const openPoAddProductModal = () => {
    if (!data?.products?.length) {
      toast.error('No hay productos disponibles para agregar al PO');
      return;
    }

    setPoDetailOpen(true);
    setPoAddProductModalOpen(true);
  };

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
    onSuccess: ({ result, payload }) => {
      setPoPreviewData({
        po_number: result.po_number,
        market_name: 'ZleTI México',
        brand_identity: 'zleti',
        generated_at: new Date().toISOString(),
        items: payload.map(item => ({ sku: item.sku, nombre: item.product_name, variantName: item.variant_name, image: item.image_url, cantidad: item.quantity, url_origen: item.source_url, unit_cost: item.unit_cost })),
      });
      setPoPreviewOpen(true);
      clearCart();
      setNotes('');
      setCartOpen(false);
      toast.success(`PO ${result.po_number} creada`, { description: 'La vista previa está lista para imprimir o guardar.' });
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
      setPoPreviewData({ po_number: result.po_number, market_name: 'ZleTI México', brand_identity: 'zleti', generated_at: new Date().toISOString(), items: payload.map(item => ({ sku: item.sku, nombre: item.product_name, variantName: item.variant_name, image: item.image_url, cantidad: item.quantity, url_origen: item.source_url, unit_cost: item.unit_cost })) });
      setPoDetailOpen(false);
      setPoPreviewOpen(true);
      toast.success(`${result.po_number} actualizado`, { description: 'La vista previa está lista para imprimir o guardar.' });
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
            {data.products.map(product => (
              <ProductCardB2B
                key={product.id}
                product={product}
                showExcelCost
                onOpenZletiPriceCalculator={openPriceCalculatorModal}
              />
            ))}
          </div>
        </> : <Card><CardContent className="py-16 text-center text-muted-foreground">No se encontraron productos en el Catalogue Maître B2B.</CardContent></Card>}
      </div>

      <Dialog open={zletiPricingModalOpen} onOpenChange={setZletiPricingModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Calculadora de precio sugerido — {selectedEstimateProduct?.nombre || 'Producto'}
            </DialogTitle>
            <DialogDescription>
              Ajusta los gastos, beneficio y datos del mercado para guardar o consultar la estimación por producto.
            </DialogDescription>
          </DialogHeader>

          {selectedEstimateProduct ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Mercado</Label>
                  <Select value={priceMarket} onValueChange={(value) => setPriceMarket(value as 'mercado_libre' | 'amazon' | 'tienda_propia')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Mercado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mercado_libre">Mercado Libre</SelectItem>
                      <SelectItem value="amazon">Amazon</SelectItem>
                      <SelectItem value="tienda_propia">Tienda propia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input type="number" min={1} value={estimateQuantityInput} onChange={event => setEstimateQuantityInput(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Costos de envío</Label>
                  <Input type="number" min={0} step="0.01" value={priceShippingCostInput} onChange={event => setPriceShippingCostInput(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Costo base</Label>
                  <Input type="number" value={baseCost.toFixed(2)} readOnly />
                </div>

                <div className="space-y-2">
                  <Label>{targetBenefitMode === 'percent' ? 'Beneficio esperado (%)' : 'Beneficio esperado (USD)'}</Label>
                  <Input type="number" min={0} step="0.01" value={targetBenefitInput} onChange={event => setTargetBenefitInput(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de beneficio esperado</Label>
                  <Select value={targetBenefitMode} onValueChange={(value) => setTargetBenefitMode(value as 'percent' | 'amount')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Modo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Porcentaje</SelectItem>
                      <SelectItem value="amount">Monto fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Gastos adicionales</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPriceExpenseRow} className="h-8">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Agregar gasto
                  </Button>
                </div>
                <div className="space-y-2">
                  {priceExpenseRows.map((expense, index) => (
                    <div key={expense.id} className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={expense.label}
                        onChange={event => updateExpenseRow(expense.id, 'label', event.target.value)}
                        placeholder={`Gasto ${index + 1}`}
                        className="flex-1"
                      />
                      <div className="flex w-[220px] items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={expense.amount}
                          onChange={event => updateExpenseRow(expense.id, 'amount', event.target.value)}
                          placeholder="0"
                          className="w-full"
                        />
                        <Select value={expense.type} onValueChange={(value) => updateExpenseRow(expense.id, 'type', value as 'fixed' | 'percent')}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Monto fijo</SelectItem>
                            <SelectItem value="percent">Porcentaje</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {priceExpenseRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => removePriceExpenseRow(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Costo total</span><span className="font-semibold">${totalCostForPrice.toFixed(2)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Beneficio objetivo</span><span className="font-semibold text-primary">${targetBenefitAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Gastos adicionales</span><span className="font-semibold">${extraExpenses.toFixed(2)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Precio sugerido</span><span className="font-bold text-green-700">${suggestedPvp.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setZletiPricingModalOpen(false)}>Cerrar</Button>
                <Button onClick={() => savePriceEstimateToProduct.mutate()} disabled={savePriceEstimateToProduct.isPending}>
                  {savePriceEstimateToProduct.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                  {savePriceEstimateToProduct.isPending ? 'Guardando...' : 'Guardar estimación'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">Cargando producto...</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={poAddProductModalOpen} onOpenChange={setPoAddProductModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Agregar producto nuevo al PO
            </DialogTitle>
            <DialogDescription>
              Selecciona un producto del catálogo, elige su variante y define la cantidad para integrarlo al PO.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data?.products?.map(product => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setPoDetailOpen(true);
                    setPoAddProductModalOpen(false);
                    useVariantDrawerStore.getState().open({
                      id: product.id,
                      sku: product.sku,
                      nombre: product.nombre,
                      images: product.imagen_principal ? [product.imagen_principal] : [],
                      price: product.precio_b2b,
                      costB2B: product.precio_b2b,
                      moq: product.moq,
                      stock: product.stock_fisico,
                      source_product_id: product.source_product_id || product.id,
                      source_url: product.source_url,
                    }, (addedItems?: any[]) => {
                      setPoDetailOpen(true);
                      setEditingItems(current => {
                        const existingKeys = new Set(current.map(item => `${item.product_id}:${item.variant_id || 'no-variant'}`));
                        const newItems = (addedItems || []).filter(item => !existingKeys.has(`${item.product_id}:${item.variant_id || 'no-variant'}`));
                        return [...current, ...newItems];
                      });
                    });
                  }}
                  className="overflow-hidden rounded-xl border border-border bg-white text-left transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden border-b bg-muted">
                    <img src={product.imagen_principal || '/placeholder.svg'} alt={product.nombre} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800">{product.nombre}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>SKU: {product.sku}</span>
                      <span>{product.variant_count || 0} variantes</span>
                    </div>

                    {product.variants && product.variants.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1">
                        {product.variants.slice(0, 4).map((variant, index) => {
                          const variantImage = variant.image_url || variant.images?.[0] || product.imagen_principal || '/placeholder.svg';
                          return (
                            <img
                              key={`${product.id}-variant-${variant.id || index}`}
                              src={variantImage}
                              alt={variant.label || product.nombre}
                              className="h-8 w-8 rounded-md border border-slate-200 bg-muted object-cover shadow-sm"
                              title={variant.label || variant.sku}
                            />
                          );
                        })}
                        {product.variants.length > 4 && (
                          <div className="flex h-8 min-w-8 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">
                            +{product.variants.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                        {(() => {
                          const info = cartSupplierInfo?.get(item.productId);
                          const url = item.sourceUrl || info?.url || null;
                          if (!url) return null;
                          return (
                            <div className="mt-2 space-y-1">
                              {info?.supplierName && <p className="text-[11px] text-muted-foreground">Proveedor: {info.supplierName}</p>}
                              <div className="flex flex-wrap items-center gap-2">
                                <a href={url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className="block max-w-full truncate text-[11px] text-primary underline underline-offset-2 hover:text-primary/80">Ver producto de origen</a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={async event => {
                                    event.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(url);
                                      toast.success('Enlace copiado');
                                    } catch {
                                      toast.error('No se pudo copiar el enlace');
                                    }
                                  }}
                                >
                                  Copiar enlace
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <span className="text-xs font-medium text-muted-foreground sm:block sm:pb-1">Cantidad</span>
                        <Input type="number" min={item.moq} value={item.quantity} onChange={event => updateQuantity(item.id, Math.max(item.moq, Number(event.target.value) || item.moq))} className="h-9 w-24 rounded-lg text-center sm:w-full" />
                      </div>
                      <div className="flex items-center justify-between sm:block sm:text-right">
                        <span className="text-xs font-medium text-muted-foreground sm:block sm:pb-1">Total</span>
                        <span className="text-sm font-bold text-slate-900">${Number(item.totalPrice || 0).toFixed(2)}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Costo proveedor: ${((cartSupplierInfo?.get(item.productId)?.excelCost || 0) * item.quantity).toFixed(2)}
                        </span>
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
          {historyLoading ? <p className="py-8 text-center text-muted-foreground">Loading PO history...</p> : poHistory.length === 0 ? <p className="py-8 text-center text-muted-foreground">No ZleTI POs generated yet.</p> : <div className="space-y-2">{poHistory.map((po: any) => <div key={po.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{po.po_number}</p><p className="text-xs text-muted-foreground">{po.total_items || 0} products · {po.total_quantity || 0} units · ${Number(po.total_amount || 0).toFixed(2)}</p></div><Badge variant="outline">{po.status}</Badge><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setHistoryOpen(false); setSelectedPoId(po.id); setPoDetailOpen(true); }}><Printer className="mr-1 h-4 w-4" /> View / Edit</Button><Button size="sm" variant="secondary" onClick={() => { setHistoryOpen(false); navigate(`/admin/logistica-zleti/${po.id}/estimacion-envio`); }}><FileDown className="mr-1 h-4 w-4" /> Calcular envío CHINA → México</Button></div></div>)}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={poDetailOpen} onOpenChange={open => { setPoDetailOpen(open); if (!open) { /* keep selectedPoId so the shipping estimate card remains visible */ } }}>
        <DialogContent className="max-h-[85vh] max-w-[85vw] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedPo?.po?.po_number || 'ZleTI PO'} — Products</DialogTitle></DialogHeader>
          {!selectedPo ? <p className="py-8 text-center text-muted-foreground">Loading PO...</p> : <div className="space-y-4">
            <div className="space-y-2">{editingItems.map((item, index) => <div key={item.id || `${item.sku}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="h-14 w-14 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"><img src={item.image_url || item.imagen || '/placeholder.svg'} alt={item.product_name} className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium">{item.product_name}</p><p className="line-clamp-1 font-mono text-xs text-muted-foreground">{item.sku} {item.variant_name ? `· ${item.variant_name}` : ''}</p></div><Input className="w-24" type="number" min={1} value={item.quantity} onChange={event => setEditingItems(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Math.max(1, Number(event.target.value) || 1) } : line))} /><span className="w-24 text-right text-sm">${(Number(item.unit_cost || 0) * Number(item.quantity || 0)).toFixed(2)}</span><Button variant="ghost" size="sm" onClick={() => setEditingItems(current => current.filter((_, lineIndex) => lineIndex !== index))} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Retirar</Button></div>)}</div>
            {cart.items.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setEditingItems(current => {
                  const existingProductIds = new Set(current.map(item => `${item.product_id}:${item.variant_id || 'no-variant'}`));
                  const newItems = cart.items
                    .filter(item => !existingProductIds.has(`${item.productId}:${item.variantId || 'no-variant'}`))
                    .map(item => ({
                      product_id: item.productId,
                      variant_id: item.variantId,
                      sku: item.sku,
                      product_name: item.nombre,
                      variant_name: [item.color, item.size].filter(Boolean).join(' / ') || null,
                      quantity: item.quantity,
                      unit_cost: item.unitPrice,
                      image_url: item.imagen,
                      color: item.color,
                      size: item.size,
                    }));

                  return [...current, ...newItems];
                })}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar productos del carrito no existentes
              </Button>
            )}
            {selectedPoId && (
              <Button variant="outline" onClick={openPoAddProductModal} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar producto nuevo al PO
              </Button>
            )}
            <Textarea value={editingNotes} onChange={event => setEditingNotes(event.target.value)} placeholder="Notes for purchasing agent" />
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setPoDetailOpen(false)} className="gap-2"><Printer className="h-4 w-4" /> Close</Button><Button variant="secondary" onClick={() => { setPoDetailOpen(false); navigate(`/admin/logistica-zleti/${selectedPoId}/estimacion-envio`); }} className="gap-2"><FileDown className="h-4 w-4" /> Calcular envío CHINA → México</Button><Button onClick={() => updatePO.mutate()} disabled={editingItems.length === 0 || updatePO.isPending}>{updatePO.isPending ? 'Saving...' : 'Save and reprint PO'}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
      <POPreviewModal open={poPreviewOpen} onOpenChange={setPoPreviewOpen} data={poPreviewData} />
    </AdminLayout>
  );
}
