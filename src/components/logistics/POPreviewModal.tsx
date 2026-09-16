import { useRef, useState } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  buildPOBuyingListHtml,
  downloadPOBuyingListPDF,
  type POBuyingListData,
} from '@/services/pdfGenerators';

interface POPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: POBuyingListData | null;
  /** When provided, Guardar persists the PO first and then downloads the PDF. */
  onSave?: () => Promise<POBuyingListData | void>;
}

export function POPreviewModal({ open, onOpenChange, data, onSave }: POPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [saving, setSaving] = useState(false);

  if (!data) return null;

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy copy
    }

    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyLinks = async () => {
    const links = Array.from(new Set(data.items.map(item => item.url_origen).filter((url): url is string => Boolean(url))));
    if (links.length === 0) {
      toast.info('Este PO no contiene enlaces de proveedor');
      return;
    }

    const copied = await copyToClipboard(links.join('\n'));
    if (copied) {
      toast.success('Enlaces copiados', { description: `${links.length} ${links.length === 1 ? 'enlace copiado' : 'enlaces copiados'}.` });
    } else {
      toast.error('No se pudieron copiar los enlaces');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let pdfData = data;
      if (onSave) {
        const updated = await onSave();
        if (updated) pdfData = updated;
      }
      await downloadPOBuyingListPDF(pdfData);
      toast.success('PO guardado', { description: `${pdfData.po_number} se guardó y el PDF se descargó correctamente.` });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving ZleTI PO:', error);
      toast.error(error?.message || 'No se pudo guardar el PO');
    } finally {
      setSaving(false);
    }
  };

  const preparePreviewLinks = () => {
    const frameDocument = iframeRef.current?.contentDocument;
    if (!frameDocument) return;

    frameDocument.querySelectorAll<HTMLAnchorElement>('a.source-url').forEach(link => {
      link.onclick = event => {
        event.preventDefault();
        const url = link.href;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      };
    });

    frameDocument.querySelectorAll<HTMLButtonElement>('button.copy-url').forEach(button => {
      button.onclick = async event => {
        event.preventDefault();
        const url = button.dataset.url;
        if (!url) return;
        const copied = await copyToClipboard(url);
        if (copied) {
          toast.success('Enlace copiado');
          button.textContent = 'Copiado';
          window.setTimeout(() => { button.textContent = 'Copiar enlace'; }, 1500);
        } else {
          toast.error('No se pudo copiar el enlace');
        }
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[calc(100%-1rem)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <div className="border-b bg-background px-5 py-4 pr-12">
          <DialogHeader>
            <DialogTitle>Vista previa — {data.po_number}</DialogTitle>
            <DialogDescription>Revisa el documento, abre los enlaces del proveedor o guarda el PO con su PDF.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 bg-muted p-2 sm:p-4">
          <iframe
            ref={iframeRef}
            title={`Vista previa ${data.po_number}`}
            srcDoc={buildPOBuyingListHtml(data)}
            onLoad={preparePreviewLinks}
            className="h-full w-full rounded border bg-background"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t bg-background px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button type="button" variant="outline" onClick={handleCopyLinks}>
            <Copy className="h-4 w-4" />
            Copiar enlaces
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {saving ? 'Guardando...' : onSave ? 'Guardar' : 'Guardar PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
