import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import useRefundManagement, { RefundStatus, RefundRequest } from '@/hooks/useRefundManagement';
import { useAdminReturnRequests, useUpdateReturnRequest, RETURN_STATUS_CONFIG } from '@/hooks/useOrderReturnRequests';
import { useAuth } from '@/hooks/useAuth';
import { 
  RefreshCw, 
  Search, 
  Loader2,
  Eye,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Ban,
  FileText,
  TrendingUp,
  Archive,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const refundStatusConfig: Record<RefundStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { 
    label: 'Pendiente', 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-500/20 border-yellow-500/30',
    icon: Clock 
  },
  under_review: { 
    label: 'En Revisión', 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-500/20 border-blue-500/30',
    icon: Eye 
  },
  approved: { 
    label: 'Aprobado', 
    color: 'text-green-700', 
    bgColor: 'bg-green-500/20 border-green-500/30',
    icon: CheckCircle 
  },
  processing: { 
    label: 'Procesando', 
    color: 'text-purple-700', 
    bgColor: 'bg-purple-500/20 border-purple-500/30',
    icon: RefreshCw 
  },
  completed: { 
    label: 'Completado', 
    color: 'text-emerald-700', 
    bgColor: 'bg-emerald-500/20 border-emerald-500/30',
    icon: DollarSign 
  },
  rejected: { 
    label: 'Rechazado', 
    color: 'text-red-700', 
    bgColor: 'bg-red-500/20 border-red-500/30',
    icon: XCircle 
  },
  cancelled: { 
    label: 'Cancelado', 
    color: 'text-gray-700', 
    bgColor: 'bg-gray-500/20 border-gray-500/30',
    icon: Ban 
  },
};

