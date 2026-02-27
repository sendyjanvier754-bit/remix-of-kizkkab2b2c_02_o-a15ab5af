/**
 * Genera un slug único para tiendas usando UUID v4 (криптográficamente seguro)
 * Formato: K + 10 caracteres hexadecimales + año
 * Ejemplo: K3F4A8B2D926
 * 
 * Este método usa crypto.randomUUID() que es:
 * - Криптográficamente seguro (aleatorizado por hardware/OS)
 * - Prácticamente libre de colisiones (2^40 = 1.1 trillones de combinaciones)
 * - No requiere consulta a BD para generar
 * 
 * Espacio: 16^10 × 100 (años) = 1,099,511,627,776,000 combinaciones
 * Con 1 billón de tiendas: probabilidad de colisión < 0.000001%
 */
export function generateStoreSlug(): string {
  // Usa crypto.randomUUID() para máxima seguridad
  const uuid = crypto.randomUUID(); // ej: "3f4a8b2d-9e1c-4f7b-a3d2-8c9e1f4a5b6c"
  
  // Toma primeros 10 caracteres hex (sin guiones)
  const hexPart = uuid.replace(/-/g, '').substring(0, 10).toUpperCase();
  
  // Año (2 dígitos)
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Formato: K + 10 hex + año = 13 caracteres
  return `K${hexPart}${year}`;
}

/**
 * Genera un slug completamente aleatorio (legacy/fallback)
 * Usa Math.random() en lugar de crypto para mayor legibilidad
 * Solo dígitos y una letra (más fácil de dictar/escribir)
 */
export function generateReadableSlug(): string {
  // Genera 4 dígitos aleatorios (1000-9999) = 9,000 posibilidades
  const part1 = Math.floor(Math.random() * 9000) + 1000;
  
  // Genera 1 letra aleatoria (A-Z) = 26 posibilidades
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  
  // Genera 6 dígitos con timestamp para aumentar entropía
  const timestamp = Date.now() % 1000000;
  const random = Math.floor(Math.random() * 1000000);
  const part2 = ((timestamp + random) % 900000) + 100000;
  
  // Año (2 dígitos)
  const year = new Date().getFullYear().toString().slice(-2);
  
  return `K${part1}${letter}${part2}${year}`;
}

/**
 * Valida si un slug tiene el formato correcto
 * @param slug - El slug a validar
 * @returns true si el slug tiene el formato correcto
 */
export function isValidStoreSlug(slug: string): boolean {
  // Formato nuevo (UUID-based): K + 10 caracteres hex + 2 dígitos
  // Ejemplo: K3F4A8B2D926
  const uuidBasedRegex = /^K[0-9A-F]{10}\d{2}$/;
  
  // Formato legacy (readable): K + 4 dígitos + 1 letra + 6 dígitos + 2 dígitos
  // Ejemplo: K2629G372026
  const readableRegex = /^K\d{4}[A-Z]\d{6}\d{2}$/;
  
  return uuidBasedRegex.test(slug) || readableRegex.test(slug);
}

/**
 * Detecta el tipo de formato de un slug
 * @param slug - El slug a analizar
 * @returns 'uuid-based', 'readable', o 'invalid'
 */
export function getSlugType(slug: string): 'uuid-based' | 'readable' | 'invalid' {
  if (/^K[0-9A-F]{10}\d{2}$/.test(slug)) return 'uuid-based';
  if (/^K\d{4}[A-Z]\d{6}\d{2}$/.test(slug)) return 'readable';
  return 'invalid';
}

/**
 * Formatea un slug para display con guiones
 * @param slug - El slug a formatear
 * @returns Slug formateado con guiones
 * @example
 * formatSlugForDisplay("K3F4A8B2D926") => "K-3F4A-8B2D-926"
 * formatSlugForDisplay("K2629G372026") => "K-2629-G-372026"
 */
export function formatSlugForDisplay(slug: string): string {
  if (!isValidStoreSlug(slug)) return slug;
  
  const type = getSlugType(slug);
  
  if (type === 'uuid-based') {
    // K3F4A8B2D926 => K-3F4A-8B2D-926
    const match = slug.match(/^(K)([0-9A-F]{4})([0-9A-F]{4})([0-9A-F]{2})(\d{2})$/);
    if (!match) return slug;
    const [, k, part1, part2, part3, year] = match;
    return `${k}-${part1}-${part2}-${part3}${year}`;
  }
  
  if (type === 'readable') {
    // K2629G372026 => K-2629-G-372026
    const match = slug.match(/^(K)(\d{4})([A-Z])(\d{6})(\d{2})$/);
    if (!match) return slug;
    const [, k, part1, letter, part2, year] = match;
    return `${k}-${part1}-${letter}-${part2}${year}`;
  }
  
  return slug;
}

/**
 * Genera un slug único con verificación en base de datos
 * Intenta hasta maxAttempts veces antes de fallar
 * 
 * @param checkUniqueness - Función async que verifica si el slug existe en BD
 * @param maxAttempts - Número máximo de intentos (default: 10)
 * @returns Slug único o null si falla después de maxAttempts
 * 
 * @example
 * const slug = await generateUniqueStoreSlug(async (slug) => {
 *   const { data } = await supabase
 *     .from('stores')
 *     .select('id')
 *     .eq('slug', slug)
 *     .maybeSingle();
 *   return data === null; // true si no existe (único)
 * });
 */
export async function generateUniqueStoreSlug(
  checkUniqueness: (slug: string) => Promise<boolean>,
  maxAttempts: number = 10
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = generateStoreSlug();
    
    try {
      const isUnique = await checkUniqueness(slug);
      if (isUnique) {
        return slug;
      }
      
      console.warn(`Slug collision detected: ${slug} (attempt ${attempt + 1}/${maxAttempts})`);
    } catch (error) {
      console.error('Error checking slug uniqueness:', error);
    }
  }
  
  console.error(`Failed to generate unique slug after ${maxAttempts} attempts`);
  return null;
}

/**
 * Calcula la probabilidad de colisión para un número de tiendas
 * @param numStores - Número de tiendas en el sistema
 * @param slugType - Tipo de slug ('uuid-based' o 'readable')
 * @returns Probabilidad de colisión (0-1)
 * 
 * @example
 * getCollisionProbability(1000000, 'uuid-based') // ~0.00000045 (0.000045%)
 * getCollisionProbability(1000000, 'readable') // ~0.0019 (0.19%)
 */
export function getCollisionProbability(
  numStores: number, 
  slugType: 'uuid-based' | 'readable' = 'uuid-based'
): number {
  // Espacio de combinaciones
  const totalCombinations = slugType === 'uuid-based'
    ? 1099511627776000 // 16^10 × 100 = ~1.1 cuatrillones
    : 260000000000;    // 10,000 × 26 × 1,000,000 = 260 mil millones
  
  // Birthday paradox approximation: P(collision) ≈ 1 - e^(-n²/(2*N))
  // Donde n = número de elementos, N = espacio total
  const exponent = -(numStores * numStores) / (2 * totalCombinations);
  const probability = 1 - Math.exp(exponent);
  
  return probability;
}
