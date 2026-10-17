import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageCircle, Phone, Mail, HelpCircle } from "lucide-react";
import { useWhatsAppSupport } from "@/hooks/useWhatsAppSupport";
import { WhatsAppSupportDialog } from "@/components/support/WhatsAppSupportDialog";

interface Props {
  children: React.ReactNode;
}

export function SupportMenuPopover({ children }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isEnabled: waEnabled } = useWhatsAppSupport();
  const [waDialogOpen, setWaDialogOpen] = useState(false);

  const handleWhatsApp = () => setWaDialogOpen(true);

  const channels = [
    {
      icon: <MessageCircle className="w-4 h-4 text-green-600" />,
      label: t('profilePanels.support.liveChat.label'),
      description: t('profilePanels.support.liveChat.description'),
      action: () => navigate("/soporte"),
      available: true,
    },
    ...(waEnabled
      ? [
          {
            icon: <MessageCircle className="w-4 h-4 text-green-600" />,
            label: t('profilePanels.support.whatsapp.label'),
            description: t('profilePanels.support.whatsapp.description'),
            action: handleWhatsApp,
            available: true,
          },
        ]
      : []),
    {
      icon: <Phone className="w-4 h-4 text-muted-foreground" />,
      label: t('profilePanels.support.call.label'),
      description: t('profilePanels.support.call.description'),
      action: () => {},
      available: false,
    },
    {
      icon: <Mail className="w-4 h-4 text-muted-foreground" />,
      label: t('profilePanels.support.email.label'),
      description: t('profilePanels.support.email.description'),
      action: () => {},
      available: false,
    },
  ];

  return (
    <>
    <WhatsAppSupportDialog open={waDialogOpen} onOpenChange={setWaDialogOpen} />
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('profilePanels.support.title')}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{t('profilePanels.support.subtitle')}</p>
        </div>
        <div className="py-1">
          {channels.map((ch) => (
            <button
              key={ch.label}
              onClick={ch.action}
              disabled={!ch.available}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="shrink-0">{ch.icon}</div>
              <div>
                <p className={`text-sm font-medium ${ch.available ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {ch.label}
                </p>
                <p className="text-xs text-muted-foreground">{ch.description}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
    </>
  );
}
