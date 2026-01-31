import { supabase } from "@/integrations/supabase/client";
import { detectAttributeType, parseColorToHex } from "./useEAVAttributes";

export interface RawImportRow {
  [key: string]: string;
}

export interface DetectedAttribute {
  columnName: string;
  attributeName: string;
  type: 'color' | 'size' | 'technical' | 'select' | 'text';
  renderType: 'swatches' | 'chips' | 'dropdown' | 'buttons';
  categoryHint: string;
  uniqueValues: Set<string>;
  // Maps each attribute value to its corresponding image URL from the same row
  valueImageMap: Record<string, string>;
}

export interface GroupedProduct {
  groupKey: string;
  parentName: string;
  baseSku: string;
  category?: string;
  supplier?: string;
  description?: string;
  variants: VariantRow[];
  detectedAttributes: DetectedAttribute[];
  // Flag to indicate if this SKU already exists in DB
  existsInDb?: boolean;
  existingProductId?: string;
}

export interface VariantRow {
  originalRow: RawImportRow;
  sku: string;
  name: string;
  costBase: number;
  stock: number;
  moq: number;
  imageUrl?: string;
  sourceUrl?: string;
  attributeValues: Record<string, string>; // { color: 'red', size: 'M' }
}

// Standard product columns (not variant attributes)
const STANDARD_COLUMNS = [
  'sku', 'codigo', 'sku_interno', 'sku interno',
  'nombre', 'name', 'title', 'product name', 'nombre producto',
  'descripcion', 'description', 'desc', 'descripcion_corta',
  'costo', 'cost', 'precio', 'price', 'costo_base', 'costo base',
  'moq', 'minimo', 'min', 'cantidad_minima', 'moq_cantidad_minima',
  'stock', 'cantidad', 'qty', 'stock_fisico', 'inventory',
  'imagen', 'image', 'foto', 'url_imagen', 'url imagen', 'picture', 'images',
  'categoria', 'category', 'cat',
  'proveedor', 'supplier', 'vendor',
  'url', 'link', 'url_proveedor', 'url_origen', 'source_url',
  'parent_id', 'parent', 'padre', 'parent_sku',
  'brand', 'marca',
];

// Detect if a column is a variant attribute
const isAttributeColumn = (header: string): boolean => {
  const lower = header.toLowerCase().trim();
  return !STANDARD_COLUMNS.some(std => lower.includes(std) || std.includes(lower));
};

/**
 * Extract base SKU for grouping - OPTIMIZED for common patterns
 * Handles various SKU formats and detects when SKUs have unique IDs per variant
 * 
 * Examples:
 *   "325681024-Coffee-M" -> "325681024" (same number across variants = good grouping)
 *   "5233016281810-NEGRO-S", "5233016281811-NEGRO-M" -> Use shorter prefix for grouping
 */
const extractBaseSku = (sku: string): string => {
  if (!sku) return '';

  const cleanSku = String(sku).trim();
  if (!cleanSku) return '';

  // Extract the first token (before variant separators)
  const tokenMatch = cleanSku.match(/^([A-Za-z0-9]+)[-_.]/);
  const token = tokenMatch?.[1] ?? cleanSku;

  // Professional rule for numeric roots: ignore last 3 digits (common per-variant increment)
  if (/^\d+$/.test(token) && token.length > 3) {
    return token.slice(0, -3);
  }

  // Fallback patterns for other SKU formats
  const patterns = [
    /-[A-Z]{1,3}(-[A-Z0-9]+)*$/i, // SKU-RED-M
    /_[A-Z]{1,3}(_[A-Z0-9]+)*$/i, // SKU_RED_M
    /\.[A-Z]{1,3}(\.[A-Z0-9]+)*$/i, // SKU.RED.M
    /-\d{3,4}$/, // SKU-001
  ];

  let base = cleanSku;
  for (const pattern of patterns) {
    base = base.replace(pattern, '');
  }

  // If we ended up with a numeric root here too, apply the same rule.
  if (/^\d+$/.test(base) && base.length > 3) {
    return base.slice(0, -3);
  }

  return base || cleanSku;
};

/**
 * Clean parent name by removing variant info like "- Red, M" or "- Coffee, L"
 */
