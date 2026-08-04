export const CLIENT_FUNDING_SOURCE_KEYS = [
  'entlastungsleistung',
  'umwandlung',
  'verhinderungspflege',
  'selbstzahler',
] as const;

export type ClientFundingSourceKey = (typeof CLIENT_FUNDING_SOURCE_KEYS)[number];

export const CLIENT_FUNDING_SOURCE_LABELS: Record<ClientFundingSourceKey, string> = {
  entlastungsleistung: 'Entlastungsleistungen',
  umwandlung: '40-%-Umwandlung',
  verhinderungspflege: 'Verhinderungspflege',
  selbstzahler: 'Selbstzahler',
};

export const CLIENT_FUNDING_SOURCE_DESCRIPTIONS: Record<ClientFundingSourceKey, string> = {
  entlastungsleistung: 'Entlastungsbetrag nach § 45b SGB XI',
  umwandlung: 'Umwandlungsanspruch nach § 45a Abs. 4 SGB XI',
  verhinderungspflege: 'Leistungen nach § 39 SGB XI',
  selbstzahler: 'Private Abrechnung vereinbarter Leistungen oder Restbeträge',
};

export function isClientFundingSourceKey(value: unknown): value is ClientFundingSourceKey {
  return typeof value === 'string'
    && (CLIENT_FUNDING_SOURCE_KEYS as readonly string[]).includes(value);
}

export function normalizeClientFundingSources(values: readonly unknown[]): ClientFundingSourceKey[] {
  const selected = new Set(values.filter(isClientFundingSourceKey));
  return CLIENT_FUNDING_SOURCE_KEYS.filter((key) => selected.has(key));
}

export function fundingSourceForCatalogKey(catalogKey: string): ClientFundingSourceKey | null {
  if (catalogKey === 'paragraph_45b') return 'entlastungsleistung';
  if (catalogKey.startsWith('umwandlung_')) return 'umwandlung';
  if (
    catalogKey === 'verhinderungspflege'
    || catalogKey === 'gemeinsames_jahresbudget'
  ) return 'verhinderungspflege';
  if (catalogKey === 'selbstzahler') return 'selbstzahler';
  return null;
}

export function isCatalogKeySelected(
  catalogKey: string,
  fundingSources: readonly ClientFundingSourceKey[],
): boolean {
  const source = fundingSourceForCatalogKey(catalogKey);
  return source === null || fundingSources.includes(source);
}
