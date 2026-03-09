import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useStoreShippingOptions, type CreateShippingOptionParams, type StoreShippingOption } from '@/hooks/useStoreShippingOptions';
import { Truck, Plus, Pencil, Trash2, Clock, DollarSign, Loader2 } from 'lucide-react';

interface StoreShippingConfigProps {
  storeId: string;
}

export const StoreShippingConfig = ({ storeId }: StoreShippingConfigProps) => {
  const { t } = useTranslation();
  const { options, isLoading, createOption, updateOption, deleteOption } = useStoreShippingOptions(storeId);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOption, setEditingOption] = useState<StoreShippingOption | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shipping_cost: 0,
    estimated_days_min: 1,
    estimated_days_max: 7,
    is_free_above: '' as string,
    is_active: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      shipping_cost: 0,
      estimated_days_min: 1,
      estimated_days_max: 7,
      is_free_above: '',
      is_active: true,
    });
    setEditingOption(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (option: StoreShippingOption) => {
    setEditingOption(option);
    setFormData({
      name: option.name,
      description: option.description || '',
      shipping_cost: option.shipping_cost,
      estimated_days_min: option.estimated_days_min,
      estimated_days_max: option.estimated_days_max,
      is_free_above: option.is_free_above ? String(option.is_free_above) : '',
      is_active: option.is_active,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);

    try {
      const params: Partial<CreateShippingOptionParams> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        shipping_cost: Number(formData.shipping_cost),
        estimated_days_min: Number(formData.estimated_days_min),
        estimated_days_max: Number(formData.estimated_days_max),
        is_free_above: formData.is_free_above ? Number(formData.is_free_above) : null,
        is_active: formData.is_active,
      };

      if (editingOption) {
        await updateOption(editingOption.id, params);
      } else {
        await createOption({ ...params, store_id: storeId } as CreateShippingOptionParams);
      }
      setShowDialog(false);
      resetForm();
    } catch (err) {
      // Error handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta opción de envío?')) return;
    await deleteOption(id);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#071d7f]" />
            Opciones de Envío
          </h3>
          <Button size="sm" onClick={openCreate} className="bg-[#071d7f] hover:bg-[#0a2a9f] text-xs h-8">
            <Plus className="h-3 w-3 mr-1" />
            Agregar
          </Button>
        </div>

        {options.length === 0 ? (
          <div className="text-center py-6 bg-muted/30 rounded-lg">
            <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">No hay opciones de envío configuradas</p>
            <p className="text-xs text-muted-foreground">Tus clientes verán el envío calculado por la plataforma</p>
          </div>
        ) : (
          <div className="space-y-3">
            {options.map((option) => (
              <div
                key={option.id}
                className={`p-3 rounded-lg border ${option.is_active ? 'border-border' : 'border-dashed border-muted-foreground/30 opacity-60'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{option.name}</span>
                      {!option.is_active && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactivo</Badge>
                      )}
                    </div>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mb-1">{option.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {option.shipping_cost === 0 ? 'Gratis' : `$${option.shipping_cost.toFixed(2)}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {option.estimated_days_min}-{option.estimated_days_max} días
                      </span>
                      {option.is_free_above && (
                        <span className="text-green-600">Gratis +${Number(option.is_free_above).toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(option)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(option.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOption ? 'Editar' : 'Nueva'} Opción de Envío</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Standard, Express"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Entrega en 3-5 días hábiles"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Costo de Envío ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.shipping_cost}
                  onChange={(e) => setFormData(f => ({ ...f, shipping_cost: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Gratis arriba de ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.is_free_above}
                  onChange={(e) => setFormData(f => ({ ...f, is_free_above: e.target.value }))}
                  placeholder="Opcional"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Días mín. entrega</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.estimated_days_min}
                  onChange={(e) => setFormData(f => ({ ...f, estimated_days_min: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Días máx. entrega</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.estimated_days_max}
                  onChange={(e) => setFormData(f => ({ ...f, estimated_days_max: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(f => ({ ...f, is_active: checked }))}
              />
              <Label className="text-xs">Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.name.trim()}
              className="bg-[#071d7f] hover:bg-[#0a2a9f]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingOption ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
