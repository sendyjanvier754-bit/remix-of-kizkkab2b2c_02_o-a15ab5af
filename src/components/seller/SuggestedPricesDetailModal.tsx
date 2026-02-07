import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { AlertCircle, TrendingUp } from 'lucide-react';

interface CartItemWithShipping {
  productId: string;
  variantId?: string;
  itemName: string;
  quantity: number;
  costPerUnit: number;
  weight_kg: number;
  shippingCostPerUnit: number; // ya distribuido proporcionalmente
}

interface SuggestedPricesDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItemWithShipping[];
  totalWeight_kg: number;
  totalShippingCost: number;
  markupMultiplier?: number; // default 2.5
}

export const SuggestedPricesDetailModal = ({
  isOpen,
  onClose,
  items,
  totalWeight_kg,
  totalShippingCost,
  markupMultiplier = 2.5,
}: SuggestedPricesDetailModalProps) => {
  const calculateItemMetrics = (item: CartItemWithShipping) => {
    // Fórmula: suggested_pvp = (cost_per_unit × markup) + shipping_per_unit
    const pvpFromCost = item.costPerUnit * markupMultiplier;
    const suggestedPvp = pvpFromCost + item.shippingCostPerUnit;
    
    // Ganancia = PVP - Costo - Logística
    const profitPerUnit = suggestedPvp - item.costPerUnit - item.shippingCostPerUnit;
    const profitMargin = item.costPerUnit > 0 ? (profitPerUnit / suggestedPvp) * 100 : 0;

    return {
      pvpFromCost,
      suggestedPvp,
      profitPerUnit,
      profitMargin,
    };
  };

  const items_with_metrics = items.map(item => ({
    ...item,
    ...calculateItemMetrics(item),
  }));

  const totalInvestment = items.reduce((sum, item) => sum + (item.costPerUnit * item.quantity), 0);
  const totalRevenue = items_with_metrics.reduce(
    (sum, item) => sum + (item.suggestedPvp * item.quantity),
    0
  );
  const totalProfit = totalRevenue - totalInvestment - (totalShippingCost * items.length);

  const factorableWeight = Math.ceil(totalWeight_kg);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Desglose de Precios de Venta Sugeridos
          </DialogTitle>
          <DialogDescription>
            Cálculo transparente incluyendo costos de logística
          </DialogDescription>
        </DialogHeader>

        {/* Tabla de items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b-2">
                <th className="px-3 py-2 text-left font-semibold">Producto</th>
                <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                <th className="px-3 py-2 text-right font-semibold">Costo Unit.</th>
                <th className="px-3 py-2 text-right font-semibold text-green-700 font-bold">PVP Final</th>
                <th className="px-3 py-2 text-right font-semibold">Ganancia</th>
                <th className="px-3 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {items_with_metrics.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{item.itemName}</td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">${item.costPerUnit.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-green-700 font-bold">
                    ${item.suggestedPvp.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">${item.profitPerUnit.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{item.profitMargin.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumen final */}
        <Card className="p-6 bg-green-50 border-green-200 mt-4">
          {/* Primera fila: Inversión y Venta */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">Inversión Total</p>
              <p className="text-3xl font-bold text-gray-900">${totalInvestment.toFixed(2)}</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-2xl text-gray-400">→</div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">Total Venta</p>
              <p className="text-3xl font-bold text-green-700">${totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {/* Separador */}
          <div className="border-t-2 border-green-300 my-6"></div>

          {/* Ganancia Neta - Destacada */}
          <div className="text-center">
            <p className="text-sm text-gray-700 mb-2 font-semibold">
              💰 Ganancia Neta Estimada
            </p>
            <p className="text-4xl font-bold text-green-700 mb-2">${totalProfit.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mb-4">
              (Después de inversión y costos de logística)
            </p>
            <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
              Margen: {((totalProfit / totalRevenue) * 100).toFixed(1)}%
            </div>
          </div>
        </Card>

        {/* Botones */}
        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-medium text-gray-800"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              // Copiar tabla a clipboard
              const text = items_with_metrics
                .map(
                  item =>
                    `${item.itemName}\t${item.quantity}\t$${item.costPerUnit.toFixed(2)}\t$${item.pvpFromCost.toFixed(2)}\t+$${item.shippingCostPerUnit.toFixed(2)}\t$${item.suggestedPvp.toFixed(2)}\t$${item.profitPerUnit.toFixed(2)}\t${item.profitMargin.toFixed(1)}%`
                )
                .join('\n');
              navigator.clipboard.writeText(text);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium text-white"
          >
            Copiar Tabla
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
