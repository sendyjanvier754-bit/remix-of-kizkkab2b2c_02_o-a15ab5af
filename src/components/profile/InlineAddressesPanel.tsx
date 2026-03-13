import { useState, useEffect } from "react";
import { useAddresses, AddressInput } from "@/hooks/useAddresses";
import { useLogisticsEngine } from "@/hooks/useLogisticsEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Plus, Pencil, Trash2, Star, Loader2, Home, Building2,
} from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM: AddressInput = {
  label: "Casa",
  full_name: "",
  phone: "",
  street_address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "HT",
  is_default: false,
  notes: "",
  department_id: null,
  commune_id: null,
};

export function InlineAddressesPanel() {
  const { addresses, isLoading, createAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses();
  const logistics = useLogisticsEngine();
  const { data: departments = [] } = logistics.useDepartments();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressInput>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load communes based on selected department
  const { data: communes = [] } = logistics.useCommunes(form.department_id || undefined);

  // When department changes, clear commune
  const handleDepartmentChange = (deptId: string) => {
    setForm(f => ({ ...f, department_id: deptId, commune_id: null, state: "" }));
  };

  const handleCommuneChange = (communeId: string) => {
    const commune = communes.find(c => c.id === communeId);
    setForm(f => ({
      ...f,
      commune_id: communeId,
      city: commune?.name || f.city,
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (addr: (typeof addresses)[0]) => {
    setEditingId(addr.id);
    setForm({
      label: addr.label,
      full_name: addr.full_name,
      phone: addr.phone ?? "",
      street_address: addr.street_address,
      city: addr.city,
      state: addr.state ?? "",
      postal_code: addr.postal_code ?? "",
      country: addr.country,
      is_default: addr.is_default,
      notes: addr.notes ?? "",
      department_id: addr.department_id,
      commune_id: addr.commune_id,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.street_address) {
      toast.error("Nombre y dirección son requeridos");
      return;
    }
    if (!form.department_id) {
      toast.error("Selecciona un departamento");
      return;
    }
    if (!form.commune_id) {
      toast.error("Selecciona una comuna");
      return;
    }
    if (editingId) {
      await updateAddress.mutateAsync({ id: editingId, ...form });
    } else {
      await createAddress.mutateAsync(form as any);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteAddress.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const isSaving = createAddress.isPending || updateAddress.isPending;

  if (isLoading) {
    return (
      <div className="bg-background border border-border rounded-md p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-background border border-border rounded-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Mis Direcciones</h2>
            <Badge variant="secondary" className="text-xs">{addresses.length}</Badge>
          </div>
          <Button size="sm" onClick={openCreate} className="h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </Button>
        </div>

        {addresses.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No tienes direcciones guardadas</p>
            <Button size="sm" onClick={openCreate} className="mt-1 gap-1">
              <Plus className="w-3.5 h-3.5" /> Agregar dirección
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {addresses.map((addr) => (
              <div key={addr.id} className="px-5 py-4 flex gap-3 group hover:bg-muted/20 transition-colors">
                <div className="shrink-0 mt-0.5">
                  {addr.label?.toLowerCase().includes("casa") ? (
                    <Home className="w-5 h-5 text-primary" />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{addr.label}</span>
                    {addr.is_default && (
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                        <Star className="w-2.5 h-2.5 mr-1" />Predeterminada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-foreground mt-0.5">{addr.full_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {addr.street_address}, {addr.city}
                    {addr.state && `, ${addr.state}`}
                  </p>
                  {addr.phone && <p className="text-xs text-muted-foreground">{addr.phone}</p>}
                </div>
                <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!addr.is_default && (
                    <button
                      onClick={() => setDefaultAddress.mutate(addr.id)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Establecer como predeterminada"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(addr)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(addr.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar dirección" : "Nueva dirección"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* Label + Country row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Etiqueta *</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Casa, Trabajo…"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">País</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))}
                  placeholder="HT"
                  className="h-9 mt-1"
                />
              </div>
            </div>

            {/* Full name */}
            <div>
              <Label className="text-xs">Nombre completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Juan Pérez"
                className="h-9 mt-1"
              />
            </div>

            {/* Phone */}
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+509 000 0000"
                className="h-9 mt-1"
              />
            </div>

            {/* Department */}
            <div>
              <Label className="text-xs">Departamento *</Label>
              <Select value={form.department_id || ""} onValueChange={handleDepartmentChange}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Seleccionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Commune */}
            <div>
              <Label className="text-xs">Comuna *</Label>
              <Select
                value={form.commune_id || ""}
                onValueChange={handleCommuneChange}
                disabled={!form.department_id}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder={form.department_id ? "Seleccionar comuna" : "Selecciona un departamento primero"} />
                </SelectTrigger>
                <SelectContent>
                  {communes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Street address */}
            <div>
              <Label className="text-xs">Dirección *</Label>
              <Input
                value={form.street_address}
                onChange={(e) => setForm(f => ({ ...f, street_address: e.target.value }))}
                placeholder="Calle, número, sector…"
                className="h-9 mt-1"
              />
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notas de entrega</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Instrucciones para el repartidor…"
                className="mt-1 min-h-[70px] resize-none"
              />
            </div>

            {/* Default checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm(f => ({ ...f, is_default: e.target.checked }))}
                className="rounded"
              />
              <span className="text-xs text-foreground">Establecer como predeterminada</span>
            </label>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              {editingId ? "Guardar cambios" : "Crear dirección"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar dirección?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive" size="sm"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteAddress.isPending}
            >
              {deleteAddress.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
