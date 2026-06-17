import type { ClientAddress } from '@/types/modules/client';

type ClientAddressSource = {
  id: string;
  tenant_id: string;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  zip?: string | null;
  city?: string | null;
  created_at?: string;
  updated_at?: string;
};

export function resolveClientStreetLine(source: ClientAddressSource): string | null {
  const street = source.street?.trim() ?? '';
  const houseNumber = source.house_number?.trim() ?? '';
  const combined = [street, houseNumber].filter(Boolean).join(' ');
  return combined || null;
}

export function resolveClientZip(source: ClientAddressSource): string {
  return source.postal_code?.trim() ?? source.zip?.trim() ?? '';
}

export function resolveClientPhone(source: {
  phone?: string | null;
  mobile?: string | null;
  primary_contact_phone?: string | null;
}): string | null {
  return (
    source.phone?.trim()
    || source.mobile?.trim()
    || source.primary_contact_phone?.trim()
    || null
  );
}

export function buildFallbackPrimaryAddress(client: ClientAddressSource): ClientAddress | null {
  const street = resolveClientStreetLine(client);
  const zip = resolveClientZip(client);
  const city = client.city?.trim() ?? '';
  if (!street && !zip && !city) return null;

  const now = client.updated_at ?? client.created_at ?? new Date().toISOString();
  return {
    id: `addr-fallback-${client.id}`,
    tenantId: client.tenant_id,
    clientId: client.id,
    addressType: 'hauptwohnsitz',
    street: street ?? '',
    zip,
    city,
    country: 'DE',
    isPrimary: true,
    accessNotes: null,
    floor: null,
    apartmentNumber: null,
    doorCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeClientAddresses(
  dbAddresses: ClientAddress[],
  clientRow: ClientAddressSource,
): ClientAddress[] {
  if (dbAddresses.length > 0) return dbAddresses;
  const fallback = buildFallbackPrimaryAddress(clientRow);
  return fallback ? [fallback] : [];
}

export function formatClientAddressLine(
  street: string | null | undefined,
  zip: string | null | undefined,
  city: string | null | undefined,
): string {
  const parts = [street?.trim(), [zip?.trim(), city?.trim()].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}
