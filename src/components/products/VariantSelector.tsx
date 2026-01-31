import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGroupedVariants, ProductVariant, AttributeCombination } from "@/hooks/useProductVariants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Package, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface VariantSelection {
  variantId: string;
  quantity: number;
}

interface VariantSelectorProps {
  productId: string;
  basePrice: number;
  baseImage?: string;
  isB2B?: boolean;
  variantPrices?: Record<string, number>;
  onSelectionChange?: (selections: VariantSelection[], totalQty: number, totalPrice: number, selectedVariant?: ProductVariant | null, isValid?: boolean, validationErrors?: string[]) => void;
  onVariantImageChange?: (imageUrl: string | null) => void;
}

// Attribute display configuration
const ATTRIBUTE_CONFIG: Record<string, { displayName: string; order: number }> = {
  color: { displayName: 'Color', order: 1 },
  size: { displayName: 'Talla', order: 2 },
  talla: { displayName: 'Talla', order: 2 },
  age: { displayName: 'Edad', order: 3 },
  edad: { displayName: 'Edad', order: 3 },
  model: { displayName: 'Modelo', order: 4 },
  modelo: { displayName: 'Modelo', order: 4 },
  voltage: { displayName: 'Voltaje', order: 5 },
  watts: { displayName: 'Watts', order: 6 },
  material: { displayName: 'Material', order: 7 },
};

// Color hex mapping (fallback when no image available)
const COLOR_HEX_MAP: Record<string, string> = {
  rojo: '#EF4444', red: '#EF4444',
  azul: '#3B82F6', blue: '#3B82F6',
  verde: '#22C55E', green: '#22C55E',
  negro: '#1F2937', black: '#1F2937',
  blanco: '#F9FAFB', white: '#F9FAFB',
  amarillo: '#EAB308', yellow: '#EAB308',
  naranja: '#F97316', orange: '#F97316',
  rosa: '#EC4899', pink: '#EC4899',
  morado: '#A855F7', purple: '#A855F7',
  gris: '#6B7280', gray: '#6B7280', grey: '#6B7280',
  cafe: '#92400E', marron: '#92400E', brown: '#92400E', coffee: '#6F4E37',
  beige: '#D4B896',
  coral: '#FF7F50',
  turquesa: '#40E0D0', turquoise: '#40E0D0',
  navy: '#000080', khaki: '#C3B091',
  olive: '#808000', burgundy: '#800020',
  cream: '#FFFDD0', mint: '#98FB98',
  lavender: '#E6E6FA', peach: '#FFCBA4',
};

const getColorHex = (colorName: string): string | null => {
  const normalized = colorName.toLowerCase().trim();
  return COLOR_HEX_MAP[normalized] || null;
};

