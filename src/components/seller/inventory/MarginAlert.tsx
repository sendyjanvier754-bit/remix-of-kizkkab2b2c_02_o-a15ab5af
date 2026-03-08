import { AlertTriangle, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";

interface MarginAlertProps {
  precioVenta: number;
  precioCosto: number;
  className?: string;
}

export function MarginAlert({ precioVenta, precioCosto, className }: MarginAlertProps) {
  const { t } = useTranslation();
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
            <strong>{t('marginAlert.loss')}:</strong> {t('marginAlert.lossDetail', { 
              price: precioVenta.toFixed(2), 
              cost: precioCosto.toFixed(2), 
              diff: (precioCosto - precioVenta).toFixed(2) 
            })}
          </>
        ) : (
          <>
            <strong>{t('marginAlert.lowMargin')}:</strong> {t('marginAlert.lowMarginDetail', { margin: margin.toFixed(1) })}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
