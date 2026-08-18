import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserCog } from 'lucide-react';

const DISMISS_KEY = 'complete_profile_prompt_dismissed';

/**
 * Asks users (typically visitors captured via WhatsApp) to finish setting up
 * their account when key profile data is still missing.
 */
export function CompleteProfilePrompt() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    const incomplete = !user.phone || !user.name;
    if (incomplete) {
      const t = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(t);
    }
  }, [user, isLoading]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Completa tu cuenta
          </DialogTitle>
          <DialogDescription>
            Faltan algunos datos en tu perfil{!user?.phone ? ' (teléfono)' : ''}. Complétalos para
            agilizar tus compras y recibir soporte más rápido.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={dismiss} className="sm:flex-1">
            Más tarde
          </Button>
          <Button
            onClick={() => {
              dismiss();
              navigate('/editar-perfil');
            }}
            className="sm:flex-1"
          >
            Completar ahora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
