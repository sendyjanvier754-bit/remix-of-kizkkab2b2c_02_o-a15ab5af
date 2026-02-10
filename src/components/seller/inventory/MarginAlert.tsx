import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MarginAlertProps {
  precioVenta: number;
  precioCosto: number;
  className?: string;
}

export function MarginAlert({ precioVenta, precioCosto, className }: MarginAlertProps) {
  const margin = precioCosto > 0 ? ((precioVenta - precioCosto) / precioCosto) * 100 : 0;
  const isLoss = precioVenta < precioCosto;
  const isLowMargin = margin > 0 && margin < 10;

  if (!isLoss && !isLowMargin) return null;

  return (
    <Alert 
      variant={isLoss ? "destructive" : "default"} 
      className={className}
    >
      {isLoss ? (
        <TrendingDown className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3 text-yellow-600" />
      )}
      <AlertDescription className={`text-[10px] ${isLoss ? "" : "text-yellow-700"}`}>
        {isLoss ? (
          <>
            <strong>Pérdida:</strong> Precio ${precioVenta.toFixed(2)} &lt; Costo ${precioCosto.toFixed(2)}. 
            Perderás ${(precioCosto - precioVenta).toFixed(2)}/unidad.
          </>
        ) : (
          <>
            <strong>Margen bajo:</strong> {margin.toFixed(1)}%. Considera aumentar el precio.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
