import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  Package,
  Truck,
  RefreshCw,
  MessageSquare,
  Clock,
  CheckCircle,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { LegalPagesModal } from "@/components/legal/LegalPagesModal";
import { AboutModal } from "@/components/legal/AboutModal";
import { useB2CFavorites } from "@/hooks/useB2CFavorites";
import { useBuyerB2COrders } from "@/hooks/useBuyerB2COrders";
import { useBuyerOrders } from "@/hooks/useBuyerOrders";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";

// ── Status helpers ────────────────────────────────────────────────────────────
const ORDER_STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:    { label: "Por pagar",    icon: Clock,        color: "text-amber-500" },
  placed:     { label: "Por pagar",    icon: Clock,        color: "text-amber-500" },
  paid:       { label: "Procesando",   icon: Package,      color: "text-blue-500"  },
  preparing:  { label: "Procesando",   icon: Package,      color: "text-blue-500"  },
  in_transit: { label: "Enviado",      icon: Truck,        color: "text-indigo-500" },
  shipped:    { label: "Enviado",      icon: Truck,        color: "text-indigo-500" },
  delivered:  { label: "Entregado",    icon: CheckCircle,  color: "text-green-500" },
  cancelled:  { label: "Cancelado",    icon: Minus,        color: "text-red-400"   },
};

// ── Sidebar nav ───────────────────────────────────────────────────────────────
interface NavItem { label: string; href: string; icon?: React.ElementType }

const LEFT_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Mi Cuenta",
    items: [
      { label: "Mi perfil",           href: "/editar-perfil",   icon: User      },
      { label: "Mis direcciones",     href: "/mis-direcciones", icon: MapPin    },
      { label: "Métodos de pago",     href: "/metodos-pago",    icon: CreditCard },
      { label: "Configuración",       href: "/configuracion",   icon: Settings  },
    ],
  },
  {
    group: "Mis Pedidos",
    items: [
      { label: "Ver todos",           href: "/mis-compras",     icon: ShoppingBag },
    ],
  },
  {
    group: "Mis Intereses",
    items: [
      { label: "Favoritos",           href: "/favoritos",       icon: Heart },
    ],
  },
  {
    group: "Servicio al Cliente",
    items: [
      { label: "Centro de ayuda",     href: "/ayuda",           icon: HelpCircle },
      { label: "Notificaciones",      href: "/notificaciones",  icon: Bell       },
      { label: "Soporte",             href: "/soporte",         icon: MessageSquare },
    ],
  },
  {
    group: "Política",
    items: [
      { label: "Términos y condiciones", href: "#legal",  icon: Shield },
      { label: "Acerca de",             href: "#about",  icon: Info   },
    ],
  },
];

// ── Order status quick-links (center panel, below greeting) ──────────────────
const ORDER_QUICK: { label: string; status: string; icon: React.ElementType }[] = [
  { label: "Por pagar",  status: "placed",     icon: Clock       },
  { label: "Procesando", status: "preparing",  icon: Package     },
  { label: "Enviado",    status: "in_transit", icon: Truck       },
  { label: "Comentarios",status: "delivered",  icon: MessageSquare },
  { label: "Devolución", status: "cancelled",  icon: RefreshCw   },
];

