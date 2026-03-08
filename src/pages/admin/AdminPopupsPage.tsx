import React, { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useMarketingPopups, MarketingPopup } from '@/hooks/useMarketingPopups';
import { useDiscountCodes } from '@/hooks/useDiscountCodes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Trash2, Edit, MoreHorizontal, Megaphone,
  MousePointerClick, ShoppingCart, Clock, Gift, Ticket,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

type TriggerType = 'welcome' | 'exit_intent' | 'cart_abandon' | 'timed_promotion';
type DisplayFreq = 'once_per_session' | 'once_per_day' | 'once_ever' | 'always';

interface PopupForm {
  title: string;
  description: string;
  trigger_type: TriggerType;
  heading: string;
  body_text: string;
  image_url: string;
  button_text: string;
  button_url: string;
  background_color: string;
  discount_code_id: string | null;
  auto_generate_coupon: boolean;
  auto_coupon_config: { discount_type: string; discount_value: number; prefix: string; max_uses_per_user: number };
  display_frequency: DisplayFreq;
  delay_seconds: number;
  scroll_percentage: number | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  target_audience: string;
  target_pages: string[];
}

const AdminPopupsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { popups, isLoading, createPopup, updatePopup, togglePopup, deletePopup } = useMarketingPopups();
  const { discountCodes } = useDiscountCodes();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const triggerTypeConfig: Record<TriggerType, { label: string; icon: React.ElementType; color: string }> = {
    welcome: { label: t('popups.triggers.welcome'), icon: Gift, color: 'bg-green-100 text-green-800' },
    exit_intent: { label: t('popups.triggers.exitIntent'), icon: MousePointerClick, color: 'bg-orange-100 text-orange-800' },
    cart_abandon: { label: t('popups.triggers.cartAbandon'), icon: ShoppingCart, color: 'bg-red-100 text-red-800' },
    timed_promotion: { label: t('popups.triggers.timedPromotion'), icon: Clock, color: 'bg-blue-100 text-blue-800' },
  };

  const emptyForm: PopupForm = {
    title: '', description: '', trigger_type: 'welcome', heading: '', body_text: '',
    image_url: '', button_text: t('popups.form.defaultButtonText'), button_url: '', background_color: '#ffffff',
    discount_code_id: null, auto_generate_coupon: false,
    auto_coupon_config: { discount_type: 'percentage', discount_value: 10, prefix: 'POPUP', max_uses_per_user: 1 },
    display_frequency: 'once_per_session', delay_seconds: 3, scroll_percentage: null,
    starts_at: '', ends_at: '', is_active: true, target_audience: 'all', target_pages: [],
  };

  const [form, setForm] = useState<PopupForm>(emptyForm);

  const filteredPopups = activeTab === 'all' ? popups : popups.filter(p => p.trigger_type === activeTab);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setIsDialogOpen(true); };

  const openEdit = (p: MarketingPopup) => {
    setEditingId(p.id);
    setForm({
      title: p.title, description: p.description || '', trigger_type: p.trigger_type,
      heading: p.heading, body_text: p.body_text || '', image_url: p.image_url || '',
      button_text: p.button_text || t('popups.form.defaultButtonText'), button_url: p.button_url || '',
      background_color: p.background_color || '#ffffff', discount_code_id: p.discount_code_id,
      auto_generate_coupon: p.auto_generate_coupon,
      auto_coupon_config: p.auto_coupon_config || emptyForm.auto_coupon_config,
      display_frequency: p.display_frequency, delay_seconds: p.delay_seconds,
      scroll_percentage: p.scroll_percentage,
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : '',
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : '',
      is_active: p.is_active, target_audience: p.target_audience, target_pages: p.target_pages || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.heading) return;
    const payload = {
      ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      discount_code_id: form.discount_code_id || null, created_by: user?.id,
    };
    if (editingId) {
      await updatePopup.mutateAsync({ id: editingId, ...payload });
    } else {
      await createPopup.mutateAsync(payload);
    }
    setIsDialogOpen(false);
  };

  const stats = {
    total: popups.length, active: popups.filter(p => p.is_active).length,
    totalViews: popups.reduce((s, p) => s + p.views_count, 0),
    totalClicks: popups.reduce((s, p) => s + p.clicks_count, 0),
  };

  return (
    <AdminLayout title={t('popups.title')} subtitle={t('popups.subtitle')}>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" /> {t('popups.title')}
            </h1>
            <p className="text-muted-foreground text-sm">{t('popups.subtitle')}</p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('popups.newPopup')}</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardDescription>{t('popups.stats.total')}</CardDescription><CardTitle className="text-2xl">{stats.total}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>{t('popups.stats.active')}</CardDescription><CardTitle className="text-2xl text-green-600">{stats.active}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>{t('popups.stats.views')}</CardDescription><CardTitle className="text-2xl">{stats.totalViews.toLocaleString()}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>{t('popups.stats.clicks')}</CardDescription><CardTitle className="text-2xl">{stats.totalClicks.toLocaleString()}</CardTitle></CardHeader></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">{t('popups.tabs.all')} ({popups.length})</TabsTrigger>
            {(Object.entries(triggerTypeConfig) as [TriggerType, typeof triggerTypeConfig[TriggerType]][]).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key} className="gap-1">
                <cfg.icon className="h-3 w-3" />
                {cfg.label} ({popups.filter(p => p.trigger_type === key).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('popups.table.popup')}</TableHead>
                  <TableHead>{t('popups.table.type')}</TableHead>
                  <TableHead>{t('popups.table.coupon')}</TableHead>
                  <TableHead>{t('popups.table.frequency')}</TableHead>
                  <TableHead className="text-center">{t('popups.stats.views')}</TableHead>
                  <TableHead className="text-center">{t('popups.stats.clicks')}</TableHead>
                  <TableHead>{t('popups.table.status')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPopups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {t('popups.noPopups')}
                    </TableCell>
                  </TableRow>
                ) : filteredPopups.map((popup) => {
                  const cfg = triggerTypeConfig[popup.trigger_type];
                  const TriggerIcon = cfg.icon;
                  return (
                    <TableRow key={popup.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{popup.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{popup.heading}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`gap-1 ${cfg.color}`}>
                          <TriggerIcon className="h-3 w-3" />{cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {popup.discount_code ? (
                          <Badge variant="outline" className="gap-1"><Ticket className="h-3 w-3" />{popup.discount_code.code}</Badge>
                        ) : popup.auto_generate_coupon ? (
                          <Badge variant="outline">{t('popups.autoGenerated')}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{t(`popups.frequencies.${popup.display_frequency}`)}</TableCell>
                      <TableCell className="text-center">{popup.views_count}</TableCell>
                      <TableCell className="text-center">{popup.clicks_count}</TableCell>
                      <TableCell>
                        <Switch checked={popup.is_active} onCheckedChange={(v) => togglePopup.mutate({ id: popup.id, is_active: v })} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(popup)}><Edit className="h-4 w-4 mr-2" /> {t('common.edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deletePopup.mutate(popup.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t('popups.editPopup') : t('popups.newPopup')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>{t('popups.form.internalName')} *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('popups.form.internalNamePlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('popups.form.triggerType')} *</Label>
                  <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v as TriggerType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(triggerTypeConfig) as [TriggerType, typeof triggerTypeConfig[TriggerType]][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('popups.form.displayFrequency')}</Label>
                  <Select value={form.display_frequency} onValueChange={(v) => setForm({ ...form, display_frequency: v as DisplayFreq })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once_per_session">{t('popups.frequencies.once_per_session')}</SelectItem>
                      <SelectItem value="once_per_day">{t('popups.frequencies.once_per_day')}</SelectItem>
                      <SelectItem value="once_ever">{t('popups.frequencies.once_ever')}</SelectItem>
                      <SelectItem value="always">{t('popups.frequencies.always')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">{t('popups.form.contentSection')}</h3>
                <div className="space-y-2">
                  <Label>{t('popups.form.heading')} *</Label>
                  <Input value={form.heading} onChange={(e) => setForm({ ...form, heading: e.target.value })} placeholder={t('popups.form.headingPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('popups.form.bodyText')}</Label>
                  <Textarea value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} placeholder={t('popups.form.bodyTextPlaceholder')} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('popups.form.buttonText')}</Label>
                    <Input value={form.button_text} onChange={(e) => setForm({ ...form, button_text: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('popups.form.imageUrl')}</Label>
                    <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Ticket className="h-4 w-4" /> {t('popups.form.couponSection')}</h3>
                <div className="flex items-center gap-3">
                  <Switch checked={form.auto_generate_coupon} onCheckedChange={(v) => setForm({ ...form, auto_generate_coupon: v, discount_code_id: v ? null : form.discount_code_id })} />
                  <Label>{t('popups.form.autoGenerateCoupon')}</Label>
                </div>
                {form.auto_generate_coupon ? (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('popups.form.discountType')}</Label>
                      <Select value={form.auto_coupon_config.discount_type} onValueChange={(v) => setForm({ ...form, auto_coupon_config: { ...form.auto_coupon_config, discount_type: v } })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">{t('popups.form.percentage')}</SelectItem>
                          <SelectItem value="fixed">{t('popups.form.fixedAmount')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('popups.form.value')}</Label>
                      <Input type="number" className="h-8" value={form.auto_coupon_config.discount_value} onChange={(e) => setForm({ ...form, auto_coupon_config: { ...form.auto_coupon_config, discount_value: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('popups.form.prefix')}</Label>
                      <Input className="h-8" value={form.auto_coupon_config.prefix} onChange={(e) => setForm({ ...form, auto_coupon_config: { ...form.auto_coupon_config, prefix: e.target.value } })} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>{t('popups.form.linkExistingCoupon')}</Label>
                    <Select value={form.discount_code_id || 'none'} onValueChange={(v) => setForm({ ...form, discount_code_id: v === 'none' ? null : v })}>
                      <SelectTrigger><SelectValue placeholder={t('popups.form.noCoupon')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('popups.form.noCoupon')}</SelectItem>
                        {discountCodes?.filter((c: any) => c.is_active).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">{t('popups.form.schedulingSection')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('popups.form.delay')}</Label>
                    <Input type="number" min={0} value={form.delay_seconds} onChange={(e) => setForm({ ...form, delay_seconds: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('popups.form.audience')}</Label>
                    <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('popups.audiences.all')}</SelectItem>
                        <SelectItem value="new_visitors">{t('popups.audiences.newVisitors')}</SelectItem>
                        <SelectItem value="returning">{t('popups.audiences.returning')}</SelectItem>
                        <SelectItem value="b2b">B2B</SelectItem>
                        <SelectItem value="b2c">B2C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('popups.form.from')}</Label>
                    <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('popups.form.until')}</Label>
                    <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={!form.title || !form.heading}>
                {editingId ? t('popups.saveChanges') : t('popups.createPopup')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPopupsPage;
