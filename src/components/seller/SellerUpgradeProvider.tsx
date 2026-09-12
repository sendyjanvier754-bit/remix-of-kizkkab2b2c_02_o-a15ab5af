import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { SellerRegistrationModal } from "@/components/profile/SellerRegistrationModal";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface SellerUpgradeContextType {
  openUpgradeModal: () => void;
}

const SellerUpgradeContext = createContext<SellerUpgradeContextType>({ openUpgradeModal: () => {} });

export const useSellerUpgrade = () => useContext(SellerUpgradeContext);

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function SellerUpgradeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const reminderTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── For USER role: check pending_seller_upgrade flag ──
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.USER) return;
    
    const pending = sessionStorage.getItem('pending_seller_upgrade') === 'true';
    const persistent = localStorage.getItem(`pending_seller_upgrade_${user.id}`) === 'true';
    
    if (pending || persistent) {
      const timer = setTimeout(() => setShowModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, user?.role]);

  // ── For SELLER role: check if onboarding is incomplete → show modal every 30 min ──
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.SELLER) return;

    const checkOnboarding = async () => {
      const { data: progress } = await supabase
        .from('seller_onboarding_progress')
        .select('is_complete')
        .eq('user_id', user.id)
        .maybeSingle();

      // If onboarding exists and is NOT complete → show the modal
      if (progress && !progress.is_complete) {
        setShowModal(true);
      }
    };

    // Check after page loads
    const initialTimer = setTimeout(checkOnboarding, 1500);

    // Set up 30-minute recurring reminder
    reminderTimer.current = setInterval(checkOnboarding, REMINDER_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (reminderTimer.current) clearInterval(reminderTimer.current);
    };
  }, [user?.id, user?.role]);

  // ── Persistent reminder for incomplete onboarding (after 5 days, every 3 days) ──
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.SELLER) return;

    const checkAndNotify = async () => {
      try {
        const { data, error } = await (supabase as any)
          .rpc('maybe_create_seller_onboarding_reminder');
        if (error) throw error;
        if (!data?.created) return;

        // The in-app notification is already persisted by the RPC. Email is a
        // secondary channel and is sent only for that newly-created reminder.
        if (!user.email) return;
        await supabase.functions.invoke('send-email', {
          body: {
            to: user.email,
            subject: t('sellerRegistration.continueLater'),
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">${t('sellerRegistration.continueLater')}</h2>
                <p style="color: #555; line-height: 1.6;">
                  ${t('sellerRegistration.draftSaved')}
                </p>
                <a href="${window.location.origin}/seller/cuenta"
                   style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin-top: 16px;">
                  ${t('sellerRegistration.continue')}
                </a>
              </div>
            `,
            type: 'notifications',
          },
        });
      } catch (e) {
        console.error('Failed to create onboarding reminder:', e);
      }
    };

    const timer = setTimeout(checkAndNotify, 5000);
    const interval = setInterval(checkAndNotify, REMINDER_INTERVAL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user?.id, user?.role, user?.email, user?.name]);

  const handleClose = (open: boolean) => {
    setShowModal(open);
    if (!open && user?.id) {
      // If user role — persist upgrade flag for next visit
      if (user.role === UserRole.USER) {
        const stillPending = sessionStorage.getItem('pending_seller_upgrade') === 'true';
        if (stillPending) {
          localStorage.setItem(`pending_seller_upgrade_${user.id}`, 'true');
        }
      }
      // For sellers with incomplete onboarding, the 30-min timer will re-open it
    }
  };

  const openUpgradeModal = () => setShowModal(true);

  return (
    <SellerUpgradeContext.Provider value={{ openUpgradeModal }}>
      {children}
      {user && <SellerRegistrationModal open={showModal} onOpenChange={handleClose} />}
    </SellerUpgradeContext.Provider>
  );
}