const extractParentName = (name: string): string => {
  if (!name) return '';
  
  // Remove common variant patterns from name
  const patterns = [
    // "Product Name - Red, M" -> "Product Name"
    /\s*[-–]\s*[A-Za-z]+\s*,\s*[A-Z0-9]+\s*$/i,
    // "Product Name, Red M" -> "Product Name"
    /,\s*[A-Za-z]+\s+[A-Z0-9]+\s*$/i,
    // Size suffixes
    /\s*[-–]\s*(small|medium|large|xl|xxl|s|m|l|xs|xxxl|3xl|4xl|5xl)\s*$/i,
    // Color suffixes
    /\s*[-–]\s*(red|blue|green|black|white|pink|yellow|purple|orange|brown|grey|gray|coffee|beige|navy|khaki)\s*$/i,
    // Technical specs
    /\s*[-–]\s*\d+\s*(w|watts?|v|volts?|mah?)\s*$/i,
    // Parenthetical info
    /\s*\(.*\)\s*$/,
    // ", XL" suffix
    /\s*,\s*[A-Z]{1,4}\s*$/,
  ];

  let cleanName = name;
  for (const pattern of patterns) {
    cleanName = cleanName.replace(pattern, '');
  }
  return cleanName.trim() || name;
};

/**
 * Check if a SKU root already exists in the database
 */
export const checkExistingSkus = async (baseSkus: string[]): Promise<Record<string, { exists: boolean; productId?: string }>> => {
  const result: Record<string, { exists: boolean; productId?: string }> = {};
  
  if (baseSkus.length === 0) return result;
  
  // Query for existing products with these base SKUs
  const { data, error } = await supabase
    .from('products')
    .select('id, sku_interno')
    .in('sku_interno', baseSkus);
  
  if (error) {
    console.error('Error checking existing SKUs:', error);
    return result;
  }
  
  // Initialize all as not existing
  baseSkus.forEach(sku => {
    result[sku] = { exists: false };
  });
  
  // Mark those that exist
  data?.forEach(product => {
    result[product.sku_interno] = { 
      exists: true, 
      productId: product.id 
    };
  });
  
  return result;
};

