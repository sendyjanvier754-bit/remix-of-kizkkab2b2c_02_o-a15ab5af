import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Upload, ShoppingBag, Wallet, Store, User, LifeBuoy, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Dashboard", url: "/grossiste/dashboard", icon: LayoutDashboard },
  { title: "Mis Productos B2B", url: "/grossiste/productos", icon: Package },
  { title: "Importar productos", url: "/grossiste/importar", icon: Upload },
  { title: "Pedidos recibidos", url: "/grossiste/pedidos", icon: ShoppingBag },
  { title: "Liquidaciones", url: "/grossiste/liquidaciones", icon: Wallet },
  { title: "Tienda B2C", url: "/grossiste/tienda-b2c", icon: Store },
  { title: "Perfil del negocio", url: "/grossiste/perfil", icon: User },
  { title: "Soporte", url: "/soporte", icon: LifeBuoy },
];

export function GrossisteSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className={collapsed ? "w-14" : "w-64"}>
      <SidebarContent>
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-semibold">Mayorista</p>
                <p className="text-xs text-muted-foreground">Panel B2B</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => signOut()} className="text-destructive">
                  <LogOut className="w-4 h-4" />
                  {!collapsed && <span>Cerrar sesión</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
