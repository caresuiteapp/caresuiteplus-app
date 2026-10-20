/** Normalize user query for case-insensitive matching. */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** True when query is non-empty and matches any provided field. */
export function matchesSearchQuery(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return false;
  return fields.some((field) => field?.toLowerCase().includes(normalized));
}

/** Rank helper — earlier field matches score higher. */
export function searchMatchScore(
  query: string,
  ...fields: (string | null | undefined)[]
): number {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return 0;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]?.toLowerCase() ?? '';
    if (!field.includes(normalized)) continue;
    if (field.startsWith(normalized)) return 100 - index * 10;
    return 50 - index * 5;
  }
  return 0;
}

export function sortBySearchRelevance<T>(
  query: string,
  items: T[],
  getFields: (item: T) => (string | null | undefined)[],
): T[] {
  return [...items].sort((a, b) => {
    const scoreB = searchMatchScore(query, ...getFields(b));
    const scoreA = searchMatchScore(query, ...getFields(a));
    return scoreB - scoreA;
  });
}
