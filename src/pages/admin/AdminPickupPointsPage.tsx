import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePickupPoints } from "@/hooks/usePickupPoints";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MapPin, Plus, Edit2, Trash2, Search, Loader2, AlertCircle, CheckCircle, Phone, MapIcon, Building
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PartnerLogoUpload } from "@/components/partners/PartnerLogoUpload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PickupPointFormData {
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  capacity: string;
  department_id: string;
  commune_id: string;
  is_active: boolean;
  logo_url: string;
}

const EMPTY_FORM: PickupPointFormData = {
  name: "",
  address: "",
  city: "",
  country: "Haiti",
  phone: "",
  email: "",
  capacity: "",
  department_id: "",
  commune_id: "",
  is_active: true,
  logo_url: "",
};

const AdminPickupPointsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { pickupPoints, isLoading, createPickupPoint, updatePickupPoint, refetch } = usePickupPoints();

  // Departamentos y comunas (jerarquía Departamento -> Comuna)
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-for-pickup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: communes = [] } = useQuery({
    queryKey: ['communes-for-pickup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communes')
        .select('id, name, code, department_id')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const [activeTab, setActiveTab] = useState("lista");
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState<PickupPointFormData>(EMPTY_FORM);

  const filteredCommunes = (communes as any[]).filter(
    (c) => !form.department_id || c.department_id === form.department_id
  );

  // Filtrar puntos de retiro
  const filteredPoints = pickupPoints.filter((point) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (point.name ?? '').toLowerCase().includes(q) ||
      (point.city ?? '').toLowerCase().includes(q) ||
      (point.address ?? '').toLowerCase().includes(q);
    return matchesSearch;
  });

  // Manejar dialogo nuevo/editar
  const handleOpenDialog = (point?: any) => {
    if (point) {
      setSelectedPoint(point.id);
      const commune = (communes as any[]).find((c) => c.id === point.commune_id);
      setForm({
        name: point.name ?? "",
        address: point.address ?? "",
        city: point.city ?? "",
        country: point.country || "Haiti",
        phone: point.phone || "",
        email: (point as any).email || "",
        capacity: (point as any).capacity != null ? String((point as any).capacity) : "",
        department_id: commune?.department_id || "",
        commune_id: point.commune_id || "",
        is_active: point.is_active !== false,
      });
    } else {
      setSelectedPoint(null);
      setForm(EMPTY_FORM);
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSelectedPoint(null);
    setForm(EMPTY_FORM);
  };

  // Validar y enviar
  const handleSubmit = async () => {
    if (!form.name) {
      toast({
        title: "Error",
        description: "El nombre del punto es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!form.address) {
      toast({
        title: "Error",
        description: "La dirección es requerida",
        variant: "destructive",
      });
      return;
    }

    if (!form.city) {
      toast({
        title: "Error",
        description: "La ciudad es requerida",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim() || "Haiti",
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        commune_id: form.commune_id || null,
        is_active: form.is_active,
      };

      const success = selectedPoint
        ? await updatePickupPoint(selectedPoint, payload)
        : await createPickupPoint(payload);

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
    if (!selectedPoint) return;

    setIsSubmitting(true);
    try {
      const success = await updatePickupPoint(selectedPoint, { is_active: false } as any);
      
      if (success) {
        setShowDeleteAlert(false);
        setSelectedPoint(null);
        await refetch();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Puntos de Retiro" subtitle="Gestiona los puntos de entrega y retiro de órdenes">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Puntos de Retiro" subtitle="Gestiona los puntos de entrega y retiro de órdenes">
      {/* Main Content */}
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-1 mb-6">
            <TabsTrigger value="lista" className="text-xs md:text-sm">
              Lista de Puntos ({filteredPoints.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB: LISTA DE PUNTOS */}
          <TabsContent value="lista" className="space-y-6 mt-0">
            {/* Buscador + Nuevo */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, dirección o ciudad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo punto
              </Button>
            </div>

            {/* Grid de Puntos */}
            {filteredPoints.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">No hay puntos de retiro creados aún</p>
                <p className="text-gray-400 text-sm mt-2">Crea uno nuevo para comenzar</p>
                <Button className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear punto de retiro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPoints.map((point) => (
                  <Card key={point.id} className="border border-gray-200 hover:shadow-md transition">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{point.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{point.city}</p>
                        </div>
                        <Badge variant={point.is_active ? "default" : "secondary"}>
                          {point.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Dirección */}
                      <div className="flex gap-2">
                        <MapIcon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Dirección</p>
                          <p className="text-sm text-gray-900">{point.address}</p>
                        </div>
                      </div>

                      {/* País */}
                      <div className="flex gap-2">
                        <Building className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">País</p>
                          <p className="text-sm text-gray-900">{point.country}</p>
                        </div>
                      </div>

                      {/* Teléfono */}
                      {point.phone && (
                        <div className="flex gap-2">
                          <Phone className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">Teléfono</p>
                            <p className="text-sm text-gray-900">{point.phone}</p>
                          </div>
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(point)}
                          className="flex-1"
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedPoint(point.id);
                            setShowDeleteAlert(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para crear/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPoint ? "Editar Punto de Retiro" : "Nuevo Punto de Retiro"}
            </DialogTitle>
            <DialogDescription>
              {selectedPoint ? "Actualiza los datos del punto" : "Crea un nuevo punto de entrega"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                placeholder="Ej: Centro de Retiro Puerto Príncipe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                placeholder="Ej: Calle Principal 123"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            {/* Ciudad */}
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                placeholder="Ej: Puerto Príncipe"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>

            {/* País */}
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input
                id="country"
                placeholder="Ej: Haiti"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input
                id="phone"
                placeholder="Ej: +509 28XX XXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Correo (opcional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="punto@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            {/* Capacidad */}
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacidad (paquetes/día, opcional)</Label>
              <Input
                id="capacity"
                type="number"
                min={0}
                placeholder="Ej: 50"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>

            {/* Departamento */}
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={form.department_id}
                onValueChange={(v) => setForm({ ...form, department_id: v === '__none__' ? '' : v, commune_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar departamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin departamento —</SelectItem>
                  {(departments as any[]).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Comuna */}
            <div className="space-y-2">
              <Label>Comuna</Label>
              <Select
                value={form.commune_id}
                onValueChange={(v) => setForm({ ...form, commune_id: v === '__none__' ? '' : v })}
                disabled={!form.department_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.department_id ? "Seleccionar comuna..." : "Selecciona un departamento primero"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin comuna —</SelectItem>
                  {filteredCommunes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code ? `${c.code} — ` : ''}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                La comuna define la logística local y los puntos disponibles en el checkout.
              </p>
            </div>

            {/* Estado */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Punto activo</Label>
                <p className="text-xs text-muted-foreground">Visible para los clientes en el checkout</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para eliminar */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogTitle>¿Desactivar punto de retiro?</AlertDialogTitle>
          <AlertDialogDescription>
            Se desactivará el punto pero se conservarán sus datos. Puedes reactivarlo después.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Desactivando..." : "Desactivar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminPickupPointsPage;
