import { useState } from "react";
import { useAdminAccounts } from "@/hooks/useAdminAccounts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users } from "lucide-react";
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

export default function AdminAccountsPage() {
  const { accounts, isLoading, changeRole } = useAdminAccounts();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  const filtered = accounts.filter(a => {
    const matchesSearch = !search ||
      (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || a.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    const account = accounts.find(a => a.id === userId);
    changeRole.mutate({
      userId,
      newRole,
      userEmail: account?.email,
      userName: account?.full_name,
    });
  };

  return (
    <AdminLayout title="Cuentas de Usuarios" icon={<Users className="w-6 h-6" />}>
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
                <TableHead>Cambiar Rol</TableHead>
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
                    <Select
                      value={account.role}
                      onValueChange={(val) => handleRoleChange(account.id, val)}
                      disabled={changeRole.isPending}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
