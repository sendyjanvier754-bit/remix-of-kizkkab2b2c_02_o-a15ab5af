import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface PdfPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string | null;
  title: string;
  description?: string;
  /** Set while the document is still being generated (e.g. saving the PO). */
  generating?: boolean;
}

/**
 * Shows the printable document inside a modal (no extra browser window).
 * Text stays selectable and source links stay clickable, both in the preview
 * and in the PDF produced by the browser's "Save as PDF" print target.
 */
export function PdfPreviewModal({ open, onOpenChange, html, title, description, generating }: PdfPreviewModalProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      setCopied(false);
    }
  }, [open]);

  const handlePrint = () => {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  const handleCopyLinks = async () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const links = Array.from(doc.querySelectorAll('a[href]'))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((href, index, all) => href && all.indexOf(href) === index);
    if (links.length === 0) {
      toast.info('Este documento no tiene enlaces de origen');
      return;
    }
    try {
      await navigator.clipboard.writeText(links.join('\n'));
      setCopied(true);
      toast.success(`${links.length} enlaces copiados`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudieron copiar los enlaces');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || 'Revisa el documento y usa Imprimir para guardarlo como PDF. El texto y los enlaces se mantienen seleccionables.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handlePrint} disabled={!html || !ready} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
          </Button>
          <Button variant="outline" onClick={handleCopyLinks} disabled={!html || !ready} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar enlaces
          </Button>
          <span className="text-xs text-muted-foreground">
            {generating
              ? 'Generando documento...'
              : html
                ? ready ? 'Documento listo' : 'Cargando vista previa...'
                : 'Sin documento'}
          </span>
        </div>

        <div className="relative h-[65vh] overflow-hidden rounded-lg border bg-white">
          {(!html || generating || !ready) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {generating ? 'Generando documento...' : 'Cargando vista previa...'}
              </p>
            </div>
          )}
          {html && (
            <iframe
              ref={frameRef}
              title={title}
              srcDoc={html}
              onLoad={() => setReady(true)}
              className="h-full w-full border-0"
              sandbox="allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PdfPreviewModal;
