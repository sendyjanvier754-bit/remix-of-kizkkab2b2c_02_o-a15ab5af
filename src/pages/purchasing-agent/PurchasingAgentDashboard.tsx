import { useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { PurchasingAgentSidebar } from '@/components/purchasing-agent/PurchasingAgentSidebar';
import { PurchasingAgentOverview } from '@/components/purchasing-agent/PurchasingAgentOverview';
import { PurchasingAgentAssignments } from '@/components/purchasing-agent/PurchasingAgentAssignments';
import { PurchasingAgentPurchases } from '@/components/purchasing-agent/PurchasingAgentPurchases';
import { PurchasingAgentQC } from '@/components/purchasing-agent/PurchasingAgentQC';
import { PurchasingAgentShipments } from '@/components/purchasing-agent/PurchasingAgentShipments';
import { PurchasingAgentSettings } from '@/components/purchasing-agent/PurchasingAgentSettings';
import { usePurchasingAgent } from '@/hooks/usePurchasingAgent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, ShieldAlert } from 'lucide-react';

export type AgentView = 'overview' | 'assignments' | 'purchases' | 'qc' | 'shipments' | 'settings';

export default function PurchasingAgentDashboard() {
  const [currentView, setCurrentView] = useState<AgentView>('overview');
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  const { useAgentProfile } = usePurchasingAgent();
  const { data: agentProfile, isLoading: profileLoading } = useAgentProfile();

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando portal de agente...</p>
        </div>
      </div>
    );
  }

  if (!agentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 mx-auto mb-2 text-destructive" />
            <CardTitle>Acceso Restringido</CardTitle>
            <CardDescription>No tienes un perfil de agente de compra activo.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Contacta al administrador para solicitar acceso al portal de agentes de compra.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'overview':
        return <PurchasingAgentOverview agentProfile={agentProfile} onNavigate={setCurrentView} />;
      case 'assignments':
        return (
          <PurchasingAgentAssignments 
            agentProfile={agentProfile}
            selectedPOId={selectedPOId}
            onSelectPO={setSelectedPOId}
          />
        );
      case 'purchases':
        return (
          <PurchasingAgentPurchases 
            agentProfile={agentProfile}
            selectedPOId={selectedPOId}
            onSelectPO={setSelectedPOId}
          />
        );
      case 'qc':
        return (
          <PurchasingAgentQC 
            agentProfile={agentProfile}
            selectedPOId={selectedPOId}
            onSelectPO={setSelectedPOId}
          />
        );
      case 'shipments':
        return (
          <PurchasingAgentShipments 
            agentProfile={agentProfile}
            selectedPOId={selectedPOId}
            onSelectPO={setSelectedPOId}
          />
        );
      case 'settings':
        return <PurchasingAgentSettings agentProfile={agentProfile} />;
      default:
        return <PurchasingAgentOverview agentProfile={agentProfile} onNavigate={setCurrentView} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <PurchasingAgentSidebar 
          agentProfile={agentProfile}
          currentView={currentView}
          onNavigate={setCurrentView}
        />
        <SidebarInset className="flex-1">
          <header className="h-14 flex items-center gap-4 border-b px-4 bg-background sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">
                {currentView === 'overview' && 'Dashboard'}
                {currentView === 'assignments' && 'Mis Asignaciones'}
                {currentView === 'purchases' && 'Gestión de Compras'}
                {currentView === 'qc' && 'Control de Calidad'}
                {currentView === 'shipments' && 'Envíos Internacionales'}
                {currentView === 'settings' && 'Configuración'}
              </h1>
            </div>
          </header>
          <main className="p-6">
            {renderContent()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
