import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { useTranslation } from "react-i18next";
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserCog } from 'lucide-react';

const DISMISS_KEY = 'complete_profile_prompt_dismissed';
const SHOWN_AT_KEY = 'complete_profile_prompt_shown_at';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // show at most once every 24h
const OPEN_DELAY_MS = 4000;
const MAX_RETRIES = 5;

const anotherDialogOpen = () =>
  typeof document !== 'undefined' &&
  !!document.querySelector('[role="dialog"], [data-state="open"][data-radix-popper-content-wrapper]');

/**
 * Asks users (typically visitors captured via WhatsApp) to finish setting up
 * their account when key profile data is still missing.
 */
export function CompleteProfilePrompt() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    const lastShown = Number(localStorage.getItem(SHOWN_AT_KEY) || 0);
    if (Date.now() - lastShown < COOLDOWN_MS) return;
    const incomplete = !user.phone || !user.name;
    if (!incomplete) return;

    let retries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryOpen = () => {
      // Never stack on top of / under another modal — wait until the screen is free
      if (anotherDialogOpen() && retries < MAX_RETRIES) {
        retries += 1;
        timer = setTimeout(tryOpen, 3000);
        return;
      }
      if (anotherDialogOpen()) return; // give up quietly this visit
      localStorage.setItem(SHOWN_AT_KEY, String(Date.now()));
      setOpen(true);
    };
    timer = setTimeout(tryOpen, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
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
            {t('profilePanels.completeProfile.title')}
          </DialogTitle>
          <DialogDescription>
            {t('profilePanels.completeProfile.description', {
              phoneNote: !user?.phone ? t('profilePanels.completeProfile.phoneNote') : '',
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={dismiss} className="sm:flex-1">
            {t('profilePanels.completeProfile.later')}
          </Button>
          <Button
            onClick={() => {
              dismiss();
              navigate('/editar-perfil');
            }}
            className="sm:flex-1"
          >
            {t('profilePanels.completeProfile.completeNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
