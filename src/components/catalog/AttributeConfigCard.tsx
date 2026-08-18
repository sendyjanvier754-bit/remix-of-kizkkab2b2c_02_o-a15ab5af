import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Palette, Ruler, Zap, Package, ImageIcon, CheckCircle2, Tag, List, LinkIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

export interface AttributeConfig {
  id: string;
  nameType: 'manual' | 'column';
  nameValue: string;
  valueColumn: string;
  imageColumn?: string; // Kept for compatibility but now auto-mapped
}

interface AttributeConfigCardProps {
  config: AttributeConfig;
  index: number;
  availableColumns: string[];
  rawData: string[][];
  headers: string[];
  imageColumnName?: string; // The main image column from mapping
  onUpdate: (id: string, updates: Partial<AttributeConfig>) => void;
  onRemove: (id: string) => void;
}

// Valid image extensions and CDN domains
const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
const KNOWN_IMAGE_CDNS = ['alicdn.com', 'aliexpress.com', 'cbu01.alicdn.com', '1688.com', 'cloudinary.com', 'imgur.com', 'unsplash.com'];

const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return false;
  
  // Check if it's a valid URL structure (starts with http or https)
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return false;
  }
  
  try {
    const urlObj = new URL(trimmedUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    // If it's from a known image CDN, consider it valid
    if (KNOWN_IMAGE_CDNS.some(cdn => hostname.includes(cdn))) {
      return true;
    }
    
    // Check if pathname contains image-related paths
    if (pathname.includes('/img/') || pathname.includes('/image/') || pathname.includes('/images/') || pathname.includes('/ibank/')) {
      return true;
    }
    
    // Check for valid image extensions
    const cleanPathname = pathname.split('?')[0]; // Remove query string
    if (VALID_IMAGE_EXTENSIONS.some(ext => cleanPathname.endsWith(`.${ext}`))) {
      return true;
    }
    
    return false;
  } catch {
    // If URL parsing fails, check for image extensions in the string
    const lowerUrl = trimmedUrl.toLowerCase();
    return VALID_IMAGE_EXTENSIONS.some(ext => lowerUrl.includes(`.${ext}`));
  }
};

const getAttributeIcon = (type: string) => {
  const lower = (type || '').toLowerCase();
  if (lower.includes('color') || lower.includes('colour')) return <Palette className="h-4 w-4 text-pink-500" />;
  if (lower.includes('size') || lower.includes('talla')) return <Ruler className="h-4 w-4 text-blue-500" />;
  if (lower.includes('volt') || lower.includes('watt') || lower.includes('power')) return <Zap className="h-4 w-4 text-yellow-500" />;
  return <Package className="h-4 w-4 text-muted-foreground" />;
};

const getIconBgColor = (type: string) => {
  const lower = (type || '').toLowerCase();
  if (lower.includes('color') || lower.includes('colour')) return 'bg-pink-100 dark:bg-pink-900/30';
  if (lower.includes('size') || lower.includes('talla')) return 'bg-blue-100 dark:bg-blue-900/30';
  if (lower.includes('volt') || lower.includes('watt') || lower.includes('power')) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-muted';
};

