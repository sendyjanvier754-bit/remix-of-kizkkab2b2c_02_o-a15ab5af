import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Heart, Package, Tag, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

const INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const HIDE_ON_PATHS = [
  "/cuenta",
  "/login",
  "/seller/login",
  "/admin/login",
  "/forgot-password",
  "/reset-password",
  "/registro-vendedor",
  "/seller/onboarding",
  "/socios/punto-retiro/registro",
  "/socios/conductor/registro",
  "/agente-compra/login",
];

export const LoginPromptModal = () => {
  const { user, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const onAuthRoute = HIDE_ON_PATHS.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (isLoading || user || onAuthRoute) {
      setOpen(false);
      return;
    }
    const interval = setInterval(() => {
      setOpen(true);
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoading, user, onAuthRoute]);

  if (user || isLoading) return null;

  const go = (tab?: "register") => {
    setOpen(false);
    navigate(tab ? "/login?tab=register" : "/login");
  };

  const benefits = [
    { icon: Heart, label: t("loginPrompt.benefitFavorites", "Guarda tus favoritos") },
    { icon: Package, label: t("loginPrompt.benefitOrders", "Sigue tus pedidos") },
    { icon: Tag, label: t("loginPrompt.benefitDeals", "Precios exclusivos") },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
        <div className="bg-primary/10 px-5 pt-6 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-lg leading-snug text-center">
              {t("loginPrompt.title", "Inicia sesión para continuar")}
            </DialogTitle>
            <DialogDescription className="text-sm text-center">
              {t("loginPrompt.subtitle", "Crea tu cuenta en menos de un minuto.")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          {benefits.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-sm text-foreground">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-primary" />
              </span>
              <span className="leading-tight">{label}</span>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 space-y-2">
          <Button onClick={() => go()} className="w-full h-11 gap-2 text-base">
            <LogIn className="h-4 w-4" />
            {t("auth.login", "Iniciar sesión")}
          </Button>
          <Button variant="outline" onClick={() => go("register")} className="w-full h-11 gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            {t("auth.register", "Crear cuenta")}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("loginPrompt.later", "Seguir explorando")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginPromptModal;
