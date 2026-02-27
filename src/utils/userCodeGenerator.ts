/**
 * Genera un código único para usuarios usando UUID v4 (криптографически seguro)
 * Formato: KZ + 10 caracteres hexadecimales + año
 * Ejemplo: KZ3F4A8B2D926
 * 
 * Similar al store slug pero con prefijo KZ para usuarios
 * KZ = "Kizk iZé" (Usuario de Kizk)
 */
export function generateUserCode(): string {
  const uuid = crypto.randomUUID();
  const hexPart = uuid.replace(/-/g, '').substring(0, 10).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  
  return `KZ${hexPart}${year}`;
}

/**
 * Valida si un código de usuario tiene el formato correcto
 */
export function isValidUserCode(code: string): boolean {
  // Formato: KZ + 10 caracteres hex + 2 dígitos
  const regex = /^KZ[0-9A-F]{10}\d{2}$/;
  return regex.test(code);
}

/**
 * Formatea un código de usuario para display con guiones
 * @example
 * formatUserCodeForDisplay("KZ3F4A8B2D926") => "KZ-3F4A-8B2D-926"
 */
export function formatUserCodeForDisplay(code: string): string {
  if (!isValidUserCode(code)) return code;
  
  // KZ3F4A8B2D926 => KZ-3F4A-8B2D-926
  const match = code.match(/^(KZ)([0-9A-F]{4})([0-9A-F]{4})([0-9A-F]{2})(\d{2})$/);
  if (!match) return code;
  
  const [, kz, part1, part2, part3, year] = match;
  return `${kz}-${part1}-${part2}-${part3}${year}`;
}

/**
 * Genera un código de usuario único con verificación en base de datos
 */
export async function generateUniqueUserCode(
  checkUniqueness: (code: string) => Promise<boolean>,
  maxAttempts: number = 10
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateUserCode();
    
    try {
      const isUnique = await checkUniqueness(code);
      if (isUnique) {
        return code;
      }
      
      console.warn(`User code collision detected: ${code} (attempt ${attempt + 1}/${maxAttempts})`);
    } catch (error) {
      console.error('Error checking user code uniqueness:', error);
    }
  }
  
  console.error(`Failed to generate unique user code after ${maxAttempts} attempts`);
  return null;
}
