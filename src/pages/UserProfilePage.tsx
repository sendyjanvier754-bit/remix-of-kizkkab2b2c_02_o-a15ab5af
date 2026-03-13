import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User, ShoppingBag, Heart, MapPin, CreditCard, Settings,
  LogOut, ChevronRight, Bell, HelpCircle, Shield, Info, Package,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { LegalPagesModal } from "@/components/legal/LegalPagesModal";
import { AboutModal } from "@/components/legal/AboutModal";
import { useB2CFavorites } from "@/hooks/useB2CFavorites";
import { useBuyerB2COrders } from "@/hooks/useBuyerB2COrders";
import { useBuyerOrders } from "@/hooks/useBuyerOrders";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { InlineOrdersPanel } from "@/components/profile/InlineOrdersPanel";
import { InlineFavoritesPanel } from "@/components/profile/InlineFavoritesPanel";
import { InlineAddressesPanel } from "@/components/profile/InlineAddressesPanel";
import { InlinePaymentPanel } from "@/components/profile/InlinePaymentPanel";
import { InlineSettingsPanel } from "@/components/profile/InlineSettingsPanel";
import { InlineReturnsPanel } from "@/components/profile/InlineReturnsPanel";
import { SupportMenuPopover } from "@/components/profile/SupportMenuPopover";
import { useMyReturnRequests } from "@/hooks/useOrderReturnRequests";

type ActiveSection = 'orders' | 'favorites' | 'addresses' | 'payment' | 'settings' | 'returns';

