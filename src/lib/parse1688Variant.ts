export interface Parsed1688Variant {
  productName: string;
  color: string;
  size: string;
  raw: string;
}

const COLOR_HEADER_ALIASES = [
  'variante1color', 'variant1color', 'variant1', 'color', '颜色', '规格1',
];

const SIZE_HEADER_ALIASES = [
  'variante2talla', 'variant2size', 'variant2', 'talla', 'size', '尺码', '尺寸', '规格2',
];

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[\s_\-():]/g, '');

const matchesAlias = (header: string, aliases: string[]) => {
  const normalized = normalizeHeader(header);
  return aliases.some(alias => normalized === normalizeHeader(alias) || normalized.includes(normalizeHeader(alias)));
};

export function find1688VariantColumns(headers: string[]) {
  return {
    color: headers.find(header => matchesAlias(header, COLOR_HEADER_ALIASES)) || '',
    size: headers.find(header => matchesAlias(header, SIZE_HEADER_ALIASES)) || '',
  };
}

const SIZE_TOKEN = /(?:\d{1,3}(?:[.]\d{1,2})?|XS|S|M|L|XL|XXL|XXXL|[2-9]XL|\d+[-/]\d+[-/]\d+\s*mm?)/i;
const SIZE_AT_END = new RegExp(`(?:^|[\\s/|，,;:])(${SIZE_TOKEN.source})\\s*$`, 'i');

const cleanVariantText = (value: unknown) => String(value ?? '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/[：]/g, ':')
  .trim();

/**
 * Parses 1688 values such as "Q05 white beige，39" into product/color/size.
 * The original raw value is always retained for traceability.
 */
export function parse1688VariantText(value: unknown): Parsed1688Variant {
  const raw = cleanVariantText(value);
  if (!raw) return { productName: '', color: '', size: '', raw: '' };

  const parts = raw.split(/[，,|;]+/).map(part => part.trim()).filter(Boolean);
  let left = parts[0] || raw;
  let size = parts.length > 1 && SIZE_TOKEN.test(parts[parts.length - 1])
    ? parts[parts.length - 1]
    : '';

  if (!size) {
    const match = left.match(SIZE_AT_END);
    if (match) {
      size = match[1];
      left = left.slice(0, match.index).trim();
    }
  }

  if (!size && parts.length === 1) {
    const tokens = raw.split(/\s+/).filter(Boolean);
    const productName = tokens.shift() || raw;
    return { productName, color: tokens.join(' ').trim(), size: '', raw };
  }

  const tokens = left.split(/\s+/).filter(Boolean);
  const looksLikeModelCode = tokens.length > 1 && /^[A-Z]{1,8}\d+[A-Z\d-]*$/i.test(tokens[0]);
  const productName = looksLikeModelCode ? tokens.shift() || '' : '';
  const color = (looksLikeModelCode ? tokens : [left]).join(' ').trim();

  return { productName, color, size, raw };
}

export function parse1688RowVariant(
  row: Record<string, unknown>,
  title: string,
  columns: { color?: string; size?: string },
): Parsed1688Variant {
  const explicitColor = columns.color ? cleanVariantText(row[columns.color]) : '';
  const explicitSize = columns.size ? cleanVariantText(row[columns.size]) : '';
  if (explicitColor || explicitSize) {
    return {
      productName: title,
      color: explicitColor,
      size: explicitSize,
      raw: [explicitColor, explicitSize].filter(Boolean).join(' / '),
    };
  }
  return parse1688VariantText(title);
}
