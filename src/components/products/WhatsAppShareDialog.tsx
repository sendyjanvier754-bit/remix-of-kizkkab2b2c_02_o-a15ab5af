import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, Send, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWhatsAppShareStore } from '@/stores/useWhatsAppShareStore';
import { useProductVariants } from '@/hooks/useProductVariants';
import { useWhatsAppSupport } from '@/hooks/useWhatsAppSupport';
import { getStoredAffiliateCode } from '@/components/affiliates/AffiliateRefCapture';
import { supabase } from '@/integrations/supabase/client';

type Intent = 'order' | 'info' | 'share';

const WhatsAppShareDialog = () => {
  const { t } = useTranslation();
  const { isOpen, product, close } = useWhatsAppShareStore();
  const { number: supportNumber, buildLink } = useWhatsAppSupport();
  const { data: variants = [] } = useProductVariants(product?.sourceProductId, false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [intent, setIntent] = useState<Intent>('order');

  useEffect(() => {
    if (isOpen) { setSelected({}); setQty(1); setIntent('order'); }
  }, [isOpen, product?.id]);

  // Resolve the seller's WhatsApp when it wasn't passed in:
  // store by id → otherwise the active B2B seller store offering this product.
  const [resolvedSellerPhone, setResolvedSellerPhone] = useState<string | null>(null);
  useEffect(() => {
    setResolvedSellerPhone(null);
    if (!isOpen || !product || product.storeWhatsapp) return;
    let cancelled = false;
    (async () => {
      let phone: string | null = null;
      if (product.storeId) {
        const { data } = await supabase.from('stores').select('whatsapp').eq('id', product.storeId).maybeSingle();
        phone = (data as any)?.whatsapp || null;
      }
      if (!phone && product.sourceProductId) {
        const { data } = await supabase
          .from('seller_catalog')
          .select('store:stores!inner(whatsapp,is_active)')
          .eq('source_product_id', product.sourceProductId)
          .eq('is_active', true)
          .limit(10);
        phone = ((data as any[]) || []).map((r) => r.store?.whatsapp).find((w) => w && String(w).replace(/\D/g, '').length >= 6) || null;
      }
      if (!cancelled) setResolvedSellerPhone(phone);
    })();
    return () => { cancelled = true; };
  }, [isOpen, product?.id, product?.storeId, product?.storeWhatsapp, product?.sourceProductId]);

  // Build attribute → values map from active variants
  const attributes = useMemo(() => {
    const map: Record<string, string[]> = {};
    variants.forEach((v) => {
      Object.entries(v.attribute_combination || {}).forEach(([k, val]) => {
        if (!val) return;
        map[k] = map[k] || [];
        if (!map[k].includes(String(val))) map[k].push(String(val));
      });
    });
    return map;
  }, [variants]);

  const matched = useMemo(() => {
    const keys = Object.keys(attributes);
    if (!keys.length || keys.some((k) => !selected[k])) return null;
    return variants.find((v) => keys.every((k) => String(v.attribute_combination?.[k] ?? '') === selected[k])) || null;
  }, [attributes, selected, variants]);

  // Image for a given attribute value (first variant carrying it)
  const imageFor = (key: string, value: string) =>
    variants.find((v) => String(v.attribute_combination?.[key] ?? '') === value && v.images?.[0])?.images?.[0];

  if (!product) return null;

  const image = matched?.images?.[0] || (selected.color && imageFor('color', selected.color)) || product.image;
  const unitPrice = product.price;
  const currency = product.currency || 'USD';

  const productUrl = (() => {
    const base = `${window.location.origin}/producto/${product.sku || ''}`;
    const params = new URLSearchParams();
    if (product.storeId) params.set('seller', product.storeId);
    const ref = getStoredAffiliateCode?.();
    if (ref) params.set('ref', ref);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  })();

  const variantText = Object.entries(selected).map(([k, v]) => `${k}: ${v}`).join(' | ');

  const buildMessage = () => {
    // The product link is the only URL: the server renders that page with the
    // selected variant / product photo, so WhatsApp shows it in the preview card.
    const lines: string[] = [];
    lines.push(t(`whatsappShare.greeting.${intent}`), '', `*${product.name}*`);
    if (product.sku) lines.push(`SKU: ${product.sku}`);
    if (variantText) lines.push(`${t('whatsappShare.variant')}: ${variantText}`);
    if (intent !== 'share') {
      lines.push(`${t('whatsappShare.quantity')}: ${qty}`);
      lines.push(`${t('whatsappShare.price')}: $${unitPrice.toFixed(2)} ${currency}`);
      lines.push(`${t('whatsappShare.total')}: $${(unitPrice * qty).toFixed(2)} ${currency}`);
    } else {
      lines.push(`${t('whatsappShare.price')}: $${unitPrice.toFixed(2)} ${currency}`);
    }
    lines.push('', productUrl);
    return lines.join('\n');
  };

  const handleSend = () => {
    const message = buildMessage();
    const text = encodeURIComponent(message);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const seller = (product.storeWhatsapp || resolvedSellerPhone || '').replace(/\D/g, '');
    let url: string;
    if (intent === 'share') {
      // Let the visitor choose any contact
      url = isMobile ? `https://wa.me/?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
    } else if (seller.length >= 6) {
      url = isMobile ? `https://wa.me/${seller}?text=${text}` : `https://web.whatsapp.com/send?phone=${seller}&text=${text}`;
    } else if (supportNumber) {
      url = buildLink(message);
    } else {
      url = isMobile ? `https://wa.me/?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
    }
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); a.remove();
    }
    close();
  };

  const intents: Intent[] = ['order', 'info', 'share'];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5 text-green-600" />
            {t('whatsappShare.title')}
          </DialogTitle>
          <DialogDescription>{t('whatsappShare.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          {image && <img src={image} alt={product.name} className="w-20 h-24 object-cover rounded-md border border-border" />}
          <div className="min-w-0">
            <p className="text-sm font-medium line-clamp-2">{product.name}</p>
            <p className="text-lg font-bold text-primary mt-1">${unitPrice.toFixed(2)} <span className="text-xs">{currency}</span></p>
          </div>
        </div>

        {Object.entries(attributes).map(([key, values]) => (
          <div key={key}>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
              {key}{selected[key] ? `: ${selected[key]}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {values.map((val) => {
                const active = selected[key] === val;
                const img = key.toLowerCase() === 'color' ? imageFor(key, val) : undefined;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelected((s) => ({ ...s, [key]: active ? '' : val }))}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${active ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'}`}
                  >
                    {img && <img src={img} alt="" className="w-5 h-5 rounded-full object-cover" />}
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-3 gap-2">
          {intents.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIntent(i)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${intent === i ? 'border-green-600 bg-green-50 text-green-700' : 'border-border hover:bg-muted'}`}
            >
              {t(`whatsappShare.intent.${i}`)}
            </button>
          ))}
        </div>

        {intent !== 'share' && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('whatsappShare.quantity')}</span>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="w-3 h-3" /></Button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty((q) => q + 1)}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-muted/60 p-3 text-xs whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">
          {buildMessage()}
        </div>

        <Button onClick={handleSend} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
          {intent === 'share' ? <Share2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {t('whatsappShare.send')}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.45 9.43M20.1 3.9A11.32 11.32 0 0 0 12.05.56C5.78.56.67 5.66.67 11.94c0 2 .52 3.96 1.52 5.69L.57 23.5l6.02-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.27 0 11.38-5.1 11.38-11.38 0-3.04-1.18-5.9-3.33-8.04" />
  </svg>
);

export default WhatsAppShareDialog;
