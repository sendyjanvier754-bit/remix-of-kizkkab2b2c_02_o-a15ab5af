import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSellerWallet } from "@/hooks/useSellerWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingUp, Clock, CheckCircle, DollarSign, ArrowUpRight, ArrowDownLeft,
  Filter, Loader2, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface WithdrawalFormData {
  amount: number | "";
  method: string;
  bank: string;
  accountNumber: string;
  accountHolder: string;
}

const SellerWalletPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { wallet, transactions, isLoading, requestWithdrawal } = useSellerWallet(user?.id);

  const [activeTab, setActiveTab] = useState("overview");
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<string>("all");
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalFormData>({
    amount: "",
    method: "transfer",
    bank: "",
    accountNumber: "",
    accountHolder: "",
  });

  // Si no hay usuario, mostrar error
  if (!user?.id) {
    return (
      <SellerLayout>
        <div className="min-h-screen bg-gray-50/50 p-4 pb-20 flex items-center justify-center">
          <Card className="border border-red-200 bg-red-50 max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <p className="text-red-800 font-medium">Error: No se pudo identificar tu cuenta</p>
              <p className="text-red-600 text-sm mt-2">Por favor recarga la página</p>
            </CardContent>
          </Card>
        </div>
      </SellerLayout>
    );
  }

  // Filter transactions
  const filteredTransactions = transactions?.filter((tx: any) => {
    if (transactionFilter === "all") return true;
    return tx.type === transactionFilter;
  }) || [];

  // Handle withdrawal submission
  const handleWithdrawalSubmit = async () => {
    if (!withdrawalForm.amount || withdrawalForm.amount <= 0) {
      toast({
        title: "Error",
        description: "Ingresa un monto válido",
        variant: "destructive",
      });
      return;
    }

    if (!wallet || withdrawalForm.amount > wallet.available_balance) {
      toast({
        title: "Error",
        description: "Monto mayor que saldo disponible",
        variant: "destructive",
      });
      return;
    }

    if (!withdrawalForm.bank || !withdrawalForm.accountNumber || !withdrawalForm.accountHolder) {
      toast({
        title: "Error",
        description: "Completa todos los campos bancarios",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await requestWithdrawal(
        withdrawalForm.amount as number,
        withdrawalForm.method === "transfer" ? "bank_transfer" : "moncash",
        {
          bank: withdrawalForm.bank,
          accountNumber: withdrawalForm.accountNumber,
          accountHolder: withdrawalForm.accountHolder,
        }
      );

      if (success) {
        toast({
          title: "Éxito",
          description: "Solicitud de retiro enviada correctamente",
        });

        setShowWithdrawalDialog(false);
        setWithdrawalForm({
          amount: "",
          method: "transfer",
          bank: "",
          accountNumber: "",
          accountHolder: "",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al procesar retiro",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SellerLayout>
        <div className="min-h-screen bg-gray-50/50 p-4 pb-20">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b px-4 py-4 md:px-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#071d7f]/10">
              <Wallet className="h-6 w-6 text-[#071d7f]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('sellerWallet.title')}</h1>
              <p className="text-sm text-gray-500">{t('sellerWallet.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab Navigation */}
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="overview" className="text-xs md:text-sm">
                {t('sellerWallet.overview')}
              </TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs md:text-sm">
                {t('sellerWallet.transactions')}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-6 mt-0">
              {/* Main Saldo Card */}
              <Card className="bg-gray-100 border border-gray-200 shadow-md">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-center justify-between gap-3">
                    {/* Saldo Section */}
                    <div className="flex items-center gap-2 flex-1">
                      <DollarSign className="h-4 w-4 text-[#071d7f] flex-shrink-0" />
                      <div className="min-w-0">
                        <Badge variant="outline" className="text-xs bg-white text-gray-700 border-gray-300 mb-1">
                          Saldo Disponible
                        </Badge>
                        <div className="text-xl md:text-2xl font-bold text-[#071d7f] truncate">
                          ${(wallet?.available_balance || 0).toLocaleString("es-DO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {/* Solicitar Retiro Button */}
                    <Button
                      onClick={() => setShowWithdrawalDialog(true)}
                      className="bg-[#94111f] hover:bg-[#7a0d1a] text-white font-semibold text-xs md:text-sm px-2.5 md:px-3 py-1.5 md:py-2 flex-shrink-0 h-fit whitespace-nowrap"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                      Retiro
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Grid - Mobile First: 2 columnas en mobile, 4 en desktop */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Card 1: Total Ganado */}
                <Card className="bg-white border border-gray-200">
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-xs md:text-sm font-medium text-gray-600">Total Ganado</span>
                      </div>
                      <p className="text-lg md:text-2xl font-bold text-gray-900">
                        ${(wallet?.total_earned || 0).toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Total Retirado */}
                <Card className="bg-white border border-gray-200">
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-xs md:text-sm font-medium text-gray-600">Total Retirado</span>
                      </div>
                      <p className="text-lg md:text-2xl font-bold text-gray-900">
                        ${(wallet?.total_withdrawn || 0).toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Retiros Pendientes */}
                <Card className="bg-white border border-gray-200">
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span className="text-xs md:text-sm font-medium text-gray-600">Pendiente Liberar</span>
                      </div>
                      <p className="text-lg md:text-2xl font-bold text-gray-900">
                        ${(wallet?.pending_balance || 0).toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Transacciones */}
                <Card className="bg-white border border-gray-200">
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-purple-600" />
                        <span className="text-xs md:text-sm font-medium text-gray-600">Movimientos</span>
                      </div>
                      <p className="text-lg md:text-2xl font-bold text-gray-900">
                        {transactions?.length || 0}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Transactions Preview */}
              <Card className="border border-gray-200">
                <CardHeader className="pb-3 md:pb-4">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">Últimos Movimientos</h3>
                </CardHeader>
                <CardContent>
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No hay movimientos aún</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTransactions.slice(0, 4).map((tx: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                tx.type === "withdrawal"
                                  ? "bg-red-100"
                                  : "bg-green-100"
                              }`}
                            >
                              {tx.type === "withdrawal" ? (
                                <ArrowUpRight className={`h-4 w-4 ${tx.type === "withdrawal" ? "text-red-600" : "text-green-600"}`} />
                              ) : (
                                <ArrowDownLeft className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm md:text-base font-medium text-gray-900 truncate">
                                {tx.description || (tx.type === "withdrawal" ? "Retiro" : "Ingreso")}
                              </p>
                              <p className="text-xs md:text-sm text-gray-500">
                                {format(new Date(tx.created_at), "d MMM, yyyy", { locale: es })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm md:text-base font-bold ${
                              tx.type === "withdrawal" ? "text-red-600" : "text-green-600"
                            }`}>
                              {tx.type === "withdrawal" ? "-" : "+"}${tx.amount.toLocaleString("es-DO", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-xs mt-1 ${
                                tx.status === "completed"
                                  ? "bg-green-50 text-green-700 border-green-300"
                                  : tx.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-300"
                                  : "bg-red-50 text-red-700 border-red-300"
                              }`}
                            >
                              {tx.status === "completed"
                                ? "Completado"
                                : tx.status === "pending"
                                ? "Pendiente"
                                : "Rechazado"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: TRANSACTIONS */}
            <TabsContent value="transactions" className="space-y-6 mt-0">
              {/* Filter */}
              <Card className="border border-gray-200">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <select
                      value={transactionFilter}
                      onChange={(e) => setTransactionFilter(e.target.value)}
                      className="text-sm md:text-base w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#071d7f]"
                    >
                      <option value="all">Todos los movimientos</option>
                      <option value="sale">Ventas</option>
                      <option value="commission">Comisiones</option>
                      <option value="refund">Reembolsos</option>
                      <option value="withdrawal">Retiros</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions List */}
              {filteredTransactions.length === 0 ? (
                <Card className="border border-gray-200">
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-base md:text-lg">No hay movimientos en esta categoría</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((tx: any, idx: number) => (
                    <Card key={idx} className="border border-gray-200 overflow-hidden">
                      <CardContent className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-0 md:flex md:items-center md:justify-between">
                          {/* Left: Icon + Description */}
                          <div className="flex items-center gap-3 col-span-1">
                            <div
                              className={`p-3 rounded-lg shrink-0 ${
                                tx.type === "withdrawal"
                                  ? "bg-red-100"
                                  : tx.type === "sale"
                                  ? "bg-green-100"
                                  : tx.type === "refund"
                                  ? "bg-orange-100"
                                  : "bg-blue-100"
                              }`}
                            >
                              {tx.type === "withdrawal" ? (
                                <ArrowUpRight className="h-5 w-5 text-red-600" />
                              ) : (
                                <ArrowDownLeft className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm md:text-base font-semibold text-gray-900 truncate">
                                {tx.description || (tx.type === "withdrawal" ? "Retiro" : "Transacción")}
                              </p>
                              <p className="text-xs md:text-sm text-gray-500">
                                {format(new Date(tx.created_at), "d MMM, yyyy HH:mm", { locale: es })}
                              </p>
                            </div>
                          </div>

                          {/* Center: Amount */}
                          <div className="col-span-1 md:text-right">
                            <p className={`text-base md:text-lg font-bold ${
                              tx.type === "withdrawal" ? "text-red-600" : "text-green-600"
                            }`}>
                              {tx.type === "withdrawal" ? "-" : "+"}${tx.amount.toLocaleString("es-DO", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>

                          {/* Right: Status */}
                          <div className="col-span-1 md:text-right">
                            <Badge
                              className={`text-xs font-medium ${
                                tx.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : tx.status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {tx.status === "completed"
                                ? "Completado"
                                : tx.status === "pending"
                                ? "Pendiente"
                                : "Rechazado"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogContent className="w-[95vw] md:max-w-md mx-auto p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl text-gray-900">Solicitar Retiro</DialogTitle>
            <DialogDescription className="text-sm md:text-base">
              Saldo disponible: ${(wallet?.available_balance || 0).toLocaleString("es-DO", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Monto */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm md:text-base font-medium">
                Monto a Retirar *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  max={wallet?.available_balance || 0}
                  placeholder="0.00"
                  value={withdrawalForm.amount}
                  onChange={(e) =>
                    setWithdrawalForm({ ...withdrawalForm, amount: e.target.value ? parseFloat(e.target.value) : "" })
                  }
                  className="pl-8 text-lg"
                />
              </div>
              <p className="text-xs text-gray-500">
                Máximo: ${(wallet?.available_balance || 0).toLocaleString("es-DO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {/* Método */}
            <div className="space-y-2">
              <Label htmlFor="method" className="text-sm md:text-base font-medium">
                Método de Retiro *
              </Label>
              <select
                id="method"
                value={withdrawalForm.method}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#071d7f]"
              >
                <option value="transfer">Transferencia Bancaria</option>
                <option value="check">Cheque</option>
              </select>
            </div>

            {/* Banco */}
            <div className="space-y-2">
              <Label htmlFor="bank" className="text-sm md:text-base font-medium">
                Banco *
              </Label>
              <Input
                id="bank"
                placeholder="Ej: Banco Dominicano"
                value={withdrawalForm.bank}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, bank: e.target.value })}
                className="text-base"
              />
            </div>

            {/* Número de Cuenta */}
            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-sm md:text-base font-medium">
                Número de Cuenta *
              </Label>
              <Input
                id="accountNumber"
                placeholder="0000 0000 0000 0000"
                value={withdrawalForm.accountNumber}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountNumber: e.target.value })}
                className="text-base"
              />
            </div>

            {/* Titular */}
            <div className="space-y-2">
              <Label htmlFor="accountHolder" className="text-sm md:text-base font-medium">
                Titular de Cuenta *
              </Label>
              <Input
                id="accountHolder"
                placeholder="Nombre completo"
                value={withdrawalForm.accountHolder}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountHolder: e.target.value })}
                className="text-base"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowWithdrawalDialog(false)}
              disabled={isSubmitting}
              className="flex-1 text-base"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleWithdrawalSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-[#071d7f] hover:bg-[#071d7f]/90 text-white text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Solicitar Retiro
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SellerLayout>
  );
};

export default SellerWalletPage;