export const AttributeConfigCard = ({
  config,
  index,
  availableColumns,
  rawData,
  headers,
  imageColumnName,
  onUpdate,
  onRemove,
}: AttributeConfigCardProps) => {
  const [pendingColumn, setPendingColumn] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const openNameModal = (column: string) => {
    setPendingColumn(column);
    // Pre-fill with current manual name, or the column name, or existing valueColumn name
    const prefill =
      config.nameType === 'manual' && config.nameValue?.trim()
        ? config.nameValue
        : column;
    setTempName(prefill);
  };

  const confirmColumnSelection = () => {
    if (!pendingColumn) return;
    onUpdate(config.id, {
      valueColumn: pendingColumn,
      nameType: 'manual',
      nameValue: tempName.trim() || pendingColumn,
    });
    setPendingColumn(null);
    setTempName('');
  };

  const cancelColumnSelection = () => {
    setPendingColumn(null);
    setTempName('');
  };

  // Preview data for the pending column inside the modal
  const pendingPreview = useMemo(() => {
    if (!pendingColumn) return { count: 0, sample: '', uniqueValues: [] as string[] };
    const idx = headers.indexOf(pendingColumn);
    if (idx === -1) return { count: 0, sample: '', uniqueValues: [] as string[] };
    const set = new Set<string>();
    rawData.forEach(row => {
      const v = row[idx]?.trim();
      if (v && v.toLowerCase() !== 'n/a') set.add(v);
    });
    const vals = Array.from(set);
    return { count: vals.length, sample: vals.slice(0, 3).join(', '), uniqueValues: vals };
  }, [pendingColumn, headers, rawData]);

  // Get unique values with their corresponding image URLs from the same row
  const valueImagePairs = useMemo(() => {
    if (!config.valueColumn) return [];
    const valueColIndex = headers.indexOf(config.valueColumn);
    const imageColIndex = imageColumnName ? headers.indexOf(imageColumnName) : -1;
    
    if (valueColIndex === -1) return [];
    
    // Map: value -> first image found for that value
    const valueToImage = new Map<string, string>();
    
    rawData.forEach((row) => {
      const val = row[valueColIndex]?.trim();
      if (val && val !== '' && val.toLowerCase() !== 'n/a') {
        // Only set image if we haven't seen this value before (first occurrence wins)
        if (!valueToImage.has(val)) {
          if (imageColIndex !== -1) {
            const imgUrl = row[imageColIndex]?.trim();
            
            if (imgUrl && isValidImageUrl(imgUrl)) {
              valueToImage.set(val, imgUrl);
            } else {
              valueToImage.set(val, ''); // Mark as seen but no valid image
            }
          } else {
            valueToImage.set(val, '');
          }
        }
      }
    });
    
    return Array.from(valueToImage.entries()).map(([value, imageUrl]) => ({
      value,
      imageUrl,
    }));
  }, [config.valueColumn, headers, rawData, imageColumnName]);

  const columnPreviews = useMemo(() => {
    const out: Record<string, { count: number; sample: string }> = {};
    availableColumns.forEach(col => {
      const idx = headers.indexOf(col);
      if (idx === -1) return;
      const set = new Set<string>();
      rawData.forEach(row => {
        const v = row[idx]?.trim();
        if (v && v.toLowerCase() !== 'n/a') set.add(v);
      });
      const vals = Array.from(set);
      out[col] = { count: vals.length, sample: vals.slice(0, 3).join(', ') };
    });
    return out;
  }, [availableColumns, headers, rawData]);

  const uniqueValues = valueImagePairs.map(p => p.value);

  const valuesWithImages = valueImagePairs.filter(p => p.imageUrl).length;

  const displayName = config.nameType === 'manual' ? config.nameValue : config.valueColumn;

  return (
    <Card className="border-2 border-dashed hover:border-solid transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              getIconBgColor(displayName || '')
            )}>
              {getAttributeIcon(displayName || '')}
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                Atributo {index + 1}: {displayName || 'Sin configurar'}
              </CardTitle>
              {uniqueValues.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {uniqueValues.length} valores únicos encontrados
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(config.id)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* STEP 1: Which column holds the variant values */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
            <Label className="text-sm font-semibold">¿Qué columna contiene esta variante?</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-7">
            Elige la columna del Excel con los valores (ej. Rojo, Verde, S, M, L).
          </p>

          <div className="pl-7">
            <Select
              value={config.valueColumn}
              onValueChange={(value) => {
                openNameModal(value);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Seleccionar columna..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {availableColumns.map(col => {
                  const preview = columnPreviews[col];
                  return (
                    <SelectItem key={col} value={col}>
                      <span className="flex flex-col items-start">
                        <span className="flex items-center gap-2 font-medium">
                          {getAttributeIcon(col)}
                          {col}
                        </span>
                        {preview?.sample && (
                          <span className="text-[11px] text-muted-foreground">
                            {preview.count} valores · {preview.sample}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {config.valueColumn && uniqueValues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uniqueValues.slice(0, 6).map(v => (
                  <Badge key={v} variant="secondary" className="text-[11px] font-normal">{v}</Badge>
                ))}
                {uniqueValues.length > 6 && (
                  <Badge variant="outline" className="text-[11px] font-normal">+{uniqueValues.length - 6}</Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: Display name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
            <Label className="text-sm font-semibold">¿Cómo se llamará para los compradores?</Label>
          </div>
          <div className="pl-7 space-y-2">
            <div className="flex gap-2">
              <Input
                value={config.nameType === 'column' ? config.valueColumn : config.nameValue}
                onChange={(e) => onUpdate(config.id, { nameType: 'manual', nameValue: e.target.value })}
                placeholder="Ej: Color, Talla, Material..."
                className="h-10"
              />
              {config.valueColumn && config.nameType !== 'column' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 whitespace-nowrap"
                  onClick={() => onUpdate(config.id, { nameType: 'column', nameValue: config.valueColumn })}
                >
                  <Tag className="h-3.5 w-3.5 mr-1" />
                  Usar nombre de la columna
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {config.nameType === 'column'
                ? `Se usará el nombre de la columna: "${config.valueColumn}". Escribe encima para personalizarlo.`
                : 'Este es el nombre que verán los compradores en la ficha del producto.'}
            </p>
          </div>
        </div>


        {/* SECTION 3: Auto-mapped Images Preview */}
        {config.valueColumn && valueImagePairs.length > 0 && (
          <div className="space-y-3 p-3 border rounded-lg bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-green-600" />
                <Label className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                  Imágenes Asociadas Automáticamente
                </Label>
              </div>
              {valuesWithImages > 0 && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {valuesWithImages} de {uniqueValues.length} con imagen
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Cada valor se asocia con la imagen de su fila en el Excel 
              {imageColumnName && <span className="font-medium"> (columna: {imageColumnName})</span>}
            </p>

            {/* Preview grid of values with their images */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
              {valueImagePairs.slice(0, 8).map(({ value, imageUrl }) => (
                <div 
                  key={value} 
                  className="flex items-center gap-2 p-2 rounded-md bg-background border"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={value}
                      className="w-8 h-8 rounded object-cover border shadow-sm flex-shrink-0"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="text-xs font-medium truncate">{value}</span>
                </div>
              ))}
            </div>
            
            {valueImagePairs.length > 8 && (
              <p className="text-xs text-muted-foreground text-center">
                +{valueImagePairs.length - 8} valores más...
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Name confirmation modal that opens right after selecting a column */}
      <Dialog open={!!pendingColumn} onOpenChange={(open) => { if (!open) cancelColumnSelection(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {index + 1}
              </span>
              Confirmar nombre de la variante
            </DialogTitle>
            <DialogDescription>
              Revisa los valores de la columna seleccionada y escribe el nombre que verán los compradores.
            </DialogDescription>
          </DialogHeader>

          {pendingColumn && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {getAttributeIcon(pendingColumn)}
                  Columna seleccionada: <span className="font-semibold">{pendingColumn}</span>
                </div>
                {pendingPreview.sample && (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingPreview.uniqueValues.slice(0, 6).map(v => (
                      <Badge key={v} variant="secondary" className="text-[11px] font-normal">{v}</Badge>
                    ))}
                    {pendingPreview.uniqueValues.length > 6 && (
                      <Badge variant="outline" className="text-[11px] font-normal">+{pendingPreview.uniqueValues.length - 6}</Badge>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {pendingPreview.count} {pendingPreview.count === 1 ? 'valor único encontrado' : 'valores únicos encontrados'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`attr-name-${config.id}`} className="text-sm font-semibold">
                  Nombre visible para los compradores
                </Label>
                <Input
                  id={`attr-name-${config.id}`}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Ej: Color, Talla, Material..."
                  className="h-10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmColumnSelection();
                    if (e.key === 'Escape') cancelColumnSelection();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Puedes personalizarlo o dejar el nombre de la columna.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={cancelColumnSelection}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmColumnSelection} disabled={!tempName.trim()}>
              <Check className="h-4 w-4 mr-1.5" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AttributeConfigCard;
