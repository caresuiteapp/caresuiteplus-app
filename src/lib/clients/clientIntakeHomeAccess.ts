/** Parses persisted home_access (single key, comma-separated, or JSON array). */
export function parseHomeAccessStoredValue(value: string | null | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => entry.trim());
      }
    } catch {
      // fall through to comma-separated parsing
    }
  }

  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Serializes selected catalog keys for client_ambulatory_details.home_access. */
export function serializeHomeAccessValues(values: string[]): string | null {
  const filtered = values.map((value) => value.trim()).filter(Boolean);
  if (filtered.length === 0) return null;
  return filtered.join(',');
}
