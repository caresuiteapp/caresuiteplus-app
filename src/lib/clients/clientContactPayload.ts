import type { ClientContactType } from '@/types/modules/client';

type ClientContactWriteInput = {
  tenantId: string;
  clientId: string;
  name: string;
  phone: string;
  email?: string | null;
  relationship: string;
  contactType: ClientContactType;
};

export function buildClientContactWritePayload(input: ClientContactWriteInput) {
  const trimmedName = input.name.trim();
  const displayName = trimmedName || 'Kontakt';
  const parts = displayName.split(/\s+/);
  const firstName = parts[0] ?? displayName;
  const lastName = parts.slice(1).join(' ') || '';

  // Live: full_name is GENERATED from first_name + last_name — must not be sent on INSERT/UPDATE.
  return {
    tenant_id: input.tenantId,
    client_id: input.clientId,
    first_name: firstName,
    last_name: lastName,
    relationship: input.relationship,
    phone: input.phone.trim() || null,
    email: input.email?.trim() || null,
    is_emergency_contact: input.contactType === 'emergency_contact',
    contact_type: input.contactType,
  };
}

export function resolveClientContactDisplayName(row: {
  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const fromParts = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return row.full_name?.trim() || row.name?.trim() || fromParts || '';
}

export function resolveClientContactIsEmergency(row: {
  is_emergency_contact?: boolean | null;
  is_emergency?: boolean | null;
  contact_type?: string | null;
}): boolean {
  if (row.is_emergency_contact === true || row.is_emergency === true) return true;
  return row.contact_type === 'emergency_contact';
}

export function resolveClientContactType(row: {
  contact_type?: string | null;
  is_emergency_contact?: boolean | null;
  is_emergency?: boolean | null;
  relationship?: string | null;
}): ClientContactType {
  const raw = row.contact_type?.trim();
  if (raw === 'emergency_contact') return 'emergency_contact';
  if (raw === 'relative') return 'relative';
  if (raw === 'doctor') return 'doctor';
  if (raw === 'care_service') return 'care_service';
  if (raw === 'other') return 'other';

  if (resolveClientContactIsEmergency(row)) return 'emergency_contact';
  if (row.relationship === 'arzt') return 'doctor';
  if (row.relationship === 'angehoerige' || row.relationship === 'ehepartner' || row.relationship === 'kind') {
    return 'relative';
  }
  return 'other';
}
