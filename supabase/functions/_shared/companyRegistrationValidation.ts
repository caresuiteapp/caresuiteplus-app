import { COMPANY_REGISTRATION_CATALOG_VERSION, normalizeCompanyRegistrationSelection, validateCompanyRegistrationSelection } from './companyRegistrationCatalog.ts';
import { validateCompanyContactFunction } from './companyContactFunctionCatalog.ts';

function usesCompanyCatalog(body: Record<string, unknown>): boolean {
  return body.registrationCatalogVersion != null || body.legalFormKey != null || body.industryKey != null;
}


export function validateRegistrationBody(body: Record<string, unknown>): string | null {
  if (!body || Array.isArray(body) || typeof body !== 'object') return 'Ungültige Registrierungsdaten.';
  for (const key of ['companyName','legalForm','industry','street','zip','city','phone','email','adminFirstName','adminLastName','adminEmail']) {
    if (typeof body[key] !== 'string' || !(body[key] as string).trim() || (body[key] as string).length > 200) {
      return 'Bitte Unternehmensdaten, Anschrift und Administrationskonto vollständig ausfüllen (höchstens 200 Zeichen je Feld).';
    }
  }
  if (!['email','adminEmail'].every(key => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((body[key] as string).trim()))) return 'Bitte gültige E-Mail-Adressen eingeben.';
  if (typeof body.adminPassword !== 'string' || body.adminPassword.length < 10 || body.adminPassword.length > 128) return 'Das Passwort muss 10 bis 128 Zeichen lang sein.';
  if (body.termsAccepted !== true) return 'Bitte Datenschutz, Nutzungsbedingungen und Ihre Registrierungsberechtigung bestätigen.';
  for (const key of ['website','ikNumber','taxNumber','vatId','adminPhone','contactFirstName','contactLastName','contactRole']) {
    if (body[key] != null && (typeof body[key] !== 'string' || (body[key] as string).length > 200)) return 'Bitte die optionalen Angaben prüfen.';
  }
  const selectionError = validateCompanyRegistrationSelection(body);
  if (selectionError) return selectionError;
  if (typeof body.contactRole === 'string' && body.contactRole.trim()) {
    const contactError = validateCompanyContactFunction(body.contactRole);
    if (contactError) return contactError;
  }
  if (usesCompanyCatalog(body)) {
    if (body.registrationCatalogVersion !== COMPANY_REGISTRATION_CATALOG_VERSION) return 'Die Auswahlvorgaben wurden aktualisiert. Bitte laden Sie die Registrierung neu.';
    const selected = normalizeCompanyRegistrationSelection({ legalForm: body.legalForm as string, industry: body.industry as string });
    if (body.legalFormKey !== selected.legalFormKey || body.industryKey !== selected.industryKey) return 'Rechtsform und Einrichtungstyp stimmen nicht mit den Auswahlvorgaben überein.';
  }
  const website = (body.website as string | undefined | null)?.trim();
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) return 'Die Website muss mit https:// oder http:// beginnen.';
  return null;
}

