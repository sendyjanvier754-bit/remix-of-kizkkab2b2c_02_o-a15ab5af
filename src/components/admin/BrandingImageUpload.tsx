import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2 } from 'lucide-react';

interface BrandingImageUploadProps {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** 'sm' = 32px, 'md' = 48px (default), 'lg' = 80px */
  previewSize?: 'sm' | 'md' | 'lg';
  /** MIME accept string for file input */
  accept?: string;
  /** max file size in MB */
  maxSizeMB?: number;
  /** show URL input field (default: false => upload-only UX) */
  allowUrlInput?: boolean;
  /** optional helper text under control */
  helperText?: string;
  /** render preview in circular template */
  circular?: boolean;
  /** optional minimum image width in px */
  minWidth?: number;
  /** optional minimum image height in px */
  minHeight?: number;
}

const SIZE_CLASS: Record<string, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
};

export function BrandingImageUpload({
  id,
  label,
  value,
  onChange,
  previewSize = 'md',
  accept = 'image/*',
  maxSizeMB = 2,
  allowUrlInput = false,
  helperText,
  minWidth,
  minHeight,
  circular = false,
}: BrandingImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateImageResolution = (file: File) =>
    new Promise<void>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        URL.revokeObjectURL(objectUrl);
        if ((minWidth && width < minWidth) || (minHeight && height < minHeight)) {
          reject(new Error(`Resolución mínima recomendada: ${minWidth ?? 0}x${minHeight ?? 0}px. Archivo actual: ${width}x${height}px`));
          return;
        }
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo leer la resolución de la imagen'));
      };
      img.src = objectUrl;
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const accepts = accept
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const isAccepted = accepts.some(pattern => {
      if (pattern.endsWith('/*')) return file.type.startsWith(pattern.replace('/*', '/'));
      return file.type === pattern;
    });

    if (!isAccepted) {
      setError('Tipo de archivo no permitido');
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo no puede superar ${maxSizeMB} MB`);
      return;
    }

    if (file.type.startsWith('image/') && (minWidth || minHeight)) {
      try {
        await validateImageResolution(file);
      } catch (err: any) {
        setError(err?.message || 'La resolución de la imagen es demasiado baja');
        return;
      }
    }

    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      // Use a deterministic name per field so re-uploading overwrites the same file
      const filename = `${id}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('branding-assets')
        .upload(filename, file, { upsert: true, contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('branding-assets').getPublicUrl(filename);
      onChange(data.publicUrl);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir la imagen');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-url`}>{label}</Label>

      {value && (
        <div className="relative inline-flex">
          <img
            src={value}
            alt={label}
            className={`${SIZE_CLASS[previewSize]} ${circular ? 'rounded-full' : 'rounded'} border bg-muted/50 object-cover p-0.5`}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
            aria-label="Quitar imagen"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="gap-1.5 shrink-0"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? 'Subiendo…' : 'Subir desde PC'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFile}
        />
        {allowUrlInput && (
          <Input
            id={`${id}-url`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… (URL directa)"
            className="text-xs"
          />
        )}
      </div>

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
