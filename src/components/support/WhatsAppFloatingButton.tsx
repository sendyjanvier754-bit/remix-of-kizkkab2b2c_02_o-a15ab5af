import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWhatsAppSupport } from '@/hooks/useWhatsAppSupport';
import { WhatsAppSupportDialog } from './WhatsAppSupportDialog';

/**
 * Floating WhatsApp support/sales entry point.
 * Every visitor completes the contact form before continuing to WhatsApp.
 */
export function WhatsAppFloatingButton() {
  const isMobile = useIsMobile();
  const { isEnabled } = useWhatsAppSupport();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!isEnabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
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
