import { useState, useRef } from 'react';
import { Plus, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SellerStatusUploadProps {
  onUpload: (file: File, caption?: string) => Promise<any>;
  hasActiveStatus?: boolean;
}

export function SellerStatusUpload({ onUpload, hasActiveStatus }: SellerStatusUploadProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(t('toasts.fileTooLarge5MB'));
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await onUpload(selectedFile, caption);
      handleClose();
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setPreview(null);
    setSelectedFile(null);
    setCaption('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex-shrink-0 w-20 h-20 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
      >
        {hasActiveStatus && (
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-pulse" />
        )}
        <Plus className="h-6 w-6 text-primary" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar estado</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!preview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[9/16] max-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
              >
                <Plus className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Seleccionar imagen</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Máximo 5MB</p>
              </div>
            ) : (
              <div className="relative aspect-[9/16] max-h-[400px] rounded-lg overflow-hidden bg-black">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {preview && (
              <>
                <Input
                  placeholder="Agregar texto al estado (opcional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={150}
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                    disabled={uploading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpload}
                    className="flex-1"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Publicar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