export function UserProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Mi Cuenta": true,
  });

  // Data
  const { items: favorites = [] } = useB2CFavorites();
  const { data: b2cOrders = [] } = useBuyerB2COrders();
  const { data: b2bOrders = [] } = useBuyerOrders();
  const allOrders = [...b2cOrders, ...b2bOrders];

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

  const getInitials = () => {
    const name = user?.name || user?.email || "";
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  };

  const toggleGroup = (group: string) =>
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));

  const handleNavClick = (href: string) => {
    if (href === "#legal") { setShowLegal(true); return; }
    if (href === "#about") { setShowAbout(true); return; }
    navigate(href);
  };

  // Count orders by status group
  const countByStatus = (statuses: string[]) =>
    allOrders.filter(o => {
      const s = (o as any).status ?? "";
      return statuses.includes(s);
    }).length;

  // Recent orders for center panel
  const recentOrders = allOrders.slice(0, 5);

  // ── Mobile layout (unchanged) ─────────────────────────────────────────────
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
            <div className="text-xl font-bold text-primary">{allOrders.length}</div>
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
          { icon: <ShoppingBag className="w-6 h-6"/>, label: "Mis Compras",    action: () => navigate("/mis-compras") },
          { icon: <Heart className="w-6 h-6"/>,        label: "Favoritos",      action: () => navigate("/favoritos") },
          { icon: <MapPin className="w-6 h-6"/>,        label: "Mis Direcciones",action: () => navigate("/mis-direcciones") },
          { icon: <Bell className="w-6 h-6"/>,          label: "Notificaciones", action: () => navigate("/notificaciones") },
          { icon: <HelpCircle className="w-6 h-6"/>,    label: "Centro de Ayuda",action: () => navigate("/ayuda") },
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
      <div className="px-4 pb-4">
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

  // ── Desktop layout (SHEIN-style 3 columns) ────────────────────────────────
  const DesktopLayout = () => (
    <div className="min-h-screen bg-muted/30">
      <GlobalHeader />

      <div className="max-w-[1200px] mx-auto px-4 py-6 grid grid-cols-[220px_1fr_220px] gap-5">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="space-y-0 bg-background border border-border rounded-md overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Centro personal</h2>
          </div>
          {LEFT_NAV.map((group) => {
            const isOpen = expandedGroups[group.group] ?? false;
            return (
              <div key={group.group} className="border-b border-border last:border-b-0">
                <button
                  onClick={() => toggleGroup(group.group)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground">{group.group}</span>
                  <span className="text-muted-foreground text-xs">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <ul className="pb-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.label}>
                          <button
                            onClick={() => handleNavClick(item.href)}
                            className="w-full flex items-center gap-2 px-6 py-1.5 text-[13px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                            {item.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
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

        {/* ── CENTER ── */}
        <main className="space-y-4">

          {/* Greeting card */}
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
                Mi perfil <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick stats row */}
            <div className="mt-4 grid grid-cols-3 divide-x divide-border border border-border rounded-md">
              <div className="flex flex-col items-center py-3 gap-0.5 hover:bg-muted/40 cursor-pointer transition-colors" onClick={() => navigate("/mis-compras")}>
                <span className="text-xl font-bold text-foreground">{allOrders.length}</span>
                <span className="text-[11px] text-muted-foreground">Pedidos</span>
              </div>
              <div className="flex flex-col items-center py-3 gap-0.5 hover:bg-muted/40 cursor-pointer transition-colors" onClick={() => navigate("/favoritos")}>
                <span className="text-xl font-bold text-foreground">{favorites.length}</span>
                <span className="text-[11px] text-muted-foreground">Favoritos</span>
              </div>
              <div className="flex flex-col items-center py-3 gap-0.5 hover:bg-muted/40 cursor-pointer transition-colors">
                <span className="text-xl font-bold text-foreground">0</span>
                <span className="text-[11px] text-muted-foreground">Puntos</span>
              </div>
            </div>
          </div>

          {/* Mis Pedidos */}
          <div className="bg-background border border-border rounded-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-sm font-bold text-foreground">Mis Pedidos</h2>
              <Link to="/mis-compras" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Ver todo <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Status quick filters */}
            <div className="grid grid-cols-5 divide-x divide-border border-b border-border">
              {ORDER_QUICK.map(({ label, status, icon: Icon }) => {
                const count = countByStatus([status]);
                return (
                  <button
                    key={status}
                    onClick={() => navigate("/mis-compras")}
                    className="flex flex-col items-center gap-1.5 py-4 hover:bg-muted/40 transition-colors relative"
                  >
                    <Icon className="w-6 h-6 text-muted-foreground" />
                    {count > 0 && (
                      <span className="absolute top-2.5 right-[calc(50%-14px)] bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {count}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Recent orders list or empty state */}
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <ShoppingBag className="w-10 h-10 opacity-30" />
                <p className="text-sm">Sin pedidos todavía</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentOrders.slice(0, 3).map((order: any) => {
                  const statusKey = order.status ?? "placed";
                  const cfg = ORDER_STATUS_CONFIG[statusKey] || ORDER_STATUS_CONFIG["placed"];
                  const StatusIcon = cfg.icon;
                  const total = order.total_amount ?? order.total ?? 0;
                  const date = order.created_at ? new Date(order.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "";
                  return (
                    <li key={order.id}
                      onClick={() => navigate("/mis-compras")}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                        <div>
                          <p className="text-xs font-medium text-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-[11px] text-muted-foreground">{date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs font-semibold text-foreground">${Number(total).toFixed(2)}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="space-y-4 self-start">

          {/* Servicio al Cliente */}
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
              <button onClick={() => navigate("/soporte")}
                className="flex flex-col items-center gap-1.5 py-3 hover:bg-muted/40 transition-colors">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground leading-tight text-center">Centro<br/>de Ayuda</span>
              </button>
            </div>
          </div>

          {/* Favoritos count */}
          <div className="bg-background border border-border rounded-md overflow-hidden">
            <button
              onClick={() => navigate("/favoritos")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-xs font-semibold text-foreground">Favoritos</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-xs">{favorites.length} artículo{favorites.length !== 1 ? "s" : ""}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
            <button
              onClick={() => navigate("/mis-compras")}
              className="w-full flex items-center justify-between px-4 py-3 border-t border-border hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Mis Pedidos</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-xs">{allOrders.length} pedido{allOrders.length !== 1 ? "s" : ""}</span>
                <ChevronRight className="w-3.5 h-3.5" />
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
      {/* Mobile */}
      <div className="md:hidden">
        <MobileLayout />
      </div>
      {/* Desktop */}
      <div className="hidden md:block">
        <DesktopLayout />
      </div>

      <LegalPagesModal open={showLegal} onOpenChange={setShowLegal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
    </PageWrapper>
  );
}

export default UserProfilePage;
