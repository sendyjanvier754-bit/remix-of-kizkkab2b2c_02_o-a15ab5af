import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  sku_interno: string;
  nombre: string;
  precio_mayorista: number;
  precio_sugerido_venta: number | null;
  stock_fisico: number;
  imagen_principal: string | null;
  galeria_imagenes: string[] | null;
  categoria_id: string | null;
  moq: number;
  descripcion_corta: string | null;
  descripcion_larga: string | null;
}

interface ParsedVariant {
  color: string | null;
  age: string | null;
  size: string | null;
  styleCode: string | null;
}

interface MigrationResult {
  success: boolean;
  parentProductsCreated: number;
  variantsCreated: number;
  attributeOptionsCreated: number;
  errors: string[];
  details: {
    parentSku: string;
    variantCount: number;
    colorsFound: string[];
    sizesFound: string[];
    agesFound: string[];
  }[];
}

// Parse SKU to extract variant information
function parseSkuVariants(sku: string): ParsedVariant {
  const parts = sku.split('-');
  
  // SKU pattern: parent_sku - style_code - age - size - color
  // Example: 1005005691868544-3-4t-110-champagne
  // Or: 1005008414127809-dh0715a-rosa-8y
  
  const result: ParsedVariant = {
    color: null,
    age: null,
    size: null,
    styleCode: null,
  };

  if (parts.length < 2) return result;

  // First part is parent SKU, skip it
  const variantParts = parts.slice(1);
  
  for (const part of variantParts) {
    const lowerPart = part.toLowerCase();
    
    // Check for age patterns: 3-4t, 5t, 6y, 8y, 10y, 12y, etc.
    if (/^\d+(-\d+)?[ty]$/i.test(part) || /^\d{1,2}y$/i.test(part)) {
      result.age = part.toUpperCase();
      continue;
    }
    
    // Check for size (numeric values like 110, 120, 130 cm)
    if (/^\d{2,3}$/.test(part) && parseInt(part) >= 80 && parseInt(part) <= 180) {
      result.size = part;
      continue;
    }
    
    // Check for known colors
    const colorPatterns = [
      'champagne', 'light-blue', 'peach-pink', 'rosa', 'white', 'beige', 
      'pink', 'blue', 'red', 'green', 'black', 'yellow', 'purple', 'orange',
      'grey', 'gray', 'brown', 'navy', 'cream', 'ivory', 'mint', 'coral',
      'lavender', 'turquoise', 'gold', 'silver', 'rose', 'blanco', 'negro',
      'azul', 'rojo', 'verde', 'amarillo', 'morado', 'naranja', 'gris'
    ];
    
    if (colorPatterns.some(c => lowerPart.includes(c))) {
      result.color = part;
      continue;
    }
    
    // If it looks like a style code (alphanumeric with letters)
    if (/^[a-z]+\d+[a-z]*$/i.test(part) || /^\d+[a-z]+$/i.test(part)) {
      result.styleCode = part;
      continue;
    }
    
    // Default: if it's not numeric and not matched, might be color
    if (!/^\d+$/.test(part) && part.length > 1) {
      result.color = result.color || part;
    }
  }
  
  return result;
}

