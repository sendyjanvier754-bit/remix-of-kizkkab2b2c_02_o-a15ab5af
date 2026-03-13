import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddresses, Address, AddressInput } from '@/hooks/useAddresses';
import { supabase } from '@/integrations/supabase/client';
import { Plus, MapPin, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Country { id: string; name: string; code: string; }
interface Department { id: string; name: string; code: string; }
interface Commune { id: string; name: string; code: string; }

interface AddressesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyAddress: AddressInput = {
  label: 'Casa',
  full_name: '',
  phone: '',
  street_address: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  is_default: false,
  notes: '',
  department_id: null,
  commune_id: null,
};

export const AddressesDialog = ({ open, onOpenChange }: AddressesDialogProps) => {
  const { addresses, isLoading, createAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses();
  const [isEditing, setIsEditing] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<AddressInput>(emptyAddress);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Location data
  const [countries, setCountries] = useState<Country[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedCommuneId, setSelectedCommuneId] = useState('');
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingCommunes, setLoadingCommunes] = useState(false);

  // Load destination countries on mount
  useEffect(() => {
    supabase
      .from('destination_countries')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setCountries((data || []) as Country[]));
  }, []);

  // Load departments when country changes
  useEffect(() => {
    if (!selectedCountryId) {
      setDepartments([]);
      setSelectedDeptId('');
      setCommunes([]);
      setSelectedCommuneId('');
      return;
    }
    setLoadingDepts(true);
    supabase
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setDepartments((data || []) as Department[]);
        setLoadingDepts(false);
      });
  }, [selectedCountryId]);

  // Load communes when department changes
  useEffect(() => {
    if (!selectedDeptId) {
      setCommunes([]);
      setSelectedCommuneId('');
      return;
    }
    setLoadingCommunes(true);
    supabase
      .from('communes')
      .select('id, name, code')
      .eq('department_id', selectedDeptId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setCommunes((data || []) as Commune[]);
        setLoadingCommunes(false);
      });
  }, [selectedDeptId]);

  // Sync location selectors → formData
  useEffect(() => {
    const country = countries.find(c => c.id === selectedCountryId);
    const dept = departments.find(d => d.id === selectedDeptId);
    setFormData(prev => ({
      ...prev,
      country: country?.name ?? '',
      state: dept?.name ?? '',
      department_id: selectedDeptId || null,
      commune_id: selectedCommuneId || null,
      city: communes.find(c => c.id === selectedCommuneId)?.name ?? prev.city,
    }));
  }, [selectedCountryId, selectedDeptId, selectedCommuneId, countries, departments, communes]);

  const resetLocation = () => {
    setSelectedCountryId('');
    setSelectedDeptId('');
    setSelectedCommuneId('');
    setDepartments([]);
    setCommunes([]);
  };

  const handleNewAddress = () => {
    setEditingAddress(null);
    setFormData(emptyAddress);
    resetLocation();
    setIsEditing(true);
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      full_name: address.full_name,
      phone: address.phone || '',
      street_address: address.street_address,
      city: address.city,
      state: address.state || '',
      postal_code: address.postal_code || '',
      country: address.country,
      is_default: address.is_default,
      notes: address.notes || '',
      department_id: address.department_id || null,
      commune_id: address.commune_id || null,
    });
    // Pre-select selectors from saved IDs — we need to resolve the country from name
    const matchCountry = countries.find(c => c.name === address.country);
    setSelectedCountryId(matchCountry?.id ?? '');
    setSelectedDeptId(address.department_id ?? '');
    setSelectedCommuneId(address.commune_id ?? '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editingAddress) {
      await updateAddress.mutateAsync({ id: editingAddress.id, ...formData });
    } else {
      await createAddress.mutateAsync(formData);
    }
    setIsEditing(false);
    setEditingAddress(null);
    setFormData(emptyAddress);
    resetLocation();
  };

  const handleDelete = async (id: string) => {
    await deleteAddress.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultAddress.mutateAsync(id);
  };

  const isSaving = createAddress.isPending || updateAddress.isPending;
  const canSave = !!formData.full_name && !!formData.street_address && !!selectedCountryId && !!selectedDeptId && !!selectedCommuneId;

  if (isEditing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto pb-8">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
            <DialogTitle>
              {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pb-16">
            {/* Label + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Etiqueta</Label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Casa, Trabajo, etc."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+509..."
                />
              </div>
            </div>

            {/* Full name */}
            <div className="space-y-1.5">
              <Label>Nombre completo <span className="text-destructive">*</span></Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nombre de quien recibe"
              />
            </div>

            {/* Street */}
            <div className="space-y-1.5">
              <Label>Dirección <span className="text-destructive">*</span></Label>
              <Textarea
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                placeholder="Calle, número, referencias..."
                rows={2}
              />
            </div>

            {/* País */}
            <div className="space-y-1.5">
              <Label>País <span className="text-destructive">*</span></Label>
              <Select
                value={selectedCountryId}
                onValueChange={(val) => {
                  setSelectedCountryId(val);
                  setSelectedDeptId('');
                  setSelectedCommuneId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un país" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Departamento */}
            <div className="space-y-1.5">
              <Label>Departamento <span className="text-destructive">*</span></Label>
              <Select
                value={selectedDeptId}
                onValueChange={(val) => {
                  setSelectedDeptId(val);
                  setSelectedCommuneId('');
                }}
                disabled={!selectedCountryId || loadingDepts}
              >
                <SelectTrigger>
                  {loadingDepts
                    ? <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando...</span>
                    : <SelectValue placeholder={selectedCountryId ? 'Selecciona un departamento' : 'Primero selecciona un país'} />
                  }
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Comuna */}
            <div className="space-y-1.5">
              <Label>Comuna / Ciudad <span className="text-destructive">*</span></Label>
              <Select
                value={selectedCommuneId}
                onValueChange={setSelectedCommuneId}
                disabled={!selectedDeptId || loadingCommunes}
              >
                <SelectTrigger>
                  {loadingCommunes
                    ? <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando...</span>
                    : <SelectValue placeholder={selectedDeptId ? 'Selecciona una comuna' : 'Primero selecciona un departamento'} />
                  }
                </SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {communes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Código postal */}
            <div className="space-y-1.5">
              <Label>Código Postal</Label>
              <Input
                value={formData.postal_code || ''}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                placeholder="Opcional"
              />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label>Notas adicionales</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Referencias adicionales para el repartidor..."
                rows={2}
              />
            </div>

            {/* Default switch */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <Label className="cursor-pointer">Usar como predeterminada</Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setIsEditing(false); resetLocation(); }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canSave || isSaving}
                className="flex-1"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Mis Direcciones
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={handleNewAddress} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Nueva Dirección
            </Button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No tienes direcciones guardadas</p>
                <p className="text-sm">Agrega tu primera dirección de envío</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3 pr-4">
                  {addresses.map((address) => (
                    <Card key={address.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{address.label}</span>
                              {address.is_default && (
                                <Badge variant="secondary" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Predeterminada
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground">{address.full_name}</p>
                            <p className="text-sm text-muted-foreground">{address.street_address}</p>
                            <p className="text-sm text-muted-foreground">
                              {address.city}{address.state ? `, ${address.state}` : ''}{address.postal_code ? ` - ${address.postal_code}` : ''}
                            </p>
                            <p className="text-sm text-muted-foreground">{address.country}</p>
                            {address.phone && (
                              <p className="text-sm text-muted-foreground">Tel: {address.phone}</p>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditAddress(address)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm(address.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {!address.is_default && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSetDefault(address.id)}
                                className="h-8 w-8"
                                title="Establecer como predeterminada"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar dirección?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La dirección será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