export function UserProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('orders');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Mi Cuenta": true,
    "Mis Pedidos": true,
    "Mis Intereses": false,
    "Servicio al Cliente": false,
    "Política": false,
  });

  const { items: favorites = [] } = useB2CFavorites();
  const { data: b2cOrders = [] } = useBuyerB2COrders();
  const { data: b2bOrders = [] } = useBuyerOrders();
  const { data: myReturns = [] } = useMyReturnRequests();
  const totalOrders = b2cOrders.length + (b2bOrders?.length ?? 0);
  const pendingReturns = myReturns.filter(r => r.status === 'pending').length;

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await signOut();
      toast.success("Sesión cerrada");
      navigate("/");
    } catch {
      toast.error("Error al cerrar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = () => {
    const name = user?.name || user?.email || "";
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  };

  const toggleGroup = (group: string) =>
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));

  // ── Mobile layout ─────────────────────────────────────────────────────────
  const MobileLayout = () => (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-6">
          <h1 className="text-2xl font-bold mb-6">Mi Cuenta</h1>
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <Avatar className="w-16 h-16 border-2 border-white shadow-md">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{user?.name || "Usuario"}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => navigate("/editar-perfil")}>
                <User className="w-3 h-3 mr-1" /> Editar Perfil
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 bg-white mb-2">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xl font-bold text-primary">{totalOrders}</div>
            <div className="text-xs text-muted-foreground mt-1">Compras</div>
          </div>
          <div className="text-center p-3 bg-pink-50 rounded-lg">
            <div className="text-xl font-bold text-pink-500">{favorites.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Favoritos</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xl font-bold text-green-500">0</div>
            <div className="text-xs text-muted-foreground mt-1">Puntos</div>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {[
          { icon: <ShoppingBag className="w-6 h-6"/>, label: "Mis Compras",     action: () => navigate("/mis-compras")     },
          { icon: <Heart className="w-6 h-6"/>,        label: "Favoritos",       action: () => navigate("/favoritos")       },
          { icon: <MapPin className="w-6 h-6"/>,        label: "Mis Direcciones", action: () => navigate("/mis-direcciones") },
          { icon: <Bell className="w-6 h-6"/>,          label: "Notificaciones",  action: () => navigate("/notificaciones")  },
          { icon: <HelpCircle className="w-6 h-6"/>,    label: "Centro de Ayuda", action: () => navigate("/soporte")         },
        ].map((item, i) => (
          <button key={i} onClick={item.action}
            className="w-full bg-white border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-primary">{item.icon}</div>
              <span className="font-medium text-sm">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}
      </div>
      <div className="px-4 py-4">
        <Button onClick={handleLogout} disabled={isLoading}
          className="w-full h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-lg flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5" />
          {isLoading ? "Cerrando sesión..." : "Cerrar Sesión"}
        </Button>
      </div>
      <div className="px-4 pb-6">
        <div className="flex gap-2">
          <button onClick={() => setShowLegal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted/50 hover:bg-muted text-xs text-muted-foreground transition-colors">
            <Shield className="h-3.5 w-3.5 text-primary" /> Términos Legales
          </button>
          <button onClick={() => setShowAbout(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted/50 hover:bg-muted text-xs text-muted-foreground transition-colors">
            <Info className="h-3.5 w-3.5 text-primary" /> Acerca de
          </button>
        </div>
      </div>
    </div>
  );

  // ── Nav item helper ────────────────────────────────────────────────────────
  const NavButton = ({
    icon: Icon,
    label,
    section,
    badge,
  }: { icon?: React.ElementType; label: string; section?: ActiveSection; badge?: number }) => {
    const isActive = section && activeSection === section;
    return (
      <button
        onClick={() => section && setActiveSection(section)}
        className={`w-full flex items-center gap-2 px-6 py-1.5 text-[13px] transition-colors
          ${isActive
            ? "text-primary bg-primary/8 font-medium"
            : "text-muted-foreground hover:text-primary hover:bg-primary/5"
          }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <Badge className="h-4 min-w-4 px-1 text-[9px] bg-destructive text-destructive-foreground">{badge}</Badge>
        )}
      </button>
    );
  };

  // ── Desktop layout ────────────────────────────────────────────────────────
  const DesktopLayout = () => (
    <div className="min-h-screen bg-muted/30">
      <GlobalHeader />

      <div className="max-w-[1200px] mx-auto px-4 py-6 grid grid-cols-[220px_1fr_220px] gap-5">

        {/* LEFT SIDEBAR */}
        <aside className="bg-background border border-border rounded-md overflow-hidden self-start sticky top-4">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Centro personal</h2>
          </div>

          {/* Mi Cuenta group */}
          <div className="border-b border-border">
            <button onClick={() => toggleGroup("Mi Cuenta")}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-semibold text-foreground">Mi Cuenta</span>
              <span className="text-muted-foreground text-xs">{expandedGroups["Mi Cuenta"] ? "−" : "+"}</span>
            </button>
            {expandedGroups["Mi Cuenta"] && (
              <ul className="pb-1">
                <li><NavButton icon={User} label="Mi perfil" section={undefined} /></li>
                <li>
                  <button
                    onClick={() => navigate("/editar-perfil")}
                    className="w-full flex items-center gap-2 px-6 py-1.5 text-[13px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" /> Mi perfil
                  </button>
                </li>
                <li><NavButton icon={MapPin} label="Mis direcciones" section="addresses" /></li>
                <li><NavButton icon={CreditCard} label="Métodos de pago" section="payment" /></li>
                <li><NavButton icon={Settings} label="Configuración" section="settings" /></li>
              </ul>
            )}
          </div>

          {/* Mis Pedidos group */}
          <div className="border-b border-border">
            <button onClick={() => toggleGroup("Mis Pedidos")}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-semibold text-foreground">Mis Pedidos</span>
              <span className="text-muted-foreground text-xs">{expandedGroups["Mis Pedidos"] ? "−" : "+"}</span>
            </button>
            {expandedGroups["Mis Pedidos"] && (
              <ul className="pb-1">
                <li><NavButton icon={ShoppingBag} label="Ver todos" section="orders" /></li>
                <li>
                  <NavButton
                    icon={RotateCcw}
                    label="Mis devoluciones"
                    section="returns"
                    badge={pendingReturns}
                  />
                </li>
              </ul>
            )}
          </div>

          {/* Mis Intereses group */}
          <div className="border-b border-border">
            <button onClick={() => toggleGroup("Mis Intereses")}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-semibold text-foreground">Mis Intereses</span>
              <span className="text-muted-foreground text-xs">{expandedGroups["Mis Intereses"] ? "−" : "+"}</span>
            </button>
            {expandedGroups["Mis Intereses"] && (
              <ul className="pb-1">
                <li><NavButton icon={Heart} label="Favoritos" section="favorites" /></li>
              </ul>
            )}
          </div>

          {/* Servicio al Cliente group */}
          <div className="border-b border-border">
            <button onClick={() => toggleGroup("Servicio al Cliente")}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-semibold text-foreground">Servicio al Cliente</span>
              <span className="text-muted-foreground text-xs">{expandedGroups["Servicio al Cliente"] ? "−" : "+"}</span>
            </button>
            {expandedGroups["Servicio al Cliente"] && (
              <ul className="pb-1">
                <li>
                  <button
                    onClick={() => navigate("/notificaciones")}
                    className="w-full flex items-center gap-2 px-6 py-1.5 text-[13px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" /> Notificaciones
                  </button>
                </li>
                <li>
                  <SupportMenuPopover>
                    <button className="w-full flex items-center gap-2 px-6 py-1.5 text-[13px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                      <HelpCircle className="w-3.5 h-3.5" /> Centro de ayuda
                    </button>
                  </SupportMenuPopover>
                </li>
              </ul>
            )}
          </div>

          {/* Política group */}
          <div className="border-b border-border">
            <button onClick={() => toggleGroup("Política")}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-semibold text-foreground">Política</span>
              <span className="text-muted-foreground text-xs">{expandedGroups["Política"] ? "−" : "+"}</span>
            </button>
            {expandedGroups["Política"] && (
              <ul className="pb-1">
                <li>
                  <button onClick={() => setShowLegal(true)}
                    className="w-full flex items-center gap-2 px-6 py-1.5 text-[13px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                    <Shield className="w-3.5 h-3.5" /> Términos y condiciones
                  </button>
                </li>
                <li>
                  <button onClick={() => setShowAbout(true)}
                    className="w-full flex items-center gap-2 px-6 py-1.5 text-[13px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                    <Info className="w-3.5 h-3.5" /> Acerca de
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-destructive hover:bg-destructive/5 transition-colors border-t border-border"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isLoading ? "Cerrando..." : "Cerrar Sesión"}
          </button>
        </aside>

        {/* CENTER */}
        <main className="space-y-4 min-w-0">

          {/* Greeting card — always visible */}
          <div className="bg-background border border-border rounded-md px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border-2 border-border">
                  <AvatarImage src={user?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-base">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-lg font-bold text-foreground leading-tight">
                    Hola, <span className="text-primary">{user?.name || user?.email?.split("@")[0] || "Usuario"}</span>
                  </h1>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/editar-perfil")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Editar perfil <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick stats */}
            <div className="mt-4 grid grid-cols-4 divide-x divide-border border border-border rounded-md">
              <button
                onClick={() => setActiveSection('orders')}
                className={`flex flex-col items-center py-3 gap-0.5 hover:bg-muted/40 cursor-pointer transition-colors ${activeSection === 'orders' ? 'bg-primary/5' : ''}`}
              >
                <span className="text-xl font-bold text-foreground">{totalOrders}</span>
                <span className="text-[11px] text-muted-foreground">Pedidos</span>
              </button>
              <button
                onClick={() => setActiveSection('favorites')}
                className={`flex flex-col items-center py-3 gap-0.5 hover:bg-muted/40 cursor-pointer transition-colors ${activeSection === 'favorites' ? 'bg-primary/5' : ''}`}
              >
                <span className="text-xl font-bold text-foreground">{favorites.length}</span>
                <span className="text-[11px] text-muted-foreground">Favoritos</span>
              </button>
              <button
                onClick={() => setActiveSection('returns')}
                className={`flex flex-col items-center py-3 gap-0.5 hover:bg-muted/40 cursor-pointer transition-colors relative ${activeSection === 'returns' ? 'bg-primary/5' : ''}`}
              >
                <span className="text-xl font-bold text-foreground">{myReturns.length}</span>
                <span className="text-[11px] text-muted-foreground">Devoluciones</span>
                {pendingReturns > 0 && (
                  <span className="absolute top-1 right-2 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">
                    {pendingReturns}
                  </span>
                )}
              </button>
              <div className="flex flex-col items-center py-3 gap-0.5">
                <span className="text-xl font-bold text-foreground">0</span>
                <span className="text-[11px] text-muted-foreground">Puntos</span>
              </div>
            </div>
          </div>

          {/* Active section panel */}
          {activeSection === 'orders'    && <InlineOrdersPanel />}
          {activeSection === 'favorites' && <InlineFavoritesPanel />}
          {activeSection === 'addresses' && <InlineAddressesPanel />}
          {activeSection === 'payment'   && <InlinePaymentPanel />}
          {activeSection === 'settings'  && <InlineSettingsPanel />}
          {activeSection === 'returns'   && <InlineReturnsPanel />}
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-4 self-start sticky top-4">

          {/* Support widget */}
          <div className="bg-background border border-border rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Servicio Al Cliente</h3>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <button onClick={() => navigate("/notificaciones")}
                className="flex flex-col items-center gap-1.5 py-3 hover:bg-muted/40 transition-colors">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground leading-tight text-center">Mis<br/>Notificaciones</span>
              </button>
              <SupportMenuPopover>
                <button className="flex flex-col items-center gap-1.5 py-3 hover:bg-muted/40 transition-colors w-full">
                  <HelpCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground leading-tight text-center">Centro<br/>de Ayuda</span>
                </button>
              </SupportMenuPopover>
            </div>
          </div>

          {/* Quick access cards */}
          <div className="bg-background border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setActiveSection('favorites')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
                <span className="text-xs font-semibold text-foreground">Favoritos</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-xs">{favorites.length} artículo{favorites.length !== 1 ? "s" : ""}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
            <button
              onClick={() => setActiveSection('orders')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Mis Pedidos</span>
              </div>
              <span className="text-xs text-muted-foreground">{totalOrders} total</span>
            </button>
            <button
              onClick={() => setActiveSection('returns')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Devoluciones</span>
              </div>
              <div className="flex items-center gap-1">
                {pendingReturns > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[9px] bg-destructive text-destructive-foreground">{pendingReturns}</Badge>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </button>
          </div>

          {/* Legal */}
          <div className="bg-background border border-border rounded-md overflow-hidden">
            <button onClick={() => setShowLegal(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border-b border-border">
              <Shield className="w-3.5 h-3.5" /> Términos Legales
            </button>
            <button onClick={() => setShowAbout(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
              <Info className="w-3.5 h-3.5" /> Acerca de
            </button>
          </div>
        </aside>
      </div>

      <Footer />
    </div>
  );

  return (
    <PageWrapper seo={{ title: "Mi Cuenta", description: "Gestiona tu cuenta y perfil" }}>
      <div className="md:hidden"><MobileLayout /></div>
      <div className="hidden md:block"><DesktopLayout /></div>
      <LegalPagesModal open={showLegal} onOpenChange={setShowLegal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
    </PageWrapper>
  );
}

export default UserProfilePage;