// Main grouping function - ENHANCED with color-image mapping
export const groupProductsByParent = (
  rows: RawImportRow[],
  headers: string[],
  columnMapping: Record<string, string>,
  manualAttributeColumns?: string[]
): { groups: GroupedProduct[]; detectedAttributeColumns: string[] } => {
  
  // Identify attribute columns - use manual selection if provided, otherwise auto-detect
  const attributeColumns = manualAttributeColumns && manualAttributeColumns.length > 0
    ? manualAttributeColumns.filter(col => headers.includes(col))
    : headers.filter(h => {
        // Skip mapped standard columns
        const isMapped = Object.values(columnMapping).includes(h);
        if (isMapped) return false;
        return isAttributeColumn(h);
      });

  // Build detected attributes info
  const detectedAttrs: Record<string, DetectedAttribute> = {};
  attributeColumns.forEach(col => {
    const { type, render, categoryHint } = detectAttributeType(col);
    detectedAttrs[col] = {
      columnName: col,
      attributeName: col.toLowerCase().replace(/\s+/g, '_'),
      type,
      renderType: render,
      categoryHint,
      uniqueValues: new Set<string>(),
      valueImageMap: {}, // Always create image map for all attributes
    };
  });

  // Group products
  const groups: Record<string, GroupedProduct> = {};

  const normalizeGroupKeyPart = (value: string): string => {
    const s = (value || '').toString().trim().toLowerCase();
    if (!s) return '';
    // Remove diacritics + normalize whitespace/punctuation
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  };

  const normalizeExcelUrl = (value: string): string => {
    const s = (value || '').toString().trim();
    if (!s) return '';
    return s
      .replace(/^"(.+)"$/, '$1') // strip wrapping quotes
      .replace(/\\:/g, ':')
      .replace(/\\_/g, '_')
      .replace(/\\\//g, '/');
  };

  rows.forEach(row => {
    const sku = row[columnMapping.sku_interno] || '';
    const name = row[columnMapping.nombre] || '';
    const imageUrl = normalizeExcelUrl(row[columnMapping.url_imagen] || '');
    const parentId = row['parent_id'] || row['Parent_ID'] || row['parent'] || '';
    // Determine group key - prioritize explicit parent_id, otherwise require BOTH:
    // - same normalized parent title
    // - same normalized SKU root (SKU ignoring last 3 digits)
    let groupKey: string;
    if (parentId) {
      groupKey = parentId;
    } else {
      const parentName = extractParentName(name);
      const baseSku = extractBaseSku(sku);

      const titleKey = normalizeGroupKeyPart(parentName);
      const skuKey = normalizeGroupKeyPart(baseSku);

      // Enforce title match AND SKU-root match by using a composite key
      groupKey = titleKey && skuKey ? `${titleKey}__${skuKey}` : (titleKey || skuKey || sku);
    }

    if (!groupKey) groupKey = sku || name;

    // Initialize group if new
    if (!groups[groupKey]) {
      // Get description - fallback to parent name if no description column exists
      const rawDescription = row[columnMapping.descripcion_corta] || '';
      const description = rawDescription.trim() || extractParentName(name);
      
      groups[groupKey] = {
        groupKey,
        parentName: extractParentName(name),
        baseSku: extractBaseSku(sku),
        category: row[columnMapping.categoria] || '',
        supplier: row[columnMapping.proveedor] || '',
        description,
        variants: [],
        detectedAttributes: [],
      };
    }

    // Build attribute values for this row
    const attributeValues: Record<string, string> = {};
    attributeColumns.forEach(col => {
      const val = row[col]?.trim();
      if (val) {
        attributeValues[col] = val;
        detectedAttrs[col].uniqueValues.add(val);
        
        // Map attribute value to image URL for thumbnail display (all attributes)
        if (imageUrl && !detectedAttrs[col].valueImageMap[val]) {
          // Only set if not already mapped (first image for this value wins)
          detectedAttrs[col].valueImageMap[val] = imageUrl;
        }
      }
    });

    // Parse row data
    const costStr = row[columnMapping.costo_base] || '0';
    const stockStr = row[columnMapping.stock_fisico] || '0';
    const moqStr = row[columnMapping.moq] || '1';

    const variant: VariantRow = {
      originalRow: row,
      sku,
      name,
      costBase: parseFloat(costStr.replace(/[^0-9.-]/g, '')) || 0,
      stock: parseInt(stockStr.replace(/[^0-9]/g, ''), 10) || 0,
      moq: parseInt(moqStr.replace(/[^0-9]/g, ''), 10) || 1,
      imageUrl: imageUrl || '',
      sourceUrl: normalizeExcelUrl(row[columnMapping.url_origen] || ''),
      attributeValues,
    };

    groups[groupKey].variants.push(variant);
  });

  // Finalize detected attributes for each group
  Object.values(groups).forEach(group => {
    group.detectedAttributes = attributeColumns
      .filter(col => {
        // Only include if this group has values for this attribute
        return group.variants.some(v => v.attributeValues[col]);
      })
      .map(col => ({
        ...detectedAttrs[col],
        // Filter valueImageMap to only include values in this group
        valueImageMap: Object.fromEntries(
          Object.entries(detectedAttrs[col].valueImageMap)
            .filter(([value]) => group.variants.some(v => v.attributeValues[col] === value))
        ),
      }));
  });

  return {
    groups: Object.values(groups),
    detectedAttributeColumns: attributeColumns,
  };
};

// Process and import grouped products with EAV
export const importGroupedProducts = async (
  groups: GroupedProduct[],
  categoryId: string | undefined,
  supplierId: string | undefined,
  priceCalculator: (cost: number) => number,
  onProgress?: (current: number, total: number, message: string) => void,
  originCountryId?: string,
  marketIds?: string[]
): Promise<{ success: number; failed: number; errors: string[] }> => {
  
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = groups.length;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    onProgress?.(i + 1, total, `Importando: ${group.parentName}`);

    let productCreated = false;
    let groupErrors: string[] = [];

    try {
      // 1. Create parent product
      const representativeVariant = group.variants[0];
      const totalStock = group.variants.reduce((sum, v) => sum + v.stock, 0);
      const minCost = Math.min(...group.variants.map(v => v.costBase));
      const b2bPrice = priceCalculator(minCost);
      
      // Collect all unique images from variants for gallery
      const allImages = [...new Set(group.variants.map(v => v.imageUrl).filter(Boolean))];
      
      // Log images being used for debugging
      console.log(`Importing product ${group.baseSku}:`, {
        imagen_principal: representativeVariant.imageUrl,
        galeria_imagenes: allImages,
        variantCount: group.variants.length
      });

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          sku_interno: group.baseSku,
          nombre: group.parentName,
          descripcion_corta: group.description || null,
          categoria_id: categoryId || null,
          proveedor_id: supplierId || null,
          origin_country_id: originCountryId || null,
          costo_base_excel: minCost,
          precio_mayorista: b2bPrice,
          moq: representativeVariant.moq,
          stock_fisico: totalStock,
          imagen_principal: representativeVariant.imageUrl || null,
          galeria_imagenes: allImages.length > 0 ? allImages : null,
          url_origen: representativeVariant.sourceUrl || null,
          is_parent: true,
        })
        .select()
        .single();

      if (productError) {
        throw new Error(`Error creating product: ${productError.message}`);
      }

      productCreated = true;

      // 2. Create/get attributes and options
      const attributeCache: Record<string, string> = {}; // name -> id
      const optionCache: Record<string, Record<string, string>> = {}; // attrId -> { value -> optionId }

      for (const detectedAttr of group.detectedAttributes) {
        // Get or create attribute
        let attrId = attributeCache[detectedAttr.attributeName];
        
        if (!attrId) {
          const { data: existingAttr } = await supabase
            .from('attributes')
            .select('id')
            .eq('slug', detectedAttr.attributeName)
            .single();

          if (existingAttr) {
            attrId = existingAttr.id;
          } else {
            const { data: newAttr, error: attrError } = await supabase
              .from('attributes')
              .insert({
                name: detectedAttr.attributeName,
                slug: detectedAttr.attributeName,
                display_name: detectedAttr.columnName,
                attribute_type: detectedAttr.type,
                render_type: detectedAttr.renderType,
                category_hint: detectedAttr.categoryHint,
              })
              .select()
              .single();

            if (attrError) throw attrError;
            attrId = newAttr.id;
          }
          attributeCache[detectedAttr.attributeName] = attrId;
        }

        optionCache[attrId] = {};

        // Create options for each unique value
        for (const value of detectedAttr.uniqueValues) {
          const valueSlug = value.toLowerCase().replace(/\s+/g, '_');
          
          const { data: existingOpt } = await supabase
            .from('attribute_options')
            .select('id')
            .eq('attribute_id', attrId)
            .eq('value', valueSlug)
            .single();

          if (existingOpt) {
            optionCache[attrId][value] = existingOpt.id;
          } else {
            const colorHex = detectedAttr.type === 'color' ? parseColorToHex(value) : undefined;
            // Get the image URL for this value from the valueImageMap
            const imageUrl = detectedAttr.valueImageMap[value] || undefined;
            
            const { data: newOpt, error: optError } = await supabase
              .from('attribute_options')
              .insert({
                attribute_id: attrId,
                value: valueSlug,
                display_value: value,
                color_hex: colorHex,
                image_url: imageUrl, // Store the variant image for color options
              })
              .select()
              .single();

            if (optError) throw optError;
            optionCache[attrId][value] = newOpt.id;
          }
        }
      }

      // 3. Create variants with proper image mapping
      for (const variant of group.variants) {
        const variantPrice = priceCalculator(variant.costBase);
        const priceAdjustment = variantPrice - b2bPrice;

        // Build attribute combination JSON with readable values
        const attributeCombination: Record<string, string> = {};
        for (const [colName, value] of Object.entries(variant.attributeValues)) {
          const attr = group.detectedAttributes.find(a => a.columnName === colName);
          if (attr && value) {
            // Store human-readable key-value pairs (e.g., { color: "Rojo", size: "M" })
            attributeCombination[attr.attributeName] = value;
          }
        }

        // Build variant label from attribute values
        const variantLabel = Object.values(variant.attributeValues).join(' / ') || variant.sku;

        const { data: variantData, error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: product.id,
            sku: variant.sku,
            name: variantLabel,
            option_type: group.detectedAttributes[0]?.attributeName || 'variant',
            option_value: Object.values(variant.attributeValues)[0] || variant.sku,
            price: variantPrice,
            stock: variant.stock,
            moq: variant.moq,
            images: variant.imageUrl ? [variant.imageUrl] : [],
            attribute_combination: attributeCombination,
            cost_price: variant.costBase,
            price_adjustment: priceAdjustment,
          })
          .select()
          .single();

        if (variantError) {
          console.error('Variant error:', variantError);
          groupErrors.push(`Variante ${variant.sku}: ${variantError.message}`);
          continue;
        }

        // 4. Link variant to attribute options
        for (const [colName, value] of Object.entries(variant.attributeValues)) {
          const attr = group.detectedAttributes.find(a => a.columnName === colName);
          if (attr) {
            const attrId = attributeCache[attr.attributeName];
            const optId = optionCache[attrId]?.[value];
            
            if (attrId && optId) {
              await supabase
                .from('variant_attribute_values')
                .insert({
                  variant_id: variantData.id,
                  attribute_id: attrId,
                  attribute_option_id: optId,
                })
                .select();
            }
          }
        }
      }

      // 5. Assign product to markets if provided
      if (marketIds && marketIds.length > 0) {
        const marketInserts = marketIds.map(marketId => ({
          product_id: product.id,
          market_id: marketId,
          is_active: true,
        }));

        const { error: marketError } = await supabase
          .from('product_markets')
          .insert(marketInserts);

        if (marketError) {
          console.error('Error assigning markets:', marketError);
          groupErrors.push(`Mercados: ${marketError.message}`);
          // Don't fail the whole import for market assignment issues
        }
      }

      // Count as success if product was created, regardless of variant/market errors
      if (productCreated) {
        success++;
        if (groupErrors.length > 0) {
          errors.push(`${group.parentName}: Producto importado con avisos - ${groupErrors.join('; ')}`);
        }
      }
    } catch (err) {
      failed++;
      errors.push(`${group.parentName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { success, failed, errors };
};
