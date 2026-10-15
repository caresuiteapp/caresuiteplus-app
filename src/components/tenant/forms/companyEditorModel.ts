import { validateEmail, validateIban, validateVatId } from '@/lib/tenant/tenantValidation';
import type { TenantCenterSectionKey, TenantCenterSnapshot } from '@/types/tenant/tenantCenter';

export const COMPANY_EDITOR_TITLES: Partial<Record<TenantCenterSectionKey, string>> = {
  company: 'Unternehmensdaten', legal: 'Versicherung & Mitgliedschaften', tax: 'Steuerdaten',
  register: 'Register & Zulassung', contact: 'Kontakt & Kommunikation', representatives: 'Geschäftsführung & Vertretung',
  bank: 'Bankverbindungen', payment: 'Zahlungsbedingungen', branding: 'Unternehmenslogo',
  modules: 'Leistungsbereiche', audit: 'Änderungsverlauf',
};

/** Client-side feedback only; permissions and persistence remain in the existing services. */
export function validateCompanyEditor(section: TenantCenterSectionKey, value: TenantCenterSnapshot): Record<string, string> {
  const errors: Record<string, string> = {};
  const optional = (key: string, error: string | null) => { if (error) errors[key] = error; };
  if (section === 'company') {
    if (!value.company.name.trim()) errors.name = 'Bitte den Firmennamen eintragen.';
    optional('email', validateEmail(value.company.email));
  }
  if (section === 'tax') optional('vatId', validateVatId(value.tax.vatId));
  if (section === 'register' && value.register.registerDate) {
    const date = value.register.registerDate;
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      errors.registerDate = 'Bitte ein gültiges Registerdatum eintragen.';
    }
  }
  if (section === 'contact') {
    optional('billingEmail', validateEmail(value.contact.billingEmail));
    optional('supportEmail', validateEmail(value.contact.supportEmail));
    value.contact.contactPersons.forEach((row, index) => {
      if (!row.firstName.trim() && !row.lastName.trim()) errors[`contact.${index}.firstName`] = 'Bitte einen Namen eintragen oder die Person entfernen.';
      optional(`contact.${index}.email`, validateEmail(row.email));
    });
  }
  if (section === 'representatives') value.representatives.forEach((row, index) => {
    if (!row.firstName.trim() && !row.lastName.trim()) errors[`representatives.${index}.firstName`] = 'Bitte einen Namen eintragen oder die Person entfernen.';
    optional(`representatives.${index}.email`, validateEmail(row.email));
  });
  if (section === 'bank') value.bankAccounts.forEach((row, index) => {
    if (!row.accountHolder.trim()) errors[`bank.${index}.accountHolder`] = 'Bitte den Kontoinhaber eintragen.';
    if (!row.iban.trim()) errors[`bank.${index}.iban`] = 'Bitte die IBAN eintragen oder das Konto entfernen.';
    else optional(`bank.${index}.iban`, validateIban(row.iban));
    if (row.bic.trim() && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(row.bic.trim())) errors[`bank.${index}.bic`] = 'Eine BIC besteht aus 8 oder 11 Zeichen.';
  });
  if (section === 'payment') {
    for (const key of ['paymentTermsDays', 'dunningAfterDays'] as const) {
      if (!/^\d+$/.test(value.payment[key].trim()) || Number(value.payment[key]) < 0 || Number(value.payment[key]) > 3650) {
        errors[key] = 'Bitte eine ganze Zahl zwischen 0 und 3650 Tagen eintragen.';
      }
    }
    const fee = value.payment.dunningFee.trim();
    if (fee && (!/^\d+(?:[.,]\d{1,2})?$/.test(fee) || !Number.isFinite(Number(fee.replace(',', '.'))))) errors.dunningFee = 'Bitte einen positiven Betrag mit höchstens zwei Nachkommastellen eintragen.';
  }
  return errors;
}

export function withPrimaryRow<T extends { isPrimary: boolean }>(rows: T[], index: number): T[] {
  return rows.map((row, rowIndex) => ({ ...row, isPrimary: rowIndex === index }));
}

export function withoutCompanyRow<T extends { isPrimary: boolean }>(rows: T[], index: number): T[] {
  const remaining = rows.filter((_, rowIndex) => rowIndex !== index);
  return rows[index]?.isPrimary && remaining.length ? withPrimaryRow(remaining, 0) : remaining;
}
