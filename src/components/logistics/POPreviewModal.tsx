import { useRef, useState } from 'react';
import { Copy, Download, Loader2, Printer } from 'lucide-react';
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
}

export function POPreviewModal({ open, onOpenChange, data }: POPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (!data) return null;

  const handlePrint = () => {
    const previewWindow = iframeRef.current?.contentWindow;
    if (!previewWindow) {
      toast.error('No se pudo preparar la impresión');
      return;
    }
    previewWindow.focus();
    previewWindow.print();
  };

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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPOBuyingListPDF(data);
      toast.success('PDF guardado', { description: `${data.po_number} se descargó correctamente.` });
    } catch (error) {
      console.error('Error downloading ZleTI PO PDF:', error);
      toast.error('No se pudo guardar el PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[calc(100%-1rem)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <div className="border-b bg-background px-5 py-4 pr-12">
          <DialogHeader>
            <DialogTitle>Vista previa — {data.po_number}</DialogTitle>
            <DialogDescription>Revisa el documento, abre los enlaces del proveedor o guárdalo como PDF.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 bg-muted p-2 sm:p-4">
          <iframe
            ref={iframeRef}
            title={`Vista previa ${data.po_number}`}
            srcDoc={buildPOBuyingListHtml(data)}
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
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button type="button" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? 'Guardando...' : 'Guardar PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}