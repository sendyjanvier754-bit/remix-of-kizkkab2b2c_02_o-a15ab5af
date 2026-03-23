import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Package, XCircle, ShieldCheck } from 'lucide-react';
import { useProductDeletion } from '@/hooks/useProductDeletion';

interface ProductDeleteDialogProps {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

type Step = 'confirm' | 'checking' | 'has_orders' | 'deleting';

export default function ProductDeleteDialog({
  productId,
  productName,
  open,
  onOpenChange,
  onDeleted,
}: ProductDeleteDialogProps) {
  const { checkPendingOrders, executeDelete, isDeleting, isChecking, checkResult } = useProductDeletion();
  const [step, setStep] = useState<Step>('confirm');

  const handleInitialConfirm = async () => {
    setStep('checking');
    const result = await checkPendingOrders(productId);
    if (!result) {
      setStep('confirm');
      return;
    }
    if (result.total_pending > 0) {
      setStep('has_orders');
    } else {
      // No pending orders, delete directly
      setStep('deleting');
      await executeDelete(productId, productName, 'delete', 'Producto descontinuado', onDeleted);
      onOpenChange(false);
      setStep('confirm');
    }
  };

  const handleKeepOrders = async () => {
    setStep('deleting');
    await executeDelete(productId, productName, 'delete_keep', 'Producto descontinuado - pedidos continúan', onDeleted);
    onOpenChange(false);
    setStep('confirm');
  };

  const handleCancelOrders = async () => {
    setStep('deleting');
    await executeDelete(productId, productName, 'delete_cancel', 'Producto descontinuado - pedidos cancelados', onDeleted);
    onOpenChange(false);
    setStep('confirm');
  };

  const handleClose = () => {
    if (!isDeleting && !isChecking) {
      onOpenChange(false);
      setStep('confirm');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Producto
          </AlertDialogTitle>
        </AlertDialogHeader>

        {/* Step: Initial confirm */}
        {step === 'confirm' && (
          <>
            <AlertDialogDescription className="space-y-2">
              <p>¿Estás seguro de eliminar <strong>"{productName}"</strong>?</p>
              <p className="text-xs text-muted-foreground">
                Se verificará si hay pedidos pendientes antes de proceder.
              </p>
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={handleInitialConfirm}>
                Continuar
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {/* Step: Checking */}
        {step === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando pedidos pendientes...</p>
          </div>
        )}

        {/* Step: Has pending orders - admin chooses */}
        {step === 'has_orders' && checkResult && (
          <>
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium text-sm">
                    Pedidos pendientes encontrados
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {checkResult.pending_orders_b2b > 0 && (
                    <p>• {checkResult.pending_orders_b2b} pedido(s) B2B</p>
                  )}
                  {checkResult.pending_orders_b2c > 0 && (
                    <p>• {checkResult.pending_orders_b2c} pedido(s) B2C</p>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">¿Qué deseas hacer con los pedidos pendientes?</p>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={handleKeepOrders}
                  disabled={isDeleting}
                >
                  <ShieldCheck className="h-4 w-4 mr-3 text-green-600 shrink-0" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Continuar con los pedidos</p>
                    <p className="text-xs text-muted-foreground">
                      Desactivar producto del catálogo pero completar los pedidos pendientes
                    </p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 border-destructive/30 hover:bg-destructive/5"
                  onClick={handleCancelOrders}
                  disabled={isDeleting}
                >
                  <XCircle className="h-4 w-4 mr-3 text-destructive shrink-0" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Cancelar y reembolsar</p>
                    <p className="text-xs text-muted-foreground">
                      Cancelar todos los pedidos, generar reembolsos y eliminar el producto
                    </p>
                  </div>
                </Button>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Volver</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}

        {/* Step: Deleting */}
        {step === 'deleting' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            <p className="text-sm text-muted-foreground">Eliminando producto...</p>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
