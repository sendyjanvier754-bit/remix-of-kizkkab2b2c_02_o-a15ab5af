import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Package, Palette, Check, Ruler, AlertCircle, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttributeCombination } from "@/types/b2b";

interface VariantInfo {
  id: string;
  sku: string;
  label: string;
  precio: number; // Deprecado - usar precio_b2b_final
  precio_b2b_final?: number; // ✅ Precio correcto desde vista
  stock: number;
  option_type?: string;
  parent_product_id?: string;
  attribute_combination?: AttributeCombination;
  images?: string[];
  image_url?: string;
}

interface VariantOption {
  productId: string;
  label: string;
  code?: string;
  image?: string;
  price: number;
  stock: number;
  type?: string;
}

interface VariantSelection {
  variantId: string;
  sku: string;
  label: string;
  quantity: number;
  price: number;
  colorLabel?: string;
}

interface VariantsByType {
  [type: string]: VariantOption[];
}

interface VariantSelectorB2BProps {
  productId?: string;
  variants: VariantInfo[];
  variantOptions?: VariantOption[];
  variantsByType?: VariantsByType;
  variantTypes?: string[];
  variantType?: string;
  colorOptions?: VariantOption[];
  basePrice: number;
  baseImage?: string;
  /**
   * Prefill quantities (e.g., existing quantities already in cart).
   * Keys are variant IDs.
   */
  initialQuantities?: Record<string, number>;
  onSelectionChange?: (selections: VariantSelection[], totalQty: number, totalPrice: number) => void;
  onVariantImageChange?: (imageUrl: string | null) => void;
}

// Attribute type display configuration
const ATTRIBUTE_CONFIG: Record<string, { icon: typeof Palette; displayName: string; order: number }> = {
  color: { icon: Palette, displayName: 'Color', order: 1 },
  size: { icon: Ruler, displayName: 'Talla', order: 2 },
  talla: { icon: Ruler, displayName: 'Talla', order: 2 },
  age: { icon: Ruler, displayName: 'Edad', order: 3 },
};

// Normalize attribute key to canonical type
const normalizeAttributeType = (key: string): string => {
  const lower = key.toLowerCase();
  if (lower.includes('color')) return 'color';
  if (lower.includes('talla') || lower.includes('size')) return 'size';
  if (lower.includes('age') || lower.includes('edad')) return 'age';
  return key;
};

// Parse color string to hex
const getColorHex = (colorName: string): string | null => {
  const colorMap: Record<string, string> = {
    champagne: '#F7E7CE',
    white: '#FFFFFF',
    black: '#000000',
    red: '#EF4444',
    blue: '#3B82F6',
    green: '#22C55E',
    yellow: '#EAB308',
    pink: '#EC4899',
    purple: '#A855F7',
    orange: '#F97316',
    beige: '#D4B896',
    brown: '#8B4513',
    navy: '#1E3A5A',
    gray: '#6B7280',
    grey: '#6B7280',
    gold: '#FFD700',
    silver: '#C0C0C0',
    cream: '#FFFDD0',
    coral: '#FF7F50',
    lavender: '#E6E6FA',
    wine: '#722F37',
    apricot: '#FBCEB1',
    sky: '#87CEEB',
    coffee: '#6F4E37',
    mocha: '#967259',
  };
  return colorMap[colorName.toLowerCase()] || null;
};

/**
 * VariantSelectorB2B - EAV-aware variant selector
 * Shows interdependent selectors for color, size, age based on attribute_combination
 * Updates parent component with variant-specific image when selection changes
 */
