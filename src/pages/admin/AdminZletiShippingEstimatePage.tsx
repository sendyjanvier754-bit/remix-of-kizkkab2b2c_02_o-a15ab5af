import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_RATE = '0.50';

export default function AdminZletiShippingEstimatePage() {
  const navigate = useNavigate();
  const { poId } = useParams();
  const queryClient = useQueryClient();

  const [shippingEstimateRateInput, setShippingEstimateRateInput] = useState<string>(DEFAULT_RATE);
  const [shippingEstimateRateMode, setShippingEstimateRateMode] = useState<'kg' | 'g'>('kg');
  const [shippingEstimateExtraExpensesInput, setShippingEstimateExtraExpensesInput] = useState<string>('0');

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
    setShippingEstimateExtraExpensesInput(String(savedEstimate.extra_expenses ?? 0));
  }, [savedEstimate]);

  const totalWeightKg = useMemo(
    () => (selectedPo?.items || []).reduce((sum, item) => sum + Number(item.weight_kg || 0) * Number(item.quantity || 0), 0),
    [selectedPo]
  );

  const transportRateForShippingEstimate = Number(shippingEstimateRateInput || 0);
  const shippingCost = shippingEstimateRateMode === 'kg'
    ? totalWeightKg * transportRateForShippingEstimate
    : totalWeightKg * 1000 * transportRateForShippingEstimate;

  const shippingEstimateExtraExpenses = Number(shippingEstimateExtraExpensesInput || 0);
  const shippingEstimateTotal = shippingCost + shippingEstimateExtraExpenses;

  const saveShippingEstimateToPo = useMutation({
    mutationFn: async () => {
      if (!poId || !selectedPo) {
        throw new Error('No hay un PO seleccionado para guardar la estimación.');
      }

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
        total_estimate: Number(shippingEstimateTotal || 0),
        item_count: selectedPo.items?.length || 0,
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
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>PO seleccionado</Label>
                    <Input value={selectedPo.po.po_number || 'PO sin número'} readOnly />
                  </div>

                  <div className="space-y-2">
                    <Label>Peso total estimado ({shippingEstimateRateMode === 'kg' ? 'kg' : 'g'})</Label>
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
                    <Label>Gastos adicionales estimados</Label>
                    <Input type="number" min={0} step="0.01" value={shippingEstimateExtraExpensesInput} onChange={event => setShippingEstimateExtraExpensesInput(event.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Resumen del cálculo</p>
                  {savedEstimate && (
                    <Badge variant="outline">Última estimación guardada</Badge>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Peso total</span>
                    <span className="font-semibold">{totalWeightKg.toFixed(2)} kg</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Envío estimado</span>
                    <span className="font-semibold">${shippingCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Gastos adicionales</span>
                    <span className="font-semibold">${shippingEstimateExtraExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-3">
                    <span className="text-muted-foreground">Total estimado</span>
                    <span className="text-lg font-bold">${shippingEstimateTotal.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={() => saveShippingEstimateToPo.mutate()}
                  className="mt-5 w-full gap-2"
                  disabled={!poId || saveShippingEstimateToPo.isPending}
                >
                  {saveShippingEstimateToPo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  {saveShippingEstimateToPo.isPending ? 'Guardando...' : 'Guardar estimación en la base de datos'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 sm:p-6">
                <p className="mb-3 text-sm font-semibold text-slate-800">Productos incluidos en el cálculo</p>
                <div className="space-y-2">
                  {(selectedPo.items || []).map((item: any, index: number) => {
                    const unitWeightKg = Number(item.weight_kg || 0);
                    const totalWeightKgForItem = unitWeightKg * Number(item.quantity || 0);

                    return (
                      <div key={item.id || `${item.product_id}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border p-3">
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
                        <div className="text-right text-sm">
                          <div className="font-medium">{unitWeightKg.toFixed(2)} kg</div>
                          <div className="text-muted-foreground">peso registrado por unidad</div>
                          <div className="mt-1 font-medium text-primary">{totalWeightKgForItem.toFixed(2)} kg</div>
                          <div className="text-muted-foreground">peso total en el PO</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
