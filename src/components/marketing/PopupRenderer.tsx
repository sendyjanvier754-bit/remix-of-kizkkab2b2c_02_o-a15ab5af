import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Gift, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivePopups, usePopupDismissal, MarketingPopup } from '@/hooks/useMarketingPopups';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const CART_IDLE_MS = 120_000; // 2 minutes of inactivity on cart page

export const PopupRenderer = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: popups = [] } = useActivePopups();
  const { isDismissed, dismiss, incrementView } = usePopupDismissal();
  const [visiblePopup, setVisiblePopup] = useState<MarketingPopup | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const cartIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAndTrack = useCallback((popup: MarketingPopup) => {
    setVisiblePopup(popup);
    setShowPopup(true);
    incrementView(popup.id);
  }, [incrementView]);

  // Find the first eligible popup to show (welcome / timed)
  const findEligiblePopup = useCallback(() => {
    for (const popup of popups) {
      if (isDismissed(popup.id, popup.display_frequency)) continue;
      if (popup.target_pages && popup.target_pages.length > 0) {
        if (!popup.target_pages.some(p => location.pathname.startsWith(p))) continue;
      }
      if (popup.trigger_type === 'exit_intent' || popup.trigger_type === 'cart_abandon') continue;
      return popup;
    }
    return null;
  }, [popups, location.pathname, isDismissed]);

  // Show welcome/timed popups after delay
  useEffect(() => {
    const popup = findEligiblePopup();
    if (!popup) return;
    const timer = setTimeout(() => showAndTrack(popup), (popup.delay_seconds || 3) * 1000);
    return () => clearTimeout(timer);
  }, [findEligiblePopup, showAndTrack]);

  // Exit intent detection
  useEffect(() => {
    const exitPopup = popups.find(p =>
      p.trigger_type === 'exit_intent' && !isDismissed(p.id, p.display_frequency)
    );
    if (!exitPopup) return;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !visiblePopup) {
        showAndTrack(exitPopup);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [popups, isDismissed, visiblePopup, showAndTrack]);

  // Cart abandon detection — trigger after idle time on cart-related pages
  useEffect(() => {
    const isCartPage = location.pathname.includes('/cart') || location.pathname.includes('/carrito');
    const cartPopup = popups.find(p =>
      p.trigger_type === 'cart_abandon' && !isDismissed(p.id, p.display_frequency)
    );
    if (!isCartPage || !cartPopup || visiblePopup) {
      if (cartIdleTimer.current) clearTimeout(cartIdleTimer.current);
      return;
    }

    const resetTimer = () => {
      if (cartIdleTimer.current) clearTimeout(cartIdleTimer.current);
      cartIdleTimer.current = setTimeout(() => {
        if (!visiblePopup) showAndTrack(cartPopup);
      }, CART_IDLE_MS);
    };

    resetTimer();
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    return () => {
      if (cartIdleTimer.current) clearTimeout(cartIdleTimer.current);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [popups, location.pathname, isDismissed, visiblePopup, showAndTrack]);

  const handleClose = () => {
    if (visiblePopup) dismiss(visiblePopup.id, visiblePopup.display_frequency);
    setShowPopup(false);
    setTimeout(() => setVisiblePopup(null), 300);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success(t('popups.codeCopied'));
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCTA = () => {
    if (visiblePopup) {
      // Track click
      import('@/integrations/supabase/client').then(({ supabase }) => {
        supabase.rpc('increment_popup_clicks' as any, { popup_id: visiblePopup.id }).then();
      });
      if (visiblePopup.button_url) window.location.href = visiblePopup.button_url;
    }
    handleClose();
  };

  if (!visiblePopup || !showPopup) return null;

  const couponCode = visiblePopup.discount_code?.code;
  const discountLabel = visiblePopup.discount_code
    ? visiblePopup.discount_code.discount_type === 'percentage'
      ? `${visiblePopup.discount_code.discount_value}%`
      : `$${visiblePopup.discount_code.discount_value}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-background/80 hover:bg-background flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {visiblePopup.image_url && (
          <div className="w-full h-48 overflow-hidden">
            <img src={visiblePopup.image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 text-center space-y-4">
          {discountLabel && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-lg">
              <Gift className="h-5 w-5" />
              {discountLabel} OFF
            </div>
          )}

          <h2 className="text-2xl font-bold tracking-tight">{visiblePopup.heading}</h2>

          {visiblePopup.body_text && (
            <p className="text-muted-foreground text-sm leading-relaxed">{visiblePopup.body_text}</p>
          )}

          {couponCode && (
            <div className="flex items-center justify-center gap-2">
              <div className="px-6 py-3 border-2 border-dashed border-primary/40 rounded-lg bg-primary/5 font-mono text-lg font-bold tracking-widest text-primary">
                {couponCode}
              </div>
              <Button variant="outline" size="icon" onClick={() => handleCopyCode(couponCode)} className="h-12 w-12 shrink-0">
                {copiedCode ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
          )}

          {visiblePopup.button_text && (
            <Button className="w-full h-12 text-base font-semibold" onClick={handleCTA}>
              {visiblePopup.button_text}
            </Button>
          )}

          <button onClick={handleClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t('popups.noThanks')}
          </button>
        </div>
      </div>
    </div>
  );
};
