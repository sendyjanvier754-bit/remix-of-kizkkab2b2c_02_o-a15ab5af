import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/types/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Award, DollarSign, TrendingUp, Users, Sparkles, Clock } from "lucide-react";
import GlobalMobileHeader from "@/components/layout/GlobalMobileHeader";

const AffiliatesDashboardPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSeller = user?.role === UserRole.SELLER;

  // Check if user is on waiting list
  const { data: onWaitingList } = useQuery({
    queryKey: ["waiting-list-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("waiting_list")
        .select("id")
        .eq("user_id", user.id)
        .eq("feature", "affiliate_benefits")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Fetch user's program
  const { data: profile } = useQuery({
    queryKey: ["my-affiliate-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("affiliate_program_id, referral_code")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch program details
  const { data: program } = useQuery({
    queryKey: ["my-affiliate-program", profile?.affiliate_program_id],
    queryFn: async () => {
      if (!profile?.affiliate_program_id) return null;
      const { data } = await supabase
        .from("affiliate_programs")
        .select("*")
        .eq("id", profile.affiliate_program_id)
        .single();
      return data;
    },
    enabled: !!profile?.affiliate_program_id,
  });

  // Fetch earnings
  const { data: earnings = [] } = useQuery({
    queryKey: ["my-affiliate-earnings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("affiliate_earnings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Join waiting list
  const joinWaitlist = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No autenticado");
      const { error } = await supabase
        .from("waiting_list")
        .insert({ user_id: user.id, feature: "affiliate_benefits" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiting-list-check"] });
      toast.success("¡Te has unido a la lista de espera!");
    },
    onError: () => toast.error("Error al unirse a la lista"),
  });

  const totalEarned = earnings.reduce((s, e) => s + Number(e.amount), 0);
  const pendingEarnings = earnings.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
  const availableEarnings = earnings.filter(e => e.status === "available").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 pt-20 space-y-6 relative">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            Panel de Beneficios
          </h1>
          <p className="text-muted-foreground">
            {isSeller ? "Tus métricas de ventas B2B y márgenes" : "Tus puntos y créditos por referidos"}
          </p>
        </div>

        {/* Content behind glassmorphism */}
        <div className="relative">
          {/* Actual dashboard content (blurred) */}
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isSeller ? "Margen Total" : "Créditos Ganados"}</p>
                      <p className="text-2xl font-bold">${totalEarned.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="h-5 w-5 text-yellow-500" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendientes</p>
                      <p className="text-2xl font-bold">${pendingEarnings.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-500" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Disponible</p>
                      <p className="text-2xl font-bold">${availableEarnings.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Program info */}
            {program && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tu Programa: {program.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{program.description}</p>
                  <div className="flex gap-4 mt-3">
                    <Badge>{program.commission_type === "percentage" ? `${program.commission_value}%` : `$${program.commission_value}`}</Badge>
                    <Badge variant="outline">{program.role_target === "seller" ? "Seller" : "User"}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Referral code */}
            {profile?.referral_code && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">Tu Código de Referido</p>
                  <div className="flex items-center gap-3">
                    <code className="text-lg font-mono bg-muted px-4 py-2 rounded-lg">{profile.referral_code}</code>
                    <Button variant="outline" size="sm" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}?ref=${profile.referral_code}`);
                      toast.success("Link copiado");
                    }}>Copiar Link</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Earnings Table */}
            <Card>
              <CardHeader>
                <CardTitle>{isSeller ? "Historial de Márgenes" : "Historial de Créditos"}</CardTitle>
              </CardHeader>
              <CardContent>
                {earnings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sin movimientos aún</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {earnings.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell>{new Date(e.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-semibold">${Number(e.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={e.status === "paid" ? "default" : e.status === "available" ? "secondary" : "outline"}>
                              {e.status === "pending" ? "Pendiente" : e.status === "available" ? "Disponible" : "Pagado"}
                            </Badge>
                          </TableCell>
                          <TableCell>{e.description || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ===================== GLASSMORPHISM OVERLAY ===================== */}
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl"
            style={{
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              background: "hsla(var(--background) / 0.6)",
            }}
          >
            <div className="text-center max-w-lg px-6 py-10 space-y-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Panel de Beneficios
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Estamos preparando un sistema de recompensas personalizado para ti.
                {isSeller
                  ? " Pronto podrás ver tus márgenes de venta B2B y beneficios exclusivos."
                  : " Pronto podrás acumular créditos por cada referido exitoso."
                }
              </p>
              {onWaitingList ? (
                <Badge className="text-base px-4 py-2" variant="secondary">
                  ✅ Ya estás en la lista de espera
                </Badge>
              ) : (
                <Button
                  size="lg"
                  className="text-base px-8"
                  onClick={() => joinWaitlist.mutate()}
                  disabled={joinWaitlist.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Unirse a la Lista de Espera
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliatesDashboardPage;
