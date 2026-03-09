import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package, ShoppingCart, Eye, Truck, TrendingUp, Clock, 
  CheckCircle2, AlertTriangle, ChevronRight, Activity
} from 'lucide-react';
import { usePurchasingAgent } from '@/hooks/usePurchasingAgent';
import { AgentView } from '@/pages/purchasing-agent/PurchasingAgentDashboard';

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

interface PurchasingAgentOverviewProps {
  agentProfile: AgentProfile;
  onNavigate: (view: AgentView) => void;
}

export function PurchasingAgentOverview({ agentProfile, onNavigate }: PurchasingAgentOverviewProps) {
  const { useAgentAssignments } = usePurchasingAgent();
  const { data: assignments } = useAgentAssignments(agentProfile.id);

  const activeAssignments = assignments?.filter(a => a.status === 'in_progress') || [];
  const pendingAssignments = assignments?.filter(a => a.status === 'assigned') || [];

  const stats = [
    {
      title: 'POs Activas',
      value: agentProfile.current_active_pos,
      max: agentProfile.max_concurrent_pos,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Items Procesados',
      value: agentProfile.total_items_processed,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Tiempo Promedio',
      value: `${agentProfile.avg_dispatch_hours.toFixed(1)}h`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Calidad',
      value: agentProfile.quality_score.toFixed(1),
      max: 5,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                ¡Bienvenido, {agentProfile.full_name}!
              </h2>
              <p className="text-muted-foreground mt-1">
                Código de Agente: <span className="font-medium">{agentProfile.agent_code}</span> • 
                País: <span className="font-medium">{agentProfile.country_name || agentProfile.country_code}</span>
              </p>
            </div>
            <Badge 
              variant={agentProfile.status === 'active' ? 'default' : 'secondary'}
              className="text-base px-4 py-1"
            >
              {agentProfile.status === 'active' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{stat.value}</span>
                    {stat.max && <span className="text-sm text-muted-foreground">/ {stat.max}</span>}
                  </div>
                </div>
              </div>
              {stat.max && typeof stat.value === 'number' && (
                <Progress 
                  value={(stat.value / stat.max) * 100} 
                  className="h-1.5 mt-3" 
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('assignments')}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Asignaciones</p>
                <p className="text-sm text-muted-foreground">{assignments?.length || 0} totales</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('purchases')}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Compras</p>
                <p className="text-sm text-muted-foreground">Gestionar órdenes</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('qc')}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Control QC</p>
                <p className="text-sm text-muted-foreground">Validar productos</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('shipments')}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Envíos</p>
                <p className="text-sm text-muted-foreground">Logística internacional</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Asignaciones Pendientes
            </CardTitle>
            <CardDescription>POs asignadas esperando iniciar</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay asignaciones pendientes
              </p>
            ) : (
              <div className="space-y-3">
                {pendingAssignments.slice(0, 5).map((assignment) => (
                  <div 
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{assignment.po?.po_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.po?.total_orders} pedidos • {assignment.po?.total_quantity} items
                      </p>
                    </div>
                    <Badge variant="secondary">Pendiente</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Work */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              En Proceso
            </CardTitle>
            <CardDescription>POs actualmente en trabajo</CardDescription>
          </CardHeader>
          <CardContent>
            {activeAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay POs en proceso actualmente
              </p>
            ) : (
              <div className="space-y-3">
                {activeAssignments.slice(0, 5).map((assignment) => (
                  <div 
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{assignment.po?.po_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.po?.total_orders} pedidos • {assignment.po?.total_quantity} items
                      </p>
                    </div>
                    <Badge variant="default">En Proceso</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
