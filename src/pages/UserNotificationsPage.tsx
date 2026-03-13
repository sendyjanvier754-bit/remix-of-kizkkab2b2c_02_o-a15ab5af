import { useNotifications, DBNotification } from '@/hooks/useNotifications';
import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  CheckCheck,
  Package,
  Wallet,
  Shield,
  MessageCircle,
  AlertTriangle,
  ChevronLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import GlobalHeader from '@/components/layout/GlobalHeader';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

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

export default function UserNotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('post_login_redirect', '/notificaciones');
      navigate('/cuenta', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return null;

  return (
    <PageWrapper seo={{ title: 'Notificaciones', description: 'Tus notificaciones' }}>
      <div className="min-h-screen bg-muted/30">
        <GlobalHeader />
        <div className="max-w-[860px] mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="gap-1.5 text-muted-foreground mr-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Volver
              </Button>
              <div className="p-2 rounded-xl bg-primary/10">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight">Notificaciones</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-muted-foreground">{unreadCount} sin leer</p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllAsRead} className="gap-1.5 text-xs">
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todo como leído
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center text-muted-foreground text-sm py-16">Cargando...</div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">No tienes notificaciones todavía</p>
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
      </div>
    </PageWrapper>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: DBNotification;
  onRead: (id: string) => void;
}) {
  const icon = typeIcons[notification.type] || typeIcons.general;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <button
      onClick={() => !notification.is_read && onRead(notification.id)}
      className={`w-full text-left px-5 py-4 transition-colors hover:bg-muted/40 ${
        !notification.is_read ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            !notification.is_read
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={`text-sm truncate ${
                !notification.is_read ? 'font-semibold text-foreground' : 'text-foreground'
              }`}
            >
              {notification.title}
            </p>
            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          {notification.message && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {notification.message}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}
