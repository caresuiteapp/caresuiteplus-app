/** Service keys / names that represent Begleitungsleistungen (not generic Einsätze). */
const BEGLEITUNG_SERVICE_FRAGMENTS = [
  'begleitung',
  'alltagsbegleitung',
  'einkauf_begleitung',
  'einkaufsbegleitung',
  'arztbegleitung',
  'freizeitbegleitung',
  'begleitung_ausser_haus',
  'begleitung_ausserhaus',
] as const;

function normalizeServiceToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** True when a visit/assignment row represents a Begleitungsleistung (not Haushalt/Betreuung alone). */
export function isPortalBegleitungService(input: {
  serviceKey?: string | null;
  serviceName?: string | null;
  title?: string | null;
}): boolean {
  const tokens = [
    normalizeServiceToken(input.serviceKey),
    normalizeServiceToken(input.serviceName),
    normalizeServiceToken(input.title),
  ].filter(Boolean);

  if (tokens.length === 0) return false;

  return tokens.some((token) =>
    BEGLEITUNG_SERVICE_FRAGMENTS.some((fragment) => token.includes(fragment)),
  );
}
