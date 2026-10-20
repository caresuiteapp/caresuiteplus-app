import type { ClientContactRecord, ClientContactType } from '@/types/modules/client';
import { FIXED_CLIENT_CONTACT_TYPES } from '@/types/modules/client/clientContact';

export function findContactByType(
  contacts: ClientContactRecord[],
  type: Exclude<ClientContactType, 'other'>,
): ClientContactRecord | null {
  return contacts.find((c) => c.contactType === type) ?? null;
}

export function listOtherContacts(contacts: ClientContactRecord[]): ClientContactRecord[] {
  const fixed = new Set<string>(FIXED_CLIENT_CONTACT_TYPES);
  return contacts.filter((c) => c.contactType === 'other' || !fixed.has(c.contactType));
}

export function formatContactPersonName(contact: ClientContactRecord | null): string | null {
  if (!contact) return null;
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || null;
}
