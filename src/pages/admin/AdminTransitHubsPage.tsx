import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Building2, Globe, MapPin, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

type HubType = 'global' | 'local_master' | 'terminal_bus';

interface TransitHub {
  id: string;
  name: string;
  code: string;
  description: string | null;
  hub_type: HubType;
  destination_country_id: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  created_at: string;
  destination_country?: { name: string; code: string } | null;
}

interface HubForm {
  name: string;
  code: string;
  description: string;
  hub_type: HubType;
  destination_country_id: string;
  address: string;
  lat: string;
  lng: string;
  is_active: boolean;
}

const emptyForm: HubForm = {
  name: '',
  code: '',
  description: '',
  hub_type: 'local_master',
  destination_country_id: '',
  address: '',
  lat: '',
  lng: '',
  is_active: true,
};

const HUB_TYPE_LABELS: Record<HubType, string> = {
  global: 'Global (Origen)',
  local_master: 'Hub Maestro Local',
  terminal_bus: 'Terminal Bus',
};

const HUB_TYPE_COLORS: Record<HubType, string> = {
  global: 'bg-blue-100 text-blue-700',
  local_master: 'bg-green-100 text-green-700',
  terminal_bus: 'bg-orange-100 text-orange-700',
};

const AdminTransitHubsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<HubType | 'all'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HubForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch transit hubs
  const { data: hubs = [], isLoading } = useQuery({
    queryKey: ['transit-hubs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transit_hubs')
        .select(`*, destination_country:destination_countries(name, code)`)
        .order('hub_type')
        .order('name');
      if (error) throw error;
      return data as TransitHub[];
    },
  });

  // Fetch destination countries for selector
  const { data: countries = [] } = useQuery({
    queryKey: ['destination-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('destination_countries')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const filtered = hubs.filter(h => {
    const matchSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
                        h.code.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || h.hub_type === filterType;
    return matchSearch && matchType;
  });

  const handleOpen = (hub?: TransitHub) => {
    if (hub) {
      setEditingId(hub.id);
      setForm({
        name: hub.name,
        code: hub.code,
        description: hub.description || '',
        hub_type: hub.hub_type,
        destination_country_id: hub.destination_country_id || '',
        address: hub.address || '',
        lat: hub.lat?.toString() || '',
        lng: hub.lng?.toString() || '',
        is_active: hub.is_active,
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error('Nombre y código son requeridos');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code.toUpperCase(),
        description: form.description || null,
        hub_type: form.hub_type,
        destination_country_id: form.destination_country_id || null,
        address: form.address || null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        is_active: form.is_active,
      };

      if (editingId) {
        const { error } = await supabase
          .from('transit_hubs')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Hub actualizado');
      } else {
        const { error } = await supabase
          .from('transit_hubs')
          .insert(payload);
        if (error) throw error;
        toast.success('Hub creado');
      }

      queryClient.invalidateQueries({ queryKey: ['transit-hubs'] });
      setShowDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="Hubs de Tránsito" subtitle="Gestiona los hubs globales y locales de la cadena logística">
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar hub..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            {/* Filter by type */}
            <Select value={filterType} onValueChange={v => setFilterType(v as HubType | 'all')}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="global">Global (Origen)</SelectItem>
                <SelectItem value="local_master">Hub Maestro Local</SelectItem>
                <SelectItem value="terminal_bus">Terminal Bus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => handleOpen()} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Hub
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4">
          {(['global', 'local_master', 'terminal_bus'] as HubType[]).map(t => (
            <Card key={t}>
              <CardContent className="pt-4 flex items-center gap-3">
                {t === 'global' ? <Globe className="h-8 w-8 text-blue-500" /> :
                 t === 'local_master' ? <Building2 className="h-8 w-8 text-green-500" /> :
                 <MapPin className="h-8 w-8 text-orange-500" />}
                <div>
                  <p className="text-2xl font-bold">{hubs.filter(h => h.hub_type === t).length}</p>
                  <p className="text-xs text-muted-foreground">{HUB_TYPE_LABELS[t]}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Hubs ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No hay hubs que coincidan
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(hub => (
                    <TableRow key={hub.id}>
                      <TableCell className="font-mono font-bold text-sm">{hub.code}</TableCell>
                      <TableCell className="font-medium">{hub.name}</TableCell>
                      <TableCell>
                        <Badge className={`${HUB_TYPE_COLORS[hub.hub_type]} border-0 text-xs`}>
                          {HUB_TYPE_LABELS[hub.hub_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {hub.destination_country?.name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {hub.address || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={hub.is_active ? 'default' : 'secondary'}>
                          {hub.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleOpen(hub)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog create/edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Hub' : 'Nuevo Hub de Tránsito'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Hub Maestro Haití"
                />
              </div>
              <div>
                <Label>Código *</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="HAITI_HUB"
                />
              </div>
            </div>
            <div>
              <Label>Tipo de Hub *</Label>
              <Select value={form.hub_type} onValueChange={v => setForm({ ...form, hub_type: v as HubType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global — Hub de origen (China, USA)</SelectItem>
                  <SelectItem value="local_master">Hub Maestro Local — Punto de entrada al país</SelectItem>
                  <SelectItem value="terminal_bus">Terminal Bus — Nodo secundario departamental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.hub_type !== 'global' && (
              <div>
                <Label>País Destino</Label>
                <Select
                  value={form.destination_country_id}
                  onValueChange={v => setForm({ ...form, destination_country_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar país" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción del hub..."
                rows={2}
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Ej: Hinche, Plateau Central, Haití"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitud</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.lat}
                  onChange={e => setForm({ ...form, lat: e.target.value })}
                  placeholder="18.1500"
                />
              </div>
              <div>
                <Label>Longitud</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.lng}
                  onChange={e => setForm({ ...form, lng: e.target.value })}
                  placeholder="-72.0100"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="hub-active"
                checked={form.is_active}
                onCheckedChange={v => setForm({ ...form, is_active: v })}
              />
              <Label htmlFor="hub-active">Hub activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? 'Actualizar' : 'Crear Hub'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTransitHubsPage;
