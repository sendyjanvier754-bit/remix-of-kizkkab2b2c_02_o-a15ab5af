import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { useCommissionOverrides } from "@/hooks/useCommissionOverrides";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Percent, Plus, Edit2, Trash2, Filter, Search, Loader2, AlertCircle, CheckCircle,
  TrendingUp, DollarSign, Clock, Eye, EyeOff, Settings, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OverrideFormData {
  seller_id: string;
  commission_percentage: number | "";
  commission_fixed: number | "";
  tax_tca_percentage: number | "";
  reason: string;
}

const AdminCommissionPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { overrides, isLoading, createOverride, updateOverride, deleteOverride, refetch } = useCommissionOverrides();
  const { config, isLoading: configLoading, updateMultipleSettings } = usePlatformSettings();

  const [activeTab, setActiveTab] = useState("default");
  const [isSaving, setIsSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [showPasswords, setShowPasswords] = useState(false);

  // Configuración global de comisiones
  const [globalCommissionForm, setGlobalCommissionForm] = useState({
    commission_percentage: config.commission_percentage,
    commission_fixed: config.commission_fixed,
    tax_tca_percentage: config.tax_tca_percentage,
  });

  // Bulk commission states
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState({
    commission_percentage: 0,
    commission_fixed: 0,
    reason: "",
  });
  const [isBulkLoading, setIsBulkLoading] = useState(true);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const [form, setForm] = useState<OverrideFormData>({
    seller_id: "",
    commission_percentage: "",
    commission_fixed: "",
    tax_tca_percentage: "",
    reason: "",
  });

  // Filtrar overrides
  const filteredOverrides = overrides.filter((override) => {
    const matchesSearch = override.seller_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         override.seller_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" 
      ? true 
      : filterStatus === "active" 
        ? override.is_active 
        : !override.is_active;
    return matchesSearch && matchesStatus;
  });

  // Manejar dialogo nuevo/editar
  const handleOpenDialog = (override?: any) => {
    if (override) {
      setSelectedOverride(override.id);
      setForm({
        seller_id: override.seller_id,
        commission_percentage: override.commission_percentage || "",
        commission_fixed: override.commission_fixed || "",
        tax_tca_percentage: override.tax_tca_percentage || "",
        reason: override.reason || "",
      });
    } else {
      setSelectedOverride(null);
      setForm({
        seller_id: "",
        commission_percentage: "",
        commission_fixed: "",
        tax_tca_percentage: "",
        reason: "",
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setForm({
      seller_id: "",
      commission_percentage: "",
      commission_fixed: "",
      tax_tca_percentage: "",
      reason: "",
    });
  };

  // Validar y enviar
  const handleSubmit = async () => {
    if (!form.seller_id) {
      toast({
        title: "Error",
        description: "Selecciona un vendedor",
        variant: "destructive",
      });
      return;
    }

    if (!form.commission_percentage && !form.commission_fixed) {
      toast({
        title: "Error",
        description: "Ingresa un porcentaje o monto fijo de comisión",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        commission_percentage: form.commission_percentage ? parseFloat(String(form.commission_percentage)) : undefined,
        commission_fixed: form.commission_fixed ? parseFloat(String(form.commission_fixed)) : undefined,
        tax_tca_percentage: form.tax_tca_percentage ? parseFloat(String(form.tax_tca_percentage)) : undefined,
        reason: form.reason || undefined,
      };

      const success = selectedOverride
        ? await updateOverride(selectedOverride, submitData)
        : await createOverride(form.seller_id, submitData);

      if (success) {
        handleCloseDialog();
        await refetch();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar eliminación
  const handleDelete = async () => {
    if (!selectedOverride) return;

    setIsSubmitting(true);
    try {
      await deleteOverride(selectedOverride);
      setShowDeleteAlert(false);
      setSelectedOverride(null);
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cargar vendedores para aplicación masiva
  const loadSellers = async () => {
    if (sellers.length > 0) return;
    
    setIsBulkLoading(true);
    try {
      const { data: sellersData, error } = await supabase
        .from('sellers')
          .select('*')
      if (error) throw error;

      setSellers(sellersData || []);
    } catch (error) {
      console.error("Error loading sellers:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los vendedores",
        variant: "destructive",
      });
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Guardar configuración global de comisiones
  const handleSaveGlobalCommission = async () => {
    setIsSaving(true);
    try {
      const success = await updateMultipleSettings({
        commission_percentage: globalCommissionForm.commission_percentage,
        commission_fixed: globalCommissionForm.commission_fixed,
        tax_tca_percentage: globalCommissionForm.tax_tca_percentage,
      });
      if (success) {
        toast({
          title: "Éxito",
          description: "Configuración global de comisiones actualizada",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Aplicar comisión a múltiples vendedores
  const handleBulkApply = async () => {
    if (selectedSellers.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un vendedor",
        variant: "destructive",
      });
      return;
    }

    if (bulkForm.commission_percentage === 0 && bulkForm.commission_fixed === 0) {
      toast({
        title: "Error",
        description: "Ingresa al menos un valor de comisión",
        variant: "destructive",
      });
      return;
    }

    setIsBulkSubmitting(true);
    try {
      let successCount = 0;
      
      for (const sellerId of selectedSellers) {
        const success = await createOverride(sellerId, {
          commission_percentage: bulkForm.commission_percentage || undefined,
          commission_fixed: bulkForm.commission_fixed || undefined,
          reason: bulkForm.reason,
        });
        if (success) successCount++;
      }

      toast({
        title: "Éxito",
        description: `Comisiones aplicadas a ${successCount}/${selectedSellers.length} vendedores`,
      });

      setSelectedSellers([]);
      setBulkForm({ commission_percentage: 0, commission_fixed: 0, reason: "" });
      await refetch();
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-4 pb-20">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="Gestión de Comisiones" subtitle="Configuración global y overrides por vendedor">
      {/* Main Content */}
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
            <TabsTrigger value="default" className="text-xs md:text-sm">
              Config. Global
            </TabsTrigger>
            <TabsTrigger value="overrides" className="text-xs md:text-sm">
              Overrides
            </TabsTrigger>
            <TabsTrigger value="bulk" className="text-xs md:text-sm">
              Aplicar Masivamente
            </TabsTrigger>
            <TabsTrigger value="historial" className="text-xs md:text-sm">
              Historial
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CONFIGURACIÓN GLOBAL */}
          <TabsContent value="default" className="space-y-6 mt-0">
            <Card className="border border-gray-200">
              <CardHeader className="pb-3 md:pb-4 border-b">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">Configuración Global de Comisiones</h3>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Define los parámetros de comisión por defecto aplicables a todas las transacciones
                </p>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Comisión Porcentaje */}
                <div className="space-y-2">
                  <Label htmlFor="global-percent" className="text-sm md:text-base font-medium">
                    Porcentaje de Comisión (%)
                  </Label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                    <Input
                      id="global-percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={globalCommissionForm.commission_percentage}
                      onChange={(e) =>
                        setGlobalCommissionForm({
                          ...globalCommissionForm,
                          commission_percentage: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pr-8 text-lg"
                    />
                  </div>
                </div>

                {/* Comisión Fija */}
                <div className="space-y-2">
                  <Label htmlFor="global-fixed" className="text-sm md:text-base font-medium">
                    Comisión Fija ($)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                    <Input
                      id="global-fixed"
                      type="number"
                      min="0"
                      step="0.01"
                      value={globalCommissionForm.commission_fixed}
                      onChange={(e) =>
                        setGlobalCommissionForm({
                          ...globalCommissionForm,
                          commission_fixed: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pl-8 text-lg"
                    />
                  </div>
                </div>

                {/* Impuesto TCA */}
                <div className="space-y-2">
                  <Label htmlFor="global-tax" className="text-sm md:text-base font-medium">
                    Impuesto TCA (%)
                  </Label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                    <Input
                      id="global-tax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={globalCommissionForm.tax_tca_percentage}
                      onChange={(e) =>
                        setGlobalCommissionForm({
                          ...globalCommissionForm,
                          tax_tca_percentage: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pr-8 text-lg"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveGlobalCommission}
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Configuración Global
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: OVERRIDES ACTIVOS */}
          <TabsContent value="overrides" className="space-y-6 mt-0">
            {/* Buscador y Filtros */}
            <div className="space-y-3 md:space-y-0 md:flex md:gap-3">
              {/* Búsqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar por vendedor o ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm md:text-base"
                />
              </div>

              {/* Filtro estado */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-sm md:text-base px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </div>
            </div>

            {/* Tabla de Overrides */}
            {filteredOverrides.length === 0 ? (
              <Card className="border border-gray-200">
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-base md:text-lg">
                    {searchQuery ? "No se encontraron resultados" : "No hay overrides configurados"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredOverrides.map((override) => (
                  <Card key={override.id} className="border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4 md:p-6">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-0">
                        {/* Vendedor */}
                        <div className="md:col-span-2">
                          <p className="text-xs md:text-sm font-medium text-gray-600">Vendedor</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900">{override.seller_name || "N/A"}</p>
                          <p className="text-xs text-gray-500 truncate">{override.seller_id}</p>
                        </div>

                        {/* Comisión Porcentaje */}
                        <div className="md:col-span-1">
                          <p className="text-xs md:text-sm font-medium text-gray-600">% Comisión</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Percent className="h-4 w-4 text-blue-600" />
                            <p className="text-sm md:text-base font-bold text-blue-600">
                              {override.commission_percentage ? `${override.commission_percentage}%` : "—"}
                            </p>
                          </div>
                        </div>

                        {/* Comisión Fija */}
                        <div className="md:col-span-1">
                          <p className="text-xs md:text-sm font-medium text-gray-600">Comisión Fija</p>
                          <div className="flex items-center gap-1 mt-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <p className="text-sm md:text-base font-bold text-green-600">
                              {override.commission_fixed ? `$${override.commission_fixed.toFixed(2)}` : "—"}
                            </p>
                          </div>
                        </div>

                        {/* Estado */}
                        <div className="md:col-span-1 flex items-end">
                          <Badge className={override.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                            {override.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>

                        {/* Acciones */}
                        <div className="md:col-span-1 flex items-end gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(override)}
                            className="text-xs"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOverride(override.id);
                              setShowDeleteAlert(true);
                            }}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expandido: Detalles adicionales */}
                      {override.reason && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-xs md:text-sm text-gray-600">
                            <strong>Razón:</strong> {override.reason}
                          </p>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs md:text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Creado: {format(new Date(override.created_at), "d MMM, yyyy", { locale: es })}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          Actualizado: {format(new Date(override.updated_at), "d MMM, yyyy", { locale: es })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-8 pt-6 border-t">
              <Card className="bg-white border border-gray-200">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs md:text-sm font-medium text-gray-600">Total Overrides</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{overrides.length}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs md:text-sm font-medium text-gray-600">Activos</p>
                  <p className="text-2xl md:text-3xl font-bold text-green-600 mt-2">
                    {overrides.filter(o => o.is_active).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs md:text-sm font-medium text-gray-600">Con % Definido</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-600 mt-2">
                    {overrides.filter(o => o.commission_percentage !== null).length}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: APLICAR MASIVAMENTE */}
          <TabsContent value="bulk" className="space-y-6 mt-0">
            <Card className="border border-gray-200">
              <CardHeader className="pb-3 md:pb-4 border-b">
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">Aplicar Comisión a Múltiples Vendedores</h3>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Selecciona uno o varios vendedores y aplícales la misma comisión personalizada
                </p>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Seleccionar Vendedores */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Selecciona Vendedores</Label>
                  <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                    {isBulkLoading ? (
                      <div className="p-4 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                      </div>
                    ) : sellers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Cargando vendedores...
                      </div>
                    ) : (
                      <div className="space-y-2 p-4">
                        {sellers.map((seller) => (
                          <label key={seller.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                            <input
                              type="checkbox"
                              checked={selectedSellers.includes(seller.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSellers([...selectedSellers, seller.id]);
                                } else {
                                  setSelectedSellers(selectedSellers.filter(id => id !== seller.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{seller.name}</p>
                              <p className="text-xs text-gray-500">{seller.business_name || seller.id}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Seleccionados: <span className="font-bold">{selectedSellers.length}</span> vendedor(es)
                  </p>
                </div>

                {/* Comisión Porcentaje */}
                <div className="space-y-2">
                  <Label htmlFor="bulk-percent" className="text-sm md:text-base font-medium">
                    Porcentaje de Comisión (%)
                  </Label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                    <Input
                      id="bulk-percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={bulkForm.commission_percentage}
                      onChange={(e) =>
                        setBulkForm({ ...bulkForm, commission_percentage: parseFloat(e.target.value) || 0 })
                      }
                      className="pr-8 text-lg"
                    />
                  </div>
                </div>

                {/* Comisión Fija */}
                <div className="space-y-2">
                  <Label htmlFor="bulk-fixed" className="text-sm md:text-base font-medium">
                    Comisión Fija ($)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                    <Input
                      id="bulk-fixed"
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkForm.commission_fixed}
                      onChange={(e) =>
                        setBulkForm({ ...bulkForm, commission_fixed: parseFloat(e.target.value) || 0 })
                      }
                      className="pl-8 text-lg"
                    />
                  </div>
                </div>

                {/* Razón */}
                <div className="space-y-2">
                  <Label htmlFor="bulk-reason" className="text-sm md:text-base font-medium">
                    Razón/Notas (opcional)
                  </Label>
                  <textarea
                    id="bulk-reason"
                    placeholder="¿Por qué se aplica este override a estos vendedores?"
                    value={bulkForm.reason}
                    onChange={(e) => setBulkForm({ ...bulkForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-20 resize-none"
                  />
                </div>

                {/* Info Card */}
                {selectedSellers.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>📋 Resumen:</strong> Se aplicará una comisión de{" "}
                      {bulkForm.commission_percentage}% + ${bulkForm.commission_fixed.toFixed(2)} a{" "}
                      <strong>{selectedSellers.length}</strong> vendedor(es) seleccionado(s).
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleBulkApply}
                  disabled={isBulkSubmitting || selectedSellers.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
                >
                  {isBulkSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aplicar a {selectedSellers.length} Vendedor(es)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: HISTORIAL */}
          <TabsContent value="historial" className="space-y-6 mt-0">
            <Card className="border border-gray-200">
              <CardHeader className="pb-3 md:pb-4">
                <h3 className="text-lg md:text-xl font-bold text-gray-900">Historial de Cambios</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overrides.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay historial disponible</p>
                  ) : (
                    overrides.map((override, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0 mt-1">
                          <CheckCircle className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm md:text-base font-semibold text-gray-900">
                            Override para {override.seller_name || override.seller_id}
                          </p>
                          <p className="text-xs md:text-sm text-gray-600 mt-1">
                            {override.commission_percentage && `${override.commission_percentage}% de comisión`}
                            {override.commission_percentage && override.commission_fixed && " + "}
                            {override.commission_fixed && `$${override.commission_fixed} fijo`}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Actualizado: {format(new Date(override.updated_at), "d MMM, yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <Badge className={override.is_active ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-800 text-xs"}>
                          {override.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Crear/Editar Override */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="w-[95vw] md:max-w-2xl mx-auto p-4 md:p-6 rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl text-gray-900">
              {selectedOverride ? "Editar Override" : "Nuevo Override de Comisión"}
            </DialogTitle>
            <DialogDescription className="text-sm md:text-base">
              Configura una comisión personalizada para un vendedor específico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Vendedor */}
            <div className="space-y-2">
              <Label htmlFor="seller" className="text-sm md:text-base font-medium">
                Vendedor *
              </Label>
              <Input
                id="seller"
                placeholder="ID del vendedor o selecciona de la lista"
                value={form.seller_id}
                onChange={(e) => setForm({ ...form, seller_id: e.target.value })}
                className="text-base"
              />
              <p className="text-xs text-gray-500">
                Los overrides se asignan por vendedor. Un vendedor solo puede tener un override activo.
              </p>
            </div>

            {/* Comisión Porcentaje */}
            <div className="space-y-2">
              <Label htmlFor="commission-percentage" className="text-sm md:text-base font-medium">
                Comisión Porcentual (%)
              </Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                <Input
                  id="commission-percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0.00"
                  value={form.commission_percentage}
                  onChange={(e) =>
                    setForm({ ...form, commission_percentage: e.target.value ? parseFloat(e.target.value) : "" })
                  }
                  className="pr-8 text-lg"
                />
              </div>
              <p className="text-xs text-gray-500">
                Ejemplo: 5 = 5% de comisión sobre cada venta
              </p>
            </div>

            {/* Comisión Fija */}
            <div className="space-y-2">
              <Label htmlFor="commission-fixed" className="text-sm md:text-base font-medium">
                Comisión Fija ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <Input
                  id="commission-fixed"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.commission_fixed}
                  onChange={(e) =>
                    setForm({ ...form, commission_fixed: e.target.value ? parseFloat(e.target.value) : "" })
                  }
                  className="pl-8 text-lg"
                />
              </div>
              <p className="text-xs text-gray-500">
                Monto fijo a descontar por cada venta (se aplica junto con porcentaje si ambos existen)
              </p>
            </div>

            {/* Tax TCA */}
            <div className="space-y-2">
              <Label htmlFor="tax-tca" className="text-sm md:text-base font-medium">
                Porcentaje TCA (%)
              </Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                <Input
                  id="tax-tca"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0.00"
                  value={form.tax_tca_percentage}
                  onChange={(e) =>
                    setForm({ ...form, tax_tca_percentage: e.target.value ? parseFloat(e.target.value) : "" })
                  }
                  className="pr-8 text-lg"
                />
              </div>
            </div>

            {/* Razón */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm md:text-base font-medium">
                Razón/Notas
              </Label>
              <textarea
                id="reason"
                placeholder="¿Por qué se aplica este override? (opcional)"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-purple-600 min-h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSubmitting}
              className="flex-1 text-base"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {selectedOverride ? "Actualizar" : "Crear"} Override
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert: Confirmar Eliminación */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="w-[95vw] md:max-w-md mx-auto rounded-xl">
          <AlertDialogTitle className="text-xl text-gray-900">Eliminar Override</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-gray-600">
            ¿Estás seguro de que deseas eliminar este override de comisión? Esta acción no se puede deshacer.
          </AlertDialogDescription>
          <div className="flex gap-3 pt-4">
            <AlertDialogCancel disabled={isSubmitting} className="flex-1 text-base">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminCommissionPage;
