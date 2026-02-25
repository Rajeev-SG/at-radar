export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

export function safeIsoDate(input: string | Date | number | undefined | null): string | undefined {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

export function decodeCursor<T = Record<string, unknown>>(cursor: string | null): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function regexFromConfig(pattern: string): RegExp {
  let flags = '';
  let source = pattern;
  const inlineFlagMatch = source.match(/^\(\?([a-z]+)\)/i);
  if (inlineFlagMatch) {
    flags = inlineFlagMatch[1];
    source = source.slice(inlineFlagMatch[0].length);
  }
  source = source.replace(/\\\\/g, '\\');
  return new RegExp(source, flags);
}

export function extractTextDeep(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(extractTextDeep).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if ('#text' in obj) return extractTextDeep(obj['#text']);
    if ('__cdata' in obj) return extractTextDeep(obj['__cdata']);
    return keys
      .filter((k) => !k.startsWith('@_'))
      .map((k) => extractTextDeep(obj[k]))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

export function passesTextFilters(
  text: string,
  filters: { include?: string; exclude?: string },
): boolean {
  const candidate = text ?? '';
  if (filters.include && !regexFromConfig(filters.include).test(candidate)) return false;
  if (filters.exclude && regexFromConfig(filters.exclude).test(candidate)) return false;
  return true;
}
