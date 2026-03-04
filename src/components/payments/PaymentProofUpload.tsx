import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, ExternalLink, Loader2, FileImage, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentProofUploadProps {
  orderId: string;
  existingUrl?: string | null;
  onUploaded?: (url: string) => void;
  /** When true, only shows a link to view the proof (admin view) */
  readOnly?: boolean;
}

/**
 * Reusable component to upload/view a payment proof (comprobante de pago).
 * The URL is stored in metadata.payment_proof_url on the orders_b2b table.
 *
 * Usage – seller upload:
 *   <PaymentProofUpload orderId={order.id} existingUrl={order.metadata?.payment_proof_url} onUploaded={...} />
 *
 * Usage – admin read-only view:
 *   <PaymentProofUpload orderId={order.id} existingUrl={order.metadata?.payment_proof_url} readOnly />
 */
export const PaymentProofUpload = ({
  orderId,
  existingUrl,
  onUploaded,
  readOnly = false,
}: PaymentProofUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(existingUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WebP) o PDF');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('El archivo no puede superar 8 MB');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `orders/${orderId}/comprobante_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(path);

      // Patch metadata.payment_proof_url on the order
      const { data: orderRow } = await supabase
        .from('orders_b2b')
        .select('metadata')
        .eq('id', orderId)
        .single();

      const existingMeta = (orderRow?.metadata as Record<string, unknown>) ?? {};

      const { error: updateError } = await supabase
        .from('orders_b2b')
        .update({ metadata: { ...existingMeta, payment_proof_url: publicUrl } })
        .eq('id', orderId);

      if (updateError) throw updateError;

      setProofUrl(publicUrl);
      onUploaded?.(publicUrl);
      toast.success('Comprobante subido. El admin validará tu pago pronto.');
    } catch (err: any) {
      console.error('Error uploading proof:', err);
      toast.error('Error al subir el comprobante: ' + (err.message ?? 'Intenta de nuevo'));
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // ── Read-only (admin) view ──────────────────────────────────────────────────
  if (readOnly) {
    if (!proofUrl) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
          <FileImage className="h-4 w-4 flex-shrink-0" />
          Sin comprobante adjunto
        </div>
      );
    }

    const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(proofUrl);

    return (
      <div className="space-y-2">
        {isImage && (
          <a href={proofUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={proofUrl}
              alt="Comprobante de pago"
              className="max-h-48 rounded-lg border object-contain w-full"
            />
          </a>
        )}
        <a
          href={proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {isImage ? 'Ver imagen completa' : 'Ver comprobante (PDF)'}
        </a>
      </div>
    );
  }

  // ── Upload (seller) view ────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {proofUrl ? (
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-semibold text-green-800">Comprobante enviado</p>
            <p className="text-xs text-green-700">
              El admin revisará y confirmará tu pago en breve.
            </p>
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline flex items-center gap-1"
            >
              Ver comprobante <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex-shrink-0 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Cambiar
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-full border-dashed border-2 h-14 flex-col gap-1"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Subiendo comprobante...</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">Subir Comprobante de Pago</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
};
