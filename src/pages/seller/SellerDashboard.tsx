import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBuyerOrders } from '@/hooks/useBuyerOrders';
import { useSellerCredits } from '@/hooks/useSellerCredits';
import { useKYC } from '@/hooks/useKYC';
import { SellerLayout } from '@/components/seller/SellerLayout';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertCircle,
  ArrowRight,
  CreditCard,
  CheckCircle2,
  Clock,
  User,
  Zap,
  Loader2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SellerDashboard = () => {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const { data: orders, isLoading: ordersLoading } = useBuyerOrders();
  const { credit, availableCredit } = useSellerCredits();
  const { isVerified } = useKYC();
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    if (orders && orders.length > 0) {
      // Get last 5 orders
      setRecentOrders(orders.slice(0, 5));
    }
  }, [orders]);

  if (authLoading || ordersLoading) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-[#071d7f]" />
        </div>
      </SellerLayout>
    );
  }

  const totalOrders = orders?.length || 0;
  const totalSpent = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
  const pendingOrders = orders?.filter(o => o.status === 'placed' || o.status === 'draft')?.length || 0;

  return (
    <SellerLayout>
      <div className="min-h-screen bg-gradient-to-b from-background via-blue-50/30 to-background">

        <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 mt-3">
          {/* Welcome Section */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-foreground">
              {t('sellerDashboard.welcome', { name: user?.name?.split(' ')[0] })}
            </h1>
          </div>

          {/* KYC Alert */}
          {!isVerified && (
            <Card className="p-4 mb-8 border-orange-200 bg-orange-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 mb-1">{t('sellerDashboard.kycPendingTitle')}</h3>
                  <p className="text-sm text-orange-700 mb-3">
                    {t('sellerDashboard.kycPendingMessage')}
                  </p>
                  <Button asChild size="sm" className="bg-orange-600 hover:bg-orange-700">
                    <Link to="/seller/cuenta">
                      {t('sellerDashboard.completeVerification')}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Stats Cards - Mis Ventas (Mismo diseño que SellerPedidosPage) */}
          <div className="bg-card border border-border rounded-lg md:mt-14">
            <div className="p-3">
              <div className="border-b pb-2 mb-3">
                <h1 className="text-lg font-bold text-foreground">{t('sellerDashboard.myActivity')}</h1>
              </div>
              <div className="grid grid-cols-4 gap-1 w-full">
                {/* Total Compras - Azul */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-1.5 text-center">
                    <ShoppingCart className="h-3 w-3 text-blue-600 mx-auto mb-0.5" />
                    <div className="text-base md:text-lg font-bold text-blue-600">{totalOrders}</div>
                    <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">{t('sellerDashboard.purchases')}</p>
                  </CardContent>
                </Card>

                {/* Inversión Total - Verde */}
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-1.5 text-center">
                    <DollarSign className="h-3 w-3 text-green-600 mx-auto mb-0.5" />
                    <div className="text-base md:text-lg font-bold text-green-600">${totalSpent.toFixed(0)}</div>
                    <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">{t('sellerDashboard.investment')}</p>
                  </CardContent>
                </Card>

                {/* Pendientes - Amarillo/Naranja */}
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-1.5 text-center">
                    <Clock className="h-3 w-3 text-amber-600 mx-auto mb-0.5" />
                    <div className="text-base md:text-lg font-bold text-amber-600">{pendingOrders}</div>
                    <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">{t('sellerDashboard.pendingOrders')}</p>
                  </CardContent>
                </Card>

                {/* Crédito - Púrpura */}
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-1.5 text-center">
                    <CreditCard className="h-3 w-3 text-purple-600 mx-auto mb-0.5" />
                    <div className="text-base md:text-lg font-bold text-purple-600">${availableCredit.toFixed(0)}</div>
                    <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">{t('sellerDashboard.credit')}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 mb-8">
            {/* Recent Orders */}
            <div className="lg:col-span-2">
              <Card>
                <div className="p-3 md:p-6">
                  <div className="flex items-center justify-between mb-3 md:mb-6">
                    <h2 className="text-base md:text-xl font-bold flex items-center gap-2">
                      <Package className="h-4 w-4 md:h-5 md:w-5 text-[#071d7f]" />
                      {t('sellerDashboard.recentOrders')}
                    </h2>
                    <Button asChild variant="outline" size="sm" className="text-xs h-7 md:h-9">
                      <Link to="/seller/mis-compras">
                        {t('sellerDashboard.viewAll')}
                        <ArrowRight className="h-3 w-3 md:h-4 md:w-4 ml-1 md:ml-2" />
                      </Link>
                    </Button>
                  </div>

                  {recentOrders.length === 0 ? (
                    <div className="text-center py-6 md:py-8">
                      <Package className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">{t('sellerDashboard.noOrdersYet')}</p>
                      <Button asChild className="mt-4 bg-[#071d7f] hover:bg-[#0a2a9f]" size="sm">
                        <Link to="/seller/adquisicion-lotes">
                          {t('sellerDashboard.startBuying')}
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-4">
                      {recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="p-2.5 md:p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="min-w-0">
                                <p className="font-semibold text-xs md:text-sm truncate">
                                  {t('sellerDashboard.orderNumber', { id: order.id.slice(0, 8).toUpperCase() })}
                                </p>
                                <p className="text-[10px] md:text-xs text-muted-foreground">
                                  {new Date(order.created_at).toLocaleDateString('es-ES')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="font-semibold text-xs md:text-sm text-foreground">
                                ${order.total_amount.toFixed(2)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] md:text-xs px-1.5 py-0 md:px-2 md:py-0.5 ${
                                  order.status === 'paid'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : order.status === 'placed'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                }`}
                              >
                                {order.status === 'paid'
                                  ? t('orders.statuses.paid')
                                  : order.status === 'placed'
                                    ? t('orders.statuses.placed')
                                    : t('orders.statuses.pending')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <div>
              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#071d7f]" />
                    {t('sellerDashboard.quickActions')}
                  </h2>

                  <div className="space-y-2">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-xs border-[#071d7f] text-[#071d7f] hover:bg-blue-50"
                    >
                      <Link to="/seller/adquisicion-lotes">
                        <ShoppingCart className="h-3 w-3 mr-2" />
                        {t('sellerDashboard.buyLots')}
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-xs border-[#071d7f] text-[#071d7f] hover:bg-blue-50"
                    >
                      <Link to="/seller/catalogo">
                        <Package className="h-3 w-3 mr-2" />
                        {t('sellerDashboard.myCatalog')}
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-xs border-[#071d7f] text-[#071d7f] hover:bg-blue-50"
                    >
                      <Link to="/seller/inventario">
                        <Package className="h-3 w-3 mr-2" />
                        {t('sellerDashboard.inventoryAction')}
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-xs border-[#071d7f] text-[#071d7f] hover:bg-blue-50"
                    >
                      <Link to="/seller/wallet">
                        <CreditCard className="h-3 w-3 mr-2" />
                        {t('sellerDashboard.wallet')}
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-xs border-[#071d7f] text-[#071d7f] hover:bg-blue-50"
                    >
                      <Link to="/seller/cuenta">
                        <User className="h-3 w-3 mr-2" />
                        {t('sellerDashboard.verification')}
                      </Link>
                    </Button>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <h3 className="font-semibold text-xs text-foreground">{t('sellerDashboard.statusSection')}</h3>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        {isVerified ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-yellow-600" />
                        )}
                        <span>
                          {isVerified ? t('sellerDashboard.kycVerified') : t('sellerDashboard.kycPending')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {credit ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-yellow-600" />
                        )}
                        <span>
                          {credit ? t('sellerDashboard.creditActive') : t('sellerDashboard.noCredit')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </SellerLayout>
  );
};

export default SellerDashboard;
