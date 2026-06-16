/** Erkennt {{group.field}} Platzhalter in HTML-Vorlagen. */

const PLACEHOLDER_PATTERN = /\{\{\s*([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)\s*\}\}/gi;

export function extractPlaceholders(htmlTemplate: string): string[] {
  if (!htmlTemplate?.trim()) return [];

  const found = new Set<string>();
  for (const match of htmlTemplate.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1]?.trim().toLowerCase();
    if (key) found.add(key);
  }
  return [...found].sort();
}

export function replacePlaceholderTokens(
  html: string,
  replacer: (key: string, raw: string) => string,
): string {
  return html.replace(PLACEHOLDER_PATTERN, (raw, key: string) => {
    const normalized = key.trim().toLowerCase();
    return replacer(normalized, raw);
  });
}
