import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Users, DollarSign, Award, TrendingUp, Clock } from "lucide-react";

interface AffiliateProgram {
  id: string;
  name: string;
  description: string | null;
  role_target: string;
  commission_value: number;
  commission_type: string;
  is_active: boolean;
  created_at: string;
}

interface AffiliateEarning {
  id: string;
  user_id: string;
  order_id: string | null;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

const AdminAffiliatesPage = () => {
  const queryClient = useQueryClient();
  const [editingProgram, setEditingProgram] = useState<AffiliateProgram | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    role_target: "user",
    commission_value: 0,
    commission_type: "percentage",
    is_active: true,
  });

  // Fetch programs
  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ["affiliate-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_programs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AffiliateProgram[];
    },
  });

  // Fetch users with their program assignments
  const { data: usersWithPrograms = [] } = useQuery({
    queryKey: ["users-with-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, affiliate_program_id, referral_code")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch earnings summary
  const { data: earnings = [] } = useQuery({
    queryKey: ["affiliate-earnings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_earnings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AffiliateEarning[];
    },
  });

  // Waiting list
  const { data: waitingList = [] } = useQuery({
    queryKey: ["waiting-list-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waiting_list")
        .select("*, profiles:user_id(full_name, email)")
        .eq("feature", "affiliate_benefits")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create/Update program
  const saveProgramMutation = useMutation({
    mutationFn: async (program: typeof form & { id?: string }) => {
      if (program.id) {
        const { error } = await supabase
          .from("affiliate_programs")
          .update({
            name: program.name,
            description: program.description || null,
            role_target: program.role_target,
            commission_value: program.commission_value,
            commission_type: program.commission_type,
            is_active: program.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", program.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("affiliate_programs")
          .insert({
            name: program.name,
            description: program.description || null,
            role_target: program.role_target,
            commission_value: program.commission_value,
            commission_type: program.commission_type,
            is_active: program.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-programs"] });
      toast.success(editingProgram ? "Programa actualizado" : "Programa creado");
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Assign program to user
  const assignProgramMutation = useMutation({
    mutationFn: async ({ userId, programId }: { userId: string; programId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ affiliate_program_id: programId })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-programs"] });
      toast.success("Programa asignado correctamente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update earning status
  const updateEarningMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("affiliate_earnings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-earnings-admin"] });
      toast.success("Estado actualizado");
    },
  });

  const resetForm = () => {
    setForm({ name: "", description: "", role_target: "user", commission_value: 0, commission_type: "percentage", is_active: true });
    setEditingProgram(null);
    setShowForm(false);
  };

  const openEdit = (p: AffiliateProgram) => {
    setEditingProgram(p);
    setForm({
      name: p.name,
      description: p.description || "",
      role_target: p.role_target,
      commission_value: p.commission_value,
      commission_type: p.commission_type,
      is_active: p.is_active,
    });
    setShowForm(true);
  };

  const totalPending = earnings.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
  const totalAvailable = earnings.filter(e => e.status === "available").reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = earnings.filter(e => e.status === "paid").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Programas de Afiliados</h1>
                <p className="text-muted-foreground">Gestiona programas, asignaciones y comisiones</p>
              </div>
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-2" />Nuevo Programa
              </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><Award className="h-5 w-5 text-primary" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Programas Activos</p>
                      <p className="text-2xl font-bold">{programs.filter(p => p.is_active).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="h-5 w-5 text-yellow-500" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comisiones Pendientes</p>
                      <p className="text-2xl font-bold">${totalPending.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-500" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Disponibles para Pago</p>
                      <p className="text-2xl font-bold">${totalAvailable.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10"><DollarSign className="h-5 w-5 text-blue-500" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pagado</p>
                      <p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="programs">
              <TabsList>
                <TabsTrigger value="programs">Programas</TabsTrigger>
                <TabsTrigger value="users">Asignaciones</TabsTrigger>
                <TabsTrigger value="earnings">Comisiones</TabsTrigger>
                <TabsTrigger value="waitlist">Lista de Espera ({waitingList.length})</TabsTrigger>
              </TabsList>

              {/* Programs Tab */}
              <TabsContent value="programs" className="space-y-4">
                {showForm && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{editingProgram ? "Editar Programa" : "Nuevo Programa"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre</Label>
                          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Bronce, Pro, VIP" />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de Beneficiario</Label>
                          <Select value={form.role_target} onValueChange={v => setForm(f => ({ ...f, role_target: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="seller">Seller (Vendedor B2B)</SelectItem>
                              <SelectItem value="user">User (Comprador Final)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Valor de Comisión</Label>
                          <Input type="number" step="0.01" value={form.commission_value} onChange={e => setForm(f => ({ ...f, commission_value: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de Comisión</Label>
                          <Select value={form.commission_type} onValueChange={v => setForm(f => ({ ...f, commission_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                              <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción del programa..." />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                        <Label>Activo</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => saveProgramMutation.mutate({ ...form, id: editingProgram?.id })} disabled={!form.name || saveProgramMutation.isPending}>
                          {editingProgram ? "Actualizar" : "Crear"}
                        </Button>
                        <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {programs.map(p => (
                    <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{p.name}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={p.is_active ? "default" : "secondary"}>
                              {p.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription>{p.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="outline">
                            {p.role_target === "seller" ? "🏪 Sellers" : "👤 Users"}
                          </Badge>
                          <span className="font-semibold">
                            {p.commission_type === "percentage" ? `${p.commission_value}%` : `$${p.commission_value}`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {usersWithPrograms.filter(u => u.affiliate_program_id === p.id).length} miembros asignados
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Users Assignment Tab */}
              <TabsContent value="users">
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Código Referido</TableHead>
                          <TableHead>Programa Asignado</TableHead>
                          <TableHead>Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usersWithPrograms.map(user => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{user.referral_code || "Sin código"}</code>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.affiliate_program_id || "none"}
                                onValueChange={v => assignProgramMutation.mutate({
                                  userId: user.id,
                                  programId: v === "none" ? null : v,
                                })}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Sin programa" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sin programa</SelectItem>
                                  {programs.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.role_target})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {programs.find(p => p.id === user.affiliate_program_id)?.name || "Ninguno"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Earnings Tab */}
              <TabsContent value="earnings">
                <Card>
                  <CardContent className="pt-6">
                    {earnings.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No hay comisiones registradas aún</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {earnings.map(e => (
                            <TableRow key={e.id}>
                              <TableCell>{new Date(e.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="font-mono text-xs">{e.user_id.slice(0, 8)}...</TableCell>
                              <TableCell className="font-semibold">${Number(e.amount).toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant={e.status === "paid" ? "default" : e.status === "available" ? "secondary" : "outline"}>
                                  {e.status === "pending" ? "Pendiente" : e.status === "available" ? "Disponible" : "Pagado"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{e.description || "—"}</TableCell>
                              <TableCell>
                                {e.status !== "paid" && (
                                  <Select
                                    value={e.status}
                                    onValueChange={v => updateEarningMutation.mutate({ id: e.id, status: v })}
                                  >
                                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pendiente</SelectItem>
                                      <SelectItem value="available">Disponible</SelectItem>
                                      <SelectItem value="paid">Pagado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Waiting List Tab */}
              <TabsContent value="waitlist">
                <Card>
                  <CardHeader>
                    <CardTitle>Lista de Espera - Panel de Beneficios</CardTitle>
                    <CardDescription>Usuarios interesados en el sistema de afiliados</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {waitingList.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nadie se ha registrado aún</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Fecha de Registro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {waitingList.map((w: any) => (
                            <TableRow key={w.id}>
                              <TableCell>{w.profiles?.full_name || "—"}</TableCell>
                              <TableCell>{w.profiles?.email || "—"}</TableCell>
                              <TableCell>{new Date(w.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminAffiliatesPage;
