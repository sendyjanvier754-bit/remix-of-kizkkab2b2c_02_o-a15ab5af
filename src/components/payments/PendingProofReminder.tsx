import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Upload, X, Receipt } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePendingPaymentProofs } from '@/hooks/usePendingPaymentProofs';
import { usePendingProofPopupConfig } from '@/hooks/usePendingProofPopupConfig';

const SESSION_KEY = 'pendingProofPopupSession';
const DAY_KEY = 'pendingProofPopupDay';
const HIDE_ON = ['checkout', '/login', '/cuenta', '/mis-compras', '/seller/mis-compras', '/reset-password'];

/**
 * Pop-up shown when the signed-in user has orders awaiting payment proof.
 * Frequency, delay and texts are configured in Admin > Pop-ups Marketing.
 */
export const PendingProofReminder = () => {
  const { user } = useAuth();
  const { data: orders = [] } = usePendingPaymentProofs();
  const { data: cfg } = usePendingProofPopupConfig();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const shownFor = useRef<string | null>(null); // per app load + user (every_visit)

  useEffect(() => {
    if (!user?.id || !cfg?.enabled || !orders.length || open) return;
    if (HIDE_ON.some((p) => pathname.includes(p))) return;
    if (shownFor.current === user.id) return;

    if (cfg.frequency === 'once_per_session' && sessionStorage.getItem(SESSION_KEY) === user.id) return;
    if (cfg.frequency === 'once_per_day' && localStorage.getItem(DAY_KEY) === `${user.id}:${new Date().toDateString()}`) return;

    const timer = setTimeout(() => {
      shownFor.current = user.id;
      sessionStorage.setItem(SESSION_KEY, user.id);
      localStorage.setItem(DAY_KEY, `${user.id}:${new Date().toDateString()}`);
      setOpen(true);
    }, Math.max(0, cfg.delay_seconds) * 1000);
    return () => clearTimeout(timer);
  }, [user?.id, cfg, orders.length, pathname, open]);

  // Reset when the user signs out so the next sign-in shows it again
  useEffect(() => { if (!user) shownFor.current = null; }, [user]);

  if (!orders.length || !cfg) return null;

  const first = orders[0];
  const title = cfg.title?.trim() || t('checkoutExtra.proof.popupTitle', { count: orders.length });
  const message = cfg.message?.trim() || t('checkoutExtra.proof.notifBody');
  const go = (url: string) => { setOpen(false); navigate(url); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-0 overflow-hidden gap-0 border-0 [&>button]:hidden">
        <div className="relative bg-gradient-to-br from-primary to-primary/80 px-6 pt-7 pb-6 text-center text-primary-foreground">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/15 ring-4 ring-primary-foreground/10">
            <Receipt className="h-8 w-8" />
          </div>
          <DialogTitle className="text-xl font-bold leading-snug">{title}</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-primary-foreground/85">{message}</DialogDescription>
        </div>

        <div className="max-h-56 overflow-y-auto px-5 py-4 space-y-2 bg-background">
          {orders.slice(0, 4).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => go(o.action_url)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Clock className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-foreground">#{o.id.slice(0, 8).toUpperCase()}</span>
                <span className="block text-xs text-muted-foreground capitalize">{o.payment_method?.replace(/_/g, ' ') || '—'}</span>
              </span>
              <span className="text-sm font-bold text-primary">
                {o.currency} {o.total_amount.toFixed(2)}
              </span>
            </button>
          ))}
        </div>

        <div className="px-5 pb-5 pt-1 space-y-2 bg-background">
          <Button className="w-full h-11 gap-2 text-base font-semibold" onClick={() => go(first.action_url)}>
            <Upload className="h-4 w-4" />
            {t('checkoutExtra.proof.uploadNow')}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('checkoutExtra.proof.remindLater')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingProofReminder;
