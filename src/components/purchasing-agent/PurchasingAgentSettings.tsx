import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  User, MapPin, Clock, TrendingUp, Package, CheckCircle2, 
  Star, Award, Shield
} from 'lucide-react';

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

interface PurchasingAgentSettingsProps {
  agentProfile: AgentProfile;
}

export function PurchasingAgentSettings({ agentProfile }: PurchasingAgentSettingsProps) {
  const performanceLevel = 
    agentProfile.quality_score >= 4.5 ? 'Excelente' :
    agentProfile.quality_score >= 4.0 ? 'Muy Bueno' :
    agentProfile.quality_score >= 3.5 ? 'Bueno' :
    agentProfile.quality_score >= 3.0 ? 'Regular' : 'Necesita Mejora';

  const performanceColor = 
    agentProfile.quality_score >= 4.5 ? 'text-green-600' :
    agentProfile.quality_score >= 4.0 ? 'text-blue-600' :
    agentProfile.quality_score >= 3.5 ? 'text-yellow-600' :
    'text-orange-600';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Mi Perfil de Agente
          </CardTitle>
          <CardDescription>Información de tu cuenta de agente de compra</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre Completo</p>
                <p className="font-medium text-lg">{agentProfile.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Código de Agente</p>
                <Badge variant="outline" className="font-mono text-base">
                  {agentProfile.agent_code}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge 
                  variant={agentProfile.status === 'active' ? 'default' : 'secondary'}
                  className="mt-1"
                >
                  {agentProfile.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">País de Operación</p>
                  <p className="font-medium">{agentProfile.country_name || agentProfile.country_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Capacidad de POs</p>
                  <p className="font-medium">{agentProfile.current_active_pos} / {agentProfile.max_concurrent_pos} activas</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Métricas de Desempeño
          </CardTitle>
          <CardDescription>Tu rendimiento como agente de compra</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quality Score */}
          <div className="p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">Puntuación de Calidad</span>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-bold ${performanceColor}`}>
                  {agentProfile.quality_score.toFixed(1)}
                </span>
                <span className="text-muted-foreground"> / 5.0</span>
              </div>
            </div>
            <Progress value={agentProfile.quality_score * 20} className="h-2 mb-2" />
            <p className={`text-sm ${performanceColor} font-medium`}>{performanceLevel}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total POs Completed */}
            <div className="p-4 bg-muted/50 rounded-xl text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-3xl font-bold">{agentProfile.total_pos_completed}</p>
              <p className="text-sm text-muted-foreground">POs Completadas</p>
            </div>

            {/* Total Items */}
            <div className="p-4 bg-muted/50 rounded-xl text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-3xl font-bold">{agentProfile.total_items_processed}</p>
              <p className="text-sm text-muted-foreground">Items Procesados</p>
            </div>

            {/* Average Dispatch Time */}
            <div className="p-4 bg-muted/50 rounded-xl text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <p className="text-3xl font-bold">{agentProfile.avg_dispatch_hours.toFixed(1)}h</p>
              <p className="text-sm text-muted-foreground">Tiempo Promedio</p>
            </div>
          </div>

          <Separator />

          {/* Achievements */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Logros
            </h4>
            <div className="flex flex-wrap gap-2">
              {agentProfile.total_pos_completed >= 10 && (
                <Badge variant="outline" className="bg-yellow-100 border-yellow-300">
                  🏆 10+ POs Completadas
                </Badge>
              )}
              {agentProfile.total_items_processed >= 100 && (
                <Badge variant="outline" className="bg-blue-100 border-blue-300">
                  📦 100+ Items Procesados
                </Badge>
              )}
              {agentProfile.quality_score >= 4.5 && (
                <Badge variant="outline" className="bg-green-100 border-green-300">
                  ⭐ Agente Elite
                </Badge>
              )}
              {agentProfile.avg_dispatch_hours <= 24 && (
                <Badge variant="outline" className="bg-purple-100 border-purple-300">
                  ⚡ Despacho Rápido
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Guías y Políticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">Control de Calidad (QC)</p>
            <p>Siempre sube fotos y videos claros de cada producto antes de aprobar o rechazar.</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">Compras Fragmentadas</p>
            <p>Puedes realizar múltiples compras por PO en diferentes plataformas (1688, Alibaba, etc).</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">Envíos Internacionales</p>
            <p>Solo puedes crear un envío cuando el 100% de los items tienen QC aprobado.</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-1">Auditoría de Peso</p>
            <p>Siempre incluye foto del paquete en la báscula para validación de peso.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