const VariantSelectorB2B = ({
  variants,
  variantsByType: propVariantsByType,
  variantTypes: propVariantTypes,
  basePrice,
  baseImage,
  initialQuantities,
  onSelectionChange,
  onVariantImageChange,
}: VariantSelectorB2BProps) => {
  // Selected values for each attribute type
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  // Quantities per variant
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Prefill quantities from cart when opening the selector
  useEffect(() => {
    if (!initialQuantities) return;
    setQuantities(initialQuantities);
  }, [initialQuantities]);

  // Extract unique values for each attribute type from all variants
  const attributeOptions = useMemo(() => {
    const options: Record<string, Set<string>> = {};
    
    variants.forEach(variant => {
      const combo = variant.attribute_combination || {};
      Object.entries(combo).forEach(([key, value]) => {
        if (value) {
          if (!options[key]) {
            options[key] = new Set();
          }
          options[key].add(value);
        }
      });
    });
    
    // Convert to sorted arrays
    const result: Record<string, string[]> = {};
    Object.entries(options).forEach(([key, valueSet]) => {
      result[key] = Array.from(valueSet).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
      });
    });
    
    return result;
  }, [variants]);

  // Build attribute-value-to-image map from variants
  const attributeImageMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    
    variants.forEach(variant => {
      const combo = variant.attribute_combination || {};
      const variantImage = variant.image_url || variant.images?.[0];
      
      if (variantImage) {
        Object.entries(combo).forEach(([attrKey, attrValue]) => {
          if (attrValue) {
            if (!map[attrKey]) map[attrKey] = {};
            // Only set if not already set (keep first found image)
            if (!map[attrKey][attrValue]) {
              map[attrKey][attrValue] = variantImage;
            }
          }
        });
      }
    });
    
    return map;
  }, [variants]);

  // Get ordered list of attribute types
  const orderedAttributeTypes = useMemo(() => {
    const types = Object.keys(attributeOptions);
    return types.sort((a, b) => {
      const orderA = ATTRIBUTE_CONFIG[a]?.order || 99;
      const orderB = ATTRIBUTE_CONFIG[b]?.order || 99;
      return orderA - orderB;
    });
  }, [attributeOptions]);

  // Filter available options based on current selections
  const getAvailableOptions = useCallback((forType: string): string[] => {
    const allOptions = attributeOptions[forType] || [];
    
    // Get other selected attributes (excluding this type)
    const otherSelections = { ...selectedAttributes };
    delete otherSelections[forType];
    
    // If no other selections, all options are available
    if (Object.keys(otherSelections).length === 0) {
      return allOptions;
    }
    
    // Filter variants that match other selections
    const matchingVariants = variants.filter(variant => {
      const combo = variant.attribute_combination || {};
      return Object.entries(otherSelections).every(([key, value]) => {
        return combo[key] === value;
      });
    });
    
    // Get unique values for this type from matching variants
    const available = new Set<string>();
    matchingVariants.forEach(variant => {
      const value = variant.attribute_combination?.[forType];
      if (value) {
        available.add(value);
      }
    });
    
    return Array.from(available);
  }, [attributeOptions, selectedAttributes, variants]);

  // Get stock for a specific attribute option
  const getOptionStock = useCallback((type: string, value: string): number => {
    return variants
      .filter(v => v.attribute_combination?.[type] === value)
      .reduce((sum, v) => sum + v.stock, 0);
  }, [variants]);

  // Find matching variant based on all selected attributes
  const matchingVariant = useMemo(() => {
    if (Object.keys(selectedAttributes).length !== orderedAttributeTypes.length) {
      return null;
    }
    
    return variants.find(variant => {
      const combo = variant.attribute_combination || {};
      return Object.entries(selectedAttributes).every(([key, value]) => combo[key] === value);
    });
  }, [selectedAttributes, orderedAttributeTypes, variants]);

  // Notify parent of variant image change
  useEffect(() => {
    if (onVariantImageChange) {
      const variantImage = matchingVariant?.image_url || matchingVariant?.images?.[0] || null;
      onVariantImageChange(variantImage);
    }
  }, [matchingVariant, onVariantImageChange]);

  // Handle attribute selection
  const handleSelectAttribute = (type: string, value: string) => {
    setSelectedAttributes(prev => {
      const newSelections = { ...prev, [type]: value };
      
      // Clear selections for types that come after this one
      const typeIndex = orderedAttributeTypes.indexOf(type);
      orderedAttributeTypes.forEach((t, idx) => {
        if (idx > typeIndex) {
          delete newSelections[t];
        }
      });
      
      return newSelections;
    });
  };

  // Handle quantity change
  const handleQuantityChange = (variantId: string, delta: number, maxStock: number) => {
    setQuantities(prev => {
      const current = prev[variantId] || 0;
      const newQty = Math.max(0, Math.min(maxStock, current + delta));
      return { ...prev, [variantId]: newQty };
    });
  };

  // Calculate totals
  const totalQty = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = useMemo(() => {
    return Object.entries(quantities).reduce((sum, [variantId, qty]) => {
      if (qty <= 0) return sum;
      const variant = variants.find(v => v.id === variantId);
      // ✅ Usar precio_b2b_final (desde vista) en lugar de precio
      return sum + (variant?.precio_b2b_final || variant?.precio || basePrice) * qty;
    }, 0);
  }, [quantities, variants, basePrice]);

  // Notify parent of changes
  useEffect(() => {
    if (onSelectionChange) {
      const initialKeys = initialQuantities ? Object.keys(initialQuantities) : [];
      const keys = new Set<string>([...Object.keys(quantities), ...initialKeys]);

      const selections: VariantSelection[] = Array.from(keys)
        .map((variantId) => {
          const quantity = quantities[variantId] ?? 0;
          const hadInitial = (initialQuantities?.[variantId] ?? 0) > 0;
          if (quantity <= 0 && !hadInitial) return null;

          const variant = variants.find(v => v.id === variantId);
          if (!variant) return null;

          return {
            variantId,
            sku: variant.sku,
            label: variant.label,
            quantity,
            // ✅ Usar precio_b2b_final (desde vista) en lugar de precio
            price: variant.precio_b2b_final || variant.precio || basePrice,
          };
        })
        .filter(Boolean) as VariantSelection[];

      onSelectionChange(selections, totalQty, totalPrice);
    }
  }, [quantities, totalQty, totalPrice, variants, basePrice, onSelectionChange, initialQuantities]);

  // Auto-select first option for each type on mount
  useEffect(() => {
    if (orderedAttributeTypes.length > 0 && Object.keys(selectedAttributes).length === 0) {
      const firstType = orderedAttributeTypes[0];
      const firstOptions = attributeOptions[firstType];
      if (firstOptions && firstOptions.length > 0) {
        setSelectedAttributes({ [firstType]: firstOptions[0] });
      }
    }
  }, [orderedAttributeTypes, attributeOptions, selectedAttributes]);

  // No variants case
  if (!variants || variants.length === 0) {
    return null;
  }

  // Check if variants have attribute_combination
  const hasEAVData = variants.some(v => v.attribute_combination && Object.keys(v.attribute_combination).length > 0);
  
  if (!hasEAVData) {
    // Fallback: show simple list of variants
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Variantes
          <Badge variant="secondary" className="text-[10px]">{variants.length}</Badge>
        </h4>
        {variants.map(variant => {
          const qty = quantities[variant.id] || 0;
          const outOfStock = variant.stock === 0;
          
          return (
            <div
              key={variant.id}
              className={cn(
                "flex items-center justify-between gap-2 p-2 rounded-md transition-colors",
                qty > 0 ? "bg-primary/10 border border-primary/30" : "bg-muted/30 border border-border/50",
                outOfStock && "opacity-50"
              )}
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{variant.label}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">${variant.precio.toFixed(2)}</span>
                  <span>· {variant.stock} disp.</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => handleQuantityChange(variant.id, -1, variant.stock)}
                  disabled={qty === 0 || outOfStock}>
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="w-8 text-center text-sm font-semibold">{qty}</div>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => handleQuantityChange(variant.id, 1, variant.stock)}
                  disabled={outOfStock || qty >= variant.stock}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
        {totalQty > 0 && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 mt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{totalQty} unidades</div>
              <div className="text-lg font-bold text-primary">${totalPrice.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Render selector for each attribute type */}
      {orderedAttributeTypes.map((type, index) => {
        const normalizedType = normalizeAttributeType(type);
        const config = ATTRIBUTE_CONFIG[normalizedType] || { icon: Package, displayName: type, order: 99 };
        const Icon = config.icon;
        const allOptions = attributeOptions[type] || [];
        const availableOptions = getAvailableOptions(type);
        const selectedValue = selectedAttributes[type];
        const isColorType = normalizedType === 'color';
        
        // Only show if previous types are selected (or this is the first type)
        const previousTypesSelected = orderedAttributeTypes.slice(0, index).every(t => selectedAttributes[t]);
        if (index > 0 && !previousTypesSelected) {
          return null;
        }

        return (
          <div key={type} className="p-3 bg-muted/30 rounded-lg border border-border/50">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              {config.displayName}
              <Badge variant="secondary" className="text-[10px]">
                {availableOptions.length} opciones
              </Badge>
            </h4>

            {type === 'color' ? (
              // Color swatches - with IMAGE THUMBNAILS support
              <div className="flex flex-wrap gap-2">
                {allOptions.map(value => {
                  const isSelected = selectedValue === value;
                  const isAvailable = availableOptions.includes(value);
                  const stock = getOptionStock(type, value);
                  const colorHex = getColorHex(value);
                  // Get variant image for this color
                  const optionImage = attributeImageMap[type]?.[value] || attributeImageMap['color']?.[value];
                  
                  return (
                    <button
                      key={value}
                      onClick={() => isAvailable && handleSelectAttribute(type, value)}
                      disabled={!isAvailable}
                      className={cn(
                        "relative w-12 h-12 rounded-lg border-2 transition-all",
                        "flex items-center justify-center overflow-hidden group",
                        isSelected 
                          ? "border-primary ring-2 ring-primary/30 scale-105" 
                          : "border-border hover:border-primary/50",
                        !isAvailable && "opacity-30 cursor-not-allowed"
                      )}
                      title={`${value} - ${stock} disponibles`}
                    >
                      {/* Priority: Image > Color Hex > Letter fallback */}
                      {optionImage ? (
                        <img 
                          src={optionImage} 
                          alt={value}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // If image fails, hide it and show color/letter fallback
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-full h-full rounded-lg flex items-center justify-center';
                              fallback.style.backgroundColor = colorHex || '#E5E7EB';
                              if (!colorHex) {
                                fallback.innerHTML = `<span class="text-[10px] font-bold uppercase text-gray-600">${value.charAt(0)}</span>`;
                              }
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : colorHex ? (
                        <div className="w-full h-full rounded-lg" style={{ backgroundColor: colorHex }} />
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">
                          {value.charAt(0)}
                        </span>
                      )}
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary drop-shadow-md" />
                        </div>
                      )}
                      {/* Out of stock overlay */}
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <div className="w-6 h-0.5 bg-destructive rotate-45 rounded" />
                        </div>
                      )}
                      {/* Color name tooltip on hover */}
                      <div className="absolute inset-x-0 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[9px] text-muted-foreground font-medium capitalize truncate block text-center">
                          {value}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              // Size/Age buttons
              <div className="flex flex-wrap gap-2">
                {allOptions.map(value => {
                  const isSelected = selectedValue === value;
                  const isAvailable = availableOptions.includes(value);
                  const stock = getOptionStock(type, value);
                  
                  return (
                    <button
                      key={value}
                      onClick={() => isAvailable && handleSelectAttribute(type, value)}
                      disabled={!isAvailable}
                      className={cn(
                        "px-3 py-2 rounded-md border-2 transition-all text-sm font-medium",
                        isSelected 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border bg-background hover:border-primary/50",
                        !isAvailable && "opacity-30 cursor-not-allowed line-through"
                      )}
                      title={`${value} - ${stock} disponibles`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedValue && (
              <div className="mt-2 text-xs text-muted-foreground">
                Seleccionado: <span className="font-medium">{selectedValue}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Show matching variant with quantity controls */}
      {matchingVariant && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex-1">
              <div className="text-sm font-medium text-green-800 dark:text-green-200">
                {Object.values(selectedAttributes).join(' / ')}
              </div>
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <span className="font-bold text-lg text-green-700 dark:text-green-300">
                  ${matchingVariant.precio.toFixed(2)}
                </span>
                <span>· {matchingVariant.stock} disp.</span>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-1 flex-shrink-0">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 border-green-300"
                onClick={() => handleQuantityChange(matchingVariant.id, -1, matchingVariant.stock)}
                disabled={(quantities[matchingVariant.id] || 0) === 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <div className="w-8 text-center text-sm font-bold">
                {quantities[matchingVariant.id] || 0}
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 border-green-300"
                onClick={() => handleQuantityChange(matchingVariant.id, 1, matchingVariant.stock)}
                disabled={(quantities[matchingVariant.id] || 0) >= matchingVariant.stock}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt to complete selection */}
      {!matchingVariant && Object.keys(selectedAttributes).length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            Selecciona todas las opciones para ver disponibilidad
          </span>
        </div>
      )}

      {/* Summary */}
      {totalQty > 0 && (
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium">{totalQty} unidades</span>
              <span className="text-muted-foreground">
                ({Object.values(quantities).filter(q => q > 0).length} variantes)
              </span>
            </div>
            <div className="text-lg font-bold text-primary">
              ${totalPrice.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantSelectorB2B;
