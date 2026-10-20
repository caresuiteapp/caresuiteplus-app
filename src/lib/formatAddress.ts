/**
 * Central German address formatting — prevents duplicate house numbers (e.g. "Ringstraße 3 3").
 */

export type FormatAddressInput = {
  street?: string | null;
  houseNumber?: string | null;
  zip?: string | null;
  city?: string | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Returns street line without duplicating house number when street already ends with it. */
export function formatStreetLine(street?: string | null, houseNumber?: string | null): string {
  const streetTrim = normalizeWhitespace(street ?? '');
  const houseTrim = normalizeWhitespace(houseNumber ?? '');

  if (!streetTrim && !houseTrim) return '';
  if (!houseTrim) return streetTrim;
  if (!streetTrim) return houseTrim;

  const streetLower = streetTrim.toLowerCase();
  const houseLower = houseTrim.toLowerCase();

  if (streetLower.endsWith(` ${houseLower}`) || streetLower.endsWith(houseLower)) {
    return streetTrim;
  }

  return normalizeWhitespace(`${streetTrim} ${houseTrim}`);
}

/** Full single-line address: "Ringstraße 3, 44627 Herne" */
export function formatAddress(input: FormatAddressInput): string {
  const streetLine = formatStreetLine(input.street, input.houseNumber);
  const locality = normalizeWhitespace(
    [input.zip?.trim(), input.city?.trim()].filter(Boolean).join(' '),
  );

  return [streetLine, locality].filter(Boolean).join(', ');
}

/** Parse snapshot or raw line — if snapshot present, use as-is after whitespace normalize. */
export function formatAddressFromSnapshotOrParts(
  snapshot: string | null | undefined,
  parts: FormatAddressInput,
): string {
  const snap = snapshot?.trim();
  if (snap) return normalizeWhitespace(snap);
  return formatAddress(parts);
}
