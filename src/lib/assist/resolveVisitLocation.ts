import {
  formatClientAddressLine,
  resolveClientStreetLine,
  resolveClientZip,
} from '@/lib/clients/clientAddressResolver';

export type VisitLocationClientRow = {
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

export type VisitLocationSource = {
  addressSnapshot?: string | null;
  locationNotes?: string | null;
  client?: VisitLocationClientRow | null;
};

/** Resolve display location: visit snapshot → location notes → client address. */
export function resolveVisitLocation(source: VisitLocationSource): string {
  const snapshot = source.addressSnapshot?.trim();
  if (snapshot) return snapshot;

  const notes = source.locationNotes?.trim();
  if (notes) return notes;

  const client = source.client;
  if (client) {
    const street = resolveClientStreetLine({
      id: '',
      tenant_id: '',
      street: client.street,
      house_number: client.house_number,
    });
    const line = formatClientAddressLine(street, resolveClientZip(client), client.city);
    if (line) return line;
  }

  return '—';
}
