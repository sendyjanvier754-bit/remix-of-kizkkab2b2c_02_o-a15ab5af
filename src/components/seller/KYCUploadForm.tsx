import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileCheck, AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react";
import { useKYC } from "@/hooks/useKYC";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const KYCUploadForm = () => {
  const { t } = useTranslation();
  const { kyc, isLoading, isVerified, isPending, isRejected, isUnverified, uploadDocument, submitKYC } = useKYC();
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [fiscalDoc, setFiscalDoc] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    if (!idFront || !idBack) {
      toast.error(t('kyc.uploadFrontBack'));
      return;
    }
    setIsUploading(true);
    try {
      const frontUrl = await uploadDocument(idFront, 'front');
      const backUrl = await uploadDocument(idBack, 'back');
      let fiscalUrl: string | undefined;
      if (fiscalDoc) fiscalUrl = await uploadDocument(fiscalDoc, 'fiscal');
      await submitKYC.mutateAsync({ idFrontUrl: frontUrl, idBackUrl: backUrl, fiscalDocUrl: fiscalUrl });
    } catch (error) {
      console.error('Error uploading documents:', error);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) return <div className="animate-pulse h-48 bg-muted rounded-lg" />;

  if (isVerified) {
    return (
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950/30">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-800 dark:text-green-200">{t('kyc.identityVerified')}</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">{t('kyc.verifiedDesc')}</AlertDescription>
      </Alert>
    );
  }

  if (isPending) {
    return (
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
        <Clock className="h-5 w-5 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">{t('kyc.verificationInProcess')}</AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          {t('kyc.pendingDesc')}
          <p className="mt-2 text-sm">{t('kyc.submitted')}: {kyc?.submitted_at ? new Date(kyc.submitted_at).toLocaleDateString() : 'N/A'}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (isRejected) {
    return (
      <Card className="border-red-300 dark:border-red-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-700 dark:text-red-300">{t('kyc.verificationRejected')}</CardTitle>
          </div>
          <CardDescription className="text-red-600 dark:text-red-400">
            {kyc?.admin_comments || t('kyc.rejectedDefault')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentUploadFields idFront={idFront} idBack={idBack} fiscalDoc={fiscalDoc} setIdFront={setIdFront} setIdBack={setIdBack} setFiscalDoc={setFiscalDoc} />
          <Button onClick={handleSubmit} disabled={isUploading || !idFront || !idBack} className="w-full mt-4" style={{ backgroundColor: '#071d7f' }}>
            {isUploading ? t('kyc.sending') : t('kyc.resendDocs')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <CardTitle>{t('kyc.verifyIdentity')}</CardTitle>
        </div>
        <CardDescription>{t('kyc.verifyDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/30">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">{t('kyc.mustVerify')}</AlertDescription>
        </Alert>
        <DocumentUploadFields idFront={idFront} idBack={idBack} fiscalDoc={fiscalDoc} setIdFront={setIdFront} setIdBack={setIdBack} setFiscalDoc={setFiscalDoc} />
        <Button onClick={handleSubmit} disabled={isUploading || !idFront || !idBack} className="w-full" style={{ backgroundColor: '#071d7f' }}>
          {isUploading ? t('kyc.sendingDocs') : t('kyc.sendForVerification')}
        </Button>
      </CardContent>
    </Card>
  );
};

interface DocumentUploadFieldsProps {
  idFront: File | null; idBack: File | null; fiscalDoc: File | null;
  setIdFront: (file: File | null) => void; setIdBack: (file: File | null) => void; setFiscalDoc: (file: File | null) => void;
}

const DocumentUploadFields = ({ idFront, idBack, fiscalDoc, setIdFront, setIdBack, setFiscalDoc }: DocumentUploadFieldsProps) => {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="id-front">{t('kyc.idFront')}</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
          <input id="id-front" type="file" accept="image/*" className="hidden" onChange={(e) => setIdFront(e.target.files?.[0] || null)} />
          <label htmlFor="id-front" className="cursor-pointer">
            {idFront ? (
              <div className="flex items-center justify-center gap-2 text-green-600"><FileCheck className="h-5 w-5" /><span className="text-sm">{idFront.name}</span></div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload className="h-8 w-8" /><span className="text-sm">{t('kyc.uploadFront')}</span></div>
            )}
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="id-back">{t('kyc.idBack')}</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
          <input id="id-back" type="file" accept="image/*" className="hidden" onChange={(e) => setIdBack(e.target.files?.[0] || null)} />
          <label htmlFor="id-back" className="cursor-pointer">
            {idBack ? (
              <div className="flex items-center justify-center gap-2 text-green-600"><FileCheck className="h-5 w-5" /><span className="text-sm">{idBack.name}</span></div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload className="h-8 w-8" /><span className="text-sm">{t('kyc.uploadBack')}</span></div>
            )}
          </label>
        </div>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="fiscal-doc">{t('kyc.fiscalDoc')}</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
          <input id="fiscal-doc" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFiscalDoc(e.target.files?.[0] || null)} />
          <label htmlFor="fiscal-doc" className="cursor-pointer">
            {fiscalDoc ? (
              <div className="flex items-center justify-center gap-2 text-green-600"><FileCheck className="h-5 w-5" /><span className="text-sm">{fiscalDoc.name}</span></div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload className="h-8 w-8" /><span className="text-sm">{t('kyc.uploadFiscal')}</span></div>
            )}
          </label>
        </div>
      </div>
    </div>
  );
};
