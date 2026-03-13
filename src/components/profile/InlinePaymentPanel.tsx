import { useAdminPaymentMethods } from "@/hooks/usePaymentMethods";
import { CreditCard, Smartphone, Banknote, Loader2, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const methodIcons: Record<string, React.ReactNode> = {
  bank:    <Building2 className="w-5 h-5 text-blue-600" />,
  moncash: <Smartphone className="w-5 h-5 text-orange-500" />,
  natcash: <Smartphone className="w-5 h-5 text-green-600" />,
  stripe:  <CreditCard className="w-5 h-5 text-purple-600" />,
};

const methodLabels: Record<string, string> = {
  bank:    "Transferencia Bancaria",
  moncash: "MonCash",
  natcash: "NatCash",
  stripe:  "Tarjeta de Crédito",
};

export function InlinePaymentPanel() {
  const { methods, isLoading } = useAdminPaymentMethods();
  const activeMethods = methods.filter(m => m.is_active);

  if (isLoading) {
    return (
      <div className="bg-background border border-border rounded-md p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-md overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Métodos de Pago Aceptados</h2>
      </div>

      <div className="px-5 py-3 bg-muted/30 border-b border-border">
        <p className="text-xs text-muted-foreground">
          Estos son los métodos de pago disponibles al realizar un pedido. Para pagos personalizados, contacta a soporte.
        </p>
      </div>

      {activeMethods.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-2 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No hay métodos disponibles actualmente</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activeMethods.map((m) => (
            <div key={m.id} className="px-5 py-4 flex gap-3 items-start">
              <div className="shrink-0 mt-0.5 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                {methodIcons[m.method_type] ?? <Banknote className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {m.display_name || methodLabels[m.method_type] || m.method_type}
                  </span>
                  {m.manual_enabled && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">Manual</Badge>
                  )}
                  {m.automatic_enabled && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700">Automático</Badge>
                  )}
                </div>
                {m.method_type === 'bank' && m.bank_name && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Banco: <span className="text-foreground font-medium">{m.bank_name}</span></p>
                    {m.account_holder && <p className="text-xs text-muted-foreground">Titular: <span className="text-foreground font-medium">{m.account_holder}</span></p>}
                    {m.account_number && <p className="text-xs text-muted-foreground">Cuenta: <span className="text-foreground font-mono font-medium">{m.account_number}</span></p>}
                  </div>
                )}
                {(m.method_type === 'moncash' || m.method_type === 'natcash') && m.phone_number && (
                  <div className="mt-1">
                    <p className="text-xs text-muted-foreground">
                      Número: <span className="text-foreground font-medium">{m.phone_number}</span>
                    </p>
                    {m.holder_name && <p className="text-xs text-muted-foreground">Nombre: <span className="text-foreground font-medium">{m.holder_name}</span></p>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
