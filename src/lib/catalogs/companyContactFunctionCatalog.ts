import {
  companyCatalogOtherDetail,
  normalizeCompanyCatalogText,
  type CompanyCatalogChoice,
} from './companyRegistrationCatalog';

/** Describes the contact's function; it does not assign application permissions. */
export const COMPANY_CONTACT_FUNCTIONS: readonly CompanyCatalogChoice[] = [
  { key: 'geschaeftsfuehrung', label: 'Geschäftsführung', aliases: ['Geschäftsführer', 'Geschäftsführerin', 'Geschäftsführer:in'] },
  { key: 'stellv_geschaeftsfuehrung', label: 'Stellvertretende Geschäftsführung', optionLabel: 'Stellv. Geschäftsführung', aliases: ['Stellv. Geschäftsführung'] },
  { key: 'inhaber', label: 'Inhaber:in', aliases: ['Inhaber', 'Inhaberin'] },
  { key: 'prokura', label: 'Prokura', aliases: ['Prokurist', 'Prokuristin', 'Prokurist:in'] },
  { key: 'betriebsleitung', label: 'Betriebsleitung', aliases: ['Betriebsleiter', 'Betriebsleiterin'] },
  { key: 'einrichtungsleitung', label: 'Einrichtungsleitung', aliases: ['Einrichtungsleiter', 'Einrichtungsleiterin'] },
  { key: 'pflegedienstleitung', label: 'Pflegedienstleitung (PDL)', aliases: ['Pflegedienstleitung', 'PDL'] },
  { key: 'stellv_pflegedienstleitung', label: 'Stellvertretende Pflegedienstleitung', optionLabel: 'Stellv. Pflegedienstleitung', aliases: ['Stellv. Pflegedienstleitung', 'Stellv. PDL'] },
  { key: 'teamleitung', label: 'Teamleitung', aliases: ['Teamleiter', 'Teamleiterin'] },
  { key: 'verwaltung', label: 'Verwaltung / Büro', aliases: ['Verwaltung', 'Büro', 'Büromanagement'] },
  { key: 'personalverwaltung', label: 'Personalverwaltung', aliases: ['Personalabteilung'] },
  { key: 'buchhaltung', label: 'Abrechnung / Buchhaltung', aliases: ['Abrechnung', 'Buchhaltung'] },
  { key: 'it_administration', label: 'IT / Systemadministration', aliases: ['IT', 'Systemadministration', 'IT-Administration'] },
  { key: 'sonstige', label: 'Sonstige Funktion', aliases: [] },
];

export function resolveCompanyContactFunction(value: unknown): CompanyCatalogChoice | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (companyCatalogOtherDetail(value) !== null) return COMPANY_CONTACT_FUNCTIONS.find(row => row.key === 'sonstige')!;
  const text = normalizeCompanyCatalogText(value);
  return COMPANY_CONTACT_FUNCTIONS.find(row => [row.key, row.label, ...row.aliases].some(alias => normalizeCompanyCatalogText(alias) === text)) ?? null;
}

export function canonicalCompanyContactFunction(value: string): string | null {
  const choice = resolveCompanyContactFunction(value);
  if (!choice) return null;
  if (choice.key !== 'sonstige') return choice.label;
  const detail = companyCatalogOtherDetail(value);
  return detail && detail.length >= 2 && detail.length <= 180 ? `Sonstige: ${detail}` : null;
}

export function validateCompanyContactFunction(value: string): string | null {
  if (!resolveCompanyContactFunction(value)) return 'Bitte die Funktion aus den Vorgaben auswählen.';
  if (value.length > 200) return 'Bitte die Funktion auf höchstens 200 Zeichen begrenzen.';
  if (!canonicalCompanyContactFunction(value)) return 'Bitte „Sonstige Funktion“ mit 2 bis 180 Zeichen genauer beschreiben.';
  return null;
}
