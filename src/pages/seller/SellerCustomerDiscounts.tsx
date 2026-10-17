import React, { useState, useEffect } from 'react';
import { SellerLayout } from '@/components/seller/SellerLayout';
import { useCustomerDiscounts, CreateCustomerDiscountParams } from '@/hooks/useCustomerDiscounts';
import { useStoreByOwner } from '@/hooks/useStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Users, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

const SellerCustomerDiscounts = () => {
  const { user } = useAuth();
  const storeQuery = useStoreByOwner(user?.id);
  const store = storeQuery.data;
  const storeLoading = storeQuery.isLoading;
  const { customerDiscounts, isLoading, createCustomerDiscount, updateCustomerDiscount, toggleCustomerDiscount, deleteCustomerDiscount } = useCustomerDiscounts(store?.id);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [formData, setFormData] = useState<Omit<CreateCustomerDiscountParams, 'customer_user_id' | 'store_id'>>({
    discount_type: 'percentage',
    discount_value: 10,
    reason: '',
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: null,
  });

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults((data || []) as UserProfile[]);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Error al buscar usuarios');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetForm = () => {
    setFormData({
      discount_type: 'percentage',
      discount_value: 10,
      reason: '',
      valid_from: new Date().toISOString().slice(0, 16),
      valid_until: null,
    });
    setEditingId(null);
    setSelectedUser(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!store) return;

    if (!editingId && !selectedUser) {
      toast.error('Selecciona un cliente');
      return;
    }

    if (editingId) {
      await updateCustomerDiscount(editingId, formData);
    } else if (selectedUser) {
      await createCustomerDiscount({
        ...formData,
        customer_user_id: selectedUser.id,
        store_id: store.id,
      });
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (discount: typeof customerDiscounts[0]) => {
    setEditingId(discount.id);
    setSelectedUser({
      id: discount.customer_user_id,
      email: discount.customer_profile?.email || '',
      full_name: discount.customer_profile?.full_name || null,
    });
    setFormData({
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      reason: discount.reason || '',
      valid_from: discount.valid_from?.slice(0, 16),
      valid_until: discount.valid_until?.slice(0, 16) || null,
    });
    setIsDialogOpen(true);
  };

  const isDiscountActive = (discount: typeof customerDiscounts[0]) => {
    if (!discount.is_active) return false;
    const now = new Date();
    if (discount.valid_from && new Date(discount.valid_from) > now) return false;
    if (discount.valid_until && new Date(discount.valid_until) < now) return false;
    return true;
  };

  if (storeLoading) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center h-64">
          <p>Cargando...</p>
        </div>
      </SellerLayout>
    );
  }

  if (!store) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center h-64">
          <p>No tienes una tienda configurada</p>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Descuentos a Clientes</h1>
            <p className="text-muted-foreground">Asigna descuentos personalizados a tus clientes</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Descuento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Editar Descuento' : 'Nuevo Descuento para Cliente'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingId ? (
                  <div className="space-y-2">
                    <Label>Buscar Cliente</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por email o nombre..."
                        className="pl-9"
                      />
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="border rounded-md max-h-40 overflow-y-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                          >
                            <div className="font-medium">{user.full_name || 'Sin nombre'}</div>
                            <div className="text-muted-foreground text-xs">{user.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {selectedUser && (
                      <div className="p-3 bg-muted rounded-md">
                        <div className="font-medium">{selectedUser.full_name || 'Sin nombre'}</div>
                        <div className="text-muted-foreground text-sm">{selectedUser.email}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="font-medium">{selectedUser?.full_name || 'Sin nombre'}</div>
                    <div className="text-muted-foreground text-sm">{selectedUser?.email}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de descuento</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(value: 'percentage' | 'fixed_amount') => 
                        setFormData({ ...formData, discount_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                        <SelectItem value="fixed_amount">Monto fijo ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_value">Valor</Label>
                    <Input
                      id="discount_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Razón del descuento</Label>
                  <Input
                    id="reason"
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Cliente frecuente, compensación, etc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valid_from">Válido desde</Label>
                    <Input
                      id="valid_from"
                      type="datetime-local"
                      value={formData.valid_from || ''}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valid_until">Válido hasta</Label>
                    <Input
                      id="valid_until"
                      type="datetime-local"
                      value={formData.valid_until || ''}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value || null })}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  {editingId ? 'Guardar Cambios' : 'Crear Descuento'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Descuentos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {customerDiscounts.filter(isDiscountActive).length}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Razón</TableHead>
                  <TableHead>Validez</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : customerDiscounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No tienes descuentos para clientes
                    </TableCell>
                  </TableRow>
                ) : (
                  customerDiscounts.map((discount) => (
                    <TableRow key={discount.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{discount.customer_profile?.full_name || 'Sin nombre'}</span>
                          <p className="text-xs text-muted-foreground">{discount.customer_profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {discount.discount_type === 'percentage' ? (
                          <span>{discount.discount_value}%</span>
                        ) : (
                          <span>${discount.discount_value.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{discount.reason || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {discount.valid_from && (
                            <div>Desde: {format(new Date(discount.valid_from), 'dd/MM/yy', { locale: es })}</div>
                          )}
                          {discount.valid_until && (
                            <div>Hasta: {format(new Date(discount.valid_until), 'dd/MM/yy', { locale: es })}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={discount.is_active}
                            onCheckedChange={(checked) => toggleCustomerDiscount(discount.id, checked)}
                          />
                          <Badge variant={isDiscountActive(discount) ? 'default' : 'secondary'}>
                            {isDiscountActive(discount) ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(discount)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCustomerDiscount(discount.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerCustomerDiscounts;
