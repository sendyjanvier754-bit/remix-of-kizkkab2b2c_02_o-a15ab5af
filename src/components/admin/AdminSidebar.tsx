import { 
  LayoutDashboard, 
  CreditCard, 
  Package, 
  Users, 
  MapPin, 
  Settings,
  LogOut,
  ShoppingBag,
  ChevronLeft,
  FolderTree,
  ShoppingCart,
  Image as ImageIcon,
  Truck,
  ClipboardList,
  Calculator,
  MessageSquare,
  RefreshCw,
  Ticket,
  UserCheck,
  BarChart3,
  LayoutGrid,
  Globe,
  Store,
  Headset
} from "lucide-react";
import { Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import { CheckSquare } from "lucide-react";

const mainNavItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Aprobaciones", url: "/admin/aprobaciones", icon: CheckSquare },
  { title: "Cotizaciones", url: "/admin/cotizaciones", icon: MessageSquare },
  { title: "Pedidos B2B", url: "/admin/pedidos", icon: ClipboardList },
  { title: "Reembolsos", url: "/admin/reembolsos", icon: RefreshCw },
  { title: "Conciliación B2B", url: "/admin/conciliacion", icon: CreditCard },
  { title: "Catálogo", url: "/admin/catalogo", icon: Package },
  { title: "Categorías", url: "/admin/categorias", icon: FolderTree },
  { title: "Proveedores", url: "/admin/proveedores", icon: Truck },
  { title: "Config. Precios", url: "/admin/precios", icon: Calculator },
  { title: "Vendedores", url: "/admin/vendedores", icon: Users },
  { title: "Banners", url: "/admin/banners", icon: ImageIcon },
];

const analyticsItems = [
  { title: "PO Maestra", url: "/admin/po-master", icon: Package },
  { title: "Optimización Inventario", url: "/admin/cart-analytics", icon: BarChart3 },
  { title: "Gestión Inventario", url: "/admin/inventory", icon: Package },
];

const settingsItems = [
  { title: "Markets", url: "/admin/markets", icon: Store },
  { title: "Logística Global", url: "/admin/global-logistics", icon: Globe },
  { title: "Secciones Marketplace", url: "/admin/marketplace-sections", icon: LayoutGrid },
  { title: "Logística Local", url: "/admin/logistics", icon: Truck },
  { title: "Puntos de Retiro", url: "/admin/pickup-points", icon: MapPin },
  { title: "Comisiones", url: "/admin/commissions", icon: Settings },
  { title: "Métodos de Pago", url: "/admin/payment-methods", icon: CreditCard },
];

const discountItems = [
  { title: "Códigos de Descuento", url: "/admin/codigos-descuento", icon: Ticket },
  { title: "Descuentos por Usuario", url: "/admin/descuentos-usuarios", icon: UserCheck },
];

export function AdminSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const { signOut, user } = useAuth();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-hero-gradient flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground">Siver Market</span>
                <span className="text-xs text-accent font-semibold">Admin 509</span>
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
            className="h-8 w-8"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/admin"}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink 
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Descuentos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink 
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink 
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            B2B Mayorista
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Portal B2B">
                  <Link
                    to="/seller/adquisicion-lotes"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ShoppingCart className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>Portal B2B</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        {!isCollapsed && user && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {user.name?.substring(0, 2).toUpperCase() || "AD"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-foreground truncate">{user.name || "Admin"}</span>
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
          </div>
        )}
        {isCollapsed && user && (
          <div className="flex justify-center mb-3">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {user.name?.substring(0, 2).toUpperCase() || "AD"}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
