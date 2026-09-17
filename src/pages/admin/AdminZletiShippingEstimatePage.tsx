import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, ChevronDown, ChevronUp, Copy, Plus, Save, Trash2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_RATE = '0.50';

type MarketplaceCurrency = 'USD' | 'MXN' | 'EUR';
type FeeType = 'percentage' | 'fixed';
type FeeApplyTo = 'sale_price' | 'landed_cost';

interface MarketplaceFee {
  id: string;
  marketplace_id?: string;
  name: string;
  fee_type: FeeType;
  value: number;
  apply_to: FeeApplyTo;
  sort_order: number;
}

interface Marketplace {
  id: string;
  name: string;
  currency: MarketplaceCurrency;
  exchange_rate: number;
  target_profit_per_unit?: number;
  is_active: boolean;
  sort_order: number;
  fees: MarketplaceFee[];
}

const createLocalFee = (): MarketplaceFee => ({
  id: `local-fee-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: 'Nuevo cargo',
  fee_type: 'percentage',
  value: 0,
  apply_to: 'sale_price',
  sort_order: 0,
});

interface ExtraExpense {
  id: string;
  name: string;
  amount: number;
}

const createExtraExpense = (name = '', amount = 0): ExtraExpense => ({
  id: `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name,
  amount,
});

const createMercadoLibreFees = (): MarketplaceFee[] => [
  { id: `local-fee-ml-premium-${Date.now()}`, name: 'Comisión Publicación Premium', fee_type: 'percentage', value: 19.5, apply_to: 'sale_price', sort_order: 0 },
  { id: `local-fee-ml-isr-${Date.now()}`, name: 'Retención ISR', fee_type: 'percentage', value: 2.5, apply_to: 'sale_price', sort_order: 1 },
  { id: `local-fee-ml-iva-${Date.now()}`, name: 'Retención IVA', fee_type: 'percentage', value: 8, apply_to: 'sale_price', sort_order: 2 },
];

