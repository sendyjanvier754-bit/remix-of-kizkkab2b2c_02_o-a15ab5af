import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAddresses, Address, AddressInput } from '@/hooks/useAddresses';
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
  country: 'Haiti',
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

  const handleNewAddress = () => {
    setEditingAddress(null);
    setFormData(emptyAddress);
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
  };

  const handleDelete = async (id: string) => {
    await deleteAddress.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultAddress.mutateAsync(id);
  };

  const isSaving = createAddress.isPending || updateAddress.isPending;

  if (isEditing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto pb-8">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
            <DialogTitle>
              {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Extra bottom padding for mobile keyboard */}
          <div className="space-y-4 pb-16">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Etiqueta</Label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Casa, Trabajo, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+509..."
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nombre de quien recibe"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Dirección *</Label>
              <Textarea
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                placeholder="Calle, número, referencias..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ciudad *</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ciudad"
                />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Departamento"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Código Postal</Label>
                <Input
                  value={formData.postal_code || ''}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="Código postal"
                />
              </div>
              <div className="space-y-2">
                <Label>País</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="País"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Referencias adicionales para el repartidor..."
                rows={2}
              />
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <Label className="cursor-pointer">Usar como predeterminada</Label>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.full_name || !formData.street_address || !formData.city || isSaving}
                className="flex-1 bg-[#071d7f] hover:bg-[#0a2a9f]"
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
              <MapPin className="h-5 w-5 text-[#071d7f]" />
              Mis Direcciones
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Button 
              onClick={handleNewAddress}
              className="w-full bg-[#071d7f] hover:bg-[#0a2a9f]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Nueva Dirección
            </Button>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#071d7f]" />
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
