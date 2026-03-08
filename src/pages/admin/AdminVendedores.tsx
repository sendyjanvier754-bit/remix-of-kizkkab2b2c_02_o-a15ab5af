import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  RefreshCw,
  UserCheck,
  UserX,
  Percent,
  Edit2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCommissionOverrides } from "@/hooks/useCommissionOverrides";

interface Seller {
  id: string;
  user_id: string;
  store_id: string | null;
  business_name: string | null;
  business_type: string | null;
  is_verified: boolean;
  verification_status: string;
  commission_rate: number | null;
  is_active: boolean;
  created_at: string;
  // Datos de profiles
  full_name: string | null;
  email: string | null;
  phone: string | null;
  // IDs
  user_code: string | null;  // Código personal del usuario (KZ...)
  store_slug: string | null;  // Slug de la tienda (K...)
}

const AdminVendedores = () => {
  const { t } = useTranslation();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionSeller, setActionSeller] = useState<Seller | null>(null);
  const [actionType, setActionType] = useState<"verify" | "unverify" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Commission dialog states
  const { createOverride, overrides } = useCommissionOverrides();
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);
  const [selectedSellerForCommission, setSelectedSellerForCommission] = useState<Seller | null>(null);
  const [commissionForm, setCommissionForm] = useState({
    commission_percentage: 0,
    commission_fixed: 0,
    reason: "",
  });
  const [isSavingCommission, setIsSavingCommission] = useState(false);

  const fetchSellers = async () => {
    setIsLoading(true);
    try {
      // 1. Obtener sellers
      const { data: sellersData, error: sellersError } = await supabase
        .from("sellers")
        .select("*")
        .order("created_at", { ascending: false });

      if (sellersError) throw sellersError;

      // 2. Para cada seller, obtener datos de profiles y stores
      const sellersWithCodes = await Promise.all(
        (sellersData || []).map(async (seller) => {
          // Obtener datos del usuario de profiles
          let profileData = { user_code: null, full_name: null, email: null, phone: null };
          if (seller.user_id) {
            const { data } = await supabase
              .from("profiles")
              .select("user_code, full_name, email, phone")
              .eq("id", seller.user_id)
              .maybeSingle();
            if (data) {
              profileData = {
                user_code: data.user_code || null,
                full_name: data.full_name || null,
                email: data.email || null,
                phone: data.phone || null,
              };
            }
          }

          // Obtener store slug
          let storeSlug = null;
          if (seller.user_id) {
            const { data: storeData } = await supabase
              .from("stores")
              .select("slug")
              .eq("owner_user_id", seller.user_id)
              .maybeSingle();
            storeSlug = storeData?.slug || null;
          }

          return {
            ...seller,
            ...profileData,
            store_slug: storeSlug,
          };
        })
      );

      setSellers(sellersWithCodes);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      toast.error("Error al cargar vendedores");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleVerifyAction = async () => {
    if (!actionSeller || !actionType) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase
        .from("sellers")
        .update({ 
          is_verified: actionType === "verify",
          verification_status: actionType === "verify" ? "verified" : "pending_verification"
        })
        .eq("id", actionSeller.id)
        .select();

      if (error) {
        console.error("Error detallado:", error);
        throw new Error(`Error al actualizar: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No se pudo actualizar el vendedor. Verifica los permisos.");
      }

      toast.success(
        actionType === "verify"
          ? `Vendedor ${actionSeller.full_name || actionSeller.email} verificado exitosamente`
          : `Vendedor ${actionSeller.full_name || actionSeller.email} desverificado`
      );

      // Update local state
      setSellers((prev) =>
        prev.map((s) =>
          s.id === actionSeller.id
            ? { 
                ...s, 
                is_verified: actionType === "verify",
                verification_status: actionType === "verify" ? "verified" : "pending_verification"
              }
            : s
        )
      );
    } catch (error: any) {
      console.error("Error updating seller:", error);
      toast.error(error.message || "Error al actualizar vendedor");
    } finally {
      setIsProcessing(false);
      setActionSeller(null);
      setActionType(null);
    }
  };

  const handleSaveCommission = async () => {
    if (!selectedSellerForCommission) return;

    if (commissionForm.commission_percentage === 0 && commissionForm.commission_fixed === 0) {
      toast.error("Debes ingresar al menos un valor de comisión");
      return;
    }

    setIsSavingCommission(true);
    try {
      const success = await createOverride(selectedSellerForCommission.id, {
        commission_percentage: commissionForm.commission_percentage || undefined,
        commission_fixed: commissionForm.commission_fixed || undefined,
        reason: commissionForm.reason,
      });

      if (success) {
        setShowCommissionDialog(false);
        setSelectedSellerForCommission(null);
        setCommissionForm({ commission_percentage: 0, commission_fixed: 0, reason: "" });
        toast.success("Comisión personalizada guardada");
      }
    } finally {
      setIsSavingCommission(false);
    }
  };

  const filteredSellers = sellers.filter(
    (seller) =>
      seller.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.user_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.store_slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingSellers = filteredSellers.filter((s) => !s.is_verified);
  const verifiedSellers = filteredSellers.filter((s) => s.is_verified);

  return (
    <AdminLayout title={t('adminSellers.title')} subtitle={t('adminSellers.subtitle')}>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" onClick={fetchSellers} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nombre, email o negocio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="text-2xl font-bold">{sellers.length}</div>
            <div className="text-muted-foreground text-sm">Total Vendedores</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-700">
              {sellers.filter((s) => !s.is_verified).length}
            </div>
            <div className="text-yellow-600 text-sm">Pendientes de Verificación</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">
              {sellers.filter((s) => s.is_verified).length}
            </div>
            <div className="text-green-600 text-sm">Verificados</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Pending Verification */}
            {pendingSellers.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UserX className="w-5 h-5 text-yellow-500" />
                  Pendientes de Verificación ({pendingSellers.length})
                </h2>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>ID Usuario</TableHead>
                        <TableHead>ID Tienda</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Fecha Registro</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingSellers.map((seller) => (
                        <TableRow key={seller.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{seller.full_name || 'Sin nombre'}</div>
                              {seller.business_name && (
                                <div className="text-sm text-muted-foreground">
                                  {seller.business_name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{seller.email}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200">
                              {seller.user_code || '-'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200">
                              {seller.store_slug || '-'}
                            </code>
                          </TableCell>
                          <TableCell>{seller.phone || "-"}</TableCell>
                          <TableCell>
                            {new Date(seller.created_at).toLocaleDateString("es")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              Pendiente
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                setActionSeller(seller);
                                setActionType("verify");
                              }}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verificar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Verified Sellers */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-500" />
                Vendedores Verificados ({verifiedSellers.length})
              </h2>
              {verifiedSellers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay vendedores verificados
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>ID Usuario</TableHead>
                        <TableHead>ID Tienda</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Fecha Registro</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifiedSellers.map((seller) => (
                        <TableRow key={seller.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{seller.full_name || 'Sin nombre'}</div>
                              {seller.business_name && (
                                <div className="text-sm text-muted-foreground">
                                  {seller.business_name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{seller.email}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200">
                              {seller.user_code || '-'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200">
                              {seller.store_slug || '-'}
                            </code>
                          </TableCell>
                          <TableCell>{seller.phone || "-"}</TableCell>
                          <TableCell>
                            {new Date(seller.created_at).toLocaleDateString("es")}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700 border-green-300">
                              Verificado
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2 flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSellerForCommission(seller);
                                setCommissionForm({ commission_percentage: 0, commission_fixed: 0, reason: "" });
                                setShowCommissionDialog(true);
                              }}
                              className="text-purple-600 border-purple-300 hover:bg-purple-50"
                            >
                              <Percent className="w-4 h-4 mr-1" />
                              Comisión
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActionSeller(seller);
                                setActionType("unverify");
                              }}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Revocar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!actionSeller && !!actionType}
        onOpenChange={() => {
          setActionSeller(null);
          setActionType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "verify" ? "Verificar Vendedor" : "Revocar Verificación"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "verify" ? (
                <>
                  ¿Confirmas que deseas verificar a <strong>{actionSeller?.full_name || actionSeller?.email}</strong>?
                  <br />
                  Una vez verificado, el vendedor podrá publicar productos en la plataforma.
                </>
              ) : (
                <>
                  ¿Confirmas que deseas revocar la verificación de{" "}
                  <strong>{actionSeller?.full_name || actionSeller?.email}</strong>?
                  <br />
                  El vendedor no podrá publicar nuevos productos hasta ser verificado nuevamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVerifyAction}
              disabled={isProcessing}
              className={
                actionType === "verify"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {actionType === "verify" ? "Verificar" : "Revocar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Commission Dialog */}
      <Dialog open={showCommissionDialog} onOpenChange={setShowCommissionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-purple-600" />
              Comisión Personalizada
            </DialogTitle>
            <DialogDescription>
              Configura una comisión personalizada para{" "}
              <strong>{selectedSellerForCommission?.full_name || selectedSellerForCommission?.email}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Comisión Porcentaje */}
            <div className="space-y-2">
              <Label htmlFor="comm-pct" className="text-sm font-medium">
                Porcentaje de Comisión (%)
              </Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                <Input
                  id="comm-pct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={commissionForm.commission_percentage}
                  onChange={(e) =>
                    setCommissionForm({
                      ...commissionForm,
                      commission_percentage: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pr-8"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Comisión Fija */}
            <div className="space-y-2">
              <Label htmlFor="comm-fix" className="text-sm font-medium">
                Comisión Fija ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="comm-fix"
                  type="number"
                  min="0"
                  step="0.01"
                  value={commissionForm.commission_fixed}
                  onChange={(e) =>
                    setCommissionForm({
                      ...commissionForm,
                      commission_fixed: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Razón */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Razón (opcional)
              </Label>
              <Input
                id="reason"
                placeholder="¿Por qué se aplica este override?"
                value={commissionForm.reason}
                onChange={(e) =>
                  setCommissionForm({ ...commissionForm, reason: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCommissionDialog(false)}
              disabled={isSavingCommission}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCommission}
              disabled={isSavingCommission}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSavingCommission ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Percent className="h-4 w-4 mr-2" />
                  Guardar Comisión
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminVendedores;
