import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

interface PartnerLogoUploadProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  helperText?: string;
  /** prefix used in the storage path, e.g. 'pickup' | 'driver' */
  slug?: string;
  maxSizeMB?: number;
}

/**
 * Logo uploader for partner profiles (pickup points & drivers).
 * Stores files in the public `branding-assets` bucket under `partner-logos/`.
 */
export function PartnerLogoUpload({
  label = 'Logo',
  value,
  onChange,
  helperText = 'PNG o JPG, máx. 2 MB. Se mostrará en el perfil del socio.',
  slug = 'partner',
  maxSizeMB = 2,
}: PartnerLogoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`La imagen no puede superar ${maxSizeMB} MB`);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `partner-logos/${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('branding-assets')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('branding-assets').getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err: any) {
      setError(err?.message ?? 'Error al subir el logo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="relative">
          {value ? (
            <>
              <img
                src={value}
                alt={label}
                className="h-16 w-16 rounded-full border object-cover bg-muted/50"
              />
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
                aria-label="Quitar logo"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="h-16 w-16 rounded-full border border-dashed flex items-center justify-center bg-muted/30 text-muted-foreground">
              <ImageIcon className="w-5 h-5" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Subiendo…' : value ? 'Cambiar logo' : 'Subir logo'}
          </Button>
          {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