const AdminReembolsos = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const refundManagement = useRefundManagement();
  
  const [statusFilter, setStatusFilter] = useState<RefundStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [dialogType, setDialogType] = useState<'review' | 'approve' | 'reject' | 'process' | 'complete' | null>(null);
  const [activeTab, setActiveTab] = useState<'refunds' | 'returns'>('refunds');

  // Return requests state
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [returnActionItem, setReturnActionItem] = useState<any | null>(null);
  const [returnActionType, setReturnActionType] = useState<'accept' | 'reject' | null>(null);
  const [returnActionNotes, setReturnActionNotes] = useState('');
  const [returnAmountApproved, setReturnAmountApproved] = useState('');

  // Form states
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('');
  const [refundReference, setRefundReference] = useState('');

  // Fetch refunds with filters
  const statusFilters = statusFilter === 'all' ? undefined : statusFilter;
  const { data: refunds, isLoading } = refundManagement.useRefunds({ status: statusFilters });
  const { data: stats } = refundManagement.useRefundStats();

  // Fetch return requests
  const { data: returnRequests = [], isLoading: returnsLoading } = useAdminReturnRequests();
  const updateReturn = useUpdateReturnRequest();

  const filteredReturnRequests = returnRequests.filter(r => {
    if (!returnSearchTerm) return true;
    return r.order_id.toLowerCase().includes(returnSearchTerm.toLowerCase())
      || r.reason.toLowerCase().includes(returnSearchTerm.toLowerCase());
  });
  const pendingReturnCount = returnRequests.filter(r => r.status === 'pending' || r.status === 'under_mediation').length;

  // Filter by search term
  const filteredRefunds = refunds?.filter(refund => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      refund.order_number.toLowerCase().includes(search) ||
      refund.buyer_name.toLowerCase().includes(search) ||
      refund.buyer_email.toLowerCase().includes(search) ||
      refund.id.toLowerCase().includes(search)
    );
  });

  const openDialog = (refund: RefundRequest, type: typeof dialogType) => {
    setSelectedRefund(refund);
    setDialogType(type);
    setNotes(refund.notes || '');
    setApprovedAmount(refund.amount.toString());
    setRejectionReason('');
    setRefundMethod('transfer');
    setRefundReference('');
  };

  const closeDialog = () => {
    setSelectedRefund(null);
    setDialogType(null);
    setNotes('');
    setRejectionReason('');
    setApprovedAmount('');
    setRefundMethod('');
    setRefundReference('');
  };

  const handleAction = async () => {
    if (!selectedRefund || !user?.id) return;

    try {
      switch (dialogType) {
        case 'review':
          await refundManagement.moveToReview(selectedRefund.id, user.id, notes);
          break;
        case 'approve':
          await refundManagement.approve(
            selectedRefund.id,
            user.id,
            parseFloat(approvedAmount),
            notes
          );
          break;
        case 'reject':
          if (!rejectionReason.trim()) {
            toast({ title: 'Debe proporcionar una razón de rechazo', variant: 'destructive' });
            return;
          }
          await refundManagement.reject(selectedRefund.id, user.id, rejectionReason, notes);
          break;
        case 'process':
          if (!refundMethod) {
            toast({ title: 'Debe seleccionar un método de reembolso', variant: 'destructive' });
            return;
          }
          await refundManagement.startProcessing(
            selectedRefund.id,
            user.id,
            refundMethod,
            refundReference,
            notes
          );
          break;
        case 'complete':
          await refundManagement.complete(selectedRefund.id, user.id, notes);
          break;
      }
      closeDialog();
    } catch (error) {
      // Error handled by hook
    }
  };

  const getRefundStatusBadge = (status: RefundStatus) => {
    const config = refundStatusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={`${config.bgColor} ${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <AdminLayout title="Gestión de Reembolsos" subtitle="Sistema de estados: pending → under_review → approved → processing → completed">

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">En Revisión</CardTitle>
              <Eye className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats?.under_review || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Aprobados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats?.approved || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Procesando</CardTitle>
              <RefreshCw className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">{stats?.processing || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Completados</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{stats?.completed || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Rechazados</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats?.rejected || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Reembolsado</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-500">${(stats?.completed_amount || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, orden, cliente o email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RefundStatus | 'all')}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="under_review">En Revisión</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Refund Requests Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Orden</TableHead>
                    <TableHead className="text-muted-foreground">Cliente</TableHead>
                    <TableHead className="text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-muted-foreground">Monto</TableHead>
                    <TableHead className="text-muted-foreground">Razón</TableHead>
                    <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                    <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filteredRefunds?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Archive className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No hay solicitudes de reembolso</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRefunds?.map((refund) => (
                      <TableRow key={refund.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-mono text-sm text-foreground">
                          {refund.order_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{refund.buyer_name}</p>
                            <p className="text-xs text-muted-foreground">{refund.buyer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(refund.created_at), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-foreground">${refund.amount.toFixed(2)}</p>
                            {refund.approved_amount && refund.approved_amount !== refund.amount && (
                              <p className="text-xs text-green-600">Aprobado: ${refund.approved_amount.toFixed(2)}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px]">
                          <p className="truncate">{refund.reason}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          {getRefundStatusBadge(refund.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {refund.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(refund, 'review')}
                                title="Mover a revisión"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {refund.status === 'under_review' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDialog(refund, 'approve')}
                                  title="Aprobar"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDialog(refund, 'reject')}
                                  title="Rechazar"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {refund.status === 'approved' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(refund, 'process')}
                                title="Iniciar procesamiento"
                                className="text-purple-600 hover:text-purple-700"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            {refund.status === 'processing' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(refund, 'complete')}
                                title="Completar"
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!selectedRefund && !!dialogType} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogType === 'review' && <><Eye className="h-5 w-5" />Mover a Revisión</>}
              {dialogType === 'approve' && <><CheckCircle className="h-5 w-5 text-green-600" />Aprobar Reembolso</>}
              {dialogType === 'reject' && <><XCircle className="h-5 w-5 text-red-600" />Rechazar Reembolso</>}
              {dialogType === 'process' && <><RefreshCw className="h-5 w-5 text-purple-600" />Procesar Reembolso</>}
              {dialogType === 'complete' && <><DollarSign className="h-5 w-5 text-emerald-600" />Completar Reembolso</>}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'review' && 'Iniciar revisión del reembolso solicitado'}
              {dialogType === 'approve' && 'Aprobar y preparar el reembolso para procesamiento'}
              {dialogType === 'reject' && 'Rechazar la solicitud de reembolso'}
              {dialogType === 'process' && 'Iniciar transacción de reembolso'}
              {dialogType === 'complete' && 'Marcar reembolso como completado'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRefund && (
            <div className="space-y-4">
              {/* Refund Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Orden</p>
                  <p className="font-mono text-sm font-medium">{selectedRefund.order_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado Actual</p>
                  {getRefundStatusBadge(selectedRefund.status)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{selectedRefund.buyer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto Original</p>
                  <p className="text-sm font-bold">${selectedRefund.amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Reason */}
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm font-medium text-yellow-700">Razón del reembolso</p>
                </div>
                <p className="text-sm text-muted-foreground">{selectedRefund.reason}</p>
              </div>

              {/* Status History */}
              {selectedRefund.status_history && selectedRefund.status_history.length > 0 && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-sm font-medium text-blue-700 mb-2">Historial de Estados</p>
                  <div className="space-y-2">
                    {selectedRefund.status_history.slice(0, 3).map((h, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-muted-foreground">{format(new Date(h.changed_at), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                        {' → '}
                        <span className="font-medium">{refundStatusConfig[h.new_status].label}</span>
                        {h.notes && <span className="text-muted-foreground italic"> - {h.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Amount (for approve dialog) */}
              {dialogType === 'approve' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Monto Aprobado</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-10"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      placeholder={selectedRefund.amount.toString()}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Puede modificar el monto si es necesario
                  </p>
                </div>
              )}

              {/* Rejection Reason (for reject dialog) */}
              {dialogType === 'reject' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-red-600">Razón de Rechazo *</label>
                  <Textarea
                    placeholder="Explique por qué se rechaza este reembolso..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="border-red-500/50"
                  />
                </div>
              )}

              {/* Refund Method (for process dialog) */}
              {dialogType === 'process' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Método de Reembolso *</label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Referencia de Transacción</label>
                    <Input
                      placeholder="ID de transacción, número de referencia..."
                      value={refundReference}
                      onChange={(e) => setRefundReference(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas</label>
                <Textarea
                  placeholder="Notas adicionales (opcional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAction} 
              disabled={refundManagement.isChangingStatus}
              className={
                dialogType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                dialogType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                dialogType === 'process' ? 'bg-purple-600 hover:bg-purple-700' :
                dialogType === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' :
                ''
              }
            >
              {refundManagement.isChangingStatus ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Procesando...</>
              ) : (
                <>
                  {dialogType === 'review' && 'Mover a Revisión'}
                  {dialogType === 'approve' && 'Aprobar Reembolso'}
                  {dialogType === 'reject' && 'Rechazar'}
                  {dialogType === 'process' && 'Iniciar Procesamiento'}
                  {dialogType === 'complete' && 'Completar Reembolso'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Solicitudes de Devolución ── */}
      <Card className="bg-card border-border mt-6">
        <CardContent className="p-0">
          <div className="px-4 pt-4 pb-2 border-b border-border flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Solicitudes de Devolución</h2>
            {pendingReturnCount > 0 && <Badge className="bg-destructive text-destructive-foreground text-xs">{pendingReturnCount}</Badge>}
          </div>
          <div className="px-4 py-3 border-b border-border">
            <Input placeholder="Buscar por ID de pedido…" value={returnSearchTerm} onChange={e => setReturnSearchTerm(e.target.value)} className="max-w-xs h-8 text-sm" />
          </div>
          {returnsLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredReturnRequests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No hay solicitudes de devolución</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Pedido</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead>
                    <TableHead>Monto</TableHead><TableHead className="text-center">Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturnRequests.map((ret) => {
                    const cfg = RETURN_STATUS_CONFIG[ret.status as keyof typeof RETURN_STATUS_CONFIG];
                    return (
                      <TableRow key={ret.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">{ret.order_id.slice(0,8).toUpperCase()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{ret.order_type.toUpperCase()}</Badge></TableCell>
                        <TableCell><p className="text-xs font-medium">{ret.reason_type || '—'}</p><p className="text-xs text-muted-foreground line-clamp-1">{ret.reason}</p></TableCell>
                        <TableCell className="text-xs">{ret.amount_requested ? `$${ret.amount_requested}` : '—'}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className={`${cfg?.color} border-current text-xs`}>{cfg?.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          {(ret.status === 'pending' || ret.status === 'under_mediation') && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => { setReturnActionItem(ret); setReturnActionType('accept'); setReturnAmountApproved(ret.amount_requested?.toString() || ''); setReturnActionNotes(''); }}>Aceptar</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => { setReturnActionItem(ret); setReturnActionType('reject'); setReturnActionNotes(''); }}>Rechazar</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!returnActionItem} onOpenChange={() => setReturnActionItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{returnActionType === 'accept' ? 'Aceptar Devolución' : 'Rechazar Devolución'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {returnActionType === 'accept' && (
              <div><label className="text-xs text-muted-foreground">Monto aprobado</label>
                <Input type="number" value={returnAmountApproved} onChange={e => setReturnAmountApproved(e.target.value)} className="mt-1 h-9" /></div>
            )}
            <div><label className="text-xs text-muted-foreground">{returnActionType === 'reject' ? 'Razón del rechazo *' : 'Notas admin'}</label>
              <Textarea value={returnActionNotes} onChange={e => setReturnActionNotes(e.target.value)} className="mt-1 min-h-[70px]" /></div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setReturnActionItem(null)}>Cancelar</Button>
            <Button size="sm" disabled={updateReturn.isPending} onClick={async () => {
              if (!returnActionItem) return;
              await updateReturn.mutateAsync({ id: returnActionItem.id, status: returnActionType === 'accept' ? 'accepted' : 'rejected', admin_notes: returnActionNotes, amount_approved: returnActionType === 'accept' && returnAmountApproved ? parseFloat(returnAmountApproved) : undefined, resolved_at: new Date().toISOString() });
              setReturnActionItem(null);
            }}>
              {updateReturn.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
};

export default AdminReembolsos;
