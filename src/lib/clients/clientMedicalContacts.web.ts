import type { ClientContactRecord } from '@/types/modules/client';
import type { ClientContactInput } from './clientContactsService';

export type MedicalContactCategory =
  | 'general_practice'
  | 'specialist'
  | 'pharmacy'
  | 'therapy'
  | 'medical_supply';

export const MEDICAL_CONTACT_CATEGORY_OPTIONS: ReadonlyArray<{
  value: MedicalContactCategory;
  label: string;
}> = [
  { value: 'general_practice', label: 'Hausarzt / Hausärztin' },
  { value: 'specialist', label: 'Facharzt / Fachärztin' },
  { value: 'pharmacy', label: 'Apotheke' },
  { value: 'therapy', label: 'Therapie' },
  { value: 'medical_supply', label: 'Sanitätshaus' },
];

const CATEGORY_LABELS = new Map(
  MEDICAL_CONTACT_CATEGORY_OPTIONS.map((option) => [option.value, option.label] as const),
);

const SAVED_CATEGORY_BY_LABEL = new Map<string, MedicalContactCategory>([
  ['hausarzt', 'general_practice'],
  ['hausärztin', 'general_practice'],
  ['hausarzt / hausärztin', 'general_practice'],
  ['facharzt', 'specialist'],
  ['fachärztin', 'specialist'],
  ['facharzt / fachärztin', 'specialist'],
  ['apotheke', 'pharmacy'],
  ['therapie', 'therapy'],
  ['sanitätshaus', 'medical_supply'],
]);

function normalized(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase('de-DE') ?? '';
}

export function resolveMedicalContactCategory(
  contact: Pick<ClientContactRecord, 'contactType' | 'relationshipLabel'>,
): MedicalContactCategory | 'physician_unspecified' | null {
  const saved = SAVED_CATEGORY_BY_LABEL.get(normalized(contact.relationshipLabel));
  if (saved) return saved;
  return contact.contactType === 'doctor' ? 'physician_unspecified' : null;
}

export function isMedicalContact(
  contact: Pick<ClientContactRecord, 'contactType' | 'relationshipLabel'>,
): boolean {
  return resolveMedicalContactCategory(contact) !== null;
}

export function listMedicalContacts(contacts: readonly ClientContactRecord[]): ClientContactRecord[] {
  return contacts.filter(isMedicalContact);
}

export function medicalContactCategoryLabel(
  contact: Pick<ClientContactRecord, 'contactType' | 'relationshipLabel'>,
): string {
  const category = resolveMedicalContactCategory(contact);
  if (!category) return 'Weiterer Kontakt';
  if (category === 'physician_unspecified') return 'Ärztlicher Kontakt';
  return CATEGORY_LABELS.get(category) ?? 'Ärztlicher oder weiterer Kontakt';
}

export function storedMedicalContactChannels(
  contact: Pick<ClientContactRecord, 'phone' | 'email'>,
): Array<{ kind: 'phone' | 'email'; label: string; value: string; security: 'unverified' }> {
  const channels: Array<{
    kind: 'phone' | 'email';
    label: string;
    value: string;
    security: 'unverified';
  }> = [];
  if (contact.phone?.trim()) {
    channels.push({ kind: 'phone', label: 'Telefon', value: contact.phone.trim(), security: 'unverified' });
  }
  if (contact.email?.trim()) {
    channels.push({ kind: 'email', label: 'E-Mail', value: contact.email.trim(), security: 'unverified' });
  }
  return channels;
}

export function buildMedicalContactInput(values: {
  category: MedicalContactCategory;
  name: string;
  responsibility: string;
  phone: string;
  email: string;
}): { ok: true; input: ClientContactInput } | { ok: false; error: string } {
  const name = values.name.trim();
  const responsibility = values.responsibility.trim();
  const phone = values.phone.trim();
  const email = values.email.trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen oder eine Einrichtung angeben.' };
  if (!responsibility) return { ok: false, error: 'Bitte die konkrete Zuständigkeit angeben.' };
  if (!phone && !email) return { ok: false, error: 'Bitte mindestens einen gespeicherten Kontaktweg angeben.' };
  const parts = name.split(/\s+/);
  const physician = values.category === 'general_practice' || values.category === 'specialist';
  return {
    ok: true,
    input: {
      firstName: parts[0] ?? name,
      lastName: parts.slice(1).join(' '),
      contactType: physician ? 'doctor' : 'other',
      relationship: physician ? 'arzt' : 'sonstige',
      relationshipLabel: CATEGORY_LABELS.get(values.category) ?? null,
      phone: phone || null,
      email: email || null,
      isEmergency: false,
      isPortalUser: false,
      portalPermissions: {
        canViewAppointments: false,
        canViewDocuments: false,
        canViewCarePlan: false,
        canSendMessages: false,
        canViewBilling: false,
      },
      notes: responsibility,
    },
  };
}
