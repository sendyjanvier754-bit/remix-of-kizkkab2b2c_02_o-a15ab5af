import { useNotifications, DBNotification } from '@/hooks/useNotifications';
import { RoleAwareLayout } from '@/components/layout/RoleAwareLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCheck, Package, Wallet, Shield, MessageCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const typeIcons: Record<string, React.ReactNode> = {
  order_delivery: <Package className="h-4 w-4" />,
  wallet_update: <Wallet className="h-4 w-4" />,
  commission_change: <Wallet className="h-4 w-4" />,
  withdrawal_status: <Wallet className="h-4 w-4" />,
  agent_otp: <Shield className="h-4 w-4" />,
  chat: <MessageCircle className="h-4 w-4" />,
  general: <Bell className="h-4 w-4" />,
  system: <AlertTriangle className="h-4 w-4" />,
};

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  return (
    <AdminLayout title="Notificaciones" subtitle={`${unreadCount} sin leer`}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="flex-row items-center justify-between py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Todas las notificaciones
            </CardTitle>
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllAsRead} className="gap-1 text-xs">
                <CheckCheck className="h-3 w-3" />
                Marcar todo como leído
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center text-muted-foreground text-sm py-12">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notif) => (
                  <NotificationItem key={notif.id} notification={notif} onRead={markAsRead} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function NotificationItem({ notification, onRead }: { notification: DBNotification; onRead: (id: string) => void }) {
  const icon = typeIcons[notification.type] || typeIcons.general;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es });

  return (
    <button
      onClick={() => !notification.is_read && onRead(notification.id)}
      className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/40 ${
        !notification.is_read ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          !notification.is_read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm truncate ${!notification.is_read ? 'font-semibold text-foreground' : 'text-foreground'}`}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          {notification.message && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}
