import React, { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useMarketingPopups, MarketingPopup } from '@/hooks/useMarketingPopups';
import { useDiscountCodes } from '@/hooks/useDiscountCodes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Trash2, Edit, MoreHorizontal, Eye, EyeOff, Megaphone,
  MousePointerClick, ShoppingCart, Clock, Gift, BarChart3, Ticket,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

const triggerTypeConfig = {
  welcome: { label: 'Bienvenida', icon: Gift, color: 'bg-green-100 text-green-800' },
  exit_intent: { label: 'Exit Intent', icon: MousePointerClick, color: 'bg-orange-100 text-orange-800' },
  cart_abandon: { label: 'Carrito Abandonado', icon: ShoppingCart, color: 'bg-red-100 text-red-800' },
  timed_promotion: { label: 'Promoción Temporal', icon: Clock, color: 'bg-blue-100 text-blue-800' },
};

const defaultForm = {
  title: '',
  description: '',
  trigger_type: 'welcome' as 'welcome' | 'exit_intent' | 'cart_abandon' | 'timed_promotion',
  heading: '',
  body_text: '',
  image_url: '',
  button_text: 'Obtener Descuento',
  button_url: '',
  background_color: '#ffffff',
  discount_code_id: null as string | null,
  auto_generate_coupon: false,
  auto_coupon_config: { discount_type: 'percentage', discount_value: 10, prefix: 'POPUP', max_uses_per_user: 1 },
  display_frequency: 'once_per_session' as 'once_per_session' | 'once_per_day' | 'once_ever' | 'always',
  delay_seconds: 3,
  scroll_percentage: null as number | null,
  starts_at: '',
  ends_at: '',
  is_active: true,
  target_audience: 'all',
  target_pages: [] as string[],



const AdminPopupsPage = () => {
  const { user } = useAuth();
  const { popups, isLoading, createPopup, updatePopup, togglePopup, deletePopup } = useMarketingPopups();
  const { discountCodes } = useDiscountCodes();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [activeTab, setActiveTab] = useState('all');

  const filteredPopups = activeTab === 'all' 
    ? popups 
    : popups.filter(p => p.trigger_type === activeTab);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const openEdit = (popup: MarketingPopup) => {
    setEditingId(popup.id);
    setForm({
      title: popup.title,
      description: popup.description || '',
      trigger_type: popup.trigger_type,
      heading: popup.heading,
      body_text: popup.body_text || '',
      image_url: popup.image_url || '',
      button_text: popup.button_text || 'Obtener Descuento',
      button_url: popup.button_url || '',
      background_color: popup.background_color || '#ffffff',
      discount_code_id: popup.discount_code_id,
      auto_generate_coupon: popup.auto_generate_coupon,
      auto_coupon_config: popup.auto_coupon_config || defaultForm.auto_coupon_config,
      display_frequency: popup.display_frequency,
      delay_seconds: popup.delay_seconds,
      scroll_percentage: popup.scroll_percentage,
      starts_at: popup.starts_at ? popup.starts_at.slice(0, 16) : '',
      ends_at: popup.ends_at ? popup.ends_at.slice(0, 16) : '',
      is_active: popup.is_active,
      target_audience: popup.target_audience,
      target_pages: popup.target_pages || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.heading) return;

    const payload = {
      ...form,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      discount_code_id: form.discount_code_id || null,
      created_by: user?.id,
    };

    if (editingId) {
      await updatePopup.mutateAsync({ id: editingId, ...payload });
    } else {
      await createPopup.mutateAsync(payload);
    }
    setIsDialogOpen(false);
  };

  const stats = {
    total: popups.length,
    active: popups.filter(p => p.is_active).length,
    totalViews: popups.reduce((s, p) => s + p.views_count, 0),
    totalClicks: popups.reduce((s, p) => s + p.clicks_count, 0),
  };

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" /> Pop-ups de Marketing
            </h1>
            <p className="text-muted-foreground text-sm">Gestiona pop-ups con cupones y descuentos para el marketplace</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Pop-up
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardDescription>Total Pop-ups</CardDescription><CardTitle className="text-2xl">{stats.total}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Activos</CardDescription><CardTitle className="text-2xl text-green-600">{stats.active}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Vistas Totales</CardDescription><CardTitle className="text-2xl">{stats.totalViews.toLocaleString()}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Clicks Totales</CardDescription><CardTitle className="text-2xl">{stats.totalClicks.toLocaleString()}</CardTitle></CardHeader></Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Todos ({popups.length})</TabsTrigger>
            {Object.entries(triggerTypeConfig).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key} className="gap-1">
                <cfg.icon className="h-3 w-3" />
                {cfg.label} ({popups.filter(p => p.trigger_type === key).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pop-up</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cupón</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead className="text-center">Vistas</TableHead>
                  <TableHead className="text-center">Clicks</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPopups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No hay pop-ups configurados
                    </TableCell>
                  </TableRow>
                ) : filteredPopups.map((popup) => {
                  const cfg = triggerTypeConfig[popup.trigger_type];
                  const TriggerIcon = cfg.icon;
                  return (
                    <TableRow key={popup.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{popup.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{popup.heading}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`gap-1 ${cfg.color}`}>
                          <TriggerIcon className="h-3 w-3" />{cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {popup.discount_code ? (
                          <Badge variant="outline" className="gap-1">
                            <Ticket className="h-3 w-3" />
                            {popup.discount_code.code}
                          </Badge>
                        ) : popup.auto_generate_coupon ? (
                          <Badge variant="outline" className="text-blue-600">Auto-generado</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{popup.display_frequency.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-center">{popup.views_count}</TableCell>
                      <TableCell className="text-center">{popup.clicks_count}</TableCell>
                      <TableCell>
                        <Switch
                          checked={popup.is_active}
                          onCheckedChange={(v) => togglePopup.mutate({ id: popup.id, is_active: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(popup)}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deletePopup.mutate(popup.id)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Pop-up' : 'Nuevo Pop-up'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nombre interno *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Pop-up Black Friday" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de activación *</Label>
                  <Select value={form.trigger_type} onValueChange={(v: any) => setForm({ ...form, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(triggerTypeConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frecuencia de muestra</Label>
                  <Select value={form.display_frequency} onValueChange={(v: any) => setForm({ ...form, display_frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once_per_session">Una vez por sesión</SelectItem>
                      <SelectItem value="once_per_day">Una vez por día</SelectItem>
                      <SelectItem value="once_ever">Solo una vez</SelectItem>
                      <SelectItem value="always">Siempre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">Contenido del Pop-up</h3>
                <div className="space-y-2">
                  <Label>Título (heading) *</Label>
                  <Input value={form.heading} onChange={(e) => setForm({ ...form, heading: e.target.value })} placeholder="¡Obtén 10% de descuento!" />
                </div>
                <div className="space-y-2">
                  <Label>Texto del cuerpo</Label>
                  <Textarea value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} placeholder="Suscríbete y recibe tu cupón..." rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Texto del botón</Label>
                    <Input value={form.button_text} onChange={(e) => setForm({ ...form, button_text: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>URL de imagen</Label>
                    <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
              </div>

              {/* Coupon */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Ticket className="h-4 w-4" /> Cupón / Descuento</h3>
                <div className="flex items-center gap-3">
                  <Switch checked={form.auto_generate_coupon} onCheckedChange={(v) => setForm({ ...form, auto_generate_coupon: v, discount_code_id: v ? null : form.discount_code_id })} />
                  <Label>Generar cupón automáticamente</Label>
                </div>

                {form.auto_generate_coupon ? (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={form.auto_coupon_config.discount_type} onValueChange={(v) => setForm({ ...form, auto_coupon_config: { ...form.auto_coupon_config, discount_type: v } })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                          <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor</Label>
                      <Input type="number" className="h-8" value={form.auto_coupon_config.discount_value} onChange={(e) => setForm({ ...form, auto_coupon_config: { ...form.auto_coupon_config, discount_value: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Prefijo</Label>
                      <Input className="h-8" value={form.auto_coupon_config.prefix} onChange={(e) => setForm({ ...form, auto_coupon_config: { ...form.auto_coupon_config, prefix: e.target.value } })} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Vincular cupón existente</Label>
                    <Select value={form.discount_code_id || 'none'} onValueChange={(v) => setForm({ ...form, discount_code_id: v === 'none' ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Sin cupón" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin cupón</SelectItem>
                        {discountCodes?.filter(c => c.is_active).map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Scheduling & Targeting */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">Programación</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Retraso (segundos)</Label>
                    <Input type="number" min={0} value={form.delay_seconds} onChange={(e) => setForm({ ...form, delay_seconds: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Audiencia</Label>
                    <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="new_visitors">Nuevos visitantes</SelectItem>
                        <SelectItem value="returning">Recurrentes</SelectItem>
                        <SelectItem value="b2b">B2B</SelectItem>
                        <SelectItem value="b2c">B2C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Desde</Label>
                    <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hasta</Label>
                    <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.title || !form.heading}>
                {editingId ? 'Guardar Cambios' : 'Crear Pop-up'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPopupsPage;
