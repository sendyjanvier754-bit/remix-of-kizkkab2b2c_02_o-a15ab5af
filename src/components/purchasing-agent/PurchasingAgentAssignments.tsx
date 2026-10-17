import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Package, Play, Eye, Clock, DollarSign, ChevronRight } from 'lucide-react';
import { usePurchasingAgent } from '@/hooks/usePurchasingAgent';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';

interface AgentProfile {
  id: string;
  user_id: string;
  agent_code: string;
  full_name: string;
  country_code: string;
  current_active_pos: number;
}

interface PurchasingAgentAssignmentsProps {
  agentProfile: AgentProfile;
  selectedPOId: string | null;
  onSelectPO: (poId: string | null) => void;
}

export function PurchasingAgentAssignments({ agentProfile, selectedPOId, onSelectPO }: PurchasingAgentAssignmentsProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { useAgentAssignments, usePOReconciliation, startAssignment } = usePurchasingAgent();
  const { data: assignments, isLoading } = useAgentAssignments(agentProfile.id);
  const { data: reconciliation } = usePOReconciliation(selectedPOId);

  const selectedAssignment = assignments?.find(a => a.po_id === selectedPOId);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      assigned: { variant: 'secondary', label: 'Asignada' },
      in_progress: { variant: 'default', label: 'En Proceso' },
      completed: { variant: 'outline', label: 'Completada' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Assignments List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Mis Asignaciones
            </CardTitle>
            <CardDescription>{assignments?.length || 0} POs asignadas</CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[600px]">
              {assignments?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No tienes asignaciones activas</p>
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  {assignments?.map(assignment => (
                    <button
                      key={assignment.id}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedPOId === assignment.po_id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => onSelectPO(assignment.po_id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{assignment.po?.po_number}</span>
                        {getStatusBadge(assignment.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {assignment.po?.total_orders} pedidos
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${assignment.po?.total_amount?.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(assignment.assigned_at), "dd MMM yyyy", { locale: es })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Assignment Details */}
      <div className="lg:col-span-2">
        {!selectedPOId ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Selecciona una asignación</h3>
              <p>Elige una PO de la lista para ver sus detalles</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* PO Header Card */}
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedAssignment?.po?.po_number}</h2>
                    <p className="text-muted-foreground">
                      {selectedAssignment?.po?.total_orders} pedidos • 
                      {selectedAssignment?.po?.total_quantity} items • 
                      ${selectedAssignment?.po?.total_amount?.toFixed(2)} USD
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedAssignment?.status === 'assigned' && (
                      <Button 
                        onClick={() => startAssignment.mutate(selectedAssignment.id)}
                        disabled={startAssignment.isPending}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Iniciar Trabajo
                      </Button>
                    )}
                    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalles
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Detalles de {selectedAssignment?.po?.po_number}</DialogTitle>
                          <DialogDescription>
                            Información completa de la orden de compra
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">Total Pedidos</p>
                              <p className="text-2xl font-bold">{selectedAssignment?.po?.total_orders}</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">Total Items</p>
                              <p className="text-2xl font-bold">{selectedAssignment?.po?.total_quantity}</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">Monto Total</p>
                              <p className="text-2xl font-bold">${selectedAssignment?.po?.total_amount?.toFixed(2)}</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">Estado</p>
                              <div className="mt-1">{getStatusBadge(selectedAssignment?.status || '')}</div>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reconciliation Stats */}
            {reconciliation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Panel de Conciliación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold">{reconciliation.items_requested}</div>
                      <div className="text-xs text-muted-foreground">Solicitados</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold">{reconciliation.items_purchased}</div>
                      <div className="text-xs text-muted-foreground">Comprados</div>
                    </div>
                    <div className="text-center p-3 bg-green-100 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{reconciliation.items_qc_approved}</div>
                      <div className="text-xs text-muted-foreground">QC Aprobado</div>
                    </div>
                    <div className="text-center p-3 bg-red-100 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{reconciliation.items_qc_rejected}</div>
                      <div className="text-xs text-muted-foreground">QC Rechazado</div>
                    </div>
                  </div>

                  {/* Financial Comparison */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Costo Esperado</p>
                      <p className="font-semibold">${reconciliation.total_expected_product_cost_usd.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Costo Real</p>
                      <p className="font-semibold">${reconciliation.total_actual_product_cost_usd.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Envío Esperado</p>
                      <p className="font-semibold">${reconciliation.total_expected_shipping_cost_usd.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Varianza Total</p>
                      <p className={`font-bold ${reconciliation.total_variance_usd > 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {reconciliation.total_variance_usd > 0 ? '+' : ''}${reconciliation.total_variance_usd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
