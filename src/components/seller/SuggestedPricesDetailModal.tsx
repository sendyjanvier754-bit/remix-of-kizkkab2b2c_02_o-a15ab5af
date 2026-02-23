import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { AlertCircle, TrendingUp } from 'lucide-react';

// Datos que vienen directamente de v_business_panel_data
export interface BusinessPanelItem {
  productId: string;
  variantId?: string;
  itemName: string;
  quantity: number;
  costPerUnit: number;          // cost_per_unit  — precio B2B
  shippingCostPerUnit: number;  // shipping_cost_per_unit
  suggestedPvpPerUnit: number;  // suggested_pvp_per_unit
  profitPerUnit: number;        // profit_1unit
  marginPercentage: number;     // margin_percentage
  weight_kg: number;
}

interface SuggestedPricesDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BusinessPanelItem[];
  isLoading?: boolean;
}

export const SuggestedPricesDetailModal = ({
  isOpen,
  onClose,
  items,
  isLoading = false,
}: SuggestedPricesDetailModalProps) => {
  const totalInvestment = items.reduce((sum, item) => sum + item.costPerUnit * item.quantity, 0);
  const totalShipping   = items.reduce((sum, item) => sum + item.shippingCostPerUnit * item.quantity, 0);
  const totalRevenue    = items.reduce((sum, item) => sum + item.suggestedPvpPerUnit * item.quantity, 0);
  const totalProfit     = items.reduce((sum, item) => sum + item.profitPerUnit * item.quantity, 0);
  const avgMargin       = items.length > 0
    ? items.reduce((sum, item) => sum + item.marginPercentage, 0) / items.length
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Desglose de Precios de Venta Sugeridos
          </DialogTitle>
          <DialogDescription>
            Datos calculados desde la vista de panel de negocios
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            Cargando datos...
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-700">
              Sin datos de logística — configura tu mercado para ver el análisis de precios.
            </p>
          </div>
        ) : (
          <>
            {/* Tabla de items */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b-2">
                    <th className="px-3 py-2 text-left font-semibold">Producto</th>
                    <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                    <th className="px-3 py-2 text-right font-semibold">Precio B2B</th>
                    <th className="px-3 py-2 text-right font-semibold text-blue-700">Costo Logística</th>
                    <th className="px-3 py-2 text-right font-semibold text-green-700">PVP Sugerido</th>
                    <th className="px-3 py-2 text-right font-semibold">Ganancia</th>
                    <th className="px-3 py-2 text-right font-semibold">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{item.itemName}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">${item.costPerUnit.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-blue-700">
                        ${item.shippingCostPerUnit.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-700 font-bold">
                        ${item.suggestedPvpPerUnit.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">${item.profitPerUnit.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{item.marginPercentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen final */}
            <Card className="p-6 bg-green-50 border-green-200 mt-4">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Inversión (B2B)</p>
                  <p className="text-2xl font-bold text-gray-900">${totalInvestment.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Logística</p>
                  <p className="text-2xl font-bold text-blue-700">${totalShipping.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Venta Sugerida</p>
                  <p className="text-2xl font-bold text-green-700">${totalRevenue.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Ganancia Neta</p>
                  <p className="text-2xl font-bold text-green-700">${totalProfit.toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t-2 border-green-300 my-4"></div>

              <div className="text-center">
                <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
                  Margen Promedio: {avgMargin.toFixed(1)}%
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
                  const header = 'Producto\tCant.\tPrecio B2B\tLogística\tPVP Sugerido\tGanancia\tMargen';
                  const rows = items.map(
                    item =>
                      `${item.itemName}\t${item.quantity}\t$${item.costPerUnit.toFixed(2)}\t$${item.shippingCostPerUnit.toFixed(2)}\t$${item.suggestedPvpPerUnit.toFixed(2)}\t$${item.profitPerUnit.toFixed(2)}\t${item.marginPercentage.toFixed(1)}%`
                  );
                  navigator.clipboard.writeText([header, ...rows].join('\n'));
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium text-white"
              >
                Copiar Tabla
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
