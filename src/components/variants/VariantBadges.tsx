/**
 * Variant attribute badges shown on cart item rows.
 *
 * Unified design used across B2C CartPage and B2B SellerCartPage.
 */

function truncateText(input: string, maxChars: number) {
  if (!input || input.length <= maxChars) return input;
  return `${input.slice(0, Math.max(0, maxChars - 1))}\u2026`;
}

export type VariantBadgesProps = {
  color?: string | null;
  size?: string | null;
  /** Extra attributes beyond color/size (resolved as fallback) */
  variantAttributes?: Record<string, unknown> | null;
  /** Max characters per pill before truncating. Default: 14 */
  maxChars?: number;
  /** Wrapper layout classes. Default: "flex gap-1 flex-wrap" */
  className?: string;
  /** Omit "Talla:" label prefix for tight spaces. Default: false */
  compact?: boolean;
};

export function VariantBadges({
  color,
  size,
  variantAttributes,
  maxChars = 14,
  className = 'flex gap-1 flex-wrap',
  compact = false,
}: VariantBadgesProps) {
  const resolvedColor = color ?? (variantAttributes?.color as string) ?? null;
  const resolvedSize =
    size ??
    (variantAttributes?.size as string) ??
    (variantAttributes?.talla as string) ??
    (variantAttributes?.tama\u00f1o as string) ??
    null;

  if (!resolvedColor && !resolvedSize) return null;

  const pillBase =
    'inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium leading-none';

  return (
    <div className={className} aria-label="Variantes seleccionadas">
      {resolvedColor && (
        <span className={`${pillBase} bg-muted/80 text-foreground`} title={resolvedColor}>
          {truncateText(resolvedColor, maxChars)}
        </span>
      )}
      {resolvedSize && (
        <span className={`${pillBase} bg-accent/70 text-accent-foreground`} title={String(resolvedSize)}>
          {compact
            ? truncateText(String(resolvedSize), maxChars)
            : `Talla: ${truncateText(String(resolvedSize), maxChars)}`}
        </span>
      )}
    </div>
  );
}
