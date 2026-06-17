import { getDemoClientCareContexts } from '@/data/demo/clients/intakeRecords';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import type { ClientListItem } from '@/types/modules/office';

/** Leistungsart label for compact list rows (demo care contexts, else Kostenträger). */
export function resolveClientListServiceLabel(client: ClientListItem): string | null {
  const contexts = getDemoClientCareContexts(client.id);
  if (contexts.length > 0) {
    return contexts.map((c) => getCatalogLabel('leistungsart', c)).join(' · ');
  }

  const carrier = client.costCarrier?.trim();
  if (carrier) return carrier;

  return null;
}

export function formatClientListLocation(client: ClientListItem): string | null {
  const location = [client.zip, client.city].filter(Boolean).join(' ');
  return location || null;
}
