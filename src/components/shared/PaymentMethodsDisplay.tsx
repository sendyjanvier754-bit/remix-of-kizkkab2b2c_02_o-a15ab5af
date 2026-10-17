import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Building2, Smartphone, CreditCard, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export interface BankInfo {
  bank_name?: string;
  account_type?: string;
  account_number?: string;
  account_holder?: string;
}

export interface MobilePaymentInfo {
  phone_number?: string;
  name?: string;
}

export interface PaymentMethodsData {
  bank_info?: BankInfo;
  moncash_info?: MobilePaymentInfo;
  natcash_info?: MobilePaymentInfo;
}

interface PaymentMethodsDisplayProps {
  paymentData: PaymentMethodsData;
  showEditButton?: boolean;
  onEdit?: () => void;
  title?: string;
  compact?: boolean;
}

// Mask account number showing only last 4 digits
const maskAccountNumber = (accountNumber: string): string => {
  if (!accountNumber || accountNumber.length < 4) return accountNumber || '';
  return `****${accountNumber.slice(-4)}`;
};

// Mask phone number showing only last 4 digits
const maskPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber || phoneNumber.length < 4) return phoneNumber || '';
  const cleaned = phoneNumber.replace(/\D/g, '');
  return `****${cleaned.slice(-4)}`;
};

export const PaymentMethodsDisplay = ({ 
  paymentData, 
  showEditButton = false, 
  onEdit,
  title,
  compact = false
}: PaymentMethodsDisplayProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const displayTitle = title ?? t('cartExtra.paymentMethods');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { bank_info, moncash_info, natcash_info } = paymentData || {};

  // Check if any payment method is configured
  const hasBankInfo = bank_info && (bank_info.bank_name || bank_info.account_number);
  const hasMoncash = moncash_info && (moncash_info.phone_number || moncash_info.name);
  const hasNatcash = natcash_info && (natcash_info.phone_number || natcash_info.name);

  const hasAnyPaymentMethod = hasBankInfo || hasMoncash || hasNatcash;

  if (!hasAnyPaymentMethod) {
    return null;
  }

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast({
        title: t('cartExtra.copiedTitle'),
        description: t('cartExtra.copiedToClipboard', { field: fieldName }),
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: t('cartExtra.copyError'),
        variant: "destructive",
      });
    }
  };

  const CopyButton = ({ text, fieldName }: { text: string; fieldName: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(text, fieldName);
      }}
      className="ml-2 p-1 rounded hover:bg-gray-100 transition-colors"
      title={t('cartExtra.copy')}
    >
      {copiedField === fieldName ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {displayTitle}
        </h4>
        
        <div className="flex flex-wrap gap-2">
          {hasBankInfo && (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
              <Building2 className="h-3 w-3 mr-1" />
              {t('payments.bankTransfer')}
            </Badge>
          )}
          {hasMoncash && (
            <Badge variant="outline" className="bg-[#94111f]/10 text-[#94111f] border-[#94111f]/20">
              <Smartphone className="h-3 w-3 mr-1" />
              MonCash
            </Badge>
          )}
          {hasNatcash && (
            <Badge variant="outline" className="bg-[#071d7f]/10 text-[#071d7f] border-[#071d7f]/20">
              <Smartphone className="h-3 w-3 mr-1" />
              NatCash
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-600" />
            {displayTitle}
          </CardTitle>
          {showEditButton && onEdit && (
            <button
              onClick={onEdit}
              className="text-sm text-primary hover:underline font-medium"
            >
              {t('cartExtra.edit')}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {/* Bank Transfer */}
          {hasBankInfo && (
            <AccordionItem value="bank" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-100">
                    <Building2 className="h-5 w-5 text-violet-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{t('payments.bankTransfer')}</p>
                    <p className="text-sm text-gray-500">{bank_info?.bank_name || t('cartExtra.bankLabel')}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="ml-12 space-y-3 text-sm">
                  {bank_info?.bank_name && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.bankLabel')}:</span>
                      <span className="font-medium text-gray-900">{bank_info.bank_name}</span>
                    </div>
                  )}
                  {bank_info?.account_type && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.typeLabel')}:</span>
                      <Badge variant="secondary" className="font-medium">
                        {bank_info.account_type}
                      </Badge>
                    </div>
                  )}
                  {bank_info?.account_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.accountLabel')}:</span>
                      <div className="flex items-center">
                        <span className="font-mono font-medium text-gray-900">
                          {maskAccountNumber(bank_info.account_number)}
                        </span>
                        <CopyButton text={bank_info.account_number} fieldName={t('cartExtra.accountNumber')} />
                      </div>
                    </div>
                  )}
                  {bank_info?.account_holder && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.holderLabel')}:</span>
                      <span className="font-medium text-gray-900">{bank_info.account_holder}</span>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* MonCash */}
          {hasMoncash && (
            <AccordionItem value="moncash" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#94111f20' }}>
                    <Smartphone className="h-5 w-5" style={{ color: '#94111f' }} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">MonCash</p>
                    <p className="text-sm text-gray-500">{moncash_info?.name || t('cartExtra.digitalWallet')}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="ml-12 space-y-3 text-sm">
                  {moncash_info?.phone_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.numberLabel')}:</span>
                      <div className="flex items-center">
                        <span className="font-mono font-medium text-gray-900">
                          {maskPhoneNumber(moncash_info.phone_number)}
                        </span>
                        <CopyButton text={moncash_info.phone_number} fieldName={t('cartExtra.moncashNumberLabel')} />
                      </div>
                    </div>
                  )}
                  {moncash_info?.name && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.nameLabel')}:</span>
                      <span className="font-medium text-gray-900">{moncash_info.name}</span>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* NatCash */}
          {hasNatcash && (
            <AccordionItem value="natcash" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#071d7f20' }}>
                    <Smartphone className="h-5 w-5" style={{ color: '#071d7f' }} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">NatCash</p>
                    <p className="text-sm text-gray-500">{natcash_info?.name || t('cartExtra.digitalWallet')}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="ml-12 space-y-3 text-sm">
                  {natcash_info?.phone_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.numberLabel')}:</span>
                      <div className="flex items-center">
                        <span className="font-mono font-medium text-gray-900">
                          {maskPhoneNumber(natcash_info.phone_number)}
                        </span>
                        <CopyButton text={natcash_info.phone_number} fieldName={t('cartExtra.natcashNumberLabel')} />
                      </div>
                    </div>
                  )}
                  {natcash_info?.name && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('cartExtra.nameLabel')}:</span>
                      <span className="font-medium text-gray-900">{natcash_info.name}</span>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default PaymentMethodsDisplay;