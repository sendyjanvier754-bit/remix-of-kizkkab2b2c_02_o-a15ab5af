import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { UpgradeToSellerModal } from "@/components/profile/UpgradeToSellerModal";
import { supabase } from "@/integrations/supabase/client";

interface SellerUpgradeContextType {
  openUpgradeModal: () => void;
}

const SellerUpgradeContext = createContext<SellerUpgradeContextType>({ openUpgradeModal: () => {} });

export const useSellerUpgrade = () => useContext(SellerUpgradeContext);

export function SellerUpgradeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Check for pending_seller_upgrade flag on any page when user is authenticated
  useEffect(() => {
    if (!user?.id) return;
    
    const pending = sessionStorage.getItem('pending_seller_upgrade') === 'true';
    if (pending && user.role === UserRole.USER) {
      // Small delay to let page render first
      const timer = setTimeout(() => setShowModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, user?.role]);

  // When user navigates away with incomplete onboarding, send email reminder
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.SELLER) return;

    const checkAndNotify = async () => {
      const { data: progress } = await supabase
        .from('seller_onboarding_progress')
        .select('is_complete')
        .eq('user_id', user.id)
        .maybeSingle();

      if (progress && !progress.is_complete) {
        // Check if we already sent a reminder recently (last 24h)
        const lastReminder = localStorage.getItem(`seller_onboarding_reminder_${user.id}`);
        const now = Date.now();
        if (lastReminder && now - parseInt(lastReminder) < 24 * 60 * 60 * 1000) return;

        // Send email reminder
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

    // Check after a delay (don't block page load)
    const timer = setTimeout(checkAndNotify, 5000);
    return () => clearTimeout(timer);
  }, [user?.id, user?.role, user?.email, user?.name]);

  const handleClose = (open: boolean) => {
    setShowModal(open);
    if (!open) {
      // If closing without completing, keep flag for next visit
      // The modal's onOpenChange(false) on success already removes it
      const stillPending = sessionStorage.getItem('pending_seller_upgrade') === 'true';
      if (stillPending) {
        // User closed without completing - save to persist across sessions
        if (user?.id) {
          localStorage.setItem(`pending_seller_upgrade_${user.id}`, 'true');
        }
      }
    }
  };

  // Also check localStorage for persistent pending upgrade
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.USER) return;
    const persistent = localStorage.getItem(`pending_seller_upgrade_${user.id}`) === 'true';
    if (persistent) {
      setShowModal(true);
    }
  }, [user?.id, user?.role]);

  const openUpgradeModal = () => setShowModal(true);

  return (
    <SellerUpgradeContext.Provider value={{ openUpgradeModal }}>
      {children}
      {user && <UpgradeToSellerModal open={showModal} onOpenChange={handleClose} />}
    </SellerUpgradeContext.Provider>
  );
}
