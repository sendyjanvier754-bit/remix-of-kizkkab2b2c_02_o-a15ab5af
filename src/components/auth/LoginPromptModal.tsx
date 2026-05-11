import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";

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

  const goLogin = () => {
    setOpen(false);
    navigate("/cuenta");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inicia sesión para continuar</DialogTitle>
          <DialogDescription>
            Accede a tu cuenta para guardar favoritos, ver tus pedidos y disfrutar de descuentos exclusivos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button onClick={goLogin} className="w-full sm:flex-1 gap-2">
            <LogIn className="h-4 w-4" />
            Iniciar sesión
          </Button>
          <Button variant="secondary" onClick={goLogin} className="w-full sm:flex-1 gap-2">
            <UserPlus className="h-4 w-4" />
            Crear cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoginPromptModal;
