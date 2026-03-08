import { PackageTracking, TrackingStatus } from '@/hooks/usePackageTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package, Truck, MapPin, CheckCircle2, AlertCircle, ExternalLink, MapPinCheck, Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS, fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface TrackingWidgetProps {
  tracking: PackageTracking | null;
  isLoading: boolean;
  getCarrierTrackingUrl: (carrier: string, trackingNumber: string) => string;
}

const statusIcons: Record<TrackingStatus, React.ElementType> = {
  pending: Clock,
  in_transit: Truck,
  out_for_delivery: MapPin,
  delivered: CheckCircle2,
  exception: AlertCircle,
};

const statusColors: Record<TrackingStatus, { color: string; bgColor: string }> = {
  pending: { color: 'text-gray-600', bgColor: 'bg-gray-50' },
  in_transit: { color: 'text-blue-600', bgColor: 'bg-blue-50' },
  out_for_delivery: { color: 'text-purple-600', bgColor: 'bg-purple-50' },
  delivered: { color: 'text-green-600', bgColor: 'bg-green-50' },
  exception: { color: 'text-red-600', bgColor: 'bg-red-50' },
};

const statusKeys: Record<TrackingStatus, string> = {
  pending: 'tracking.pending',
  in_transit: 'tracking.inTransit',
  out_for_delivery: 'tracking.outForDelivery',
  delivered: 'tracking.delivered',
  exception: 'tracking.exception',
};

const dateFnsLocales: Record<string, any> = { es, en: enUS, fr };

export const TrackingWidget = ({ tracking, isLoading, getCarrierTrackingUrl }: TrackingWidgetProps) => {
  const { t, i18n } = useTranslation();
  const dateLocale = dateFnsLocales[i18n.language] || es;

  if (!tracking && !isLoading) return null;

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-center h-20">
            <div className="animate-pulse text-muted-foreground">{t('tracking.loadingTracking')}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tracking) return null;

  const config = statusColors[tracking.current_status];
  const StatusIcon = statusIcons[tracking.current_status];
  const carrierUrl = getCarrierTrackingUrl(tracking.carrier, tracking.tracking_number);
  const sortedEvents = tracking.events ? [...tracking.events].reverse() : [];

  return (
    <div className="space-y-4">
      <Card className={`border-l-4 ${
        tracking.current_status === 'delivered' ? 'border-l-green-500 bg-green-50/30' :
        tracking.current_status === 'out_for_delivery' ? 'border-l-purple-500 bg-purple-50/30' :
        tracking.current_status === 'in_transit' ? 'border-l-blue-500 bg-blue-50/30' :
        tracking.current_status === 'exception' ? 'border-l-red-500 bg-red-50/30' :
        'border-l-gray-300'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${config.color}`} />
                <CardTitle className="text-lg">{t(statusKeys[tracking.current_status])}</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">{tracking.carrier} • {tracking.tracking_number}</p>
            </div>
            {carrierUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={carrierUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  {t('tracking.viewOnCarrier', { carrier: tracking.carrier })}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPinCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t('tracking.currentLocation')}</p>
              <p className="font-medium">{tracking.current_location}</p>
            </div>
          </div>
          {tracking.estimated_delivery && (
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">{t('tracking.estimatedDelivery')}</p>
                <p className="font-medium">
                  {format(new Date(tracking.estimated_delivery), 'dd MMMM, yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {sortedEvents.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">{t('tracking.trackingHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedEvents.map((event, index) => {
                const eventConfig = statusColors[event.status];
                const EventIcon = statusIcons[event.status];
                const isLatest = index === 0;
                return (
                  <div key={event.id} className={`flex gap-4 pb-3 ${index !== sortedEvents.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded-full ${isLatest ? eventConfig.bgColor : 'bg-muted'}`}>
                        <EventIcon className={`h-4 w-4 ${isLatest ? eventConfig.color : 'text-muted-foreground'}`} />
                      </div>
                      {index !== sortedEvents.length - 1 && <div className="w-0.5 h-8 bg-border my-1" />}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{event.description}</p>
                        {isLatest && <Badge variant="outline" className="text-xs">{t('tracking.latestNews')}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{event.location}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), 'dd MMM, HH:mm', { locale: dateLocale })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
