import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageCircle, Phone, Mail, HelpCircle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export function SupportMenuPopover({ children }: Props) {
  const navigate = useNavigate();

  const channels = [
    {
      icon: <MessageCircle className="w-4 h-4 text-green-600" />,
      label: "Chat en vivo",
      description: "Habla con soporte ahora",
      action: () => navigate("/soporte"),
      available: true,
    },
    {
      icon: <Phone className="w-4 h-4 text-muted-foreground" />,
      label: "Llamada",
      description: "Próximamente",
      action: () => {},
      available: false,
    },
    {
      icon: <Mail className="w-4 h-4 text-muted-foreground" />,
      label: "Correo electrónico",
      description: "Próximamente",
      action: () => {},
      available: false,
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Centro de Ayuda</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">¿Cómo podemos ayudarte?</p>
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
  );
}
