/** Replace common ASCII transliterations with German umlauts (ae→ä, oe→ö, ue→ü). */
export function applyGermanUmlauts(text: string): string {
  return text
    .replace(/ae/g, 'ä')
    .replace(/Ae/g, 'Ä')
    .replace(/oe/g, 'ö')
    .replace(/Oe/g, 'Ö')
    .replace(/ue/g, 'ü')
    .replace(/Ue/g, 'Ü');
}

/** Capitalize the first character (sentence/start capitalization). */
export function capitalizeGermanLabel(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Fallback label for catalog keys: umlauts + start capitalization. */
export function formatGermanCatalogKey(key: string): string {
  return capitalizeGermanLabel(applyGermanUmlauts(key.trim()));
}
