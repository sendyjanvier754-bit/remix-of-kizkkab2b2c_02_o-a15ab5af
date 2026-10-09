import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { usePendingPaymentProofs } from '@/hooks/usePendingPaymentProofs';

const SEEN_KEY = 'pendingProofReminderShown';

/**
 * Shows a push-style notification for orders awaiting payment proof,
 * with a direct action to open the order and upload the proof.
 * Shown once per order per browser session.
 */
export const PendingProofReminder = () => {
  const { data = [] } = usePendingPaymentProofs();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!data.length || pathname.includes('checkout')) return;
    let seen: string[] = [];
    try { seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'); } catch { /* ignore */ }
    const next = data.find((o) => !seen.includes(o.id));
    if (!next) return;
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, next.id]));
    const code = next.id.slice(0, 8).toUpperCase();
    const title = t('checkoutExtra.proof.notifTitle', { code });
    const body = t('checkoutExtra.proof.notifBody');
    toast.warning(title, {
      description: body,
      duration: 15000,
      action: { label: t('checkoutExtra.proof.uploadNow'), onClick: () => navigate(next.action_url) },
    });
    // Native push notification when the browser allows it
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      const n = new Notification(title, { body, tag: `proof-${next.id}` });
      n.onclick = () => { window.focus(); navigate(next.action_url); n.close(); };
    }
  }, [data, pathname, navigate, t]);

  return null;
};

export default PendingProofReminder;
