import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Megaphone, Gift, DollarSign, Link2, Copy, Check, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useMyAffiliate, useApplyAsAffiliate } from "@/hooks/useAffiliates";

export default function InfluencerProgramPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: affiliate, isLoading } = useMyAffiliate();
  const apply = useApplyAsAffiliate();

  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.email && !displayName) {
      setDisplayName(user.name || user.email.split("@")[0]);
    }
  }, [user, displayName]);

  const link = affiliate ? `${window.location.origin}/?ref=${affiliate.affiliate_code}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !code.trim()) {
      toast.error("Completa tu nombre público y el código que deseas");
      return;
    }
    await apply.mutateAsync({ display_name: displayName, affiliate_code: code, notes });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="p-2 rounded-lg bg-primary/10">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">Programa de afiliados e influencers</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Benefit icon={Link2} title="Tu enlace único" text="Comparte tu enlace o tu código en redes y mensajería." />
          <Benefit icon={Gift} title="Descuento para tu público" text="Quien use tu código recibe un descuento automático al pagar." />
          <Benefit icon={DollarSign} title="Comisión por cada venta" text="Ganas un porcentaje de cada compra pagada con tu código." />
        </section>

        {authLoading || isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !user ? (
          <Card>
            <CardHeader>
              <CardTitle>Crea tu cuenta para participar</CardTitle>
              <CardDescription>Necesitas una cuenta para recibir tu código y cobrar tus comisiones.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button asChild>
                <Link to="/cuenta?redirect=/programa-afiliados">Crear cuenta o entrar</Link>
              </Button>
            </CardContent>
          </Card>
        ) : affiliate ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Tu participación</CardTitle>
              <Badge variant={affiliate.status === "active" ? "default" : "secondary"}>
                {affiliate.status === "active"
                  ? "Activo"
                  : affiliate.status === "pending"
                    ? "En revisión"
                    : affiliate.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {affiliate.status === "pending" && (
                <p className="text-sm text-muted-foreground">
                  Tu solicitud está en revisión. Te avisaremos en cuanto esté aprobada.
                </p>
              )}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="text-xs text-muted-foreground">Tu código</p>
                <p className="font-mono text-xl font-semibold">{affiliate.affiliate_code}</p>
                <div className="flex items-center gap-2 pt-2">
                  <Input readOnly value={link} className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyLink} aria-label="Copiar enlace">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button asChild>
                <Link to="/socio/afiliado">Ir a mi panel</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Solicita tu código</CardTitle>
              <CardDescription>Revisamos cada solicitud antes de activarla.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="display_name">Nombre público</Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej. Marie Créations"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="affiliate_code">Código deseado</Label>
                  <Input
                    id="affiliate_code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="MARIE10"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">Solo letras y números, mínimo 3 caracteres.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Cuéntanos de tu audiencia</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Redes, número de seguidores, tipo de contenido..."
                    rows={4}
                  />
                </div>
                <Button type="submit" disabled={apply.isPending}>
                  {apply.isPending ? "Enviando..." : "Enviar solicitud"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="p-2 rounded-lg bg-primary/10 w-fit">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
