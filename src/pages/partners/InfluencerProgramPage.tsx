import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.error(t("affiliateProgram.fillRequired"));
      return;
    }
    await apply.mutateAsync({ display_name: displayName, affiliate_code: code, notes });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t("affiliateProgram.linkCopied"));
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label={t("affiliateProgram.back")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="p-2 rounded-lg bg-primary/10">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">{t("affiliateProgram.title")}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Benefit icon={Link2} title={t("affiliateProgram.benefitLinkTitle")} text={t("affiliateProgram.benefitLinkText")} />
          <Benefit icon={Gift} title={t("affiliateProgram.benefitDiscountTitle")} text={t("affiliateProgram.benefitDiscountText")} />
          <Benefit icon={DollarSign} title={t("affiliateProgram.benefitCommissionTitle")} text={t("affiliateProgram.benefitCommissionText")} />
        </section>

        {authLoading || isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !user ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("affiliateProgram.createAccountTitle")}</CardTitle>
              <CardDescription>{t("affiliateProgram.createAccountDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button asChild>
                <Link to="/cuenta?redirect=/programa-afiliados">{t("affiliateProgram.createAccountCta")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : affiliate ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{t("affiliateProgram.yourParticipation")}</CardTitle>
              <Badge variant={affiliate.status === "active" ? "default" : "secondary"}>
                {affiliate.status === "active"
                  ? t("affiliateProgram.statusActive")
                  : affiliate.status === "pending"
                    ? t("affiliateProgram.statusPending")
                    : affiliate.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {affiliate.status === "pending" && (
                <p className="text-sm text-muted-foreground">
                  {t("affiliateProgram.pendingReview")}
                </p>
              )}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="text-xs text-muted-foreground">{t("affiliateProgram.yourCode")}</p>
                <p className="font-mono text-xl font-semibold">{affiliate.affiliate_code}</p>
                <div className="flex items-center gap-2 pt-2">
                  <Input readOnly value={link} className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyLink} aria-label={t("affiliateProgram.copyLink")}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button asChild>
                <Link to="/socio/afiliado">{t("affiliateProgram.goToPanel")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("affiliateProgram.requestCodeTitle")}</CardTitle>
              <CardDescription>{t("affiliateProgram.requestCodeDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="display_name">{t("affiliateProgram.displayNameLabel")}</Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("affiliateProgram.displayNamePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="affiliate_code">{t("affiliateProgram.codeLabel")}</Label>
                  <Input
                    id="affiliate_code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="MARIE10"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">{t("affiliateProgram.codeHint")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">{t("affiliateProgram.notesLabel")}</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("affiliateProgram.notesPlaceholder")}
                    rows={4}
                  />
                </div>
                <Button type="submit" disabled={apply.isPending}>
                  {apply.isPending ? t("affiliateProgram.submitting") : t("affiliateProgram.submit")}
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
