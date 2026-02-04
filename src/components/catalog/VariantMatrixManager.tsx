import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, X, Upload, Trash2, Image as ImageIcon, 
  Palette, Ruler, Package, Zap, RefreshCw, Eye, Save, Loader2, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAllProductVariants, ProductVariant } from '@/hooks/useProductVariants';
import { useVariantManagement } from '@/hooks/useVariantManagement';
import { useToast } from '@/hooks/use-toast';
import { useCatalog } from '@/hooks/useCatalog';

interface VariantMatrixManagerProps {
  // For editing existing products
  productId?: string;
  productSku?: string;
  basePrice?: number;
  productImage?: string | null;
  // For creating new products (standalone mode)
  baseSku?: string;
  productName?: string;
  existingVariants?: VariantMatrixItem[];
  onVariantsChange?: (variants: VariantMatrixItem[]) => void;
}

interface AttributeDefinition {
  id: string;
  name: string;
  displayName: string;
  type: 'color' | 'size' | 'text' | 'select';
  values: string[];
}

interface VariantMatrixItem {
  id?: string;
  sku: string;
  attributeValues: Record<string, string>;
  price: number;
  priceAdjustment: number;
  stock: number;
  imageUrl: string;
  imageFile?: File;
  isNew?: boolean;
  isModified?: boolean;
}

// Common attribute presets
const ATTRIBUTE_PRESETS: Record<string, { displayName: string; icon: typeof Palette; values: string[] }> = {
  color: { 
    displayName: 'Color', 
    icon: Palette, 
    values: ['Rojo', 'Azul', 'Negro', 'Blanco', 'Rosa', 'Verde', 'Amarillo', 'Beige', 'Champagne']
  },
  size: { 
    displayName: 'Talla', 
    icon: Ruler, 
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '110', '120', '130', '140', '150']
  },
  age: { 
    displayName: 'Edad', 
    icon: Ruler, 
    values: ['4T', '5T', '6T', '8T', '10T', '12T']
  },
  voltage: { 
    displayName: 'Voltaje', 
    icon: Zap, 
    values: ['110V', '220V', '12V', '24V']
  },
  watts: { 
    displayName: 'Potencia', 
    icon: Zap, 
    values: ['50W', '100W', '150W', '200W', '500W']
  },
};

