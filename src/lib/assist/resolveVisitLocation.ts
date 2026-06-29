import { resolveClientZip } from '@/lib/clients/clientAddressResolver';
import { formatAddressFromSnapshotOrParts } from '@/lib/formatAddress';

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
  const formatted = formatAddressFromSnapshotOrParts(null, {
    street: client?.street,
    houseNumber: client?.house_number,
    zip: client ? resolveClientZip(client) : null,
    city: client?.city,
  });
  if (formatted) return formatted;

  return '—';
}
