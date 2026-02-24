import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Truck, Plane, Package, Shield, MapPin, Building2 } from 'lucide-react';
import { ShippingCalculation } from '@/hooks/useLogisticsEngine';

interface ShippingCostBreakdownProps {
  calculation: ShippingCalculation;
  referencePrice: number;
  showDetails?: boolean;
}

export const ShippingCostBreakdown: React.FC<ShippingCostBreakdownProps> = ({
  calculation,
  referencePrice,
  showDetails = true,
}) => {
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Desglose de Envío
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Separator />

        {showDetails && (
          <>
            {/* Shipping segments */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-blue-500" />
                  China → USA
                </span>
                <span>{formatCurrency(calculation.chinaUsaCost)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-green-500" />
                  USA → Haití
                </span>
                <span>{formatCurrency(calculation.usaHaitiCost)}</span>
              </div>
            </div>

            <Separator />

            {/* Category fees */}
            {(calculation.categoryFixedFee > 0 || calculation.categoryPercentageFee > 0) && (
              <>
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Tarifas de Categoría
                  </div>
                  {calculation.categoryFixedFee > 0 && (
                    <div className="flex justify-between text-sm pl-6">
                      <span className="text-muted-foreground">Manejo especial</span>
                      <span>{formatCurrency(calculation.categoryFixedFee)}</span>
                    </div>
                  )}
                  {calculation.categoryPercentageFee > 0 && (
                    <div className="flex justify-between text-sm pl-6">
                      <span className="text-muted-foreground">% sobre adquisición</span>
                      <span>{formatCurrency(calculation.categoryPercentageFee)}</span>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Local fees */}
            {(calculation.extraDepartmentFee > 0 || calculation.deliveryFee > 0 || calculation.operationalFee > 0) && (
              <>
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Cargos Locales
                  </div>
                  {calculation.extraDepartmentFee > 0 && (
                    <div className="flex justify-between text-sm pl-6">
                      <span className="text-muted-foreground">Extra departamento</span>
                      <span>{formatCurrency(calculation.extraDepartmentFee)}</span>
                    </div>
                  )}
                  {calculation.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm pl-6">
                      <span className="text-muted-foreground">Envío a domicilio</span>
                      <span>{formatCurrency(calculation.deliveryFee)}</span>
                    </div>
                  )}
                  {calculation.operationalFee > 0 && (
                    <div className="flex justify-between text-sm pl-6">
                      <span className="text-muted-foreground">Gasto operativo</span>
                      <span>{formatCurrency(calculation.operationalFee)}</span>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Insurance */}
            {calculation.insuranceCost > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-500" />
                    Seguro ({((calculation.insuranceCost / referencePrice) * 100).toFixed(1)}%)
                  </span>
                  <span>{formatCurrency(calculation.insuranceCost)}</span>
                </div>
                <Separator />
              </>
            )}
          </>
        )}

        {/* Totals */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Costo del producto:</span>
            <span>{formatCurrency(referencePrice)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>Total envío:</span>
            <span>{formatCurrency(calculation.totalShippingCost)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Precio Final:</span>
            <span className="text-primary">{formatCurrency(calculation.finalPrice)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
