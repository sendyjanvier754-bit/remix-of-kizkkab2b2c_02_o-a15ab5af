import {
  LayoutDashboard, Package, ShoppingCart, Eye, Truck, Settings, LogOut, ShoppingBag,
  ChevronLeft, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { AgentView } from "@/pages/purchasing-agent/PurchasingAgentDashboard";

interface AgentProfile {
  id: string;
  user_id: string;
  agent_code: string;
  full_name: string;
  country_code: string;
  country_name?: string;
  status: string;
  current_active_pos: number;
  max_concurrent_pos: number;
  total_pos_completed: number;
  total_items_processed: number;
  avg_dispatch_hours: number;
  quality_score: number;
}

interface PurchasingAgentSidebarProps {
  agentProfile: AgentProfile;
  currentView: AgentView;
  onNavigate: (view: AgentView) => void;
}

export function PurchasingAgentSidebar({ agentProfile, currentView, onNavigate }: PurchasingAgentSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const navItems = [
    { id: 'overview' as AgentView, title: 'Dashboard', icon: LayoutDashboard },
    { id: 'assignments' as AgentView, title: 'Mis Asignaciones', icon: Package },
    { id: 'purchases' as AgentView, title: 'Compras', icon: ShoppingCart },
    { id: 'qc' as AgentView, title: 'Control de Calidad', icon: Eye },
    { id: 'shipments' as AgentView, title: 'Envíos', icon: Truck },
    { id: 'settings' as AgentView, title: 'Configuración', icon: Settings },
  ];

  const handleLogout = () => {
    window.location.href = '/';
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground">Agente de Compra</span>
                <span className="text-xs text-muted-foreground">{agentProfile.agent_code}</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Stats Card */}
        {!isCollapsed && (
          <div className="px-4 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">POs Activas</span>
                <Badge variant="secondary">{agentProfile.current_active_pos}/{agentProfile.max_concurrent_pos}</Badge>
              </div>
              <Progress value={(agentProfile.current_active_pos / agentProfile.max_concurrent_pos) * 100} className="h-1.5" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Calidad</span>
                <span className="font-medium">{agentProfile.quality_score.toFixed(1)}/5</span>
              </div>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    tooltip={item.title}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      currentView === item.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        {!isCollapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {agentProfile.full_name?.substring(0, 2).toUpperCase() || "AG"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-foreground truncate">{agentProfile.full_name}</span>
              <span className="text-xs text-muted-foreground truncate">{agentProfile.country_name || agentProfile.country_code}</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center mb-3">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {agentProfile.full_name?.substring(0, 2).toUpperCase() || "AG"}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>Salir</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
