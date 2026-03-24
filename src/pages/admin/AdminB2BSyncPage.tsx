import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw, Store, Clock, CheckCircle, XCircle, AlertTriangle, History, Loader2
} from "lucide-react";
import {
  useStoresWithSync,
  useToggleAutoSync,
  useManualSync,
  useSyncLogs,
  type SyncLog,
} from "@/hooks/useB2BSync";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function AdminB2BSyncPage() {
  const { data: stores, isLoading } = useStoresWithSync();
  const toggleSync = useToggleAutoSync();
  const manualSync = useManualSync();
  const { data: allLogs } = useSyncLogs();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const { data: storeLogs } = useSyncLogs(selectedStoreId ?? undefined);

  const enabledCount = stores?.filter((s) => s.auto_sync_b2b).length ?? 0;

  if (isLoading) {
    return (
      <AdminLayout title="Sincronización B2B → B2C" subtitle="Gestiona la sincronización automática del catálogo">
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Sincronización B2B → B2C"
      subtitle="Activa la sincronización automática del catálogo B2B para tiendas B2C"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Store className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stores?.length ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Tiendas activas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{enabledCount}</p>
                  <p className="text-sm text-muted-foreground">Con auto-sync activo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <History className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{allLogs?.length ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Registros de sync</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Store Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tiendas B2C</CardTitle>
            <CardDescription>
              Activa el switch para sincronizar automáticamente todos los productos B2B a una tienda.
              Los precios se toman de v_business_panel_data y el stock del catálogo B2B.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Auto-Sync B2B</TableHead>
                  <TableHead>Última sincronización</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores?.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{store.name}</p>
                        {store.slug && (
                          <p className="text-xs text-muted-foreground">/{store.slug}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={store.auto_sync_b2b}
                        disabled={toggleSync.isPending}
                        onCheckedChange={(checked) =>
                          toggleSync.mutate({ storeId: store.id, enabled: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {store.last_b2b_sync_at ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(store.last_b2b_sync_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!store.auto_sync_b2b || manualSync.isPending}
                          onClick={() => manualSync.mutate(store.id)}
                        >
                          {manualSync.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1">Sincronizar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedStoreId(store.id)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!stores?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No hay tiendas B2C activas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sync Logs Dialog */}
        <Dialog open={!!selectedStoreId} onOpenChange={() => setSelectedStoreId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Historial de sincronización — {stores?.find((s) => s.id === selectedStoreId)?.name}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3">
                {storeLogs?.map((log) => (
                  <SyncLogEntry key={log.id} log={log} />
                ))}
                {!storeLogs?.length && (
                  <p className="text-center text-muted-foreground py-8">
                    Sin registros de sincronización
                  </p>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function SyncLogEntry({ log }: { log: SyncLog }) {
  const getIcon = () => {
    switch (log.action) {
      case "sync_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "sync_error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "sync_started":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      {getIcon()}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={log.action === "sync_completed" ? "default" : "secondary"}>
            {log.action}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: es })}
          </span>
        </div>
        {log.action === "sync_completed" && (
          <p className="text-sm mt-1">
            +{log.products_added} agregados · ↻{log.products_updated} actualizados · −{log.products_removed} removidos
          </p>
        )}
      </div>
    </div>
  );
}
