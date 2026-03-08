import { useSellerQuotes } from '@/hooks/useQuotes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es, enUS, fr } from 'date-fns/locale';
import { MessageSquare, Eye, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const dateFnsLocales: Record<string, any> = { es, en: enUS, fr };

export function SellerQuotesHistory() {
  const { t, i18n } = useTranslation();
  const dateLocale = dateFnsLocales[i18n.language] || es;
  const { quotes, isLoading } = useSellerQuotes();
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    pending: { label: t('quotes.pending'), variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
    responded: { label: t('quotes.responded'), variant: 'default', icon: <MessageSquare className="h-3 w-3" /> },
    approved: { label: t('quotes.approved'), variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { label: t('quotes.rejected'), variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />{t('quotes.myQuotes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />{t('quotes.myQuotes')} ({quotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('quotes.noQuotes')}</p>
              <p className="text-xs mt-1">{t('quotes.noQuotesHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <div key={quote.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium">{quote.quote_number}</span>
                      <Badge variant={statusConfig[quote.status]?.variant || 'secondary'} className="gap-1 text-xs">
                        {statusConfig[quote.status]?.icon}
                        {statusConfig[quote.status]?.label || quote.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>${quote.total_amount.toFixed(2)}</span>
                      <span>•</span>
                      <span>{quote.total_quantity} items</span>
                      <span>•</span>
                      <span>{format(new Date(quote.created_at), 'dd MMM', { locale: dateLocale })}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedQuote(quote)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('quotes.quote')} {selectedQuote?.quote_number}</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={statusConfig[selectedQuote.status]?.variant || 'secondary'} className="gap-1">
                  {statusConfig[selectedQuote.status]?.icon}
                  {statusConfig[selectedQuote.status]?.label || selectedQuote.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(selectedQuote.created_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t('quotes.products')}</p>
                <div className="border rounded-lg divide-y">
                  {selectedQuote.cart_snapshot?.items?.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-medium">{item.nombre}</p>
                        <p className="text-xs text-muted-foreground">{item.cantidad || item.quantity} × ${item.precio_b2b?.toFixed(2) || item.unit_price?.toFixed(2)}</p>
                      </div>
                      <span className="font-medium">${item.subtotal?.toFixed(2) || item.total_price?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 p-2 bg-muted rounded-lg">
                  <span className="font-medium">{t('common.total')}</span>
                  <span className="font-bold">${selectedQuote.total_amount.toFixed(2)}</span>
                </div>
              </div>
              {selectedQuote.admin_notes && (
                <div>
                  <p className="text-sm font-medium mb-1">{t('quotes.adminResponse')}</p>
                  <p className="text-sm bg-muted p-2 rounded">{selectedQuote.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
