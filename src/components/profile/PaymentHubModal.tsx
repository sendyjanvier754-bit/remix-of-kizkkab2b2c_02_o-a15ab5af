import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Clock,
  AlertCircle,
  Wallet,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { InlinePaymentPanel } from "@/components/profile/InlinePaymentPanel";
import { useBuyerB2COrders } from "@/hooks/useBuyerB2COrders";
import { useBuyerOrders } from "@/hooks/useBuyerOrders";

interface PaymentHubModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface NormalizedOrder {
  id: string;
  type: "B2C" | "B2B";
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  total: number;
  currency: string | null;
  created_at: string;
}

const PENDING_PAYMENT_STATUSES = new Set([
  "pending",
  "pending_payment",
  "pending_validation",
  "awaiting_payment",
]);

const PAID_STATUSES = new Set(["paid", "completed", "succeeded"]);

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: string | null, t: (k: string, o?: Record<string, unknown>) => string) {
  const s = (status ?? "").toLowerCase();
  if (PAID_STATUSES.has(s)) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <CheckCircle2 className="w-3 h-3" /> {t("profilePanels.paymentHub.status.paid")}
      </Badge>
    );
  }
  if (s === "pending_validation") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
        {t("profilePanels.paymentHub.status.pendingValidation")}
      </Badge>
    );
  }
  if (PENDING_PAYMENT_STATUSES.has(s)) {
    return (
      <Badge className="bg-orange-100 text-orange-700 border-orange-200">
        {t("profilePanels.paymentHub.status.pending")}
      </Badge>
    );
  }
  if (s === "failed" || s === "expired" || s === "cancelled") {
    return (
      <Badge variant="destructive" className="capitalize">{s}</Badge>
    );
  }
  return <Badge variant="outline" className="capitalize">{s || "—"}</Badge>;
}

function OrderRow({
  order,
  onClick,
  t,
}: {
  order: NormalizedOrder;
  onClick: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Wallet className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {order.type}
          </Badge>
          {statusBadge(order.payment_status ?? order.status, t)}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDate(order.created_at)}
          {order.payment_method && <> · {order.payment_method}</>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-foreground">
          ${order.total.toFixed(2)}
        </p>
        <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
      </div>
    </button>
  );
}

export function PaymentHubModal({ open, onOpenChange }: PaymentHubModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: b2cOrders = [] } = useBuyerB2COrders();
  const { data: b2bOrders = [] } = useBuyerOrders();

  const allOrders = useMemo<NormalizedOrder[]>(() => {
    const b2c: NormalizedOrder[] = b2cOrders.map((o: any) => ({
      id: o.id,
      type: "B2C",
      status: o.status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      total: Number(o.total_amount ?? 0),
      currency: o.currency,
      created_at: o.created_at,
    }));
    const b2b: NormalizedOrder[] = (b2bOrders ?? []).map((o: any) => ({
      id: o.id,
      type: "B2B",
      status: o.status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      total: Number(o.total_amount ?? o.total ?? 0),
      currency: o.currency,
      created_at: o.created_at,
    }));
    return [...b2c, ...b2b].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [b2cOrders, b2bOrders]);

  const pending = allOrders.filter(o =>
    PENDING_PAYMENT_STATUSES.has((o.payment_status ?? "").toLowerCase())
  );
  const history = allOrders.filter(o => !pending.includes(o));

  const handleOpenOrder = (o: NormalizedOrder) => {
    onOpenChange(false);
    navigate("/mis-compras");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-5 h-5 text-primary" />
            {t("profilePanels.paymentHub.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("profilePanels.paymentHub.description")}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="methods" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-3 w-auto">
            <TabsTrigger value="methods" className="gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("profilePanels.paymentHub.tabs.methods")}</span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("profilePanels.paymentHub.tabs.pending")}</span>
              {pending.length > 0 && (
                <Badge className="ml-1 h-4 px-1.5 text-[10px] bg-destructive text-destructive-foreground">
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("profilePanels.paymentHub.tabs.history")}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="methods" className="mt-0">
              <InlinePaymentPanel />
            </TabsContent>

            <TabsContent value="pending" className="mt-0 space-y-2">
              {pending.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500/60" />
                  {t("profilePanels.paymentHub.noPending")}
                </div>
              ) : (
                pending.map(o => (
                  <OrderRow key={`${o.type}-${o.id}`} order={o} onClick={() => handleOpenOrder(o)} t={t} />
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0 space-y-2">
              {history.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                  {t("profilePanels.paymentHub.noHistory")}
                </div>
              ) : (
                history.map(o => (
                  <OrderRow key={`${o.type}-${o.id}`} order={o} onClick={() => handleOpenOrder(o)} t={t} />
                ))
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-3 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("profilePanels.paymentHub.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentHubModal;
