import { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, Home, LogOut, ShoppingBag, ChevronLeft, Package, Heart, User, Store, LayoutGrid, ClipboardList, Shield, Wallet, LayoutDashboard, Ticket, Users, Share2, BarChart3, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar, SidebarSeparator } from "@/components/ui/sidebar";
export function SellerSidebar() {
  const {
    state,
    toggleSidebar
  } = useSidebar();
  const {
    user,
    signOut
  } = useAuth();
  const isCollapsed = state === "collapsed";
  const location = useLocation();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('stores')
      .select('id, slug')
      .eq('owner_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStoreSlug(data.slug || data.id);
      });
  }, [user?.id]);

  const mainNavItems = [{
    title: "Dashboard",
    url: "/seller/dashboard",
    icon: LayoutDashboard
  }, {
    title: "Comprar Lotes",
    url: "/seller/adquisicion-lotes",
    icon: ShoppingCart,
    badge: "B2B"
  }, {
    title: "Mis Compras",
    url: "/seller/mis-compras",
    icon: Package,
    badge: "Nuevo"
  }, {
    title: "Mis Ventas",
    url: "/seller/pedidos",
    icon: ClipboardList
  }, {
    title: "Inventario B2C",
    url: "/seller/inventario",
    icon: LayoutGrid
  }, {
    title: "Marketing",
    url: "/seller/marketing",
    icon: Share2,
    badge: "Nuevo"
  }, {
    title: "Analytics",
    url: "/seller/analytics",
    icon: BarChart3
  }, {
    title: "Mi Catálogo",
    url: "/seller/catalogo",
    icon: Store
  }, {
    title: "Carrito B2B",
    url: "/seller/carrito",
    icon: ShoppingBag
  }, {
    title: "Lista de Deseos",
    url: "/seller/favoritos",
    icon: Heart
  }, {
    title: "Mi Billetera",
    url: "/seller/wallet",
    icon: Wallet
  }, {
    title: "Créditos",
    url: "/seller/credit",
    icon: Shield
  }, {
    title: "Mis Códigos",
    url: "/seller/codigos-descuento",
    icon: Ticket
  }, {
    title: "Desc. Clientes",
    url: "/seller/descuentos-clientes",
    icon: Users
  }, {
    title: "Mi Cuenta",
    url: "/seller/cuenta",
    icon: User
  }];
  const isActive = (url: string) => location.pathname === url;
  return <Sidebar collapsible="icon" className="border-r border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 pt-4 md:pt-16 lg:pt-20 h-screen flex flex-col">
      <SidebarHeader className="p-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-3 overflow-hidden transition-all duration-300 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground tracking-tight">Siver Market</span>
              <span className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">Seller Hub</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="my-2 opacity-50 flex-shrink-0" />

      <SidebarContent className="px-2 flex-1 overflow-y-auto min-h-0">
        <SidebarGroup>
          
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainNavItems.map(item => {
              const active = isActive(item.url);
              return <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={active} className={`
                      h-auto py-3 px-3 rounded-xl transition-all duration-200 border mb-2
                      ${active ? "!bg-[#071d7f] !text-white !border-[#071d7f] shadow-md hover:!bg-[#071d7f]/90 hover:!text-white" : "bg-white text-[#071d7f] border-[#071d7f] hover:bg-gray-50 hover:text-[#071d7f]"}
                    `}>
                      <Link to={item.url} className="flex items-center gap-3 w-full">
                        <item.icon className={`h-5 w-5 flex-shrink-0 transition-colors ${active ? "text-white" : "text-[#071d7f]"}`} />
                        <span className="font-medium flex-1">{item.title}</span>
                        {item.badge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${active ? "bg-white/20 text-white" : "bg-blue-100 text-[#071d7f]"}`}>
                            {item.badge}
                          </span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>;
            })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Ir a inicio" className="h-auto py-3 px-3 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all">
                  <Link to="/" className="flex items-center gap-3">
                    <Home className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium">Volver a la Tienda</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {storeSlug && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Ver mi tienda como cliente" className="h-auto py-3 px-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 transition-all">
                    <a href={`/tienda/${storeSlug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                      <ExternalLink className="h-5 w-5 flex-shrink-0" />
                      <span className="font-medium">Ver mi Tienda</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 pb-20 lg:pb-4 flex-shrink-0 mt-auto">
        <div className={`flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/50 transition-all duration-300 ${isCollapsed ? "justify-center p-2 bg-transparent border-0" : ""}`}>
          <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
              {user?.name?.substring(0, 2).toUpperCase() || "SV"}
            </AvatarFallback>
          </Avatar>
          
          {!isCollapsed && <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold truncate text-foreground">{user?.name || "Vendedor"}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>}
          
          {!isCollapsed && <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg ml-1">
              <LogOut className="h-4 w-4" />
            </Button>}
        </div>
      </SidebarFooter>
    </Sidebar>;
}