export default function AdminZletiShippingEstimatePage() {
  const navigate = useNavigate();
  const { poId } = useParams();
  const queryClient = useQueryClient();

  const [shippingEstimateRateInput, setShippingEstimateRateInput] = useState<string>(DEFAULT_RATE);
  const [shippingEstimateRateMode, setShippingEstimateRateMode] = useState<'kg' | 'g'>('kg');
  const [extraExpenses, setExtraExpenses] = useState<ExtraExpense[]>([]);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [marketplaceDraft, setMarketplaceDraft] = useState<Marketplace | null>(null);
  const [suggestedProfitInput, setSuggestedProfitInput] = useState<string>('50');
  const [deleteMarketplaceDialogOpen, setDeleteMarketplaceDialogOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [selectedDetailMarketplaceId, setSelectedDetailMarketplaceId] = useState<string>('');
  const [marketplaceConfigExpanded, setMarketplaceConfigExpanded] = useState(true);
  const [shippingConfigExpanded, setShippingConfigExpanded] = useState(true);

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
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, peso_kg, weight_kg, peso_g, weight_g')
          .in('id', productIds);

        if (productsError) throw productsError;
        productsById = new Map((products || []).map((product: any) => [product.id, product]));
      }

      if (variantIds.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('id, product_id, peso_kg, weight_kg, peso_g, weight_g')
          .in('id', variantIds);

        if (variantsError) throw variantsError;
        variantsById = new Map((variants || []).map((variant: any) => [variant.id, variant]));
      }

      const normalizedItems = (items || []).map((item: any) => ({
        ...item,
        weight_kg: Number(
          variantsById.get(item.variant_id)?.weight_kg ||
          variantsById.get(item.variant_id)?.peso_kg ||
          (Number(variantsById.get(item.variant_id)?.weight_g || variantsById.get(item.variant_id)?.peso_g || 0) / 1000) ||
          productsById.get(item.product_id)?.weight_kg ||
          productsById.get(item.product_id)?.peso_kg ||
          (Number(productsById.get(item.product_id)?.weight_g || productsById.get(item.product_id)?.peso_g || 0) / 1000) ||
          0
        ),
      }));

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
          apply_to: fee.fee_type === 'percentage' ? 'sale_price' : fee.apply_to as FeeApplyTo,
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

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    return (metadata as Record<string, any>).zleti_shipping_estimate ?? null;
  }, [selectedPo]);

  useEffect(() => {
    if (!savedEstimate) {
      return;
    }

    setShippingEstimateRateInput(String(savedEstimate.rate_value ?? DEFAULT_RATE));
    setShippingEstimateRateMode(savedEstimate.rate_mode === 'g' ? 'g' : 'kg');
    const savedItems = Array.isArray(savedEstimate.extra_expense_items) ? savedEstimate.extra_expense_items : null;
    if (savedItems) {
      setExtraExpenses(savedItems.map((expense: any) => createExtraExpense(String(expense?.name || ''), Number(expense?.amount || 0))));
    } else if (Number(savedEstimate.extra_expenses || 0) > 0) {
      setExtraExpenses([createExtraExpense('Gastos adicionales', Number(savedEstimate.extra_expenses || 0))]);
    }
    setSuggestedProfitInput(String(savedEstimate.marketplace?.suggested_profit_per_unit ?? 50));
    if (savedEstimate.marketplace?.id && marketplaces.some(marketplace => marketplace.id === savedEstimate.marketplace.id)) {
      setSelectedMarketplaceId(savedEstimate.marketplace.id);
    }
  }, [marketplaces, savedEstimate]);

  const totalWeightKg = useMemo(
    () => (selectedPo?.items || []).reduce((sum, item) => sum + Number(item.weight_kg || 0) * Number(item.quantity || 0), 0),
    [selectedPo]
  );

  const transportRateForShippingEstimate = Number(shippingEstimateRateInput || 0);
  const shippingCost = shippingEstimateRateMode === 'kg'
    ? totalWeightKg * transportRateForShippingEstimate
    : totalWeightKg * 1000 * transportRateForShippingEstimate;

  const shippingEstimateExtraExpenses = extraExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const shippingEstimateTotal = shippingCost + shippingEstimateExtraExpenses;

  const marketplaceTotals = useMemo(() => {
    const marketplace = marketplaceDraft;
    const fees = marketplace?.fees || [];
    const onSale = fees.filter(fee => fee.apply_to !== 'landed_cost');
    const onLanded = fees.filter(fee => fee.apply_to === 'landed_cost');
    const percentageSalePrice = onSale
      .filter(fee => fee.fee_type === 'percentage')
      .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
    const fixedFees = onSale
      .filter(fee => fee.fee_type === 'fixed')
      .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
    const percentageLandedCost = onLanded
      .filter(fee => fee.fee_type === 'percentage')
      .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
    const fixedLandedCost = onLanded
      .filter(fee => fee.fee_type === 'fixed')
      .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
    const denominator = 1 - percentageSalePrice / 100;
    const viable = percentageSalePrice < 100;

    return { percentageSalePrice, fixedFees, percentageLandedCost, fixedLandedCost, denominator, viable };
  }, [marketplaceDraft]);

  const itemShippingBreakdown = useMemo(() => {
    const items = selectedPo?.items || [];
    const totalWeight = items.reduce(
      (sum, item) => sum + Number(item.weight_kg || 0) * Number(item.quantity || 0),
      0
    );
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const allocationBase = totalWeight > 0 ? totalWeight : totalQuantity;

    return items.map((item: any) => {
      const quantity = Math.max(0, Number(item.quantity || 0));
      const unitWeightKg = Math.max(0, Number(item.weight_kg || 0));
      const itemWeightKg = unitWeightKg * quantity;
      const allocationWeight = totalWeight > 0 ? itemWeightKg : quantity;
      const allocationShare = allocationBase > 0 ? allocationWeight / allocationBase : 0;
      const itemShippingTotal = shippingEstimateTotal * allocationShare;
      const shippingPerUnit = quantity > 0 ? itemShippingTotal / quantity : 0;
      const productCostUsd = Number(item.unit_cost || 0);
      const shippingCostUsd = shippingPerUnit;
      const landedUnitCost = productCostUsd + shippingCostUsd;
      const currency = marketplaceDraft?.currency || 'USD';
      const exchangeRate = Number(marketplaceDraft?.exchange_rate || 1);
      const landedUnitCostInCurrency = landedUnitCost * exchangeRate;
      const desiredProfit = Number((marketplaceDraft?.target_profit_per_unit ?? suggestedProfitInput) || 0);
      const suggestedSalePrice = marketplaceTotals.viable
        ? (landedUnitCostInCurrency + desiredProfit + marketplaceTotals.fixedFees) / marketplaceTotals.denominator
        : 0;
      const feeBreakdown = (marketplaceDraft?.fees || []).map(fee => {
        const amount = fee.fee_type === 'fixed'
          ? Number(fee.value || 0)
          : suggestedSalePrice * Number(fee.value || 0) / 100;

        return { ...fee, amount };
      });
      const totalDeductions = feeBreakdown.reduce((sum, fee) => sum + fee.amount, 0);
      const netReceived = suggestedSalePrice - totalDeductions;
      const netProfit = netReceived - landedUnitCostInCurrency;

      return {
        ...item,
        unitWeightKg,
        itemWeightKg,
        allocationShare,
        itemShippingTotal,
        shippingPerUnit,
        productCostUsd,
        shippingCostUsd,
        landedUnitCost,
        landedUnitCostInCurrency,
        suggestedSalePrice,
        feeBreakdown,
        totalDeductions,
        netReceived,
        netProfit,
      };
    });
  }, [marketplaceDraft, marketplaceTotals, selectedPo, shippingEstimateTotal, suggestedProfitInput]);

  const poTotals = useMemo(() => {
    const exchangeRate = Number(marketplaceDraft?.exchange_rate || 1);
    const currency = (marketplaceDraft?.currency || 'USD') as MarketplaceCurrency;

    const sumBy = (getter: (item: any) => number) =>
      itemShippingBreakdown.reduce(
        (sum: number, item: any) => sum + getter(item) * Number(item.quantity || 0),
        0
      );

    const supplierCostUsd = sumBy((item) => Number(item.productCostUsd || 0));
    const shippingCostUsd = sumBy((item) => Number(item.shippingCostUsd || 0));
    const landedCostUsd = sumBy((item) => Number(item.landedUnitCost || 0));
    const suggestedSaleTotal = sumBy((item) => Number(item.suggestedSalePrice || 0));
    const marketplaceDeductions = sumBy((item) => Number(item.totalDeductions || 0));

    const supplierCostInCurrency = supplierCostUsd * exchangeRate;
    const shippingCostInCurrency = shippingCostUsd * exchangeRate;
    const landedCostInCurrency = landedCostUsd * exchangeRate;
    const expectedProfit = suggestedSaleTotal - landedCostInCurrency - marketplaceDeductions;
    const marginPercent = suggestedSaleTotal > 0 ? (expectedProfit / suggestedSaleTotal) * 100 : 0;

    return {
      currency,
      exchangeRate,
      supplierCostUsd,
      supplierCostInCurrency,
      shippingCostUsd,
      shippingCostInCurrency,
      landedCostUsd,
      landedCostInCurrency,
      marketplaceDeductions,
      suggestedSaleTotal,
      expectedProfit,
      marginPercent,
    };
  }, [itemShippingBreakdown, marketplaceDraft]);

  const formattedCurrency = (amount: number, currency = marketplaceDraft?.currency || 'USD') =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const formattedCurrencyWithCode = (amount: number, currency: MarketplaceCurrency) =>
    `${formattedCurrency(amount, currency)} ${currency}`;

  const selectedDetailMarketplace = useMemo(
    () => {
      const detailMarketplaces = marketplaceDraft
        ? marketplaces.map(marketplace => marketplace.id === marketplaceDraft.id ? marketplaceDraft : marketplace)
        : marketplaces;
      return detailMarketplaces.find(marketplace => marketplace.id === selectedDetailMarketplaceId) || marketplaceDraft || detailMarketplaces[0] || null;
    },
    [marketplaces, marketplaceDraft, selectedDetailMarketplaceId]
  );

  const detailMarketplaces = useMemo(
    () => marketplaceDraft
      ? marketplaces.map(marketplace => marketplace.id === marketplaceDraft.id ? marketplaceDraft : marketplace)
      : marketplaces,
    [marketplaces, marketplaceDraft]
  );

  const selectedDetailCalculation = useMemo(() => {
    if (!selectedDetailItem || !selectedDetailMarketplace) return null;

    const marketplace = selectedDetailMarketplace;
    const fees = marketplace.fees || [];
    const percentageSalePrice = fees
      .filter(fee => fee.fee_type === 'percentage')
      .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
    const fixedFees = fees.filter(fee => fee.fee_type === 'fixed').reduce((sum, fee) => sum + Number(fee.value || 0), 0);
    const denominator = 1 - percentageSalePrice / 100;
    const viable = percentageSalePrice < 100;
    const desiredProfit = Number(marketplace.target_profit_per_unit ?? suggestedProfitInput ?? 0);
    const landedUnitCostInCurrency = selectedDetailItem.landedUnitCost * Number(marketplace.exchange_rate || 1);
    const suggestedSalePrice = viable
      ? (landedUnitCostInCurrency + desiredProfit + fixedFees) / denominator
      : 0;
    const feeBreakdown = fees.map(fee => ({
      ...fee,
      amount: fee.fee_type === 'fixed'
        ? Number(fee.value || 0)
        : suggestedSalePrice * Number(fee.value || 0) / 100,
    }));
    const totalDeductions = feeBreakdown.reduce((sum, fee) => sum + fee.amount, 0);

    return {
      ...selectedDetailItem,
      marketplace,
      desiredProfit,
      landedUnitCostInCurrency,
      suggestedSalePrice,
      feeBreakdown,
      totalDeductions,
      netReceived: suggestedSalePrice - totalDeductions,
      netProfit: suggestedSalePrice - totalDeductions - landedUnitCostInCurrency,
      viable,
    };
  }, [marketplaceDraft, marketplaces, selectedDetailItem, selectedDetailMarketplace, selectedDetailMarketplaceId, suggestedProfitInput]);

  const updateMarketplaceDraft = (changes: Partial<Marketplace>) => {
    setMarketplaceDraft(current => current ? { ...current, ...changes } : current);
  };

  const updateMarketplaceFee = (feeId: string, changes: Partial<MarketplaceFee>) => {
    setMarketplaceDraft(current => current ? {
      ...current,
      fees: current.fees.map(fee => fee.id === feeId ? { ...fee, ...changes } : fee),
    } : current);
  };

  const addMarketplace = useMutation({
    mutationFn: async () => {
      const name = 'Mercado Libre';
      const currency: MarketplaceCurrency = 'MXN';
      const { data, error } = await (supabase as any)
        .from('zleti_marketplaces')
        .insert({ name, currency, exchange_rate: 18, target_profit_per_unit: 50, sort_order: marketplaces.length })
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
      if (!poId || !selectedPo) {
        throw new Error('No hay un PO seleccionado para guardar la estimación.');
      }
      await persistMarketplaceConfiguration();

      const existingMetadata = selectedPo?.po?.metadata && typeof selectedPo.po.metadata === 'object' && !Array.isArray(selectedPo.po.metadata)
        ? (selectedPo.po.metadata as Record<string, any>)
        : {};

      const estimatePayload = {
        source: 'zleti_logistics_estimate',
        generated_at: new Date().toISOString(),
        po_number: selectedPo.po.po_number || null,
        total_weight_kg: Number(totalWeightKg || 0),
        rate_value: Number(transportRateForShippingEstimate || 0),
        rate_mode: shippingEstimateRateMode,
        shipping_cost: Number(shippingCost || 0),
        extra_expenses: Number(shippingEstimateExtraExpenses || 0),
        extra_expense_items: extraExpenses.map((expense, index) => ({
          name: expense.name.trim() || `Gasto ${index + 1}`,
          amount: Number(expense.amount || 0),
        })),
        total_estimate: Number(shippingEstimateTotal || 0),
        item_count: selectedPo.items?.length || 0,
        marketplace: marketplaceDraft ? {
          id: marketplaceDraft.id,
          name: marketplaceDraft.name,
          currency: marketplaceDraft.currency,
          exchange_rate: Number(marketplaceDraft.exchange_rate || 1),
          target_profit_per_unit: Number(marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput ?? 0),
          suggested_profit_per_unit: Number(marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput ?? 0),
          fees: marketplaceDraft.fees,
        } : null,
        item_breakdown: itemShippingBreakdown.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: Number(item.quantity || 0),
          weight_kg: Number(item.unitWeightKg || 0),
          item_weight_kg: Number(item.itemWeightKg || 0),
          shipping_total: Number(item.itemShippingTotal || 0),
          shipping_per_unit: Number(item.shippingPerUnit || 0),
          landed_unit_cost: Number(item.landedUnitCost || 0),
          landed_unit_cost_in_currency: Number(item.landedUnitCostInCurrency || 0),
          suggested_sale_price: Number(item.suggestedSalePrice || 0),
        })),
      };

      const { error } = await (supabase as any)
        .from('master_purchase_orders')
        .update({
          metadata: {
            ...existingMetadata,
            zleti_shipping_estimate: estimatePayload,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId);

      if (error) throw error;

      return estimatePayload;
    },
    onSuccess: async () => {
      setShippingConfigExpanded(false);
      setMarketplaceConfigExpanded(false);
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history'] });
      queryClient.invalidateQueries({ queryKey: ['zleti-po-history-detail', poId] });
      toast.success('Estimación guardada en la base de datos', {
        description: `La estimación de envío para ${selectedPo?.po?.po_number || 'el PO'} quedó guardada y disponible para consulta.`,
      });
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo guardar la estimación del envío'),
  });

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
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">China → México · cálculo por PO</p>
            <p className="text-sm text-muted-foreground">
              Calcula el costo estimado de envío usando el peso total registrado de los productos del PO y el costo que cobra el transportista por kg o por g.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">Guardado en base de datos</Badge>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">Cargando PO...</CardContent>
          </Card>
        ) : !selectedPo ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No se encontró el PO solicitado.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Estimación de envío internacional</p>
                    <p className="text-xs text-muted-foreground">China → México · PO {selectedPo.po.po_number || 'sin número'}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShippingConfigExpanded(current => !current)}>
                    {shippingConfigExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {shippingConfigExpanded ? 'Plegar' : 'Desplegar'}
                  </Button>
                </div>

                {!shippingConfigExpanded ? (
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="secondary">Peso total: {totalWeightKg.toFixed(2)} kg</Badge>
                      <span className="text-muted-foreground">
                        Tarifa: ${transportRateForShippingEstimate.toFixed(2)} USD/{shippingEstimateRateMode}
                      </span>
                      <span className="font-semibold text-primary">Envío est.: ${shippingEstimateTotal.toFixed(2)} USD</span>
                      {marketplaceDraft && <Badge variant="outline">{marketplaceDraft.name} · {marketplaceTotals.percentageSalePrice.toFixed(2)}% cargos</Badge>}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShippingConfigExpanded(true)}>Editar configuración</Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>PO seleccionado</Label>
                      <Input value={selectedPo.po.po_number || 'PO sin número'} readOnly />
                    </div>

                    <div className="space-y-2">
                      <Label>Peso total estimado (kg)</Label>
                      <Input type="number" value={totalWeightKg.toFixed(2)} readOnly />
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de tarifa</Label>
                      <Select value={shippingEstimateRateMode} onValueChange={(value) => setShippingEstimateRateMode(value as 'kg' | 'g')}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="kg / g" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">Por kg</SelectItem>
                          <SelectItem value="g">Por g</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Costo transportista ({shippingEstimateRateMode === 'kg' ? 'USD/kg' : 'USD/g'})</Label>
                      <Input type="number" min={0} step="0.01" value={shippingEstimateRateInput} onChange={event => setShippingEstimateRateInput(event.target.value)} />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Gastos adicionales estimados (USD)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setExtraExpenses(current => [...current, createExtraExpense()])}
                        >
                          <Plus className="h-3.5 w-3.5" /> Agregar gasto
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {extraExpenses.map(expense => (
                          <div key={expense.id} className="grid gap-2 rounded-md bg-muted/30 p-2 md:grid-cols-[1fr_160px_auto] md:items-center">
                            <Input
                              value={expense.name}
                              placeholder="Concepto (aduana, empaque, inspección...)"
                              onChange={event => setExtraExpenses(current => current.map(item => item.id === expense.id ? { ...item, name: event.target.value } : item))}
                            />
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={expense.amount}
                              onChange={event => setExtraExpenses(current => current.map(item => item.id === expense.id ? { ...item, amount: Number(event.target.value) || 0 } : item))}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Eliminar gasto"
                              onClick={() => setExtraExpenses(current => current.filter(item => item.id !== expense.id))}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                        {!extraExpenses.length && (
                          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                            Sin gastos adicionales registrados.
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total de gastos adicionales: ${shippingEstimateExtraExpenses.toFixed(2)} USD (se prorratean en el costo landed).
                      </p>
                    </div>
                  </div>
                )}

                {shippingConfigExpanded && (
                  <div className="mt-5 rounded-lg border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">Resumen del cálculo</p>
                      {savedEstimate && <Badge variant="outline">Última estimación guardada</Badge>}
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                      <div><span className="text-muted-foreground">Peso total</span><p className="font-semibold">{totalWeightKg.toFixed(2)} kg</p></div>
                      <div><span className="text-muted-foreground">Envío estimado</span><p className="font-semibold">${shippingCost.toFixed(2)} USD</p></div>
                      <div><span className="text-muted-foreground">Gastos adicionales</span><p className="font-semibold">${shippingEstimateExtraExpenses.toFixed(2)} USD</p></div>
                      <div><span className="text-muted-foreground">Total estimado</span><p className="text-lg font-bold">${shippingEstimateTotal.toFixed(2)} USD</p></div>
                      <div><span className="text-muted-foreground">Canal activo</span><p className="font-semibold">{marketplaceDraft ? `${marketplaceDraft.name} · ${marketplaceDraft.currency}` : 'Sin configurar'}</p></div>
                      <div>
                        <span className="text-muted-foreground">Costo landed total (PO)</span>
                        <p className="text-lg font-bold text-slate-800">${poTotals.landedCostUsd.toFixed(2)} USD</p>
                        {poTotals.currency !== 'USD' && (
                          <p className="text-xs text-muted-foreground">{formattedCurrencyWithCode(poTotals.landedCostInCurrency, poTotals.currency)}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Proveedor ${poTotals.supplierCostUsd.toFixed(2)} + envío/gastos ${poTotals.shippingCostUsd.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Venta total sugerida</span>
                        <p className="text-lg font-bold text-emerald-700">{formattedCurrencyWithCode(poTotals.suggestedSaleTotal, poTotals.currency)}</p>
                        <p className="text-xs text-muted-foreground">Costo landed + margen deseado</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Beneficio total esperado</span>
                        <p className={`text-lg font-bold ${poTotals.expectedProfit >= 0 ? 'text-emerald-700' : 'text-destructive'}`}>
                          {formattedCurrencyWithCode(poTotals.expectedProfit, poTotals.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {poTotals.marginPercent.toFixed(1)}% sobre la venta · comisiones {formattedCurrencyWithCode(poTotals.marketplaceDeductions, poTotals.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end border-t pt-4">
                      <Button type="button" className="gap-2" onClick={() => saveShippingEstimateToPo.mutate()} disabled={!poId || !marketplaceTotals.viable || saveShippingEstimateToPo.isPending}>
                        <Save className="h-4 w-4" />
                        {saveShippingEstimateToPo.isPending ? 'Guardando...' : 'Guardar estimación y configuración'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Configuración de marketplaces</p>
                    <p className="text-xs text-muted-foreground">Cada pestaña tiene su moneda, tipo de cambio y cargos propios.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => addMarketplace.mutate()} disabled={addMarketplace.isPending}>
                      <Plus className="h-4 w-4" /> Agregar marketplace
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setMarketplaceConfigExpanded(current => !current)}>
                      {marketplaceConfigExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {marketplaceConfigExpanded ? 'Plegar' : 'Desplegar'}
                    </Button>
                  </div>
                </div>

                {!marketplaceConfigExpanded && marketplaceDraft && (
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="secondary">{marketplaceDraft.name}</Badge>
                      <span className="text-muted-foreground">TC: 1 USD = {Number(marketplaceDraft.exchange_rate || 1).toFixed(2)} {marketplaceDraft.currency}</span>
                      <span className="text-muted-foreground">Ganancia: {formattedCurrencyWithCode(Number(suggestedProfitInput || 0), marketplaceDraft.currency)}</span>
                      <span className="text-muted-foreground">Cargos: {marketplaceTotals.percentageSalePrice.toFixed(2)}%</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setMarketplaceConfigExpanded(true)}>Editar configuración</Button>
                  </div>
                )}

                {marketplaceConfigExpanded && marketplacesLoading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Cargando marketplaces...</p>
                ) : marketplaceConfigExpanded && !marketplaceDraft ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No hay marketplaces configurados. Agrega el primero para calcular precios de venta.
                    <Button type="button" variant="outline" size="sm" className="ml-2 gap-2" onClick={() => addMarketplace.mutate()} disabled={addMarketplace.isPending}>
                      <Plus className="h-4 w-4" /> Agregar marketplace
                    </Button>
                  </div>
                ) : marketplaceConfigExpanded && marketplaceDraft ? (
                  <Tabs value={selectedMarketplaceId} onValueChange={(value) => setSelectedMarketplaceId(value)}>
                    <div className="overflow-x-auto pb-2">
                      <TabsList className="inline-flex min-w-full justify-start">
                        {marketplaces.map(marketplace => (
                          <TabsTrigger key={marketplace.id} value={marketplace.id} className="gap-2 whitespace-nowrap">
                            {marketplace.name} ({marketplace.currency})
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    {marketplaces.map(marketplace => (
                      <TabsContent key={marketplace.id} value={marketplace.id} className="mt-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Nombre del marketplace</Label>
                            <Input value={marketplaceDraft.name} onChange={event => updateMarketplaceDraft({ name: event.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Moneda de venta</Label>
                            <Select value={marketplaceDraft.currency} onValueChange={value => updateMarketplaceDraft({ currency: value as MarketplaceCurrency, exchange_rate: value === 'USD' ? 1 : marketplaceDraft.exchange_rate })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="MXN">MXN</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de cambio (1 USD = {marketplaceDraft.currency})</Label>
                            <Input type="number" min={0.000001} step="0.000001" value={marketplaceDraft.exchange_rate} disabled={marketplaceDraft.currency === 'USD'} onChange={event => updateMarketplaceDraft({ exchange_rate: Number(event.target.value) || 1 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Ganancia deseada por unidad ({marketplaceDraft.currency})</Label>
                            <Input type="number" min={0} step="0.01" value={marketplaceDraft.target_profit_per_unit ?? suggestedProfitInput} onChange={event => { const value = Number(event.target.value) || 0; setSuggestedProfitInput(event.target.value); updateMarketplaceDraft({ target_profit_per_unit: value }); }} />
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

                        <div className="mt-5 rounded-lg border p-4">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">Gastos configurables</p>
                              <p className="text-xs text-muted-foreground">Los cargos porcentuales sobre el precio deben sumar menos de 100%.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={marketplaceTotals.viable ? 'secondary' : 'destructive'}>
                                Total acumulado: {marketplaceTotals.percentageSalePrice.toFixed(2)}%
                              </Badge>
                              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => updateMarketplaceDraft({ fees: [...marketplaceDraft.fees, createLocalFee()] })}>
                              <Plus className="h-3.5 w-3.5" /> Agregar cargo
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {marketplaceDraft.fees.map(fee => (
                              <div key={fee.id} className="grid gap-2 rounded-md bg-muted/30 p-3 md:grid-cols-[1fr_120px_130px_150px_auto] md:items-end">
                                <div className="space-y-1">
                                  <Label className="text-xs">Concepto</Label>
                                  <Input value={fee.name} onChange={event => updateMarketplaceFee(fee.id, { name: event.target.value })} placeholder="Comisión de venta" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Valor</Label>
                                  <Input type="number" min={0} step="0.01" value={fee.value} onChange={event => updateMarketplaceFee(fee.id, { value: Number(event.target.value) || 0 })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Tipo</Label>
                                  <Select value={fee.fee_type} onValueChange={value => updateMarketplaceFee(fee.id, { fee_type: value as FeeType, apply_to: value === 'percentage' ? 'sale_price' : fee.apply_to })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="percentage">Porcentaje (%)</SelectItem><SelectItem value="fixed">Fijo ({marketplaceDraft.currency})</SelectItem></SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Aplicar sobre</Label>
                                  <Select value={fee.apply_to} disabled={fee.fee_type === 'percentage'} onValueChange={value => updateMarketplaceFee(fee.id, { apply_to: value as FeeApplyTo })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="sale_price">Precio de venta</SelectItem><SelectItem value="landed_cost">Costo aterrizado</SelectItem></SelectContent>
                                  </Select>
                                </div>
                                <Button type="button" variant="ghost" size="icon" title="Eliminar cargo" onClick={() => updateMarketplaceDraft({ fees: marketplaceDraft.fees.filter(item => item.id !== fee.id) })}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            ))}
                            {!marketplaceDraft.fees.length && <p className="py-3 text-center text-xs text-muted-foreground">Sin cargos configurados.</p>}
                          </div>
                          {!marketplaceTotals.viable && <p className="mt-3 text-sm font-medium text-destructive">Total percentage fees cannot be equal to or exceed 100%. Los cargos sobre precio de venta deben ser menores al 100%.</p>}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 sm:p-6">
                <p className="mb-3 text-sm font-semibold text-slate-800">Productos incluidos en el cálculo</p>
                <div className="space-y-2">
                  {itemShippingBreakdown.map((item: any, index: number) => {
                    return (
                      <div key={item.id || `${item.product_id}-${item.variant_id || 'base'}-${index}`} className="rounded-lg border p-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
                              className="h-12 w-12 rounded-md border bg-muted object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                              IMG
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.product_name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{item.sku} · {item.quantity || 0} unidades</p>
                            {item.variant_name && (
                              <p className="text-xs text-muted-foreground">Variante: {item.variant_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 border-t pt-3 text-right text-sm sm:grid-cols-4">
                          <div>
                            <div className="font-medium">{item.unitWeightKg.toFixed(3)} kg</div>
                            <div className="text-xs text-muted-foreground">peso por unidad</div>
                          </div>
                          <div>
                            <div className="font-medium">{item.itemWeightKg.toFixed(3)} kg</div>
                            <div className="text-xs text-muted-foreground">peso de la línea</div>
                          </div>
                          <div>
                            <div className="font-medium text-primary">${item.shippingPerUnit.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">+ envío por unidad</div>
                          </div>
                          <div>
                            <div className="font-bold text-emerald-700">${item.landedUnitCost.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">costo aterrizado unitario</div>
                          </div>
                          <div className="sm:col-span-4 rounded-md bg-emerald-50 p-2 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <div className="text-base font-bold text-emerald-800">{formattedCurrencyWithCode(item.suggestedSalePrice, marketplaceDraft?.currency || 'USD')}</div>
                              <Button type="button" variant="link" className="h-auto p-0 text-xs text-emerald-700" onClick={() => { setSelectedDetailItem(item); setSelectedDetailMarketplaceId(marketplaceDraft?.id || marketplaces[0]?.id || ''); }}>
                                Ver detalle de deducciones
                              </Button>
                            </div>
                            <div className="text-xs text-emerald-700">precio de venta sugerido por unidad</div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                          <span>Envío asignado a la línea: ${item.itemShippingTotal.toFixed(2)}</span>
                          <span>{(item.allocationShare * 100).toFixed(1)}% del total</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                  <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    El valor <strong>“+ envío por unidad”</strong> es el monto que puedes sumar al precio de venta de cada producto o variante. Incluye el costo del transportista y los gastos adicionales, distribuidos según el peso de cada línea.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Dialog open={!!selectedDetailItem} onOpenChange={open => !open && setSelectedDetailItem(null)}>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Detalle de deducciones</DialogTitle>
                  <DialogDescription>
                    {selectedDetailCalculation?.product_name} · {selectedDetailCalculation?.marketplace.name} ({selectedDetailCalculation?.marketplace.currency}) · TC: 1 USD = {Number(selectedDetailCalculation?.marketplace.exchange_rate || 1).toFixed(2)} {selectedDetailCalculation?.marketplace.currency}
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
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Origen del costo aterrizado (USD)</p>
                      <div className="space-y-2">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Costo de producto (unitario)</span>
                          <span className="font-semibold">{formattedCurrencyWithCode(selectedDetailCalculation.productCostUsd, 'USD')}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">(+) Envío internacional (unitario)</span>
                          <span className="font-semibold">+{formattedCurrencyWithCode(selectedDetailCalculation.shippingCostUsd, 'USD')}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-t pt-2">
                          <span className="font-semibold">(=) Costo aterrizado total</span>
                          <span className="font-bold">{formattedCurrencyWithCode(selectedDetailCalculation.landedUnitCost, 'USD')}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-primary">
                          <span>Costo aterrizado local (× TC {Number(selectedDetailCalculation.marketplace.exchange_rate || 1).toFixed(4)})</span>
                          <span className="font-bold">{formattedCurrencyWithCode(selectedDetailCalculation.landedUnitCostInCurrency, selectedDetailCalculation.marketplace.currency)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Deducciones marketplace y cargos adicionales ({selectedDetailCalculation.marketplace.currency})</p>
                      <div className="space-y-2">
                        {selectedDetailCalculation.feeBreakdown.map((fee: any) => (
                          <div key={fee.id} className="flex justify-between gap-3">
                            <span className="text-muted-foreground">
                              (-) {fee.name} ({fee.fee_type === 'percentage' ? `${Number(fee.value).toFixed(2)}% sobre precio de venta` : `Fijo ${selectedDetailCalculation.marketplace.currency}`})
                            </span>
                            <span className="font-medium text-destructive">-{formattedCurrencyWithCode(fee.amount, selectedDetailCalculation.marketplace.currency)}</span>
                          </div>
                        ))}
                        {!selectedDetailCalculation.feeBreakdown.length && <p className="text-xs text-muted-foreground">Sin deducciones configuradas.</p>}
                        <div className="flex justify-between gap-3 border-t pt-2">
                          <span className="font-semibold">(=) Total deducciones marketplace</span>
                          <span className="font-bold text-destructive">-{formattedCurrencyWithCode(selectedDetailCalculation.totalDeductions, selectedDetailCalculation.marketplace.currency)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">3. Suma y conciliación final ({selectedDetailCalculation.marketplace.currency})</p>
                      <div className="space-y-2 font-mono text-sm">
                        <div className="flex justify-between gap-3"><span>Costo aterrizado (producto + envío)</span><span>{formattedCurrencyWithCode(selectedDetailCalculation.landedUnitCostInCurrency, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3"><span>+ Gastos y retenciones marketplace</span><span>{formattedCurrencyWithCode(selectedDetailCalculation.totalDeductions, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3"><span>+ Ganancia neta deseada</span><span>{formattedCurrencyWithCode(selectedDetailCalculation.desiredProfit, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3 border-t pt-2 text-base font-bold text-emerald-800"><span>= Precio de venta sugerido final</span><span>{formattedCurrencyWithCode(selectedDetailCalculation.suggestedSalePrice, selectedDetailCalculation.marketplace.currency)}</span></div>
                      </div>
                      <div className="mt-4 space-y-2 border-t pt-3 text-sm">
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Ingreso neto recibido (precio - deducciones)</span><span className="font-semibold">{formattedCurrencyWithCode(selectedDetailCalculation.netReceived, selectedDetailCalculation.marketplace.currency)}</span></div>
                        <div className="flex justify-between gap-3 rounded-md bg-emerald-50 p-2"><span className="font-semibold text-emerald-800">Ganancia neta limpia</span><span className="font-bold text-emerald-800">{formattedCurrencyWithCode(selectedDetailCalculation.netProfit, selectedDetailCalculation.marketplace.currency)}</span></div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      La ganancia neta limpia coincide con el objetivo configurado: {formattedCurrencyWithCode(selectedDetailCalculation.desiredProfit, selectedDetailCalculation.marketplace.currency)}.
                    </p>
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
                    Eliminar tab
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
