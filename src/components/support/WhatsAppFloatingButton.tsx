import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWhatsAppSupport } from '@/hooks/useWhatsAppSupport';
import { WhatsAppSupportDialog } from './WhatsAppSupportDialog';

/**
 * Floating WhatsApp support/sales entry point.
 * Logged-in users go straight to WhatsApp; visitors are asked for name/email first.
 */
export function WhatsAppFloatingButton() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { isEnabled, openWhatsApp, registerLead } = useWhatsAppSupport();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!isEnabled) return null;

  const handleClick = async () => {
    if (user) {
      openWhatsApp(`Hola, soy ${user.name || user.email}. Necesito ayuda.`);
      await registerLead({
        name: user.name || 'Cliente',
        email: user.email || '',
        phone: user.phone || undefined,
      });
      return;
    }
    setDialogOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Ayuda por WhatsApp"
        className={`fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-700 ${
          isMobile ? 'bottom-20' : 'bottom-6'
        }`}
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      <WhatsAppSupportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
