import type { OfficeRecipientType } from '@/types/office/officeCompose';

/** Erweiterte Empfängerarten für Compose (Spec 1.1). */
export type ComposeRecipientType =
  | 'client'
  | 'relative'
  | 'legal_guardian'
  | 'billing_recipient'
  | 'emergency_contact'
  | 'employee'
  | 'team'
  | 'office'
  | 'management'
  | 'pdl'
  | 'ward_leadership'
  | 'counseling_team'
  | 'billing_dept'
  | 'qm'
  | 'academy'
  | 'internal';

export type ComposeRecipientCategory = 'client_contacts' | 'staff' | 'organization';

export const COMPOSE_RECIPIENT_CATEGORIES: ReadonlyArray<{
  key: ComposeRecipientCategory;
  label: string;
}> = [
  { key: 'client_contacts', label: 'Klient & Kontakte' },
  { key: 'staff', label: 'Mitarbeitende & Teams' },
  { key: 'organization', label: 'Organisation' },
];

export const COMPOSE_RECIPIENT_TYPES: Record<
  ComposeRecipientCategory,
  ReadonlyArray<{ key: ComposeRecipientType; label: string }>
> = {
  client_contacts: [
    { key: 'client', label: 'Klient:in' },
    { key: 'relative', label: 'Angehörige:r' },
    { key: 'legal_guardian', label: 'Gesetzliche:r Betreuer:in' },
    { key: 'billing_recipient', label: 'Rechnungsempfänger:in' },
    { key: 'emergency_contact', label: 'Notfallkontakt' },
  ],
  staff: [
    { key: 'employee', label: 'Mitarbeiter:in' },
    { key: 'team', label: 'Team' },
    { key: 'pdl', label: 'Pflegedienstleitung' },
    { key: 'ward_leadership', label: 'Wohnbereichsleitung' },
    { key: 'counseling_team', label: 'Beratungsteam' },
  ],
  organization: [
    { key: 'office', label: 'Verwaltung / Büro' },
    { key: 'management', label: 'Geschäftsführung' },
    { key: 'billing_dept', label: 'Abrechnung' },
    { key: 'qm', label: 'QM' },
    { key: 'academy', label: 'Akademie' },
    { key: 'internal', label: 'Intern' },
  ],
};

export function defaultCategoryForRecipient(type: ComposeRecipientType): ComposeRecipientCategory {
  if (
    type === 'client' ||
    type === 'relative' ||
    type === 'legal_guardian' ||
    type === 'billing_recipient' ||
    type === 'emergency_contact'
  ) {
    return 'client_contacts';
  }
  if (
    type === 'employee' ||
    type === 'team' ||
    type === 'pdl' ||
    type === 'ward_leadership' ||
    type === 'counseling_team'
  ) {
    return 'staff';
  }
  return 'organization';
}

/** Mappt erweiterte Empfängerarten auf Office-Compose-API. */
export function mapComposeRecipientToOfficeType(type: ComposeRecipientType): OfficeRecipientType {
  if (type === 'client' || type === 'relative' || type === 'legal_guardian' || type === 'billing_recipient' || type === 'emergency_contact') {
    return 'client';
  }
  if (type === 'employee') return 'employee';
  if (type === 'team' || type === 'pdl' || type === 'ward_leadership' || type === 'counseling_team') {
    return 'team';
  }
  return 'internal';
}

export function composeRecipientUsesPersonPicker(type: ComposeRecipientType): boolean {
  return (
    type === 'client' ||
    type === 'relative' ||
    type === 'legal_guardian' ||
    type === 'billing_recipient' ||
    type === 'emergency_contact' ||
    type === 'employee'
  );
}
