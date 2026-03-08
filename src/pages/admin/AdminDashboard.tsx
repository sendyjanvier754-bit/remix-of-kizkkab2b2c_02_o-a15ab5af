import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CreditCard, 
  Users, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Percent,
  Package,
  AlertCircle,
  DollarSign,
  ShoppingCart,
  Globe
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePayments, useSellers } from "@/hooks/usePayments";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoverageAlerts } from "@/hooks/useCoverageAlerts";
import { useTranslation } from "react-i18next";

const getStatusBadge = (status: string, t: any) => {
  switch (status) {
    case "verified":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-teal/10 text-teal"><CheckCircle2 className="w-3 h-3" />{t('common.verified')}</span>;
    case "pending":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500"><Clock className="w-3 h-3" />{t('common.pending')}</span>;
    case "rejected":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive"><AlertTriangle className="w-3 h-3" />{t('common.rejected')}</span>;
    default:
      return null;
  }
};

const getMethodLabel = (method: string, t: any) => {
  switch (method) {
    case "stripe": return "Stripe";
    case "moncash": return "Mon Cash";
    case "transfer": return t('common.transfer');
    default: return method;
  }
};

const StatCard = ({ icon: Icon, label, value, color, bgColor, isLoading, trend }: any) => (
  <div className="group relative bg-gradient-to-br from-card to-card/80 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-4 border border-border/30 hover:border-primary/20 overflow-hidden">
    {/* Subtle gradient overlay on hover */}
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <div className={`${bgColor} p-2.5 rounded-xl shadow-sm`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-1">{label}</p>
      {isLoading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <p className="text-xl font-bold text-foreground tracking-tight">{value}</p>
      )}
    </div>
  </div>
);

