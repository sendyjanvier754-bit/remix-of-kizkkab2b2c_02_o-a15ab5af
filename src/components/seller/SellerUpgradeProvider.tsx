import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { SellerRegistrationModal } from "@/components/profile/SellerRegistrationModal";
import { supabase } from "@/integrations/supabase/client";

interface SellerUpgradeContextType {
  openUpgradeModal: () => void;
}

const SellerUpgradeContext = createContext<SellerUpgradeContextType>({ openUpgradeModal: () => {} });

export const useSellerUpgrade = () => useContext(SellerUpgradeContext);

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function SellerUpgradeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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

  // ── Email reminder for incomplete onboarding (once per 24h) ──
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.SELLER) return;

    const checkAndNotify = async () => {
      const { data: progress } = await supabase
        .from('seller_onboarding_progress')
        .select('is_complete')
        .eq('user_id', user.id)
        .maybeSingle();

      if (progress && !progress.is_complete) {
        const lastReminder = localStorage.getItem(`seller_onboarding_reminder_${user.id}`);
        const now = Date.now();
        if (lastReminder && now - parseInt(lastReminder) < 24 * 60 * 60 * 1000) return;

        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: user.email,
              subject: '¡Completa la configuración de tu tienda!',
              htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #333;">¡Hola ${user.name || ''}!</h2>
                  <p style="color: #555; line-height: 1.6;">
                    Notamos que aún no has completado la configuración de tu tienda. 
                    ¡Solo faltan unos pasos para empezar a vender!
                  </p>
                  <a href="${window.location.origin}/seller/cuenta" 
                     style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin-top: 16px;">
                    Continuar configuración
                  </a>
                  <p style="color: #999; font-size: 12px; margin-top: 24px;">
                    Si ya completaste tu tienda, puedes ignorar este correo.
                  </p>
                </div>
              `,
              type: 'notifications',
            },
          });
          localStorage.setItem(`seller_onboarding_reminder_${user.id}`, String(now));
        } catch (e) {
          console.error('Failed to send onboarding reminder email:', e);
        }
      }
    };

    const timer = setTimeout(checkAndNotify, 5000);
    return () => clearTimeout(timer);
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
