import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, Users, Gift, Copy, TrendingUp, Clock, CheckCircle, XCircle,
  AlertTriangle, DollarSign, Loader2, ChevronDown
} from "lucide-react";
import { useKYC } from "@/hooks/useKYC";
import { useSellerCredits, useCreditMovements, MovementFilters } from "@/hooks/useSellerCredits";
import { useReferrals } from "@/hooks/useReferrals";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const CreditReferralDashboard = () => {
  const { t } = useTranslation();
  const { isVerified, isUnverified, isPending } = useKYC();
  const { credit, availableCredit, hasActiveCredit } = useSellerCredits();
  const { referralLink, myReferrals, settings, totalReferrals, completedReferrals, totalEarned } = useReferrals();

  const [movementType, setMovementType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filters: MovementFilters = {
    type: movementType !== 'all' ? movementType : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  };

  const { movements, isLoading: movementsLoading, isFetchingMore, hasMore, loadMore } = useCreditMovements(filters);

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast.success(t('creditReferral.linkCopied'));
    }
  };

  const clearFilters = () => { setMovementType('all'); setStartDate(''); setEndDate(''); };
  const hasActiveFilters = movementType !== 'all' || startDate || endDate;

  if (!isVerified) {
    return (
      <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/30">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-700 dark:text-orange-300">
          {isPending ? t('creditReferral.verificationPending') : t('creditReferral.mustVerify')}
        </AlertDescription>
      </Alert>
    );
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'purchase': return { label: t('creditReferral.b2bPurchase'), icon: CreditCard, color: 'text-orange-600 bg-orange-50' };
      case 'payment': return { label: t('creditReferral.paymentReceived'), icon: CheckCircle, color: 'text-green-600 bg-green-50' };
      case 'referral_bonus': return { label: t('creditReferral.referralBonus'), icon: Gift, color: 'text-blue-600 bg-blue-50' };
      case 'adjustment': return { label: t('creditReferral.adminAdjustment'), icon: TrendingUp, color: 'text-purple-600 bg-purple-50' };
      default: return { label: type, icon: DollarSign, color: 'text-gray-600 bg-gray-50' };
    }
  };

  return (
    <Tabs defaultValue="credit" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="credit" className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />{t('creditReferral.myCredit')}
        </TabsTrigger>
        <TabsTrigger value="referrals" className="flex items-center gap-2">
          <Users className="h-4 w-4" />{t('creditReferral.referrals')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="credit" className="space-y-4">
        {!hasActiveCredit ? (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>{t('creditReferral.creditNotActive')}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardHeader className="pb-2"><CardDescription>{t('creditReferral.creditLimit')}</CardDescription><CardTitle className="text-2xl">${credit?.credit_limit?.toFixed(2) ?? '0.00'}</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription>{t('creditReferral.currentDebt')}</CardDescription><CardTitle className="text-2xl text-red-600">${credit?.balance_debt?.toFixed(2) ?? '0.00'}</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription>{t('creditReferral.availableCredit')}</CardDescription><CardTitle className="text-2xl text-green-600">${availableCredit.toFixed(2)}</CardTitle></CardHeader></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('creditReferral.creditUsage')}</CardTitle>
                <CardDescription>{t('creditReferral.creditUsageDesc', { percent: credit?.max_cart_percentage ?? 0 })}</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={credit?.credit_limit ? ((credit.balance_debt / credit.credit_limit) * 100) : 0} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">
                  {credit?.credit_limit ? ((credit.balance_debt / credit.credit_limit) * 100).toFixed(1) : 0}% {t('creditReferral.used')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />{t('creditReferral.movementHistory')}
                    </CardTitle>
                    <CardDescription>{t('creditReferral.movementHistoryDesc')}</CardDescription>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>{t('creditReferral.clearFilters')}</Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t mt-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('creditReferral.type')}</Label>
                    <Select value={movementType} onValueChange={setMovementType}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t('creditReferral.allTypes')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('creditReferral.allTypes')}</SelectItem>
                        <SelectItem value="purchase">{t('creditReferral.purchases')}</SelectItem>
                        <SelectItem value="payment">{t('creditReferral.payments')}</SelectItem>
                        <SelectItem value="referral_bonus">{t('creditReferral.referralBonuses')}</SelectItem>
                        <SelectItem value="adjustment">{t('creditReferral.adjustments')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('creditReferral.from')}</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('creditReferral.to')}</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 mt-1" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : movements && movements.length > 0 ? (
                  <div className="space-y-3">
                    {movements.map((mov) => {
                      const isCredit = mov.amount < 0;
                      const typeInfo = getTypeInfo(mov.movement_type);
                      const TypeIcon = typeInfo.icon;
                      return (
                        <div key={mov.id} className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                          <div className={`p-2 rounded-full ${typeInfo.color}`}><TypeIcon className="h-4 w-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm">{typeInfo.label}</p>
                              <span className={`font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                                {isCredit ? '-' : '+'}${Math.abs(mov.amount).toFixed(2)}
                              </span>
                            </div>
                            {mov.description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{mov.description}</p>}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(mov.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-muted-foreground/60">|</span>
                              <span>{t('creditReferral.balance')}: ${mov.balance_before.toFixed(2)} → ${mov.balance_after.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {hasMore && (
                      <Button variant="outline" className="w-full mt-4" onClick={loadMore} disabled={isFetchingMore}>
                        {isFetchingMore ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('creditReferral.loading')}</>
                        ) : (
                          <><ChevronDown className="h-4 w-4 mr-2" />{t('creditReferral.loadMore')}</>
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{hasActiveFilters ? t('creditReferral.noResultsFilters') : t('creditReferral.noMovements')}</p>
                    <p className="text-sm">{hasActiveFilters ? t('creditReferral.tryOtherFilters') : t('creditReferral.transactionsAppear')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      <TabsContent value="referrals" className="space-y-4">
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-blue-600" />{t('creditReferral.yourReferralLink')}
            </CardTitle>
            <CardDescription>
              {t('creditReferral.referralLinkDesc', { amount: settings?.bonus_per_referral ?? 20 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referralLink ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-white dark:bg-gray-900 rounded-lg text-sm truncate border">{referralLink}</code>
                <Button variant="outline" size="icon" onClick={copyReferralLink}><Copy className="h-4 w-4" /></Button>
              </div>
            ) : (
              <p className="text-muted-foreground">{t('creditReferral.loadingLink')}</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardDescription>{t('creditReferral.totalReferrals')}</CardDescription><CardTitle className="text-2xl">{totalReferrals}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>{t('creditReferral.withPurchase')}</CardDescription><CardTitle className="text-2xl text-green-600">{completedReferrals}</CardTitle></CardHeader></Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>{t('creditReferral.goalForIncrease')}</CardDescription><CardTitle className="text-2xl">{completedReferrals}/{settings?.referrals_for_credit_increase ?? 5}</CardTitle></CardHeader>
            <CardContent className="pt-0"><Progress value={(completedReferrals / (settings?.referrals_for_credit_increase ?? 5)) * 100} className="h-2" /></CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardDescription>{t('creditReferral.totalEarned')}</CardDescription><CardTitle className="text-2xl text-blue-600">${totalEarned.toFixed(2)}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">{t('creditReferral.myReferrals')}</CardTitle></CardHeader>
          <CardContent>
            {myReferrals && myReferrals.length > 0 ? (
              <div className="space-y-3">
                {myReferrals.map((ref: any) => (
                  <div key={ref.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{ref.referred?.profiles?.full_name || ref.referred?.profiles?.email || 'Usuario'}</p>
                        <p className="text-sm text-muted-foreground">{t('creditReferral.registered')}: {new Date(ref.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ref.first_purchase_completed ? (
                        ref.bonus_approved ? (
                          <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{t('creditReferral.bonusApplied')}</Badge>
                        ) : (
                          <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{t('creditReferral.bonusPending')}</Badge>
                        )
                      ) : (
                        <Badge variant="outline">{t('creditReferral.noPurchase')}</Badge>
                      )}
                      <span className="font-medium text-green-600">${settings?.bonus_per_referral ?? 20}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t('creditReferral.noReferrals')}</p>
                <p className="text-xs mt-1">{t('creditReferral.shareLink')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
