import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  User, 
  ShoppingBag, 
  Heart, 
  MapPin, 
  CreditCard, 
  Settings, 
  LogOut,
  ChevronRight,
  Bell,
  HelpCircle,
  Shield,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LegalPagesModal } from "@/components/legal/LegalPagesModal";
import { AboutModal } from "@/components/legal/AboutModal";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  description?: string;
  action: () => void;
  badge?: string | number;
}

export function UserProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await signOut();
      toast.success("Sesión cerrada");
      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Error al cerrar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  const menuItems: MenuItem[] = [
    {
      icon: <ShoppingBag className="w-6 h-6" />,
      label: "Mis Compras",
      description: "Ver historial de compras",
      action: () => navigate("/mis-compras"),
    },
    {
      icon: <Heart className="w-6 h-6" />,
      label: "Favoritos",
      description: "Productos guardados",
      action: () => navigate("/favoritos"),
    },
    {
      icon: <MapPin className="w-6 h-6" />,
      label: "Mis Direcciones",
      description: "Gestionar direcciones de envío",
      action: () => navigate("/mis-direcciones"),
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      label: "Métodos de Pago",
      description: "Tarjetas y formas de pago",
      action: () => navigate("/metodos-pago"),
    },
    {
      icon: <Bell className="w-6 h-6" />,
      label: "Notificaciones",
      description: "Configurar alertas",
      action: () => navigate("/notificaciones"),
    },
    {
      icon: <Settings className="w-6 h-6" />,
      label: "Configuración",
      description: "Privacidad y seguridad",
      action: () => navigate("/configuracion"),
    },
    {
      icon: <HelpCircle className="w-6 h-6" />,
      label: "Centro de Ayuda",
      description: "Preguntas frecuentes",
      action: () => navigate("/ayuda"),
    },
  ];

  const getInitials = () => {
    if (!user?.name && !user?.email) return "U";
    const name = user?.name || user?.email || "";
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <PageWrapper seo={{ title: "Mi Cuenta - Siver Market", description: "Gestiona tu cuenta y perfil" }}>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        {/* Header Profile Section */}
        <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
          <div className="px-4 py-6">
            <h1 className="text-2xl font-bold mb-6">Mi Cuenta</h1>
            
            {/* Profile Card */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <Avatar className="w-16 h-16 border-2 border-white shadow-md">
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="bg-blue-600 text-white text-xl font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">
                  {user?.name || "Usuario"}
                </h2>
                <p className="text-sm text-gray-600">{user?.email}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs h-7"
                  onClick={() => navigate("/editar-perfil")}
                >
                  <User className="w-3 h-3 mr-1" />
                  Editar Perfil
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="px-4 py-4 bg-white mb-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">0</div>
              <div className="text-xs text-gray-600 mt-1">Compras</div>
            </div>
            <div className="text-center p-3 bg-pink-50 rounded-lg">
              <div className="text-xl font-bold text-pink-600">0</div>
              <div className="text-xs text-gray-600 mt-1">Favoritos</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">0</div>
              <div className="text-xs text-gray-600 mt-1">Puntos</div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-4 py-3 space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                <div className="flex-shrink-0 text-blue-600">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">
                    {item.label}
                  </div>
                  {item.description && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <div className="px-4 py-4">
          <Button
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full h-11 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            {isLoading ? "Cerrando sesión..." : "Cerrar Sesión"}
          </Button>
        </div>

        {/* Legal & About Modals */}
        <div className="px-4 pb-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Información Legal</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLegal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 transition-colors"
            >
              <Shield className="h-3.5 w-3.5 text-[#071d7f]" /> Términos Legales
            </button>
            <button
              onClick={() => setShowAbout(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 transition-colors"
            >
              <Info className="h-3.5 w-3.5 text-[#071d7f]" /> Acerca de
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-4 py-4 text-center text-xs text-gray-500 border-t bg-gray-50">
          <p>Silver Market Haiti v1.0</p>
          <p className="mt-1">© 2026 Todos los derechos reservados</p>
        </div>
      </div>
      <LegalPagesModal open={showLegal} onOpenChange={setShowLegal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
    </PageWrapper>
  );
}

export default UserProfilePage;