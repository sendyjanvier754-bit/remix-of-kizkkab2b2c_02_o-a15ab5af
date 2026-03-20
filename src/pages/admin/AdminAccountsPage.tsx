import { useState } from "react";
import { useAdminAccounts } from "@/hooks/useAdminAccounts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";

const ROLES = [
  { value: 'user', label: 'Usuario', color: 'bg-muted text-muted-foreground' },
  { value: 'seller', label: 'Vendedor', color: 'bg-primary/10 text-primary' },
  { value: 'admin', label: 'Admin', color: 'bg-destructive/10 text-destructive' },
  { value: 'sales_agent', label: 'Agente Ventas', color: 'bg-accent/80 text-accent-foreground' },
  { value: 'purchasing_agent', label: 'Agente Compras', color: 'bg-secondary text-secondary-foreground' },
  { value: 'staff_pickup', label: 'Staff Pickup', color: 'bg-muted text-muted-foreground' },
  { value: 'moderator', label: 'Moderador', color: 'bg-muted text-muted-foreground' },
];

const getRoleBadge = (role: string) => {
  const r = ROLES.find(x => x.value === role) || ROLES[0];
  return <Badge variant="outline" className={`${r.color} text-xs`}>{r.label}</Badge>;
};

const getRoleLabel = (role: string) => ROLES.find(x => x.value === role)?.label || role;

export default function AdminAccountsPage() {
  const { accounts, isLoading, changeRole } = useAdminAccounts();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    userId: string;
    newRole: string;
    userName: string | null;
    userEmail: string | null;
    currentRole: string;
  } | null>(null);

  const filtered = accounts.filter(a => {
    const matchesSearch = !search ||
      (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || a.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const openRoleDialog = (userId: string, currentRole: string, userName: string | null, userEmail: string | null) => {
    setPendingChange({ userId, newRole: currentRole, userName, userEmail, currentRole });
    setDialogOpen(true);
  };

  const confirmRoleChange = () => {
    if (!pendingChange || pendingChange.newRole === pendingChange.currentRole) return;
    changeRole.mutate({
      userId: pendingChange.userId,
      newRole: pendingChange.newRole,
      userEmail: pendingChange.userEmail,
      userName: pendingChange.userName,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        setPendingChange(null);
      },
    });
  };

  return (
    <AdminLayout title="Cuentas de Usuarios">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{filtered.length} cuenta{filtered.length !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{accounts.filter(a => a.role === 'seller').length} vendedores</span>
          <span>•</span>
          <span>{accounts.filter(a => a.role === 'admin').length} admins</span>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol Actual</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No se encontraron cuentas</TableCell>
                </TableRow>
              ) : filtered.map(account => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={account.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(account.full_name || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{account.full_name || 'Sin nombre'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{account.email}</TableCell>
                  <TableCell>{getRoleBadge(account.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(account.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => openRoleDialog(account.id, account.role, account.full_name, account.email)}
                    >
                      Cambiar Rol
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Role Change Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!changeRole.isPending) { setDialogOpen(open); if (!open) setPendingChange(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar Rol de Usuario</DialogTitle>
            <DialogDescription>
              {pendingChange && (
                <>
                  Cambiando rol de <strong>{pendingChange.userName || 'Usuario'}</strong> ({pendingChange.userEmail})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {pendingChange && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20">Actual:</span>
                {getRoleBadge(pendingChange.currentRole)}
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Nuevo rol:</span>
                <Select
                  value={pendingChange.newRole}
                  onValueChange={(val) => setPendingChange(prev => prev ? { ...prev, newRole: val } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pendingChange.newRole === 'seller' && pendingChange.currentRole !== 'seller' && (
                <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Se creará automáticamente una tienda y registro de vendedor para este usuario.</span>
                </div>
              )}

              {pendingChange.currentRole === 'seller' && pendingChange.newRole !== 'seller' && (
                <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  <span>La tienda del usuario será desactivada al quitar el rol de vendedor.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setPendingChange(null); }} disabled={changeRole.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={changeRole.isPending || !pendingChange || pendingChange.newRole === pendingChange.currentRole}
            >
              {changeRole.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cambiando...</>
              ) : (
                'Confirmar cambio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
