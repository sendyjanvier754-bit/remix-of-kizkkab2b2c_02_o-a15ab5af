import { 
  LayoutDashboard, CreditCard, Package, Users, MapPin, Settings, LogOut, ShoppingBag,
  ChevronLeft, FolderTree, ShoppingCart, Image as ImageIcon, Truck, ClipboardList,
  Calculator, MessageSquare, RefreshCw, Ticket, UserCheck, BarChart3, LayoutGrid,
  Globe, Store, Headset, Bell, MessageCircle, ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckSquare, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

export function AdminSidebar() {
  const { t } = useTranslation();
  const { state, toggleSidebar } = useSidebar();
  const { signOut, user } = useAuth();
  const isCollapsed = state === "collapsed";

  const mainNavItems = [
    { title: t('adminSidebar.dashboard'), url: "/admin", icon: LayoutDashboard },
    { title: t('adminSidebar.approvals'), url: "/admin/aprobaciones", icon: CheckSquare },
    { title: t('adminSidebar.quotes'), url: "/admin/cotizaciones", icon: MessageSquare },
    { title: t('adminSidebar.ordersB2B'), url: "/admin/pedidos", icon: ClipboardList },
    { title: t('adminSidebar.refunds'), url: "/admin/reembolsos", icon: RefreshCw },
    { title: t('adminSidebar.conciliation'), url: "/admin/conciliacion", icon: CreditCard },
    { title: t('adminSidebar.catalog'), url: "/admin/catalogo", icon: Package },
    { title: t('adminSidebar.categories'), url: "/admin/categorias", icon: FolderTree },
    { title: t('adminSidebar.suppliers'), url: "/admin/proveedores", icon: Truck },
    { title: t('adminSidebar.priceConfig'), url: "/admin/precios", icon: Calculator },
    { title: t('adminSidebar.sellers'), url: "/admin/vendedores", icon: Users },
    { title: t('adminSidebar.banners'), url: "/admin/banners", icon: ImageIcon },
    { title: t('adminSidebar.agentOrders'), url: "/admin/agente-pedidos", icon: Headset },
    { title: t('adminSidebar.liveChat'), url: "/admin/soporte-chat", icon: MessageCircle },
    { title: t('adminSidebar.notifications'), url: "/admin/notificaciones", icon: Bell },
  ];

  const analyticsItems = [
    { title: t('adminSidebar.poMaster'), url: "/admin/po-master", icon: Package },
    { title: t('adminSidebar.inventoryOptimization'), url: "/admin/cart-analytics", icon: BarChart3 },
    { title: t('adminSidebar.inventoryManagement'), url: "/admin/inventory", icon: Package },
  ];

  const settingsItems = [
    { title: t('adminSidebar.markets'), url: "/admin/markets", icon: Store },
    { title: t('adminSidebar.globalLogistics'), url: "/admin/global-logistics", icon: Globe },
    { title: t('adminSidebar.marketplaceSections'), url: "/admin/marketplace-sections", icon: LayoutGrid },
    { title: t('adminSidebar.localLogistics'), url: "/admin/logistics", icon: Truck },
    { title: t('adminSidebar.pickupPoints'), url: "/admin/pickup-points", icon: MapPin },
    { title: t('adminSidebar.commissions'), url: "/admin/commissions", icon: Settings },
    { title: t('adminSidebar.paymentMethods'), url: "/admin/payment-methods", icon: CreditCard },
  ];

  const discountItems = [
    { title: t('adminSidebar.discountCodes'), url: "/admin/codigos-descuento", icon: Ticket },
    { title: t('adminSidebar.userDiscounts'), url: "/admin/descuentos-usuarios", icon: UserCheck },
    { title: "Pop-ups Marketing", url: "/admin/popups", icon: Megaphone },
  ];

  const renderGroup = (label: string, items: typeof mainNavItems) => (
    <SidebarGroup>
      <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
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
  );

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
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup(t('adminSidebar.main'), mainNavItems)}
        {renderGroup(t('adminSidebar.analytics'), analyticsItems)}
        {renderGroup(t('adminSidebar.discounts'), discountItems)}
        {renderGroup(t('adminSidebar.system'), settingsItems)}

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>{t('adminSidebar.b2bWholesale')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t('adminSidebar.b2bPortal')}>
                  <Link to="/seller/adquisicion-lotes" className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <ShoppingCart className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{t('adminSidebar.b2bPortal')}</span>}
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
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={signOut}>
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>{t('adminSidebar.logoutSession')}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
