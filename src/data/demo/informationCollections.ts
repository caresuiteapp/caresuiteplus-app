import type { WorkflowStatus } from '@/types';
import { demoClients } from './clients';
import { DEMO_TENANT_ID } from './tenant';

export type InformationCollectionListItem = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  collectionType: string;
  status: WorkflowStatus;
  collectedAt: string;
  assessorName: string;
  completenessPercent: number;
  openItemsCount: number;
};

const TYPES = ['Erstaufnahme', 'Pflegeplanung', 'Verlauf', 'Übergabe', 'Evaluation'];

function buildCollections(): InformationCollectionListItem[] {
  const clients = demoClients.slice(0, 18);
  return clients.map((client, i) => ({
    id: `ic-${String(i + 1).padStart(3, '0')}`,
    tenantId: DEMO_TENANT_ID,
    clientId: client.id,
    clientName: `${client.firstName} ${client.lastName}`,
    collectionType: TYPES[i % TYPES.length]!,
    status: (['aktiv', 'in_bearbeitung', 'entwurf', 'aktiv'] as WorkflowStatus[])[i % 4]!,
    collectedAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    assessorName: 'Pflegekraft Demo',
    completenessPercent: 40 + (i % 6) * 10,
    openItemsCount: i % 5,
  }));
}

let store = buildCollections();

export function getDemoInformationCollections(): InformationCollectionListItem[] {
  return store.map((item) => ({ ...item }));
}

export function createDemoInformationCollection(input: {
  clientId: string;
  clientName: string;
  collectionType: string;
}): InformationCollectionListItem {
  const now = new Date().toISOString();
  const item: InformationCollectionListItem = {
    id: `ic-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    clientId: input.clientId,
    clientName: input.clientName,
    collectionType: input.collectionType,
    status: 'entwurf',
    collectedAt: now,
    assessorName: 'Pflegekraft Demo',
    completenessPercent: 10,
    openItemsCount: 6,
  };
  store = [item, ...store];
  return { ...item };
}

export function getDemoInformationCollectionById(id: string): InformationCollectionListItem | null {
  const item = store.find((s) => s.id === id);
  return item ? { ...item } : null;
}
