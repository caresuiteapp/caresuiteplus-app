import type { TenantCenterSectionKey, TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import { filterCompanyCatalog } from './tenantServiceCatalogEditor';

export const COMPANY_TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'identity', label: 'Unternehmensprofil' },
  { id: 'compliance', label: 'Recht & Steuer' },
  { id: 'finance', label: 'Abrechnung' },
  { id: 'organization', label: 'Organisation' },
  { id: 'history', label: 'Aktivitäten' },
] as const;
export type CompanyTab = typeof COMPANY_TABS[number]['id'];
export type CompanySection = {
  key: TenantCenterSectionKey;
  tab: CompanyTab;
  title: string;
  description: string;
  icon: string;
  rows: [string, string][];
  action: string;
  populated: boolean;
  optional?: boolean;
  searchText?: string;
};
export type CompanySuggestion = { id: string; section: TenantCenterSectionKey; title: string; description: string };

const clean = (value?: string | null) => value?.trim() ?? '';
export function companyIdentity(snapshot: TenantCenterSnapshot) {
  const company = snapshot.company;
  const legal = clean(company.legalName);
  const legacyRepresentative = /^vertreten\s+durch\b/i.test(legal);
  const name = clean(company.name) || (!legacyRepresentative ? legal : '') || 'Ihr Unternehmen';
  const representative = snapshot.representatives.find(person => person.isPrimary) ?? snapshot.representatives[0];
  const representativeName = representative ? [representative.salutation, representative.firstName, representative.lastName].map(clean).filter(Boolean).join(' ') : '';
  const addressParts = [[company.street, company.houseNumber].map(clean).filter(Boolean).join(' '), [company.zip, company.city].map(clean).filter(Boolean).join(' ')].filter(Boolean);
  return {
    name,
    legalName: !legacyRepresentative && legal !== name ? legal : '',
    representative: representativeName || (legacyRepresentative ? legal.replace(/^vertreten\s+durch\s*/i, '').trim() : ''),
    address: addressParts.length ? [...addressParts, clean(company.country)].filter(Boolean).join(' · ') : '',
    email: clean(company.email) || clean(snapshot.contact.supportEmail),
    phone: clean(company.phone) || clean(snapshot.contact.supportPhone),
    initials: name.split(/[\s–-]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('de-DE'),
  };
}
export function activeCompanyCatalog(snapshot: TenantCenterSnapshot) {
  return filterCompanyCatalog(snapshot.catalogItems, 'all', '').filter(item => item.isActive);
}
export function companyWebsite(value: string): string | null {
  const input = clean(value);
  if (!input) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function companyDate(value: string, withTime = false): string {
  if (!value) return 'Datum nicht hinterlegt';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Datum nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } as const : {}), timeZone: 'Europe/Berlin' }).format(date);
}
export function maskedCompanyIban(value: string): string {
  const iban = value.replace(/\s/g, '');
  return iban ? `${iban.slice(0, 2)} •••• •••• ${iban.slice(-4)}` : '';
}
export function companySuggestions(s: TenantCenterSnapshot): CompanySuggestion[] {
  const items: CompanySuggestion[] = [];
  if (!clean(s.company.name)) items.push({ id: 'name', section: 'company', title: 'Unternehmensname ergänzen', description: 'Für die Unternehmensakte und Ihre Dokumente.' });
  if (![s.company.street, s.company.houseNumber, s.company.zip, s.company.city].every(value => clean(value))) items.push({ id: 'address', section: 'company', title: 'Anschrift ergänzen', description: 'Straße, Hausnummer, Postleitzahl und Ort Ihres Unternehmens.' });
  if (!companyIdentity(s).email && !companyIdentity(s).phone) items.push({ id: 'contact', section: 'contact', title: 'Erreichbarkeit hinterlegen', description: 'Eine E-Mail-Adresse oder Telefonnummer für Rückfragen.' });
  if (s.bankAccounts.length && !s.bankAccounts.some(bank => bank.isPrimary)) items.push({ id: 'primary-bank', section: 'bank', title: 'Hauptkonto auswählen', description: 'Legen Sie fest, welche Bankverbindung bevorzugt verwendet wird.' });
  if (s.representatives.length > 1 && !s.representatives.some(person => person.isPrimary)) items.push({ id: 'primary-representative', section: 'representatives', title: 'Hauptvertretung auswählen', description: 'Eine vertretungsberechtigte Person als erste Ansprechperson festlegen.' });
  if (activeCompanyCatalog(s).some(item => item.defaultPriceNet === null)) items.push({ id: 'prices', section: 'catalog', title: 'Fehlende Preise prüfen', description: 'Mindestens eine aktive Katalogposition hat noch keinen Preis.' });
  return items;
}
export function companySections(s: TenantCenterSnapshot, activeAreas: readonly string[]): CompanySection[] {
  const identity = companyIdentity(s);
  const bank = s.bankAccounts.find(item => item.isPrimary) ?? s.bankAccounts[0];
  const activeServices = activeCompanyCatalog(s);
  const taxSchemes = { standard: 'Regelbesteuerung', kleinunternehmer: 'Kleinunternehmerregelung', exempt: 'Steuerbefreit' };
  const sections: Omit<CompanySection, 'populated'>[] = [
    { key: 'company', tab: 'identity', title: 'Unternehmensdaten', icon: 'building', description: 'Name, Rechtsform und Hauptsitz Ihres Unternehmens.', rows: [['Rechtsform', s.company.legalForm], ['Branche', s.company.industry], ['Anschrift', identity.address], ['Website', s.company.website]], action: 'Stammdaten bearbeiten' },
    { key: 'contact', tab: 'identity', title: 'Kontakt & Kommunikation', icon: 'mail', description: 'Erreichbarkeit, Abrechnung und Ihre Ansprechpersonen.', rows: [['E-Mail', identity.email], ['Telefon', identity.phone], ['Abrechnung', s.contact.billingEmail], ['Ansprechpersonen', s.contact.contactPersons.length ? `${s.contact.contactPersons.length} hinterlegt` : '']], action: 'Kontakte bearbeiten' },
    { key: 'representatives', tab: 'identity', title: 'Geschäftsführung & Vertretung', icon: 'people', description: 'Vertretungsberechtigte Personen und Hauptvertretung.', rows: [['Hauptvertretung', identity.representative], ['Personen', s.representatives.length ? `${s.representatives.length} hinterlegt` : '']], action: 'Vertretung bearbeiten' },
    { key: 'branding', tab: 'identity', title: 'Unternehmenslogo', icon: 'image', description: 'Ihr Logo für den Auftritt und die Unternehmensunterlagen.', rows: [['Logo', s.branding.logoUrl ? 'Eigenes Logo hinterlegt' : '']], action: 'Logo bearbeiten', optional: true },
    { key: 'legal', tab: 'compliance', title: 'Versicherung & Verbände', icon: 'shield', description: 'Haftpflichtversicherung, Kammer und Berufsverband.', rows: [['Versicherer', s.legal.liabilityInsurer], ['Versicherung', s.legal.liabilityInsurance], ['Versicherungsnummer', s.legal.liabilityPolicyNumber], ['Berufsverband', s.legal.professionalAssociation]], action: 'Angaben bearbeiten', optional: true },
    { key: 'tax', tab: 'compliance', title: 'Steuerdaten', icon: 'receipt', description: 'Steuerliche Kennzeichen und die hinterlegte Besteuerung.', rows: [['Steuernummer', s.tax.taxNumber], ['USt-IdNr.', s.tax.vatId], ['Finanzamt', s.tax.taxOffice], ['Besteuerung', taxSchemes[s.tax.taxScheme] ?? '']], action: 'Steuerdaten bearbeiten', optional: true },
    { key: 'register', tab: 'compliance', title: 'Register, IK & Aufsicht', icon: 'certificate', description: 'Registereintrag, Institutionskennzeichen und Aufsichtsbehörde.', rows: [['Registergericht', s.register.registerCourt], ['Registernummer', s.register.registerNumber], ['Institutionskennzeichen', s.register.ikNumber], ['Aufsichtsbehörde', s.register.supervisoryAuthority]], action: 'Registerangaben bearbeiten', optional: true },
    { key: 'bank', tab: 'finance', title: 'Bankverbindungen', icon: 'bank', description: 'Bankkonten und die bevorzugte Verbindung für Ihre Abrechnung.', rows: [['Kontoinhaber', bank?.accountHolder ?? ''], ['Bank', bank?.bankName ?? ''], ['IBAN', maskedCompanyIban(bank?.iban ?? '')], ['Konten', s.bankAccounts.length ? `${s.bankAccounts.length} hinterlegt` : '']], action: 'Bankverbindungen bearbeiten' },
    { key: 'payment', tab: 'finance', title: 'Rechnung & Zahlungsziel', icon: 'receipt', description: 'Zahlungsfristen, Mahnung und Texte auf Ihren Rechnungen.', rows: [['Zahlungsziel', s.payment.paymentTermsDays ? `${s.payment.paymentTermsDays} Tage` : ''], ['Mahnung nach', s.payment.dunningAfterDays ? `${s.payment.dunningAfterDays} Tagen` : ''], ['Rechnungspräfix', s.payment.invoicePrefix], ['Rechnungstext', s.payment.invoiceFooterText]], action: 'Zahlungsbedingungen bearbeiten' },
    { key: 'catalog', tab: 'finance', title: 'Leistungen & Preise', icon: 'catalog', description: 'Leistungen, Einheiten und Preise zentral pflegen.', rows: [['Aktive Positionen', `${activeServices.length}`], ['Mit Preis', `${activeServices.filter(item => item.defaultPriceNet !== null).length}`]], action: 'Leistungskatalog öffnen' },
    { key: 'travelSurcharges', tab: 'finance', title: 'Fahrtkosten & Zuschläge', icon: 'car', description: 'Fahrtkosten und Zuschläge im selben Leistungskatalog verwalten.', rows: [['Fahrtkosten', `${activeServices.filter(item => item.category === 'travel').length} Positionen`], ['Zuschläge', `${activeServices.filter(item => item.category === 'surcharge').length} Positionen`]], action: 'Fahrtkosten öffnen', optional: true },
    { key: 'clientServiceTypes', tab: 'finance', title: 'Leistungsarten für Klient:innen', icon: 'people', description: 'Unternehmensweite Vorlagen für die angebotenen Leistungsarten.', rows: [], action: 'Leistungsarten öffnen', optional: true },
    { key: 'clientBudgetDefaults', tab: 'finance', title: 'Budgetvorlagen', icon: 'wallet', description: 'Vorgaben für Budgetjahre und Budgets bei der Aufnahme.', rows: [], action: 'Budgetvorlagen öffnen', optional: true },
    { key: 'modules', tab: 'organization', title: 'Leistungsbereiche', icon: 'grid', description: 'Die aktuell für Ihr Unternehmen verfügbaren Bereiche.', rows: [['Verfügbar', activeAreas.join(' · ')]], action: 'Bereiche ansehen' },
    { key: 'customFields', tab: 'organization', title: 'Eigene Angaben', icon: 'sliders', description: 'Zusätzliche Felddefinitionen für Ihre Unternehmensunterlagen.', rows: [['Felddefinitionen', `${s.customFields.length}`]], action: 'Feld hinzufügen', optional: true },
    { key: 'dataManagement', tab: 'organization', title: 'Daten importieren & exportieren', icon: 'transfer', description: 'Klient:innen und Personal über CSV-Dateien übernehmen oder exportieren.', rows: [], action: 'Datenverwaltung öffnen', optional: true },
  ];
  return sections.map(section => ({ ...section,
    searchText: section.key === 'contact' ? s.contact.contactPersons.map(person => [person.firstName, person.lastName, person.role, person.email, person.phone].join(' ')).join(' ') : section.key === 'customFields' ? s.customFields.map(field => field.label).join(' ') : section.key === 'representatives' ? s.representatives.map(person => [person.firstName, person.lastName, person.position].join(' ')).join(' ') : '',
    populated: section.rows.some(([, value]) => Boolean(clean(value))) }));
}
export function filterCompanySections(sections: readonly CompanySection[], query: string): CompanySection[] {
  const needle = query.trim().toLocaleLowerCase('de-DE');
  return sections.filter(section => !needle || [section.title, section.description, section.searchText, ...section.rows.flat()].join(' ').toLocaleLowerCase('de-DE').includes(needle));
}
