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
  RotateCcw, MessageCircle, Clock, Truck, Star, Wallet,
} from "lucide-react";
import { Store as StoreIcon } from "lucide-react";
import { UserRole } from "@/types/auth";
import { toast } from "sonner";
import { LegalPagesModal } from "@/components/legal/LegalPagesModal";
import { AboutModal } from "@/components/legal/AboutModal";
import { UpgradeToSellerModal } from "@/components/profile/UpgradeToSellerModal";
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
import { useUnreadChatCount } from "@/hooks/useSupportChat";
import RecommendedProductsSection from "@/components/products/RecommendedProductsSection";

type ActiveSection = 'orders' | 'favorites' | 'addresses' | 'payment' | 'settings' | 'returns';

export function UserProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showUpgradeSeller, setShowUpgradeSeller] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('orders');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Mi Cuenta": true,
    "Mis Pedidos": true,
    "Mis Intereses": false,
    "Centro de Ayuda": true,
    "Política": false,
  });

  const { items: favorites = [] } = useB2CFavorites();
  const { data: b2cOrders = [] } = useBuyerB2COrders();
  const { data: b2bOrders = [] } = useBuyerOrders();
  const { data: myReturns = [] } = useMyReturnRequests();
  const unreadChats = useUnreadChatCount();
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

  // Derived order counts by status
  const pendingPayment = b2cOrders.filter(o => o.status === 'pending_payment' || o.status === 'pending').length;
  const pendingShipment = b2cOrders.filter(o => o.status === 'confirmed' || o.status === 'processing').length;
  const shipped = b2cOrders.filter(o => o.status === 'shipped' || o.status === 'in_transit').length;

  // ── Mobile layout (AliExpress-style with all desktop features) ──────────────
  const MobileLayout = () => (
    <div className="min-h-screen bg-muted/30 pb-24">

      {/* ── Header: Name + icons ── */}
      <div className="bg-background px-4 pt-4 pb-3 flex items-center gap-3">
        <Avatar className="w-10 h-10 border-2 border-border flex-shrink-0">
          <AvatarImage src={user?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">{getInitials()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground truncate">{user?.name || "Usuario"}</h1>
        </div>
        <button onClick={() => navigate("/editar-perfil")} className="p-2 hover:bg-muted rounded-full transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
        <button onClick={() => navigate("/notificaciones")} className="p-2 hover:bg-muted rounded-full transition-colors relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadChats > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">{unreadChats}</span>
          )}
        </button>
      </div>

      {/* ── Mis Pedidos: 5 icon grid ── */}
      <div className="bg-background mt-2 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-foreground">Mis pedidos</h2>
          <button onClick={() => navigate("/mis-compras")} className="text-xs text-primary flex items-center gap-0.5 font-medium">
            Ver todo <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[
            { icon: <Wallet className="w-7 h-7" />, label: "Pendientes de pago", count: pendingPayment, action: () => navigate("/mis-compras") },
            { icon: <Package className="w-7 h-7" />, label: "Pendientes de envío", count: pendingShipment, action: () => navigate("/mis-compras") },
            { icon: <Truck className="w-7 h-7" />, label: "Enviado", count: shipped, action: () => navigate("/mis-compras") },
            { icon: <Star className="w-7 h-7" />, label: "Añadir reseñas", count: 0, action: () => navigate("/mis-compras") },
            { icon: <RotateCcw className="w-7 h-7" />, label: "Devoluciones", count: pendingReturns, action: () => setActiveSection('returns') },
          ].map((item, i) => (
            <button key={i} onClick={item.action} className="flex flex-col items-center gap-1.5 py-2 relative">
              <div className="text-foreground/70">{item.icon}</div>
              {item.count > 0 && (
                <span className="absolute top-0 right-1/4 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">{item.count}</span>
              )}
              <span className="text-[10px] text-muted-foreground leading-tight text-center line-clamp-2">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 2: Historial, Lista de deseos, Mis direcciones, Configuración ── */}
      <div className="bg-background mt-2 px-4 py-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: <Clock className="w-7 h-7" />, label: "Historial", action: () => navigate("/mis-compras") },
            { icon: <Heart className="w-7 h-7" />, label: "Lista de deseos", action: () => navigate("/favoritos") },
            { icon: <MapPin className="w-7 h-7" />, label: "Mis direcciones", action: () => navigate("/mis-direcciones") },
            { icon: <Settings className="w-7 h-7" />, label: "Configuración", action: () => setActiveSection('settings') },
          ].map((item, i) => (
            <button key={i} onClick={item.action} className="flex flex-col items-center gap-1.5 py-1">
              <div className="text-foreground/70">{item.icon}</div>
              <span className="text-[10px] text-muted-foreground leading-tight text-center line-clamp-2">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 3: Centro de Ayuda, Pago, Live Chat, Créditos, Legal ── */}
      <div className="bg-background mt-2 px-4 py-4">
        <div className="grid grid-cols-5 gap-1">
          {[
            { icon: <HelpCircle className="w-7 h-7" />, label: "Centro de Ayuda", action: () => navigate("/soporte"), badge: 0 },
            { icon: <CreditCard className="w-7 h-7" />, label: "Pago", action: () => setActiveSection('payment'), badge: 0 },
            { icon: <MessageCircle className="w-7 h-7" />, label: "Live Chat", action: () => navigate("/soporte"), badge: unreadChats },
            { icon: <Wallet className="w-7 h-7" />, label: "Créditos de compra", action: () => {}, badge: 0 },
            { icon: <Info className="w-7 h-7" />, label: "Sugerencias", action: () => setShowAbout(true), badge: 0 },
          ].map((item, i) => (
            <button key={i} onClick={item.action} className="flex flex-col items-center gap-1.5 py-1 relative">
              <div className="text-foreground/70">{item.icon}</div>
              {item.badge > 0 && (
                <span className="absolute top-0 right-1/4 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">{item.badge}</span>
              )}
              <span className="text-[10px] text-muted-foreground leading-tight text-center line-clamp-2">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Términos Legales / Acerca de ── */}
      <div className="bg-background mt-2 divide-y divide-border">
        <button onClick={() => setShowLegal(true)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-foreground">Términos Legales</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => setShowAbout(true)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-foreground">Acerca de</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* ── Active section panel (inline, shows when tapped) ── */}
      {activeSection && (
        <div className="mt-2 px-3">
          {activeSection === 'orders'    && <InlineOrdersPanel />}
          {activeSection === 'favorites' && <InlineFavoritesPanel />}
          {activeSection === 'addresses' && <InlineAddressesPanel />}
          {activeSection === 'payment'   && <InlinePaymentPanel />}
          {activeSection === 'settings'  && <InlineSettingsPanel />}
          {activeSection === 'returns'   && <InlineReturnsPanel />}
        </div>
      )}

      {/* ── Convertirse en Vendedor (solo para usuarios normales) ── */}
      {user?.role === UserRole.USER && (
        <div className="mt-2 px-4">
          <button
            onClick={() => setShowUpgradeSeller(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-primary border border-primary/30 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors font-medium"
          >
            <StoreIcon className="w-4 h-4" />
            Convertirse en Vendedor
          </button>
        </div>
      )}

      {/* ── Cerrar Sesión ── */}
      <div className="mt-4 px-4 pb-4">
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-destructive border border-destructive/30 rounded-lg bg-background hover:bg-destructive/5 transition-colors font-medium"
        >
          <LogOut className="w-4 h-4" />
          {isLoading ? "Cerrando sesión..." : "Cerrar Sesión"}
        </button>
      </div>

      {/* ── Productos recomendados (solo mobile/tablet) ── */}
      <RecommendedProductsSection maxProducts={12} />
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

          {/* Centro de Ayuda group */}
          <div className="border-b border-border">
            <button onClick={() => toggleGroup("Centro de Ayuda")}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Centro de Ayuda
                {unreadChats > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[9px] bg-destructive text-destructive-foreground">{unreadChats}</Badge>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{expandedGroups["Centro de Ayuda"] ? "−" : "+"}</span>
            </button>
            {expandedGroups["Centro de Ayuda"] && (
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
                  <button
                    onClick={() => navigate("/soporte")}
                    className="w-full flex items-center gap-2 px-6 py-1.5 text-[13px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="flex-1 text-left">Live Chat</span>
                    {unreadChats > 0 && (
                      <Badge className="h-4 min-w-4 px-1 text-[9px] bg-destructive text-destructive-foreground">{unreadChats}</Badge>
                    )}
                  </button>
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

          {/* Upgrade to Seller */}
          {user?.role === UserRole.USER && (
            <button
              onClick={() => setShowUpgradeSeller(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-primary hover:bg-primary/5 transition-colors border-t border-border font-medium"
            >
              <StoreIcon className="w-3.5 h-3.5" />
              Convertirse en Vendedor
            </button>
          )}

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
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Centro de Ayuda</h3>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <button onClick={() => navigate("/notificaciones")}
                className="flex flex-col items-center gap-1.5 py-3 hover:bg-muted/40 transition-colors">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground leading-tight text-center">Notificaciones</span>
              </button>
              <button onClick={() => navigate("/soporte")}
                className="relative flex flex-col items-center gap-1.5 py-3 hover:bg-muted/40 transition-colors w-full">
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground leading-tight text-center">Live Chat</span>
                {unreadChats > 0 && (
                  <span className="absolute top-1.5 right-3 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">
                    {unreadChats}
                  </span>
                )}
              </button>
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
      <UpgradeToSellerModal open={showUpgradeSeller} onOpenChange={setShowUpgradeSeller} />
    </PageWrapper>
  );
}

export default UserProfilePage;
