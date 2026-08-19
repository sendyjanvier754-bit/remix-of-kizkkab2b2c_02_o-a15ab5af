import { useBranding } from '@/hooks/useBranding';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppLeadInput {
  name: string;
  email: string;
  phone?: string;
  message?: string;
}

/**
 * WhatsApp support/sales channel.
 * The number and default message are configured from Identidad (branding_settings).
 */
export const useWhatsAppSupport = () => {
  const { getValue } = useBranding();

  // Preferred: a full WhatsApp link configured by the admin (e.g. https://wa.me/message/XXXX)
  const configuredLink = (getValue('whatsapp_support_link') || '').trim();

  const rawNumber =
    getValue('whatsapp_support_number') ||
    getValue('social_whatsapp') ||
    getValue('contact_phone');

  const digits = (rawNumber || '').replace(/[^0-9]/g, '');
  // Mexico no longer uses the legacy extra "1" between country code and mobile number.
  const number = /^521\d{10}$/.test(digits) ? `52${digits.slice(3)}` : digits;
  const defaultMessage =
    getValue('whatsapp_support_message') || 'Hola, necesito ayuda con mi compra.';
  const isEnabled = configuredLink.length > 0 || number.length >= 6;

  const buildLink = (message?: string) => {
    const text = encodeURIComponent(message || defaultMessage);

    if (configuredLink) {
      // Branded wa.me/message links ignore prefilled text. When the admin also
      // configured the contact number, use that same contact directly so the
      // captured form data is actually delivered in the WhatsApp message.
      if (/wa\.me\/message\//i.test(configuredLink) && number) {
        return `https://wa.me/${number}?text=${text}`;
      }
      if (/wa\.me\/message\//i.test(configuredLink)) return configuredLink;
      const sep = configuredLink.includes('?') ? '&' : '?';
      return `${configuredLink}${sep}text=${text}`;
    }

    const isMobileDevice =
      typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // wa.me redirects desktop browsers to api.whatsapp.com, which refuses to
    // load from embedded previews. web.whatsapp.com is the stable desktop URL.
    return isMobileDevice
      ? `https://wa.me/${number}?text=${text}`
      : `https://web.whatsapp.com/send?phone=${number}&text=${text}`;
  };



  /**
   * Opens WhatsApp in a real new tab.
   * Uses a synthetic anchor click because window.open from an embedded
   * preview iframe gets blocked (ERR_BLOCKED_BY_RESPONSE) by WhatsApp.
   */
  const openWhatsApp = (message?: string) => {
    if (!isEnabled) return;
    const url = buildLink(message);
    if (typeof document === 'undefined') return;
    // Short invite links can't carry the text, so leave it on the clipboard.
    if (/wa\.me\/message\//i.test(url)) {
      try {
        navigator.clipboard?.writeText(message || defaultMessage);
      } catch {
        // ignore clipboard failures
      }
    }
    // Open directly from the submit click. This avoids the preview shell
    // treating WhatsApp as iframe content, which WhatsApp explicitly blocks.
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };


  /** Registers a visitor lead so the sales team can follow up later. */
  const registerLead = async (lead: WhatsAppLeadInput) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('whatsapp_leads').insert({
        name: lead.name.trim(),
        email: lead.email.trim().toLowerCase(),
        phone: lead.phone?.trim() || null,
        message: lead.message?.trim() || null,
        page_url: typeof window !== 'undefined' ? window.location.pathname : null,
        user_id: userData?.user?.id ?? null,
      });
    } catch {
      // Never block the WhatsApp redirect because of a logging failure
    }
  };

  return { number, isEnabled, defaultMessage, buildLink, openWhatsApp, registerLead };
};