// Hook to get admin dashboard stats
const useAdminDashboardStats = () => {
  return useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      // Fetch all stats in parallel
      const [
        ordersResult,
        commissionsResult,
        kycPendingResult,
        approvalsResult,
        totalRevenueResult
      ] = await Promise.all([
        // Total orders (B2B)
        supabase.from("orders_b2b").select("id, total_amount", { count: "exact" }),
        // Total commissions (unpaid)
        supabase.from("commission_debts").select("commission_amount, is_paid"),
        // KYC pending
        supabase.from("kyc_verifications").select("id", { count: "exact" }).eq("status", "pending_verification"),
        // Pending approvals
        supabase.from("admin_approval_requests").select("id", { count: "exact" }).eq("status", "pending"),
        // Total revenue from paid orders
        supabase.from("orders_b2b").select("total_amount").eq("payment_status", "paid")
      ]);

      // Calculate totals
      const totalOrders = ordersResult.count || 0;
      
      const totalRevenue = totalRevenueResult.data?.reduce(
        (sum, order) => sum + (Number(order.total_amount) || 0), 0
      ) || 0;
      
      const commissions = commissionsResult.data || [];
      const totalCommissions = commissions.reduce(
        (sum, c) => sum + (Number(c.commission_amount) || 0), 0
      );
      const unpaidCommissions = commissions
        .filter(c => !c.is_paid)
        .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
      
      const kycPending = kycPendingResult.count || 0;
      const pendingApprovals = approvalsResult.count || 0;

      return {
        totalOrders,
        totalRevenue,
        totalCommissions,
        unpaidCommissions,
        kycPending,
        pendingApprovals,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
};

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { payments, stats, isLoading: paymentsLoading } = usePayments();
  const { sellersCount, isLoading: sellersLoading } = useSellers();
  const { data: dashStats, isLoading: statsLoading } = useAdminDashboardStats();
  const { data: coverageAlerts } = useCoverageAlerts();

  const isLoading = paymentsLoading || sellersLoading;
  const recentPayments = payments.slice(0, 5);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const stickyStatsData = [
    {
      label: t('adminDashboard.totalOrders'),
      value: dashStats?.totalOrders?.toLocaleString() || "0",
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      isLoading: statsLoading
    },
    {
      label: t('adminDashboard.revenue'),
      value: formatCurrency(dashStats?.totalRevenue || 0),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
      isLoading: statsLoading
    },
    {
      label: t('adminDashboard.commissions'),
      value: formatCurrency(dashStats?.totalCommissions || 0),
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      isLoading: statsLoading
    },
    {
      label: t('adminDashboard.sellers'),
      value: sellersCount.toString(),
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      isLoading: sellersLoading
    },
    {
      label: t('adminDashboard.kycPending'),
      value: dashStats?.kycPending?.toString() || "0",
      icon: AlertCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      isLoading: statsLoading
    },
    {
      label: t('adminDashboard.approvals'),
      value: dashStats?.pendingApprovals?.toString() || "0",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      isLoading: statsLoading
    }
  ];

  const dashStatsData = [
    {
      title: t('adminDashboard.pendingPayments'),
      value: stats.pending.toString(),
      description: t('adminDashboard.requireVerification'),
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      link: "/admin/conciliacion?status=pending"
    },
    {
      title: t('adminDashboard.verifiedPayments'),
      value: stats.verified.toString(),
      description: t('adminDashboard.thisMonth'),
      icon: CheckCircle2,
      color: "text-teal",
      bgColor: "bg-teal/10",
      link: "/admin/conciliacion?status=verified"
    },
    {
      title: t('adminDashboard.activeSellers'),
      value: sellersCount.toString(),
      description: t('adminDashboard.registered'),
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      link: "/admin/vendedores"
    },
    {
      title: t('adminDashboard.b2bVolume'),
      value: formatCurrency(stats.totalVolume || 0),
      description: t('adminDashboard.totalVerified'),
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-accent/10",
      link: "/admin/conciliacion"
    },
    {
      title: t('adminDashboard.pendingCommissions'),
      value: formatCurrency(dashStats?.unpaidCommissions || 0),
      description: t('adminDashboard.toCollect'),
      icon: Percent,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
      link: "/admin/commissions"
    },
  ];

  if (isLoading) {
    return (
      <AdminLayout title={t('adminDashboard.title')} subtitle={t('adminDashboard.subtitle')}>
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 -mx-6 px-6 py-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title={t('adminDashboard.title')} 
      subtitle={t('adminDashboard.subtitle')}
    >
      {/* Sticky Stats Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-background via-background/98 to-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 border-b border-border/20 shadow-sm -mx-6 px-6 py-5 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stickyStatsData.map((stat) => (
            <StatCard
              key={stat.label}
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
              color={stat.color}
              bgColor={stat.bgColor}
              isLoading={stat.isLoading}
            />
          ))}
        </div>
      </div>

      {/* Dashboard Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-10">
        {dashStatsData.map((stat) => (
          <Link key={stat.title} to={stat.link}>
            <Card className="group relative overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-border/30 hover:border-primary/30 bg-gradient-to-br from-card to-card/90">
              {/* Decorative gradient */}
              <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bgColor} rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity -translate-y-8 translate-x-8`} />
              
              <CardContent className="relative z-10 p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground/80">{stat.description}</p>
                  </div>
                  <div className={`p-3.5 rounded-2xl ${stat.bgColor} shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Coverage Alerts */}
      {coverageAlerts && coverageAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {coverageAlerts.map((alert, idx) => (
            <Card key={idx} className={alert.severity === 'error' ? 'border-destructive/50 bg-destructive/5' : 'border-amber-500/50 bg-amber-500/5'}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${alert.severity === 'error' ? 'bg-destructive/10' : 'bg-amber-500/10'}`}>
                    {alert.severity === 'error' ? (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${alert.severity === 'error' ? 'text-destructive' : 'text-amber-600'}`}>
                      {alert.message}
                    </p>
                    {alert.items && alert.items.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.items.slice(0, 3).map(i => i.name).join(', ')}
                        {alert.items.length > 3 && ` +${alert.items.length - 3} más`}
                      </p>
                    )}
                  </div>
                  <Link to="/admin/markets">
                    <Button size="sm" variant="outline">
                      <Globe className="h-4 w-4 mr-1" /> {t('common.configure')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t('adminDashboard.recentPaymentsB2B')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('adminDashboard.lastTransactions')}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/conciliacion">{t('common.viewAll')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {recentPayments.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('adminDashboard.id')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('adminDashboard.seller')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('adminDashboard.amount')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('adminDashboard.paymentMethod')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('adminDashboard.paymentStatus')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('adminDashboard.paymentDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm font-mono text-foreground">{payment.payment_number}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{payment.seller?.name || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-foreground">${payment.amount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{getMethodLabel(payment.method)}</td>
                      <td className="py-3 px-4">{getStatusBadge(payment.status)}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString("es-HT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">Sin pagos recientes</p>
                <p className="text-sm text-muted-foreground">Los pagos B2B aparecerán aquí cuando se registren</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminDashboard;