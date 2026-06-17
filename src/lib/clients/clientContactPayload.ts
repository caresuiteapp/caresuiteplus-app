type ClientContactWriteInput = {
  tenantId: string;
  clientId: string;
  name: string;
  phone: string;
  relationship: string;
  isEmergency: boolean;
};

export function buildClientContactWritePayload(input: ClientContactWriteInput) {
  const trimmedName = input.name.trim();
  const displayName = trimmedName || 'Kontakt';
  const parts = displayName.split(/\s+/);
  const firstName = parts[0] ?? displayName;
  const lastName = parts.slice(1).join(' ') || '';

  return {
    tenant_id: input.tenantId,
    client_id: input.clientId,
    full_name: displayName,
    first_name: firstName,
    last_name: lastName,
    relationship: input.relationship,
    phone: input.phone.trim() || null,
    email: null,
    is_emergency_contact: input.isEmergency,
    contact_type: input.isEmergency ? 'emergency_contact' : 'relative',
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