const VariantSelector = ({
  productId,
  basePrice,
  baseImage,
  isB2B = false,
  variantPrices = {},
  onSelectionChange,
  onVariantImageChange,
}: VariantSelectorProps) => {
  const { grouped, variants, attrDisplayNames, isLoading } = useGroupedVariants(productId);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onVariantImageChangeRef = useRef(onVariantImageChange);
  
  // Keep ref updated
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    onVariantImageChangeRef.current = onVariantImageChange;
  }, [onSelectionChange, onVariantImageChange]);

  // Extract attribute options from EAV data with images
  const attributeOptions = useMemo(() => {
    if (!variants || variants.length === 0) return {};
    
    const options: Record<string, Set<string>> = {};
    
    variants.forEach(v => {
      const combo = v.attribute_combination;
      if (combo && typeof combo === 'object') {
        Object.entries(combo).forEach(([key, value]) => {
          if (value) {
            if (!options[key]) options[key] = new Set();
            options[key].add(value);
          }
        });
      }
      // Fallback to option_type/option_value
      if (v.option_type && v.option_value) {
        const key = v.option_type.toLowerCase();
        if (!options[key]) options[key] = new Set();
        options[key].add(v.option_value);
      }
    });
    
    return Object.fromEntries(
      Object.entries(options).map(([key, set]) => [key, Array.from(set)])
    );
  }, [variants]);

  // Build attribute-to-image map from variants (for any attribute type)
  const attributeImageMap = useMemo(() => {
    if (!variants || variants.length === 0) return {};
    
    const map: Record<string, Record<string, string>> = {};
    
    variants.forEach(v => {
      const combo = v.attribute_combination;
      const variantImage = v.images?.[0];
      
      if (combo && typeof combo === 'object' && variantImage) {
        // Map each attribute value to its first found image
        Object.entries(combo).forEach(([attrKey, attrValue]) => {
          if (attrValue) {
            if (!map[attrKey]) map[attrKey] = {};
            if (!map[attrKey][attrValue]) {
              map[attrKey][attrValue] = variantImage;
            }
          }
        });
      }
      
      // Also check option_type/option_value for fallback
      if (v.option_type && v.option_value && variantImage) {
        const key = v.option_type.toLowerCase();
        if (!map[key]) map[key] = {};
        if (!map[key][v.option_value]) {
          map[key][v.option_value] = variantImage;
        }
      }
    });
    
    return map;
  }, [variants]);

  // Legacy colorImageMap for backwards compatibility
  const colorImageMap = useMemo(() => {
    return attributeImageMap['color'] || attributeImageMap['Color'] || {};
  }, [attributeImageMap]);

  // Check if we have EAV attributes
  const hasEAVAttributes = Object.keys(attributeOptions).length > 0;

  // Sort attribute types by configured order
  const orderedAttributeTypes = useMemo(() => {
    return Object.keys(attributeOptions).sort((a, b) => {
      const orderA = ATTRIBUTE_CONFIG[a.toLowerCase()]?.order ?? 99;
      const orderB = ATTRIBUTE_CONFIG[b.toLowerCase()]?.order ?? 99;
      return orderA - orderB;
    });
  }, [attributeOptions]);

  // Get available options for an attribute (considering dependencies)
  const getAvailableOptions = useCallback((attrType: string): string[] => {
    const allOptions = attributeOptions[attrType] || [];
    if (!variants) return allOptions;
    
    // Filter based on current selections
    const availableSet = new Set<string>();
    
    variants.forEach(v => {
      const combo = v.attribute_combination;
      if (!combo) return;
      
      // Check if this variant matches all current selections (except the one we're filtering)
      let matches = true;
      for (const [key, value] of Object.entries(selectedAttributes)) {
        if (key !== attrType && combo[key] !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches && combo[attrType]) {
        availableSet.add(combo[attrType]);
      }
    });
    
    return allOptions.filter(opt => availableSet.has(opt));
  }, [attributeOptions, variants, selectedAttributes]);

  // Calculate which attribute types are actually required based on current selections
  // E.g., if a color only has one size, that attribute type might be auto-selected or skipped
  const requiredAttributeTypes = useMemo(() => {
    if (!variants || orderedAttributeTypes.length === 0) return orderedAttributeTypes;
    
    const required: string[] = [];
    
    orderedAttributeTypes.forEach((attrType, idx) => {
      // First attribute type is always required
      if (idx === 0) {
        required.push(attrType);
        return;
      }
      
      // For subsequent types, check if they exist for the current selection path
      const prevSelections = orderedAttributeTypes.slice(0, idx).reduce((acc, type) => {
        if (selectedAttributes[type]) {
          acc[type] = selectedAttributes[type];
        }
        return acc;
      }, {} as Record<string, string>);
      
      // Check if any variant with current selections has this attribute
      const hasThisAttr = variants.some(v => {
        const combo = v.attribute_combination;
        if (!combo || !combo[attrType]) return false;
        
        // Match previous selections
        for (const [key, value] of Object.entries(prevSelections)) {
          if (combo[key] !== value) return false;
        }
        return true;
      });
      
      if (hasThisAttr) {
        required.push(attrType);
      }
    });
    
    return required;
  }, [variants, orderedAttributeTypes, selectedAttributes]);

  // Auto-select when only one option available for an attribute type
  useEffect(() => {
    if (!variants || orderedAttributeTypes.length === 0) return;
    
    orderedAttributeTypes.forEach((attrType, idx) => {
      // Skip if already selected
      if (selectedAttributes[attrType]) return;
      
      // Skip if previous attributes aren't selected (except first)
      if (idx > 0) {
        const prevAttr = orderedAttributeTypes[idx - 1];
        if (!selectedAttributes[prevAttr]) return;
      }
      
      // Get available options for this type
      const availableOptions = new Set<string>();
      variants.forEach(v => {
        const combo = v.attribute_combination;
        if (!combo || !combo[attrType]) return;
        
        // Check if matches current selections
        let matches = true;
        for (const [key, value] of Object.entries(selectedAttributes)) {
          if (key !== attrType && combo[key] !== value) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          availableOptions.add(combo[attrType]);
        }
      });
      
      // If only one option available, auto-select it
      if (availableOptions.size === 1) {
        const singleOption = Array.from(availableOptions)[0];
        setSelectedAttributes(prev => ({
          ...prev,
          [attrType]: singleOption
        }));
      }
    });
  }, [variants, orderedAttributeTypes, selectedAttributes]);

  // Find matching variant for current selections
  const matchingVariant = useMemo(() => {
    if (!variants || Object.keys(selectedAttributes).length === 0) return null;
    
    return variants.find(v => {
      const combo = v.attribute_combination;
      if (!combo) return false;
      
      for (const [key, value] of Object.entries(selectedAttributes)) {
        if (combo[key] !== value) return false;
      }
      return true;
    });
  }, [variants, selectedAttributes]);

  // Update image when matching variant changes OR when color is selected
  useEffect(() => {
    if (onVariantImageChangeRef.current) {
      // Priority: matching variant image > selected color image > base image
      if (matchingVariant?.images?.[0]) {
        onVariantImageChangeRef.current(matchingVariant.images[0]);
      } else if (selectedAttributes.color && colorImageMap[selectedAttributes.color]) {
        onVariantImageChangeRef.current(colorImageMap[selectedAttributes.color]);
      } else if (baseImage) {
        onVariantImageChangeRef.current(baseImage);
      }
    }
  }, [matchingVariant, selectedAttributes.color, colorImageMap, baseImage]);

  // Calculate totals
  const totalQty = Object.values(selections).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = variants?.reduce((sum, v) => {
    const qty = selections[v.id] || 0;
    // Use B2B dynamic price if available, otherwise use variant price or base price
    const price = (isB2B && variantPrices[v.id]) ? variantPrices[v.id] : (v.price ?? basePrice);
    return sum + price * qty;
  }, 0) || 0;

  // Get the display name for an attribute type directly from database
  const getAttributeDisplayName = useCallback((attrType: string): string => {
    // Try exact match from database first
    if (attrDisplayNames[attrType]) return attrDisplayNames[attrType];
    
    // Try lowercase match
    const lowerType = attrType.toLowerCase();
    if (attrDisplayNames[lowerType]) return attrDisplayNames[lowerType];
    
    // Fallback: capitalize the original attribute type
    return attrType.charAt(0).toUpperCase() + attrType.slice(1).replace(/_/g, ' ');
  }, [attrDisplayNames]);

  // Validation: check if all REQUIRED attribute types are selected (not all possible types)
  const validationState = useMemo(() => {
    if (!hasEAVAttributes || orderedAttributeTypes.length === 0) {
      // No EAV attributes - valid if we have quantity
      return { isValid: totalQty > 0, errors: totalQty === 0 ? ['Selecciona una cantidad'] : [] };
    }

    const errors: string[] = [];
    
    // Only check required attribute types (those that exist for current selection path)
    requiredAttributeTypes.forEach(attrType => {
      if (!selectedAttributes[attrType]) {
        const displayName = getAttributeDisplayName(attrType);
        errors.push(`Selecciona ${displayName}`);
      }
    });

    // If all required attributes are selected, check quantity
    if (errors.length === 0 && totalQty === 0) {
      errors.push('Selecciona una cantidad');
    }

    return { isValid: errors.length === 0, errors };
  }, [hasEAVAttributes, orderedAttributeTypes, requiredAttributeTypes, selectedAttributes, getAttributeDisplayName, totalQty]);

  // Notify parent of changes including validation state
  useEffect(() => {
    if (onSelectionChangeRef.current && variants) {
      const selectionsList = Object.entries(selections)
        .filter(([_, qty]) => qty > 0)
        .map(([variantId, quantity]) => ({ variantId, quantity }));
      onSelectionChangeRef.current(
        selectionsList, 
        totalQty, 
        totalPrice, 
        matchingVariant, 
        validationState.isValid, 
        validationState.errors
      );
    }
  }, [selections, totalQty, totalPrice, variants, matchingVariant, validationState]);

  const updateQuantity = (variantId: string, delta: number, variant: ProductVariant) => {
    setSelections((prev) => {
      const current = prev[variantId] || 0;
      let newQty = current + delta;
      newQty = Math.max(0, Math.min(variant.stock, newQty));
      return { ...prev, [variantId]: newQty };
    });
  };

  const handleAttributeSelect = (attrType: string, value: string) => {
    setSelectedAttributes(prev => {
      const newAttrs = { ...prev, [attrType]: value };
      
      // Clear downstream selections when a parent attribute changes
      const typeIndex = orderedAttributeTypes.indexOf(attrType);
      orderedAttributeTypes.forEach((type, idx) => {
        if (idx > typeIndex) {
          delete newAttrs[type];
        }
      });
      
      return newAttrs;
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="space-y-2">
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!variants || variants.length === 0) {
    return null;
  }

  const optionTypes = Object.keys(grouped);

  // Render EAV-based hierarchical selector if we have attribute_combination
  if (hasEAVAttributes && orderedAttributeTypes.length > 0) {
    return (
      <div className="space-y-4">
        {/* Attribute Selectors */}
        {orderedAttributeTypes.map((attrType, idx) => {
          const availableOptions = getAvailableOptions(attrType);
          const selectedValue = selectedAttributes[attrType];
          
          // Smart display name detection
          let displayName = attrDisplayNames[attrType] || attrDisplayNames[attrType.toLowerCase()] || ATTRIBUTE_CONFIG[attrType.toLowerCase()]?.displayName;
          
          // If still generic name, try to infer from values
          if (!displayName || displayName.toLowerCase().includes('attribute')) {
            // Check if values look like colors
            const colorNames = Object.keys(COLOR_HEX_MAP);
            const hasColorValues = availableOptions.some(opt => 
              colorNames.includes(opt.toLowerCase())
            );
            // Check if values look like sizes
            const sizePattern = /^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|\d+)$/i;
            const hasSizeValues = availableOptions.some(opt => 
              sizePattern.test(opt.trim())
            );
            
            if (hasColorValues) {
              displayName = 'Color';
            } else if (hasSizeValues) {
              displayName = 'Talla';
            } else {
              displayName = `Opción ${idx + 1}`;
            }
          }
          
          // Detect if this is a color attribute based on name or values
          const isColor = attrType.toLowerCase().includes('color') || 
            displayName.toLowerCase() === 'color' ||
            availableOptions.some(opt => Object.keys(COLOR_HEX_MAP).includes(opt.toLowerCase()));
          
          // Only show if previous attributes are selected (except first)
          const prevAttr = orderedAttributeTypes[idx - 1];
          if (idx > 0 && prevAttr && !selectedAttributes[prevAttr]) {
            return null;
          }

          // Skip if this attribute type is not required for current selection path
          // (e.g., Vinotinto only has S, so Size might be auto-selected or not needed)
          if (!requiredAttributeTypes.includes(attrType)) {
            return null;
          }
          
          // Skip rendering if no options available (attribute doesn't apply)
          if (availableOptions.length === 0) {
            return null;
          }

          // Check if this attribute is missing (for visual error indication)
          const isMissing = !selectedValue && validationState.errors.some(e => 
            e.toLowerCase().includes(displayName.toLowerCase())
          );

          // Check if only one option (auto-selected scenario)
          const isAutoSelected = availableOptions.length === 1 && selectedValue === availableOptions[0];

          return (
            <div key={attrType} className={cn(
              "p-3 rounded-lg border",
              isMissing ? "bg-destructive/5 border-destructive/30" : "bg-muted/30 border-border/50"
            )}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  isMissing ? "text-destructive" : "text-foreground"
                )}>
                  {displayName}
                  {isMissing && <span className="ml-1 text-destructive">*</span>}
                </h4>
                <div className="flex items-center gap-1">
                  {isAutoSelected && (
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      Única opción
                    </Badge>
                  )}
                  {selectedValue && (
                    <Badge variant="secondary" className="text-[10px] font-normal capitalize">
                      {selectedValue}
                    </Badge>
                  )}
                </div>
              </div>
              <div className={cn(
                "flex flex-wrap gap-2",
                isColor && "gap-2"
              )}>
                {availableOptions.map(option => {
                  const isSelected = selectedValue === option;
                  const colorHex = isColor ? getColorHex(option) : null;
                  // Get image for this option from the attribute image map
                  const optionImage = attributeImageMap[attrType]?.[option] || null;
                  
                  // Get stock for this option
                  const optionStock = variants?.reduce((sum, v) => {
                    const combo = v.attribute_combination;
                    if (combo?.[attrType] === option) {
                      // Check if matches other selections
                      let matches = true;
                      for (const [key, val] of Object.entries(selectedAttributes)) {
                        if (key !== attrType && combo[key] !== val) {
                          matches = false;
                          break;
                        }
                      }
                      if (matches) return sum + v.stock;
                    }
                    return sum;
                  }, 0) || 0;
                  
                  const isOutOfStock = optionStock === 0;

                  // Color selector with IMAGE THUMBNAIL
                  if (isColor) {
                    // Show image thumbnail if available, otherwise show color swatch
                    if (optionImage) {
                      return (
                        <button
                          key={option}
                          onClick={() => !isOutOfStock && handleAttributeSelect(attrType, option)}
                          disabled={isOutOfStock}
                          className={cn(
                            "relative w-16 h-16 sm:w-12 sm:h-12 rounded-lg border-2 transition-all overflow-hidden group",
                            isSelected 
                              ? "border-primary ring-2 ring-primary/30 scale-105" 
                              : "border-border hover:border-primary/50",
                            isOutOfStock && "opacity-40 cursor-not-allowed"
                          )}
                          title={`${option}${isOutOfStock ? ' (Agotado)' : ''}`}
                        >
                          {optionImage && (
                            <img 
                              src={optionImage} 
                              alt={option}
                              className="w-full h-full object-cover"
                              loading="eager"
                              crossOrigin="anonymous"
                              decoding="sync"
                              onError={(e) => {
                                // If image fails, show fallback color
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.style.backgroundColor = getColorHex(option) || '#E5E7EB';
                                }
                              }}
                            />
                          )}
                          {!optionImage && (
                            <div 
                              className="w-full h-full" 
                              style={{ backgroundColor: getColorHex(option) || '#E5E7EB' }}
                            />
                          )}
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="h-4 w-4 text-primary drop-shadow-md" />
                            </div>
                          )}
                          {/* Out of stock overlay */}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <div className="w-8 h-0.5 bg-destructive rotate-45 rounded" />
                            </div>
                          )}
                          {/* Color name tooltip on hover */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-1">
                            <span className="text-[8px] text-white font-medium truncate block text-center capitalize">
                              {option}
                            </span>
                          </div>
                        </button>
                      );
                    }
                    
                    // Fallback to color swatch
                    return (
                      <button
                        key={option}
                        onClick={() => !isOutOfStock && handleAttributeSelect(attrType, option)}
                        disabled={isOutOfStock}
                        className={cn(
                          "w-10 h-10 rounded-lg border-2 transition-all relative flex items-center justify-center",
                          isSelected 
                            ? "border-primary ring-2 ring-primary/30 scale-105" 
                            : "border-border hover:border-primary/50",
                          isOutOfStock && "opacity-40 cursor-not-allowed"
                        )}
                        style={{ backgroundColor: colorHex || '#E5E7EB' }}
                        title={`${option}${isOutOfStock ? ' (Agotado)' : ''}`}
                      >
                        {isSelected && (
                          <Check className={cn(
                            "h-4 w-4 drop-shadow-md",
                            colorHex && (colorHex === '#F9FAFB' || colorHex === '#FFFDD0') 
                              ? "text-gray-800" 
                              : "text-white"
                          )} />
                        )}
                        {isOutOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-6 h-0.5 bg-destructive rotate-45 rounded" />
                          </div>
                        )}
                      </button>
                    );
                  }

                  // Non-color attributes (size, etc.)
                  return (
                    <Button
                      key={option}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => !isOutOfStock && handleAttributeSelect(attrType, option)}
                      disabled={isOutOfStock}
                      className={cn(
                        "h-9 px-4 text-sm font-medium",
                        isSelected && "ring-2 ring-primary/30",
                        isOutOfStock && "opacity-50 line-through"
                      )}
                    >
                      {option}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Show matching variant with quantity control and consolidated info */}
        {matchingVariant && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-4">
              {/* Variant image thumbnail */}
              {matchingVariant.images?.[0] && (
                <img 
                  src={matchingVariant.images[0]} 
                  alt={matchingVariant.name}
                  className="w-16 h-16 object-cover rounded-lg border-2 border-primary/30 shadow-sm"
                />
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">
                    {Object.values(selectedAttributes).join(' / ')}
                  </span>
                  {matchingVariant.stock === 0 && (
                    <Badge variant="secondary" className="text-xs">Agotado</Badge>
                  )}
                  {matchingVariant.stock > 0 && matchingVariant.stock <= 5 && (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                      ¡Últimas {matchingVariant.stock}!
                    </Badge>
                  )}
                  {isB2B && matchingVariant.moq > 1 && (
                    <Badge variant="outline" className="text-xs">Min: {matchingVariant.moq}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className="text-lg font-bold text-primary whitespace-nowrap">
                    ${((isB2B && variantPrices[matchingVariant.id]) ? variantPrices[matchingVariant.id] : (matchingVariant.price ?? basePrice)).toFixed(2)}
                  </span>
                  {matchingVariant.precio_promocional && matchingVariant.precio_promocional < ((isB2B && variantPrices[matchingVariant.id]) ? variantPrices[matchingVariant.id] : (matchingVariant.price ?? basePrice)) && (
                    <span className="text-sm text-muted-foreground line-through whitespace-nowrap">
                      ${((isB2B && variantPrices[matchingVariant.id]) ? variantPrices[matchingVariant.id] : (matchingVariant.price ?? basePrice)).toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {matchingVariant.stock} disponibles
                  </span>
                </div>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => updateQuantity(matchingVariant.id, -1, matchingVariant)}
                  disabled={(selections[matchingVariant.id] || 0) === 0 || matchingVariant.stock === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="w-12 text-center text-lg font-bold">
                  {selections[matchingVariant.id] || 0}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => updateQuantity(matchingVariant.id, 1, matchingVariant)}
                  disabled={matchingVariant.stock === 0 || (selections[matchingVariant.id] || 0) >= matchingVariant.stock}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {totalQty > 0 && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium">{totalQty} unidades</span>
              </div>
              <div className="text-xl font-bold text-primary">
                ${totalPrice.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback: Original grouped by option_type display
  return (
    <div className="space-y-3">
      {optionTypes.map((type) => (
        <div key={type} className="p-2 sm:p-3 bg-muted/30 rounded-lg border border-border/50">
          <h4 className="text-xs sm:text-sm font-semibold text-foreground mb-2 sm:mb-3 capitalize">
            {type === "size" ? "Talla" : type === "color" ? "Color" : type === "age" ? "Edad" : type}
          </h4>
          <div className="space-y-1.5 sm:space-y-2">
            {grouped[type].map((variant) => {
              const qty = selections[variant.id] || 0;
              const price = isB2B && variantPrices[variant.id] ? variantPrices[variant.id] : (variant.price ?? basePrice);
              const hasPromo = variant.precio_promocional && variant.precio_promocional < price;
              const displayPrice = hasPromo ? variant.precio_promocional : price;
              const outOfStock = variant.stock === 0;

              return (
                <div
                  key={variant.id}
                  className={cn(
                    "flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-md transition-colors",
                    qty > 0 ? "bg-primary/10 border border-primary/20" : "bg-background",
                    outOfStock && "opacity-50"
                  )}
                >
                  {/* Variant image if available */}
                  {variant.images?.[0] && (
                    <img 
                      src={variant.images[0]} 
                      alt={variant.option_value}
                      className="w-10 h-10 object-cover rounded border border-border flex-shrink-0"
                    />
                  )}
                  
                  {/* Left: Variant info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span className="font-medium text-xs sm:text-sm text-foreground truncate max-w-[80px] sm:max-w-none">
                        {variant.option_value}
                      </span>
                      {outOfStock && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 py-0">
                          Agotado
                        </Badge>
                      )}
                      {isB2B && variant.moq > 1 && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1 py-0">
                          Min:{variant.moq}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                      <span className="text-xs sm:text-sm font-bold text-primary">
                        ${displayPrice?.toFixed(2)}
                      </span>
                      {hasPromo && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                          ${price.toFixed(2)}
                        </span>
                      )}
                      <span className="text-[10px] sm:text-xs text-muted-foreground hidden xs:inline">
                        · {variant.stock} disp.
                      </span>
                    </div>
                  </div>

                  {/* Right: Quantity controls */}
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={() => updateQuantity(variant.id, -1, variant)}
                      disabled={qty === 0 || outOfStock}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <div className="w-7 sm:w-10 text-center text-xs sm:text-sm font-semibold">
                      {qty}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={() => updateQuantity(variant.id, 1, variant)}
                      disabled={outOfStock || qty >= variant.stock}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Summary */}
      {totalQty > 0 && (
        <div className="p-2 sm:p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              <span className="font-medium">{totalQty} uds</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-primary">
              ${totalPrice.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantSelector;
