import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, Copy, FileDown, FileSpreadsheet, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_VOLUMETRIC_DIVISOR,
  computeEstimateLines,
  computeShippingTotals,
  formatMoney,
  formatMoneyWithCode,
  getMarketplaceFeeTotals,
  priceForMarketplace,
  type EstimateItemInput,
  type FeeApplyTo,
  type FeeType,
  type Marketplace,
  type MarketplaceCurrency,
  type MarketplaceFee,
  type ShippingConfig,
} from '@/lib/zletiPricing';
import { exportPriceSheetToExcel, exportPriceSheetToPdf, type PriceSheetRow } from '@/lib/zletiPriceSheetExport';

const DEFAULT_RATE = '0.50';

const createLocalFee = (): MarketplaceFee => ({
  id: `local-fee-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: 'Nuevo cargo',
  fee_type: 'percentage',
  value: 0,
  apply_to: 'sale_price',
  sort_order: 0,
});

const createMercadoLibreFees = (): MarketplaceFee[] => [
  { id: `local-fee-ml-premium-${Date.now()}`, name: 'Comisión Publicación Premium', fee_type: 'percentage', value: 19.5, apply_to: 'sale_price', sort_order: 0 },
  { id: `local-fee-ml-isr-${Date.now()}`, name: 'Retención ISR', fee_type: 'percentage', value: 2.5, apply_to: 'sale_price', sort_order: 1 },
  { id: `local-fee-ml-iva-${Date.now()}`, name: 'Retención IVA', fee_type: 'percentage', value: 8, apply_to: 'sale_price', sort_order: 2 },
];

const numberOrNull = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default function AdminZletiShippingEstimatePage() {
  const navigate = useNavigate();
  const { poId } = useParams();
  const queryClient = useQueryClient();

  const [shippingEstimateRateInput, setShippingEstimateRateInput] = useState<string>(DEFAULT_RATE);
  const [shippingEstimateRateMode, setShippingEstimateRateMode] = useState<'kg' | 'g'>('kg');
  const [shippingEstimateExtraExpensesInput, setShippingEstimateExtraExpensesInput] = useState<string>('0');
  const [useVolumetric, setUseVolumetric] = useState(true);
  const [volumetricDivisorInput, setVolumetricDivisorInput] = useState<string>(String(DEFAULT_VOLUMETRIC_DIVISOR));
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [marketplaceDraft, setMarketplaceDraft] = useState<Marketplace | null>(null);
  const [suggestedProfitInput, setSuggestedProfitInput] = useState<string>('50');
  const [deleteMarketplaceDialogOpen, setDeleteMarketplaceDialogOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [selectedDetailMarketplaceId, setSelectedDetailMarketplaceId] = useState<string>('');
  const [configOpen, setConfigOpen] = useState(false);

  const { data: selectedPo, isLoading } = useQuery({
    queryKey: ['zleti-po-history-detail', poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data: po, error: poError } = await (supabase as any)
        .from('master_purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const { data: items, error: itemsError } = await (supabase as any)
        .from('zleti_manual_po_items')
        .select('*')
        .eq('po_id', poId)
        .order('created_at');

      if (itemsError) throw itemsError;

      const productIds: string[] = Array.from(
        new Set((items || []).flatMap((item: any) => (item.product_id ? [String(item.product_id)] : [])))
      );
      const variantIds: string[] = Array.from(
        new Set((items || []).flatMap((item: any) => (item.variant_id ? [String(item.variant_id)] : [])))
      );

      let productsById = new Map<string, any>();
      let variantsById = new Map<string, any>();

      if (productIds.length > 0) {
        const { data: products, error: productsError } = await (supabase as any)
          .from('products')
          .select('id, peso_kg, weight_kg, peso_g, weight_g, length_cm, width_cm, height_cm')
          .in('id', productIds);

        if (productsError) throw productsError;
        productsById = new Map((products || []).map((product: any) => [product.id, product]));
      }

      if (variantIds.length > 0) {
        const { data: variants, error: variantsError } = await (supabase as any)
          .from('product_variants')
          .select('id, product_id, peso_kg, weight_kg, peso_g, weight_g, length_cm, width_cm, height_cm')
          .in('id', variantIds);

        if (variantsError) throw variantsError;
        variantsById = new Map((variants || []).map((variant: any) => [variant.id, variant]));
      }

      const normalizedItems = (items || []).map((item: any) => {
        const variant = variantsById.get(item.variant_id);
        const product = productsById.get(item.product_id);

        return {
          ...item,
          weight_kg: Number(
            variant?.weight_kg ||
            variant?.peso_kg ||
            (Number(variant?.weight_g || variant?.peso_g || 0) / 1000) ||
            product?.weight_kg ||
            product?.peso_kg ||
            (Number(product?.weight_g || product?.peso_g || 0) / 1000) ||
            0
          ),
          length_cm: numberOrNull(variant?.length_cm) ?? numberOrNull(product?.length_cm),
          width_cm: numberOrNull(variant?.width_cm) ?? numberOrNull(product?.width_cm),
          height_cm: numberOrNull(variant?.height_cm) ?? numberOrNull(product?.height_cm),
        };
      });

      return { po, items: normalizedItems };
    },
  });

  const { data: marketplaces = [], isLoading: marketplacesLoading } = useQuery<Marketplace[]>({
    queryKey: ['zleti-marketplaces-pricing'],
    queryFn: async () => {
      const { data: marketplaceRows, error: marketplaceError } = await (supabase as any)
        .from('zleti_marketplaces')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at');
      if (marketplaceError) throw marketplaceError;

      const ids = (marketplaceRows || []).map((row: any) => row.id);
      const { data: feeRows, error: feeError } = ids.length
        ? await (supabase as any).from('zleti_marketplace_fees').select('*').in('marketplace_id', ids).order('sort_order').order('created_at')
        : { data: [], error: null };
      if (feeError) throw feeError;

      return (marketplaceRows || []).map((row: any) => ({
        ...row,
        currency: row.currency as MarketplaceCurrency,
        exchange_rate: Number(row.exchange_rate || 1),
        target_profit_per_unit: Number(row.target_profit_per_unit ?? 50),
        fees: (feeRows || []).filter((fee: any) => fee.marketplace_id === row.id).map((fee: any) => ({
          ...fee,
          value: Number(fee.value || 0),
          fee_type: fee.fee_type as FeeType,
          apply_to: fee.apply_to as FeeApplyTo,
        })),
      }));
    },
  });

  useEffect(() => {
    if (!marketplaces.length) {
      setSelectedMarketplaceId('');
      setMarketplaceDraft(null);
      return;
    }
    const active = marketplaces.find(marketplace => marketplace.id === selectedMarketplaceId) || marketplaces[0];
    setSelectedMarketplaceId(active.id);
    setMarketplaceDraft(active);
  }, [marketplaces, selectedMarketplaceId]);

  const savedEstimate = useMemo(() => {
    const metadata = selectedPo?.po?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    return (metadata as Record<string, any>).zleti_shipping_estimate ?? null;
  }, [selectedPo]);

  useEffect(() => {
    if (!savedEstimate) return;

    setShippingEstimateRateInput(String(savedEstimate.rate_value ?? DEFAULT_RATE));
    setShippingEstimateRateMode(savedEstimate.rate_mode === 'g' ? 'g' : 'kg');
    setShippingEstimateExtraExpensesInput(String(savedEstimate.extra_expenses ?? 0));
    setSuggestedProfitInput(String(savedEstimate.marketplace?.suggested_profit_per_unit ?? 50));
    if (typeof savedEstimate.use_volumetric === 'boolean') setUseVolumetric(savedEstimate.use_volumetric);
    if (savedEstimate.volumetric_divisor) setVolumetricDivisorInput(String(savedEstimate.volumetric_divisor));
    if (savedEstimate.marketplace?.id && marketplaces.some(marketplace => marketplace.id === savedEstimate.marketplace.id)) {
      setSelectedMarketplaceId(savedEstimate.marketplace.id);
    }
  }, [marketplaces, savedEstimate]);

  const shippingConfig: ShippingConfig = useMemo(() => ({
    rate: Number(shippingEstimateRateInput || 0),
    rateMode: shippingEstimateRateMode,
    extraExpenses: Number(shippingEstimateExtraExpensesInput || 0),
    volumetricDivisor: Number(volumetricDivisorInput || DEFAULT_VOLUMETRIC_DIVISOR) || DEFAULT_VOLUMETRIC_DIVISOR,
    useVolumetric,
  }), [shippingEstimateExtraExpensesInput, shippingEstimateRateInput, shippingEstimateRateMode, useVolumetric, volumetricDivisorInput]);

  const estimateItems: EstimateItemInput[] = useMemo(
    () => (selectedPo?.items || []).map((item: any) => ({
      ...item,
      quantity: Number(item.quantity || 0),
      unit_cost: Number(item.unit_cost || 0),
      weight_kg: Number(item.weight_kg || 0),
    })),
    [selectedPo]
  );

  const shippingTotals = useMemo(() => computeShippingTotals(estimateItems, shippingConfig), [estimateItems, shippingConfig]);
  const estimateLines = useMemo(
    () => computeEstimateLines(estimateItems, shippingConfig, shippingTotals),
    [estimateItems, shippingConfig, shippingTotals]
  );

  const marketplaceTotals = useMemo(() => getMarketplaceFeeTotals(marketplaceDraft), [marketplaceDraft]);

  const detailMarketplaces = useMemo(
    () => (marketplaceDraft
      ? marketplaces.map(marketplace => (marketplace.id === marketplaceDraft.id ? marketplaceDraft : marketplace))
      : marketplaces),
    [marketplaces, marketplaceDraft]
  );

  /** Every line priced against every marketplace — powers the comparison table. */
  const pricedLines = useMemo(
    () => estimateLines.map(line => ({
      line,
      pricing: detailMarketplaces.map(marketplace =>
        priceForMarketplace(line.landedUnitCost, marketplace, Number(suggestedProfitInput || 0))
      ),
    })),
    [detailMarketplaces, estimateLines, suggestedProfitInput]
  );

  const activePricingFor = (index: number) => {
    const entry = pricedLines[index];
    if (!entry) return null;
    return entry.pricing.find(pricing => pricing.marketplaceId === marketplaceDraft?.id) || entry.pricing[0] || null;
  };

  const totalLandedCost = useMemo(
    () => estimateLines.reduce((sum, line) => sum + line.lineLandedCost, 0),
    [estimateLines]
  );

  const selectedDetailMarketplace = useMemo(
    () => detailMarketplaces.find(marketplace => marketplace.id === selectedDetailMarketplaceId) || marketplaceDraft || detailMarketplaces[0] || null,
    [detailMarketplaces, marketplaceDraft, selectedDetailMarketplaceId]
  );

  const selectedDetailCalculation = useMemo(() => {
    if (!selectedDetailItem || !selectedDetailMarketplace) return null;
    const pricing = priceForMarketplace(selectedDetailItem.landedUnitCost, selectedDetailMarketplace, Number(suggestedProfitInput || 0));
    return { ...selectedDetailItem, marketplace: selectedDetailMarketplace, ...pricing };
  }, [selectedDetailItem, selectedDetailMarketplace, suggestedProfitInput]);

  const updateMarketplaceDraft = (changes: Partial<Marketplace>) => {
    setMarketplaceDraft(current => (current ? { ...current, ...changes } : current));
  };

  const updateMarketplaceFee = (feeId: string, changes: Partial<MarketplaceFee>) => {
    setMarketplaceDraft(current => (current ? {
      ...current,
      fees: current.fees.map(fee => (fee.id === feeId ? { ...fee, ...changes } : fee)),
    } : current));
  };

  const addMarketplace = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zleti_marketplaces')
        .insert({ name: 'Mercado Libre', currency: 'MXN', exchange_rate: 18, target_profit_per_unit: 50, sort_order: marketplaces.length })
        .select('*')
        .single();
      if (error) throw error;
      const fees = createMercadoLibreFees().map((fee, index) => ({
        marketplace_id: data.id,
        name: fee.name,
        fee_type: fee.fee_type,
        value: fee.value,
        apply_to: fee.apply_to,
        sort_order: index,
      }));
      const { error: feesError } = await (supabase as any).from('zleti_marketplace_fees').insert(fees);
      if (feesError) throw feesError;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['zleti-marketplaces-pricing'] });
      setSelectedMarketplaceId(data.id);
      toast.success('Marketplace agregado');
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo agregar el marketplace'),
  });

  const deleteMarketplace = useMutation({
    mutationFn: async () => {
      if (!marketplaceDraft) return;
      const { error } = await (supabase as any).from('zleti_marketplaces').delete().eq('id', marketplaceDraft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedMarketplaceId('');
      setMarketplaceDraft(null);
      queryClient.invalidateQueries({ queryKey: ['zleti-marketplaces-pricing'] });
      toast.success('Marketplace eliminado');
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo eliminar el marketplace'),
  });

  const cloneMarketplace = useMutation({
    mutationFn: async () => {
      if (!marketplaceDraft) throw new Error('Selecciona un marketplace');
      const { data, error } = await (supabase as any)
        .from('zleti_marketplaces')
        .insert({
          name: `${marketplaceDraft.name} (copia)`,
          currency: marketplaceDraft.currency,
          exchange_rate: Number(marketplaceDraft.exchange_rate) || 1,
          target_profit_per_unit: Number(marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput) || 0,
          sort_order: marketplaces.length,
        })
        .select('*')
        .single();
      if (error) throw error;

      const fees = marketplaceDraft.fees.map((fee, index) => ({
        marketplace_id: data.id,
        name: fee.name,
        fee_type: fee.fee_type,
        value: Number(fee.value) || 0,
        apply_to: fee.apply_to,
        sort_order: index,
      }));
      if (fees.length) {
        const { error: feesError } = await (supabase as any).from('zleti_marketplace_fees').insert(fees);
        if (feesError) throw feesError;
      }
      return data;
    },
    onSuccess: (data) => {
      setSelectedMarketplaceId(data.id);
      queryClient.invalidateQueries({ queryKey: ['zleti-marketplaces-pricing'] });
      toast.success('Configuración clonada');
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo clonar la configuración'),
  });

  const persistMarketplaceConfiguration = async () => {
    if (!marketplaceDraft) throw new Error('Selecciona un marketplace');
    if (!marketplaceDraft.name.trim()) throw new Error('El marketplace debe tener un nombre');
    if (marketplaceTotals.percentageSalePrice >= 100) {
      throw new Error('La suma de cargos sobre precio de venta debe ser menor al 100%');
    }

    const { error: marketplaceError } = await (supabase as any)
      .from('zleti_marketplaces')
      .update({
        name: marketplaceDraft.name.trim(),
        currency: marketplaceDraft.currency,
        exchange_rate: Number(marketplaceDraft.exchange_rate) || 1,
        target_profit_per_unit: Number(marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', marketplaceDraft.id);
    if (marketplaceError) throw marketplaceError;

    const { error: deleteFeesError } = await (supabase as any)
      .from('zleti_marketplace_fees')
      .delete()
      .eq('marketplace_id', marketplaceDraft.id);
    if (deleteFeesError) throw deleteFeesError;

    const fees = marketplaceDraft.fees
      .filter(fee => fee.name.trim() || Number(fee.value) > 0)
      .map((fee, index) => ({
        marketplace_id: marketplaceDraft.id,
        name: fee.name.trim() || `Cargo ${index + 1}`,
        fee_type: fee.fee_type,
        value: Number(fee.value) || 0,
        apply_to: fee.apply_to,
        sort_order: index,
      }));

    if (fees.length) {
      const { error: feesError } = await (supabase as any).from('zleti_marketplace_fees').insert(fees);
      if (feesError) throw feesError;
    }
  };

  const saveShippingEstimateToPo = useMutation({
    mutationFn: async () => {
      if (!poId || !selectedPo) throw new Error('No hay un PO seleccionado para guardar la estimación.');
      await persistMarketplaceConfiguration();

      const existingMetadata = selectedPo?.po?.metadata && typeof selectedPo.po.metadata === 'object' && !Array.isArray(selectedPo.po.metadata)
        ? (selectedPo.po.metadata as Record<string, any>)
        : {};

      const estimatePayload = {
        source: 'zleti_logistics_estimate',
        generated_at: new Date().toISOString(),
        po_number: selectedPo.po.po_number || null,
        total_weight_kg: Number(shippingTotals.totalRealWeightKg || 0),
        total_volumetric_weight_kg: Number(shippingTotals.totalVolumetricWeightKg || 0),
        total_chargeable_weight_kg: Number(shippingTotals.totalChargeableWeightKg || 0),
        total_volume_cm3: Number(shippingTotals.totalVolumeCm3 || 0),
        use_volumetric: useVolumetric,
        volumetric_divisor: shippingConfig.volumetricDivisor,
        rate_value: shippingConfig.rate,
        rate_mode: shippingEstimateRateMode,
        shipping_cost: Number(shippingTotals.shippingCost || 0),
        extra_expenses: Number(shippingTotals.extraExpenses || 0),
        total_estimate: Number(shippingTotals.totalEstimate || 0),
        item_count: estimateItems.length,
        marketplace: marketplaceDraft ? {
          id: marketplaceDraft.id,
          name: marketplaceDraft.name,
          currency: marketplaceDraft.currency,
          exchange_rate: Number(marketplaceDraft.exchange_rate || 1),
          target_profit_per_unit: Number(marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput ?? 0),
          suggested_profit_per_unit: Number(marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput ?? 0),
          fees: marketplaceDraft.fees,
        } : null,
        item_breakdown: pricedLines.map(({ line, pricing }) => ({
          product_id: line.item.product_id,
          variant_id: line.item.variant_id || null,
          quantity: line.quantity,
          weight_kg: line.unitWeightKg,
          volumetric_weight_kg: line.unitVolumetricWeightKg,
          chargeable_weight_kg: line.unitChargeableWeightKg,
          volume_cm3: line.unitVolumeCm3,
          shipping_total: line.lineShippingTotal,
          shipping_per_unit: line.shippingPerUnit,
          landed_unit_cost: line.landedUnitCost,
          marketplace_pricing: pricing.map(entry => ({
            marketplace_id: entry.marketplaceId,
            marketplace_name: entry.marketplaceName,
            currency: entry.currency,
            suggested_sale_price: entry.suggestedSalePrice,
            net_profit: entry.netProfit,
            margin_percent: entry.marginPercent,
          })),
        })),
      };

      const { error } = await (supabase as any)
        .from('master_purchase_orders')
        .update({
          metadata: { ...existingMetadata, zleti_shipping_estimate: estimatePayload },
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId);

      if (error) throw error;
      return estimatePayload;
    },
    onSuccess: async () => {
      setConfigOpen(false);
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history'] });
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history-detail', poId] });
      toast.success('Estimación guardada en la base de datos', {
        description: `La estimación de envío para ${selectedPo?.po?.po_number || 'el PO'} quedó guardada y disponible para consulta.`,
      });
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo guardar la estimación del envío'),
  });

  const buildPriceSheet = (): { rows: PriceSheetRow[]; meta: Parameters<typeof exportPriceSheetToExcel>[1] } => {
    const rows: PriceSheetRow[] = pricedLines.flatMap(({ line, pricing }) =>
      pricing.map(entry => ({
        sku: line.item.sku || '',
        productName: line.item.product_name || '',
        variantName: line.item.variant_name || '',
        quantity: line.quantity,
        unitWeightKg: line.unitWeightKg,
        volumetricWeightKg: line.unitVolumetricWeightKg,
        chargeableWeightKg: line.unitChargeableWeightKg,
        volumeCm3: line.unitVolumeCm3,
        productCostUsd: line.productCostUsd,
        shippingPerUnitUsd: line.shippingPerUnit,
        landedUnitCostUsd: line.landedUnitCost,
        marketplaceName: entry.marketplaceName,
        currency: entry.currency,
        suggestedSalePrice: entry.suggestedSalePrice,
        netProfit: entry.netProfit,
        marginPercent: entry.marginPercent,
      }))
    );

    return {
      rows,
      meta: {
        poNumber: selectedPo?.po?.po_number || 'zleti',
        generatedAt: new Date(),
        rateLabel: `${formatMoney(shippingConfig.rate, 'USD')} / ${shippingEstimateRateMode}${useVolumetric ? ` · volumétrico 1:${shippingConfig.volumetricDivisor}` : ''}`,
        totalChargeableWeightKg: shippingTotals.totalChargeableWeightKg,
        shippingCostUsd: shippingTotals.shippingCost,
        extraExpensesUsd: shippingTotals.extraExpenses,
        totalEstimateUsd: shippingTotals.totalEstimate,
      },
    };
  };

  const handleExportExcel = () => {
    const { rows, meta } = buildPriceSheet();
    if (!rows.length) return toast.error('No hay productos para exportar');
    exportPriceSheetToExcel(rows, meta);
    toast.success('Hoja de precios exportada a Excel');
  };

  const handleExportPdf = () => {
    const { rows, meta } = buildPriceSheet();
    if (!rows.length) return toast.error('No hay productos para exportar');
    exportPriceSheetToPdf(rows, meta);
    toast.success('Hoja de precios exportada a PDF');
  };

  const missingDimensions = estimateLines.filter(line => line.unitVolumeCm3 <= 0).length;

  return (
    <AdminLayout
      title="Estimación de envío ZleTI"
      headerActions={(
        <Button variant="outline" onClick={() => navigate('/admin/logistica-zleti')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver al módulo
        </Button>
      )}
    >
      <div className="space-y-4 p-4 sm:p-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">Cargando PO...</CardContent>
          </Card>
        ) : !selectedPo ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">No se encontró el PO solicitado.</CardContent>
          </Card>
        ) : (
          <>
            {/* Barra fija de resultados */}
            <div className="sticky top-0 z-30 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Peso facturable</p>
                    <p className="text-lg font-bold">{shippingTotals.totalChargeableWeightKg.toFixed(2)} kg</p>
                    <p className="text-[11px] text-muted-foreground">
                      real {shippingTotals.totalRealWeightKg.toFixed(2)} · vol. {shippingTotals.totalVolumetricWeightKg.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Envío</p>
                    <p className="text-lg font-bold text-primary">{formatMoney(shippingTotals.shippingCost, 'USD')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatMoney(shippingConfig.rate, 'USD')}/{shippingEstimateRateMode}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total estimado</p>
                    <p className="text-lg font-bold">{formatMoney(shippingTotals.totalEstimate, 'USD')}</p>
                    <p className="text-[11px] text-muted-foreground">+ gastos {formatMoney(shippingTotals.extraExpenses, 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Costo aterrizado PO</p>
                    <p className="text-lg font-bold">{formatMoney(totalLandedCost, 'USD')}</p>
                    <p className="text-[11px] text-muted-foreground">{marketplaceDraft ? `${marketplaceDraft.name} · ${marketplaceDraft.currency}` : 'Sin canal'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
                    <FileDown className="h-4 w-4" /> PDF
                  </Button>
                  <Sheet open={configOpen} onOpenChange={setConfigOpen}>
                    <SheetTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-2">
                        <Settings2 className="h-4 w-4" /> Configuración
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
                      <SheetHeader>
                        <SheetTitle>Configuración del cálculo</SheetTitle>
                        <SheetDescription>
                          Cada cambio recalcula al instante los precios de la hoja. PO {selectedPo.po.po_number || 'sin número'}.
                        </SheetDescription>
                      </SheetHeader>

                      <div className="mt-5 space-y-5">
                        <div className="space-y-3 rounded-lg border p-4">
                          <p className="text-sm font-semibold">Envío internacional</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Tipo de tarifa</Label>
                              <Select value={shippingEstimateRateMode} onValueChange={value => setShippingEstimateRateMode(value as 'kg' | 'g')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="kg">Por kg</SelectItem>
                                  <SelectItem value="g">Por g</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Costo transportista (USD/{shippingEstimateRateMode})</Label>
                              <Input type="number" min={0} step="0.01" value={shippingEstimateRateInput} onChange={event => setShippingEstimateRateInput(event.target.value)} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Gastos adicionales estimados (USD)</Label>
                              <Input type="number" min={0} step="0.01" value={shippingEstimateExtraExpensesInput} onChange={event => setShippingEstimateExtraExpensesInput(event.target.value)} />
                            </div>
                          </div>

                          <div className="flex items-center justify-between rounded-md bg-muted/40 p-3">
                            <div>
                              <p className="text-sm font-medium">Cobrar peso volumétrico</p>
                              <p className="text-xs text-muted-foreground">Usa el mayor entre peso real y volumen / divisor.</p>
                            </div>
                            <Switch checked={useVolumetric} onCheckedChange={setUseVolumetric} />
                          </div>
                          {useVolumetric && (
                            <div className="space-y-2">
                              <Label>Divisor volumétrico (cm³ por kg)</Label>
                              <Input type="number" min={1000} step="100" value={volumetricDivisorInput} onChange={event => setVolumetricDivisorInput(event.target.value)} />
                              <p className="text-xs text-muted-foreground">Aéreo estándar 5000 · consolidado 6000.</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 rounded-lg border p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">Marketplaces</p>
                            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addMarketplace.mutate()} disabled={addMarketplace.isPending}>
                              <Plus className="h-3.5 w-3.5" /> Agregar
                            </Button>
                          </div>

                          {marketplacesLoading ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Cargando marketplaces...</p>
                          ) : !marketplaceDraft ? (
                            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                              No hay marketplaces configurados. Agrega el primero para calcular precios de venta.
                            </p>
                          ) : (
                            <Tabs value={selectedMarketplaceId} onValueChange={setSelectedMarketplaceId}>
                              <div className="overflow-x-auto pb-2">
                                <TabsList className="inline-flex min-w-full justify-start">
                                  {marketplaces.map(marketplace => (
                                    <TabsTrigger key={marketplace.id} value={marketplace.id} className="whitespace-nowrap">
                                      {marketplace.name} ({marketplace.currency})
                                    </TabsTrigger>
                                  ))}
                                </TabsList>
                              </div>
                              {marketplaces.map(marketplace => (
                                <TabsContent key={marketplace.id} value={marketplace.id} className="mt-3 space-y-4">
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2 sm:col-span-2">
                                      <Label>Nombre</Label>
                                      <Input value={marketplaceDraft.name} onChange={event => updateMarketplaceDraft({ name: event.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Moneda</Label>
                                      <Select
                                        value={marketplaceDraft.currency}
                                        onValueChange={value => updateMarketplaceDraft({ currency: value as MarketplaceCurrency, exchange_rate: value === 'USD' ? 1 : marketplaceDraft.exchange_rate })}
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="USD">USD</SelectItem>
                                          <SelectItem value="MXN">MXN</SelectItem>
                                          <SelectItem value="EUR">EUR</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Tipo de cambio (1 USD)</Label>
                                      <Input type="number" min={0.000001} step="0.000001" value={marketplaceDraft.exchange_rate} disabled={marketplaceDraft.currency === 'USD'} onChange={event => updateMarketplaceDraft({ exchange_rate: Number(event.target.value) || 1 })} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Ganancia por unidad ({marketplaceDraft.currency})</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput}
                                        onChange={event => {
                                          setSuggestedProfitInput(event.target.value);
                                          updateMarketplaceDraft({ target_profit_per_unit: Number(event.target.value) || 0 });
                                        }}
                                      />
                                    </div>
                                    <div className="flex items-end gap-2">
                                      <Button type="button" variant="outline" size="icon" title="Clonar configuración" onClick={() => cloneMarketplace.mutate()} disabled={cloneMarketplace.isPending}>
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <Button type="button" variant="outline" size="icon" title="Eliminar marketplace" onClick={() => setDeleteMarketplaceDialogOpen(true)} disabled={deleteMarketplace.isPending}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="rounded-lg border p-3">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-sm font-semibold">Gastos configurables</p>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={marketplaceTotals.viable ? 'secondary' : 'destructive'}>
                                          {marketplaceTotals.percentageSalePrice.toFixed(2)}% sobre venta
                                        </Badge>
                                        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => updateMarketplaceDraft({ fees: [...marketplaceDraft.fees, createLocalFee()] })}>
                                          <Plus className="h-3.5 w-3.5" /> Cargo
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      {marketplaceDraft.fees.map(fee => (
                                        <div key={fee.id} className="grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_90px_auto]">
                                          <div className="space-y-1">
                                            <Label className="text-xs">Concepto</Label>
                                            <Input value={fee.name} onChange={event => updateMarketplaceFee(fee.id, { name: event.target.value })} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Valor</Label>
                                            <Input type="number" min={0} step="0.01" value={fee.value} onChange={event => updateMarketplaceFee(fee.id, { value: Number(event.target.value) || 0 })} />
                                          </div>
                                          <div className="flex items-end">
                                            <Button type="button" variant="ghost" size="icon" title="Eliminar cargo" onClick={() => updateMarketplaceDraft({ fees: marketplaceDraft.fees.filter(item => item.id !== fee.id) })}>
                                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Tipo</Label>
                                            <Select value={fee.fee_type} onValueChange={value => updateMarketplaceFee(fee.id, { fee_type: value as FeeType })}>
                                              <SelectTrigger><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                                                <SelectItem value="fixed">Fijo ({marketplaceDraft.currency})</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-1 sm:col-span-2">
                                            <Label className="text-xs">Aplicar sobre</Label>
                                            <Select value={fee.apply_to} disabled={fee.fee_type === 'fixed'} onValueChange={value => updateMarketplaceFee(fee.id, { apply_to: value as FeeApplyTo })}>
                                              <SelectTrigger><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="sale_price">Precio de venta</SelectItem>
                                                <SelectItem value="landed_cost">Costo aterrizado</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      ))}
                                      {!marketplaceDraft.fees.length && <p className="py-3 text-center text-xs text-muted-foreground">Sin cargos configurados.</p>}
                                    </div>
                                    {!marketplaceTotals.viable && (
                                      <p className="mt-3 text-sm font-medium text-destructive">Los cargos sobre precio de venta deben sumar menos de 100%.</p>
                                    )}
                                  </div>
                                </TabsContent>
                              ))}
                            </Tabs>
                          )}
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={() => saveShippingEstimateToPo.mutate()}
                    disabled={!poId || !marketplaceTotals.viable || saveShippingEstimateToPo.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {saveShippingEstimateToPo.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">PO {selectedPo.po.po_number || 'sin número'}</Badge>
              <span>China → México · {estimateItems.length} líneas</span>
              {savedEstimate && <Badge variant="outline">Última estimación guardada</Badge>}
              {useVolumetric && missingDimensions > 0 && (
                <Badge variant="destructive">{missingDimensions} línea(s) sin medidas: se usa solo el peso real</Badge>
              )}
            </div>

            {/* Hoja de precios por línea */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left font-medium">Producto</th>
                        <th className="p-3 text-right font-medium">Uds</th>
                        <th className="p-3 text-right font-medium">Peso real</th>
                        <th className="p-3 text-right font-medium">Volumétrico</th>
                        <th className="p-3 text-right font-medium">Facturable</th>
                        <th className="p-3 text-right font-medium">Envío/u</th>
                        <th className="p-3 text-right font-medium">Aterrizado</th>
                        <th className="p-3 text-right font-medium">Precio sugerido</th>
                        <th className="p-3 text-right font-medium">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimateLines.map((line, index) => {
                        const pricing = activePricingFor(index);
                        const item: any = line.item;
                        return (
                          <tr key={item.id || `${item.product_id}-${item.variant_id || 'base'}-${index}`} className="border-t align-top">
                            <td className="p-3">
                              <div className="flex items-start gap-3">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.product_name} className="h-10 w-10 rounded-md border bg-muted object-cover" />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">IMG</div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{item.product_name}</p>
                                  <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                                  {item.variant_name && <p className="text-xs text-muted-foreground">{item.variant_name}</p>}
                                  <p className="text-[11px] text-muted-foreground">
                                    {line.unitVolumeCm3 > 0
                                      ? `${item.length_cm}×${item.width_cm}×${item.height_cm} cm · ${line.unitVolumeCm3.toFixed(0)} cm³`
                                      : 'Sin medidas registradas'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right">{line.quantity}</td>
                            <td className="p-3 text-right">{line.unitWeightKg.toFixed(3)} kg</td>
                            <td className="p-3 text-right text-muted-foreground">{line.unitVolumetricWeightKg.toFixed(3)} kg</td>
                            <td className="p-3 text-right font-medium">{line.unitChargeableWeightKg.toFixed(3)} kg</td>
                            <td className="p-3 text-right text-primary">{formatMoney(line.shippingPerUnit, 'USD')}</td>
                            <td className="p-3 text-right font-semibold">{formatMoney(line.landedUnitCost, 'USD')}</td>
                            <td className="p-3 text-right">
                              <div className="font-bold">{pricing ? formatMoneyWithCode(pricing.suggestedSalePrice, pricing.currency) : '—'}</div>
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-xs"
                                onClick={() => {
                                  setSelectedDetailItem({ ...item, ...line, landedUnitCost: line.landedUnitCost, productCostUsd: line.productCostUsd, shippingCostUsd: line.shippingPerUnit });
                                  setSelectedDetailMarketplaceId(marketplaceDraft?.id || detailMarketplaces[0]?.id || '');
                                }}
                              >
                                Ver deducciones
                              </Button>
                            </td>
                            <td className="p-3 text-right">
                              {pricing ? (
                                <>
                                  <div className="font-semibold">{pricing.marginPercent.toFixed(1)}%</div>
                                  <div className="text-xs text-muted-foreground">{formatMoney(pricing.netProfit, pricing.currency)}</div>
                                </>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {!estimateLines.length && (
                        <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Este PO no tiene productos.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Comparación por marketplace */}
            {detailMarketplaces.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="flex flex-col gap-1 p-4 sm:p-5">
                    <p className="text-sm font-semibold">Comparación por marketplace</p>
                    <p className="text-xs text-muted-foreground">Precio sugerido, ganancia neta y margen de cada canal para decidir dónde publicar cada producto.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left font-medium">Producto</th>
                          {detailMarketplaces.map(marketplace => (
                            <th key={marketplace.id} className="p-3 text-right font-medium">{marketplace.name} ({marketplace.currency})</th>
                          ))}
                          <th className="p-3 text-right font-medium">Mejor canal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricedLines.map(({ line, pricing }, index) => {
                          const best = pricing.reduce((top, entry) => (entry.marginPercent > (top?.marginPercent ?? -Infinity) ? entry : top), pricing[0]);
                          const item: any = line.item;
                          return (
                            <tr key={item.id || `cmp-${index}`} className="border-t">
                              <td className="p-3">
                                <p className="truncate font-medium">{item.product_name}</p>
                                <p className="font-mono text-xs text-muted-foreground">{item.sku}{item.variant_name ? ` · ${item.variant_name}` : ''}</p>
                              </td>
                              {pricing.map(entry => (
                                <td key={entry.marketplaceId} className={`p-3 text-right ${best && entry.marketplaceId === best.marketplaceId ? 'bg-primary/5' : ''}`}>
                                  <div className="font-semibold">{formatMoney(entry.suggestedSalePrice, entry.currency)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatMoney(entry.netProfit, entry.currency)} · {entry.marginPercent.toFixed(1)}%
                                  </div>
                                </td>
                              ))}
                              <td className="p-3 text-right">
                                {best ? <Badge variant="secondary">{best.marketplaceName}</Badge> : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
              <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                El <strong>peso facturable</strong> es el mayor entre el peso real y el volumétrico (largo × ancho × alto ÷ {shippingConfig.volumetricDivisor}).
                El envío se reparte entre líneas según ese peso, y el precio sugerido garantiza la ganancia configurada después de todos los cargos del canal.
              </p>
            </div>

            <Dialog open={!!selectedDetailItem} onOpenChange={open => !open && setSelectedDetailItem(null)}>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Detalle de deducciones</DialogTitle>
                  <DialogDescription>
                    {selectedDetailCalculation?.product_name} · {selectedDetailCalculation?.marketplace.name} ({selectedDetailCalculation?.marketplace.currency}) · TC: 1 USD = {Number(selectedDetailCalculation?.marketplace.exchange_rate || 1).toFixed(2)}
                  </DialogDescription>
                </DialogHeader>
                {selectedDetailCalculation && (
                  <div className="space-y-3 text-sm">
                    <Tabs value={selectedDetailMarketplaceId || selectedDetailCalculation.marketplace.id} onValueChange={setSelectedDetailMarketplaceId}>
                      <div className="overflow-x-auto pb-2">
                        <TabsList className="inline-flex min-w-full justify-start">
                          {detailMarketplaces.map(marketplace => (
                            <TabsTrigger key={marketplace.id} value={marketplace.id} className="whitespace-nowrap">
                              {marketplace.name} ({marketplace.currency})
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                    </Tabs>

                    <div className="rounded-lg border p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Costo aterrizado (USD)</p>
                      <div className="space-y-2">
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Costo de producto (unitario)</span><span className="font-semibold">{formatMoneyWithCode(selectedDetailCalculation.productCostUsd, 'USD')}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">(+) Envío internacional (unitario)</span><span className="font-semibold">+{formatMoneyWithCode(selectedDetailCalculation.shippingCostUsd, 'USD')}</span></div>
                        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                          <span>Peso facturable usado</span>
                          <span>{Number(selectedDetailCalculation.unitChargeableWeightKg || 0).toFixed(3)} kg (real {Number(selectedDetailCalculation.unitWeightKg || 0).toFixed(3)} · vol. {Number(selectedDetailCalculation.unitVolumetricWeightKg || 0).toFixed(3)})</span>
                        </div>
                        <div className="flex justify-between gap-3 border-t pt-2"><span className="font-semibold">(=) Costo aterrizado</span><span className="font-bold">{formatMoneyWithCode(selectedDetailCalculation.landedUnitCost, 'USD')}</span></div>
                        <div className="flex justify-between gap-3 text-primary"><span>En moneda local</span><span className="font-bold">{formatMoneyWithCode(selectedDetailCalculation.landedUnitCostInCurrency, selectedDetailCalculation.marketplace.currency)}</span></div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Deducciones del canal ({selectedDetailCalculation.marketplace.currency})</p>
                      <div className="space-y-2">
                        {selectedDetailCalculation.feeBreakdown.map((fee: any) => (
                          <div key={fee.id} className="flex justify-between gap-3">
                            <span className="text-muted-foreground">
                              (-) {fee.name} ({fee.fee_type === 'percentage' ? `${Number(fee.value).toFixed(2)}% sobre ${fee.apply_to === 'landed_cost' ? 'costo aterrizado' : 'precio de venta'}` : 'fijo'})
                            </span>
                            <span className="font-medium text-destructive">-{formatMoneyWithCode(fee.amount, selectedDetailCalculation.marketplace.currency)}</span>
                          </div>
                        ))}
                        {!selectedDetailCalculation.feeBreakdown.length && <p className="text-xs text-muted-foreground">Sin deducciones configuradas.</p>}
                        <div className="flex justify-between gap-3 border-t pt-2"><span className="font-semibold">(=) Total deducciones</span><span className="font-bold text-destructive">-{formatMoneyWithCode(selectedDetailCalculation.totalDeductions, selectedDetailCalculation.marketplace.currency)}</span></div>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">3. Conciliación final ({selectedDetailCalculation.marketplace.currency})</p>
                      <div className="space-y-2 font-mono text-sm">
                        <div className="flex justify-between gap-3"><span>Costo aterrizado</span><span>{formatMoneyWithCode(selectedDetailCalculation.landedUnitCostInCurrency, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3"><span>+ Cargos del canal</span><span>{formatMoneyWithCode(selectedDetailCalculation.totalDeductions, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3"><span>+ Ganancia deseada</span><span>{formatMoneyWithCode(selectedDetailCalculation.desiredProfit, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3 border-t pt-2 text-base font-bold"><span>= Precio de venta sugerido</span><span>{formatMoneyWithCode(selectedDetailCalculation.suggestedSalePrice, selectedDetailCalculation.marketplace.currency)}</span></div>
                      </div>
                      <div className="mt-4 space-y-2 border-t pt-3 text-sm">
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Ingreso neto recibido</span><span className="font-semibold">{formatMoneyWithCode(selectedDetailCalculation.netReceived, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3 rounded-md bg-primary/5 p-2"><span className="font-semibold">Ganancia neta · margen</span><span className="font-bold">{formatMoneyWithCode(selectedDetailCalculation.netProfit, selectedDetailCalculation.marketplace.currency)} · {selectedDetailCalculation.marginPercent.toFixed(1)}%</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <AlertDialog open={deleteMarketplaceDialogOpen} onOpenChange={setDeleteMarketplaceDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este marketplace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará {marketplaceDraft?.name} junto con todos sus cargos configurados. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { setDeleteMarketplaceDialogOpen(false); deleteMarketplace.mutate(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