// Get or create attribute option
async function getOrCreateAttributeOption(
  supabase: any,
  attributeId: string,
  value: string,
  displayValue: string,
  colorHex?: string
): Promise<string> {
  // Check if exists
  const { data: existing } = await supabase
    .from('attribute_options')
    .select('id')
    .eq('attribute_id', attributeId)
    .eq('value', value.toLowerCase())
    .single();

  if (existing) return existing.id;

  // Create new
  const { data: newOption, error } = await supabase
    .from('attribute_options')
    .insert({
      attribute_id: attributeId,
      value: value.toLowerCase(),
      display_value: displayValue,
      color_hex: colorHex || null,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating attribute option:', error);
    throw error;
  }

  return newOption.id;
}

// Get color hex from color name
function getColorHex(colorName: string): string | undefined {
  const colorMap: Record<string, string> = {
    champagne: '#F7E7CE',
    'light-blue': '#ADD8E6',
    'peach-pink': '#FFDAB9',
    rosa: '#FFC0CB',
    pink: '#FFC0CB',
    white: '#FFFFFF',
    blanco: '#FFFFFF',
    beige: '#F5F5DC',
    blue: '#0000FF',
    azul: '#0000FF',
    red: '#FF0000',
    rojo: '#FF0000',
    green: '#008000',
    verde: '#008000',
    black: '#000000',
    negro: '#000000',
    yellow: '#FFFF00',
    amarillo: '#FFFF00',
    purple: '#800080',
    morado: '#800080',
    orange: '#FFA500',
    naranja: '#FFA500',
    grey: '#808080',
    gray: '#808080',
    gris: '#808080',
    brown: '#A52A2A',
    navy: '#000080',
    cream: '#FFFDD0',
    ivory: '#FFFFF0',
    mint: '#98FF98',
    coral: '#FF7F50',
    lavender: '#E6E6FA',
    turquoise: '#40E0D0',
    gold: '#FFD700',
    silver: '#C0C0C0',
    rose: '#FF007F',
  };

  return colorMap[colorName.toLowerCase()];
}

// Clean product name by removing variant info
function cleanProductName(nombre: string): string {
  // Remove patterns like "- Color X", "Talla X", etc.
  return nombre
    .replace(/\s*[-–]\s*(color|talla|size|edad|age)\s*[:\s]*\w+/gi, '')
    .replace(/\s*\(\s*(color|talla|size|edad|age)\s*[:\s]*\w+\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, dryRun = true } = await req.json();

    if (action === 'preview') {
      // Preview mode: analyze products and show what would be migrated
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('is_parent', false)
        .order('sku_interno');

      if (error) throw error;

      // Group by parent SKU
      const groups: Record<string, Product[]> = {};
      for (const product of products) {
        const parentSku = product.sku_interno.split('-')[0];
        if (!groups[parentSku]) {
          groups[parentSku] = [];
        }
        groups[parentSku].push(product);
      }

      // Analyze each group
      const details = Object.entries(groups).map(([parentSku, variants]) => {
        const colors = new Set<string>();
        const sizes = new Set<string>();
        const ages = new Set<string>();

        for (const variant of variants) {
          const parsed = parseSkuVariants(variant.sku_interno);
          if (parsed.color) colors.add(parsed.color);
          if (parsed.size) sizes.add(parsed.size);
          if (parsed.age) ages.add(parsed.age);
        }

        return {
          parentSku,
          variantCount: variants.length,
          sampleName: cleanProductName(variants[0].nombre),
          colorsFound: Array.from(colors),
          sizesFound: Array.from(sizes),
          agesFound: Array.from(ages),
          totalStock: variants.reduce((sum, v) => sum + (v.stock_fisico || 0), 0),
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          totalProducts: products.length,
          uniqueParentSkus: Object.keys(groups).length,
          details,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'migrate') {
      console.log('Starting migration, dryRun:', dryRun);
      
      // Get attributes
      const { data: attributes } = await supabase
        .from('attributes')
        .select('id, slug')
        .in('slug', ['color', 'size', 'age_group']);

      const attributeMap: Record<string, string> = {};
      for (const attr of attributes || []) {
        attributeMap[attr.slug] = attr.id;
      }

      console.log('Attribute map:', attributeMap);

      // Get all active non-parent products
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('is_parent', false)
        .order('sku_interno');

      if (error) throw error;

      // Group by parent SKU
      const groups: Record<string, Product[]> = {};
      for (const product of products) {
        const parentSku = product.sku_interno.split('-')[0];
        if (!groups[parentSku]) {
          groups[parentSku] = [];
        }
        groups[parentSku].push(product);
      }

      const result: MigrationResult = {
        success: true,
        parentProductsCreated: 0,
        variantsCreated: 0,
        attributeOptionsCreated: 0,
        errors: [],
        details: [],
      };

      // Process each group
      for (const [parentSku, variants] of Object.entries(groups)) {
        try {
          console.log(`Processing group: ${parentSku} with ${variants.length} variants`);
          
          const colors = new Set<string>();
          const sizes = new Set<string>();
          const ages = new Set<string>();

          // Parse all variants first
          const parsedVariants = variants.map(v => ({
            product: v,
            parsed: parseSkuVariants(v.sku_interno),
          }));

          for (const { parsed } of parsedVariants) {
            if (parsed.color) colors.add(parsed.color);
            if (parsed.size) sizes.add(parsed.size);
            if (parsed.age) ages.add(parsed.age);
          }

          result.details.push({
            parentSku,
            variantCount: variants.length,
            colorsFound: Array.from(colors),
            sizesFound: Array.from(sizes),
            agesFound: Array.from(ages),
          });

          if (dryRun) continue;

          // Select first variant as parent
          const parentProduct = variants[0];
          const cleanedName = cleanProductName(parentProduct.nombre);

          // Update the parent product
          const { error: updateError } = await supabase
            .from('products')
            .update({
              is_parent: true,
              sku_interno: parentSku,
              nombre: cleanedName,
            })
            .eq('id', parentProduct.id);

          if (updateError) {
            result.errors.push(`Error updating parent ${parentSku}: ${updateError.message}`);
            continue;
          }

          result.parentProductsCreated++;

          // Create variants for all products (including the first one)
          for (const { product, parsed } of parsedVariants) {
            // Build variant name
            const variantParts: string[] = [];
            if (parsed.color) variantParts.push(parsed.color);
            if (parsed.size) variantParts.push(`${parsed.size}cm`);
            if (parsed.age) variantParts.push(parsed.age);
            const variantName = variantParts.join(' / ') || product.sku_interno;

            // Create product variant
            const { data: newVariant, error: variantError } = await supabase
              .from('product_variants')
              .insert({
                product_id: parentProduct.id,
                sku: product.sku_interno,
                name: variantName,
                option_type: parsed.color ? 'color' : (parsed.size ? 'size' : 'age'),
                option_value: parsed.color || parsed.size || parsed.age || 'default',
                price: product.precio_mayorista,
                stock: product.stock_fisico,
                moq: product.moq || 1,
                images: product.imagen_principal ? [product.imagen_principal] : [],
                is_active: true,
                attribute_combination: {
                  color: parsed.color,
                  size: parsed.size,
                  age: parsed.age,
                },
              })
              .select('id')
              .single();

            if (variantError) {
              result.errors.push(`Error creating variant ${product.sku_interno}: ${variantError.message}`);
              continue;
            }

            result.variantsCreated++;

            // Create attribute options and link them
            const attributeLinks: { attribute_id: string; option_id: string }[] = [];

            if (parsed.color && attributeMap.color) {
              try {
                const optionId = await getOrCreateAttributeOption(
                  supabase,
                  attributeMap.color,
                  parsed.color,
                  parsed.color.charAt(0).toUpperCase() + parsed.color.slice(1),
                  getColorHex(parsed.color)
                );
                attributeLinks.push({ attribute_id: attributeMap.color, option_id: optionId });
                result.attributeOptionsCreated++;
              } catch (e) {
                console.error('Error creating color option:', e);
              }
            }

            if (parsed.size && attributeMap.size) {
              try {
                const optionId = await getOrCreateAttributeOption(
                  supabase,
                  attributeMap.size,
                  parsed.size,
                  `${parsed.size} cm`
                );
                attributeLinks.push({ attribute_id: attributeMap.size, option_id: optionId });
                result.attributeOptionsCreated++;
              } catch (e) {
                console.error('Error creating size option:', e);
              }
            }

            if (parsed.age && attributeMap.age_group) {
              try {
                const optionId = await getOrCreateAttributeOption(
                  supabase,
                  attributeMap.age_group,
                  parsed.age,
                  parsed.age
                );
                attributeLinks.push({ attribute_id: attributeMap.age_group, option_id: optionId });
                result.attributeOptionsCreated++;
              } catch (e) {
                console.error('Error creating age option:', e);
              }
            }

            // Link variant to attribute options via variant_attribute_values
            for (const link of attributeLinks) {
              await supabase
                .from('variant_attribute_values')
                .insert({
                  variant_id: newVariant.id,
                  attribute_id: link.attribute_id,
                  attribute_option_id: link.option_id,
                })
                .single();
            }

            // Log migration
            await supabase
              .from('product_migration_log')
              .insert({
                original_product_id: product.id,
                new_variant_id: newVariant.id,
                parent_sku: parentSku,
                status: 'completed',
              });

            // Deactivate original product if it's not the parent
            if (product.id !== parentProduct.id) {
              await supabase
                .from('products')
                .update({ 
                  is_active: false,
                  parent_product_id: parentProduct.id,
                })
                .eq('id', product.id);
            }
          }
        } catch (groupError: unknown) {
          const errorMsg = groupError instanceof Error ? groupError.message : String(groupError);
          console.error(`Error processing group ${parentSku}:`, groupError);
          result.errors.push(`Error processing group ${parentSku}: ${errorMsg}`);
        }
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "preview" or "migrate".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error in normalize-products:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