const VariantMatrixManager = ({
  productId,
  productSku,
  basePrice = 0,
  productImage,
  baseSku,
  productName,
  existingVariants = [],
  onVariantsChange,
}: VariantMatrixManagerProps) => {
  const { toast } = useToast();
  const { uploadImage } = useCatalog();
  
  // DB integration for existing products
  const { data: dbVariants = [], isLoading: loadingVariants, refetch } = useAllProductVariants(productId);
  const variantManagement = useVariantManagement(productId || '');
  
  const isEditMode = !!productId;
  const effectiveSku = productSku || baseSku || 'NEW';
  const effectivePrice = basePrice || 0;

  // State for attribute definitions
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [activeAttributeId, setActiveAttributeId] = useState<string | null>(null);

  // Generated variants from attribute combinations
  const [variants, setVariants] = useState<VariantMatrixItem[]>(existingVariants);
  const [saving, setSaving] = useState(false);
  
  // Preview state
  const [previewVariant, setPreviewVariant] = useState<VariantMatrixItem | null>(null);

  // Extract attributes from existing DB variants
  useEffect(() => {
    if (isEditMode && dbVariants.length > 0) {
      // Parse attribute_combination from DB variants to build attributes
      const detectedAttrs: Record<string, Set<string>> = {};
      
      dbVariants.forEach(v => {
        const combo = (v as any).attribute_combination as Record<string, string> | null;
        if (combo && typeof combo === 'object') {
          Object.entries(combo).forEach(([key, value]) => {
            if (!detectedAttrs[key]) detectedAttrs[key] = new Set();
            if (value) detectedAttrs[key].add(value);
          });
        }
        // Also use option_type/option_value as fallback
        if (v.option_type && v.option_value) {
          if (!detectedAttrs[v.option_type]) detectedAttrs[v.option_type] = new Set();
          detectedAttrs[v.option_type].add(v.option_value);
        }
      });

      const newAttrs: AttributeDefinition[] = Object.entries(detectedAttrs).map(([name, values], idx) => ({
        id: `attr-${idx}`,
        name,
        displayName: ATTRIBUTE_PRESETS[name]?.displayName || name,
        type: name === 'color' ? 'color' : 'text',
        values: Array.from(values),
      }));

      setAttributes(newAttrs);

      // Convert DB variants to matrix items
      const matrixItems: VariantMatrixItem[] = dbVariants.map(v => {
        const combo = (v as any).attribute_combination as Record<string, string> | null;
        const images = Array.isArray(v.images) ? v.images : [];
        return {
          id: v.id,
          sku: v.sku,
          attributeValues: combo || { [v.option_type]: v.option_value },
          price: v.price || effectivePrice,
          priceAdjustment: (v.price || effectivePrice) - effectivePrice,
          stock: v.stock,
          imageUrl: images[0] || '',
        };
      });

      setVariants(matrixItems);
    }
  }, [dbVariants, isEditMode, effectivePrice]);

  // Add a new attribute type
  const addAttribute = useCallback((name: string) => {
    const preset = ATTRIBUTE_PRESETS[name.toLowerCase()];
    const newAttr: AttributeDefinition = {
      id: `attr-${Date.now()}`,
      name: name.toLowerCase(),
      displayName: preset?.displayName || name,
      type: name.toLowerCase() === 'color' ? 'color' : 'text',
      values: [],
    };
    setAttributes(prev => [...prev, newAttr]);
    setActiveAttributeId(newAttr.id);
    setNewAttributeName('');
  }, []);

  // Add value to an attribute
  const addAttributeValue = useCallback((attrId: string, value: string) => {
    setAttributes(prev => prev.map(attr => 
      attr.id === attrId 
        ? { ...attr, values: [...attr.values, value] }
        : attr
    ));
    setNewAttributeValue('');
  }, []);

  // Remove value from an attribute
  const removeAttributeValue = useCallback((attrId: string, value: string) => {
    setAttributes(prev => prev.map(attr =>
      attr.id === attrId
        ? { ...attr, values: attr.values.filter(v => v !== value) }
        : attr
    ));
  }, []);

  // Remove an attribute entirely
  const removeAttribute = useCallback((attrId: string) => {
    setAttributes(prev => prev.filter(attr => attr.id !== attrId));
    if (activeAttributeId === attrId) {
      setActiveAttributeId(null);
    }
  }, [activeAttributeId]);

  // Generate all variant combinations
  const generateVariants = useCallback(() => {
    if (attributes.length === 0) {
      setVariants([]);
      onVariantsChange?.([]);
      return;
    }

    const generateCombinations = (attrs: AttributeDefinition[]): Record<string, string>[] => {
      if (attrs.length === 0) return [{}];
      
      const [first, ...rest] = attrs;
      const restCombos = generateCombinations(rest);
      
      const result: Record<string, string>[] = [];
      first.values.forEach(value => {
        restCombos.forEach(combo => {
          result.push({ ...combo, [first.name]: value });
        });
      });
      
      return result;
    };

    const combinations = generateCombinations(attributes);
    
    const newVariants: VariantMatrixItem[] = combinations.map((combo) => {
      const variantLabel = Object.values(combo).join('-');
      const existingVariant = variants.find(v => 
        JSON.stringify(v.attributeValues) === JSON.stringify(combo)
      );
      
      return {
        id: existingVariant?.id,
        sku: existingVariant?.sku || `${effectiveSku}-${variantLabel.toUpperCase().replace(/\s+/g, '')}`,
        attributeValues: combo,
        price: existingVariant?.price ?? effectivePrice,
        priceAdjustment: existingVariant?.priceAdjustment ?? 0,
        stock: existingVariant?.stock ?? 0,
        imageUrl: existingVariant?.imageUrl ?? '',
        isNew: !existingVariant?.id,
      };
    });

    setVariants(newVariants);
    onVariantsChange?.(newVariants);
  }, [attributes, effectiveSku, effectivePrice, variants, onVariantsChange]);

  // Update a single variant
  const updateVariant = useCallback((sku: string, updates: Partial<VariantMatrixItem>) => {
    setVariants(prev => {
      const updated = prev.map(v => v.sku === sku ? { ...v, ...updates, isModified: true } : v);
      onVariantsChange?.(updated);
      return updated;
    });
  }, [onVariantsChange]);

  // Handle image file upload
  const handleImageUpload = async (file: File, variantSku: string) => {
    if (!productId) {
      // Local preview for new products
      const previewUrl = URL.createObjectURL(file);
      updateVariant(variantSku, { imageUrl: previewUrl, imageFile: file });
      return;
    }

    try {
      const url = await uploadImage(file, productId);
      updateVariant(variantSku, { imageUrl: url });
      toast({ title: 'Imagen subida' });
    } catch (error) {
      toast({ title: 'Error al subir imagen', variant: 'destructive' });
    }
  };

  // Save all variants to database
  const saveVariants = async () => {
    if (!productId) return;

    setSaving(true);
    try {
      for (const variant of variants) {
        const attributeCombination: Record<string, string> = {};
        Object.entries(variant.attributeValues).forEach(([key, value]) => {
          attributeCombination[key] = value;
        });

        const variantData = {
          product_id: productId,
          sku: variant.sku,
          name: Object.values(variant.attributeValues).join(' / '),
          option_type: Object.keys(variant.attributeValues)[0] || 'variant',
          option_value: Object.values(variant.attributeValues)[0] || variant.sku,
          price: variant.price,
          stock: variant.stock,
          images: variant.imageUrl ? [variant.imageUrl] : [],
          attribute_combination: attributeCombination,
        };

        if (variant.id) {
          // Update existing
          await variantManagement.updateVariant.mutateAsync({
            id: variant.id,
            updates: variantData,
          });
        } else {
          // Create new
          await variantManagement.createVariant.mutateAsync(variantData);
        }
      }

      toast({ title: 'Variantes guardadas' });
      refetch();
    } catch (error) {
      toast({ title: 'Error al guardar variantes', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Delete a variant
  const handleDeleteVariant = async (variant: VariantMatrixItem) => {
    if (variant.id && productId) {
      await variantManagement.deleteVariant.mutateAsync(variant.id);
    }
    setVariants(prev => prev.filter(v => v.sku !== variant.sku));
  };

  // Get icon for attribute type
  const getAttributeIcon = (name: string) => {
    const preset = ATTRIBUTE_PRESETS[name.toLowerCase()];
    const Icon = preset?.icon || Package;
    return <Icon className="h-4 w-4" />;
  };

  // Suggested values for active attribute
  const suggestedValues = useMemo(() => {
    if (!activeAttributeId) return [];
    const attr = attributes.find(a => a.id === activeAttributeId);
    if (!attr) return [];
    const preset = ATTRIBUTE_PRESETS[attr.name];
    if (!preset) return [];
    return preset.values.filter(v => !attr.values.includes(v));
  }, [activeAttributeId, attributes]);

  if (loadingVariants) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerta informativa */}
      {isEditMode && (
        <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Las variantes se guardan de forma independiente. Después de configurar tus variantes, 
            presiona el botón <strong>"Guardar"</strong> en la sección de "Configurar Variantes" (paso 3).
          </AlertDescription>
        </Alert>
      )}

      {/* Step 1: Define Attributes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
            Definir Atributos de Variantes
          </CardTitle>
          <CardDescription>
            Agrega los tipos de variantes (Color, Talla, Modelo, etc.) y sus valores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Attributes */}
          {attributes.map(attr => (
            <div 
              key={attr.id} 
              className={cn(
                "p-4 rounded-lg border transition-all cursor-pointer",
                activeAttributeId === attr.id 
                  ? "border-primary bg-primary/5" 
                  : "border-border bg-muted/30"
              )}
              onClick={() => setActiveAttributeId(attr.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getAttributeIcon(attr.name)}
                  <span className="font-medium">{attr.displayName}</span>
                  <Badge variant="secondary" className="text-xs">{attr.values.length} valores</Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeAttribute(attr.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Values chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {attr.values.map(value => (
                  <Badge 
                    key={value} 
                    variant="outline"
                    className="pl-2 pr-1 py-1 flex items-center gap-1"
                  >
                    {attr.type === 'color' && (
                      <span 
                        className="w-3 h-3 rounded-full border border-border mr-1"
                        style={{ backgroundColor: getColorHex(value) || '#ccc' }}
                      />
                    )}
                    {value}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeAttributeValue(attr.id, value); }}
                      className="ml-1 p-0.5 rounded hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* Add value input */}
              {activeAttributeId === attr.id && (
                <div className="flex gap-2">
                  <Input
                    placeholder={`Agregar valor (ej: ${ATTRIBUTE_PRESETS[attr.name]?.values[0] || 'valor'})`}
                    value={newAttributeValue}
                    onChange={(e) => setNewAttributeValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAttributeValue.trim()) {
                        e.preventDefault();
                        addAttributeValue(attr.id, newAttributeValue.trim());
                      }
                    }}
                    className="flex-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (newAttributeValue.trim()) {
                        addAttributeValue(attr.id, newAttributeValue.trim());
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Suggested values */}
              {activeAttributeId === attr.id && suggestedValues.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Sugerencias:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedValues.slice(0, 6).map(val => (
                      <Badge 
                        key={val}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={(e) => { e.stopPropagation(); addAttributeValue(attr.id, val); }}
                      >
                        + {val}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new attribute */}
          <div className="flex gap-2">
            <Input
              placeholder="Nombre del atributo (ej: Color, Talla, Modelo)"
              value={newAttributeName}
              onChange={(e) => setNewAttributeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newAttributeName.trim()) {
                  addAttribute(newAttributeName.trim());
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (newAttributeName.trim()) {
                  addAttribute(newAttributeName.trim());
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Atributo
            </Button>
          </div>

          {/* Quick add buttons */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(ATTRIBUTE_PRESETS)
              .filter(([name]) => !attributes.some(a => a.name === name))
              .slice(0, 4)
              .map(([name, preset]) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => addAttribute(name)}
                >
                  <preset.icon className="h-3 w-3 mr-1" />
                  + {preset.displayName}
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Generate Variants */}
      {attributes.length > 0 && attributes.some(a => a.values.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                Generar Matriz de Variantes
              </CardTitle>
              <Button onClick={generateVariants} size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Generar
              </Button>
            </div>
            <CardDescription>
              {(() => {
                const totalCombinations = attributes.reduce((acc, attr) => 
                  acc * (attr.values.length || 1), 1);
                return `Se generarán ${totalCombinations} combinaciones de variantes`;
              })()}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Step 3: Variant Matrix Table */}
      {variants.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                Configurar Variantes
                <Badge variant="secondary">{variants.length} variantes</Badge>
              </CardTitle>
              {isEditMode && (
                <Button onClick={saveVariants} size="sm" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar
                </Button>
              )}
            </div>
            <CardDescription>
              Asigna stock, precio e imagen específica a cada combinación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground p-2 bg-muted/50 rounded-md sticky top-0 z-10">
                  <div className="col-span-3">Variante</div>
                  <div className="col-span-2">SKU</div>
                  <div className="col-span-2">Precio</div>
                  <div className="col-span-2">Stock</div>
                  <div className="col-span-2">Imagen</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Rows */}
                {variants.map(variant => (
                  <div 
                    key={variant.sku}
                    className={cn(
                      "grid grid-cols-12 gap-2 items-center p-2 rounded-md border transition-all",
                      previewVariant?.sku === variant.sku 
                        ? "border-primary bg-primary/5" 
                        : "border-border/50 hover:border-border"
                    )}
                    onClick={() => setPreviewVariant(variant)}
                  >
                    {/* Variant label */}
                    <div className="col-span-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(variant.attributeValues).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* SKU */}
                    <div className="col-span-2">
                      <Input
                        value={variant.sku}
                        onChange={(e) => updateVariant(variant.sku, { sku: e.target.value })}
                        className="h-8 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Price */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={variant.price}
                          onChange={(e) => updateVariant(variant.sku, { 
                            price: parseFloat(e.target.value) || 0,
                            priceAdjustment: (parseFloat(e.target.value) || 0) - effectivePrice
                          })}
                          className="h-8 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    {/* Stock */}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        value={variant.stock}
                        onChange={(e) => updateVariant(variant.sku, { stock: parseInt(e.target.value) || 0 })}
                        className="h-8 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Image */}
                    <div className="col-span-2 flex items-center gap-1">
                      {variant.imageUrl ? (
                        <div className="relative w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                          <img 
                            src={variant.imageUrl} 
                            alt={variant.sku}
                            className="w-full h-full object-cover"
                          />
                          <button
                            className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateVariant(variant.sku, { imageUrl: '' });
                            }}
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-8 h-8 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors flex-shrink-0">
                          <Upload className="h-3 w-3 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              e.stopPropagation();
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file, variant.sku);
                            }}
                          />
                        </label>
                      )}
                      <Input
                        placeholder="URL"
                        value={variant.imageUrl}
                        onChange={(e) => updateVariant(variant.sku, { imageUrl: e.target.value })}
                        className="h-8 text-xs flex-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVariant(variant);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {previewVariant && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Previsualización Dinámica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {previewVariant.imageUrl ? (
                  <img 
                    src={previewVariant.imageUrl} 
                    alt={previewVariant.sku}
                    className="w-full h-full object-cover"
                  />
                ) : productImage ? (
                  <img 
                    src={productImage} 
                    alt="Product"
                    className="w-full h-full object-cover opacity-50"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{productName || productSku || 'Producto'}</h4>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(previewVariant.attributeValues).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">SKU:</span> {previewVariant.sku}</p>
                  <p><span className="text-muted-foreground">Precio:</span> <span className="font-bold text-primary">${previewVariant.price.toFixed(2)}</span></p>
                  <p><span className="text-muted-foreground">Stock:</span> {previewVariant.stock} unidades</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Helper function to convert color names to hex
function getColorHex(colorName: string): string | null {
  const colorMap: Record<string, string> = {
    rojo: '#EF4444', red: '#EF4444',
    azul: '#3B82F6', blue: '#3B82F6',
    negro: '#000000', black: '#000000',
    blanco: '#FFFFFF', white: '#FFFFFF',
    rosa: '#EC4899', pink: '#EC4899',
    verde: '#22C55E', green: '#22C55E',
    amarillo: '#EAB308', yellow: '#EAB308',
    beige: '#D4B896',
    champagne: '#F7E7CE',
    naranja: '#F97316', orange: '#F97316',
    morado: '#A855F7', purple: '#A855F7',
    gris: '#6B7280', grey: '#6B7280', gray: '#6B7280',
    dorado: '#FFD700', gold: '#FFD700',
    plateado: '#C0C0C0', silver: '#C0C0C0',
  };
  return colorMap[colorName.toLowerCase()] || null;
}

export default VariantMatrixManager;
