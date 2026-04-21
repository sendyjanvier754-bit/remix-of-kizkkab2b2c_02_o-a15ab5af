import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { UpgradeToGrossisteModal } from "@/components/profile/UpgradeToGrossisteModal";

interface GrossisteUpgradeContextType {
  openUpgradeModal: () => void;
}

const GrossisteUpgradeContext = createContext<GrossisteUpgradeContextType>({ openUpgradeModal: () => {} });

export const useGrossisteUpgrade = () => useContext(GrossisteUpgradeContext);

export function GrossisteUpgradeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Detect pending grossiste upgrade after login (only for USER role)
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.USER) return;

    const pending = sessionStorage.getItem('pending_grossiste_upgrade') === 'true';
    const persistent = localStorage.getItem(`pending_grossiste_upgrade_${user.id}`) === 'true';

    if (pending || persistent) {
      const timer = setTimeout(() => setShowModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, user?.role]);

  const handleClose = (open: boolean) => {
    setShowModal(open);
    if (!open && user?.id && user.role === UserRole.USER) {
      const stillPending = sessionStorage.getItem('pending_grossiste_upgrade') === 'true';
      if (stillPending) {
        localStorage.setItem(`pending_grossiste_upgrade_${user.id}`, 'true');
      }
    }
  };

  const openUpgradeModal = () => setShowModal(true);

  return (
    <GrossisteUpgradeContext.Provider value={{ openUpgradeModal }}>
      {children}
      {user && <UpgradeToGrossisteModal open={showModal} onOpenChange={handleClose} />}
    </GrossisteUpgradeContext.Provider>
  );
}
