import type { WoundDocumentation } from '@/types/modules/pflege';
import { WOUND_DESCRIPTIONS, WOUND_LOCATIONS } from './generators/pflegeDemoGenerators';
import { demoClients } from './clients';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const STATUSES: WoundDocumentation['status'][] = [
  'aktiv',
  'in_bearbeitung',
  'archiviert',
  'aktiv',
  'in_bearbeitung',
];

function buildWoundSeeds(): WoundDocumentation[] {
  const clients = demoClients.slice(0, 12);
  return WOUND_LOCATIONS.map((bodyLocation, i) => {
    const client = clients[i % clients.length]!;
    const days = 1 + (i % 30);
    const documentedAt = daysAgo(days);
    return {
      id: `wound-${String(i + 1).padStart(3, '0')}`,
      tenantId: DEMO_TENANT_ID,
      clientId: client.id,
      bodyLocation,
      description: WOUND_DESCRIPTIONS[i % WOUND_DESCRIPTIONS.length]!,
      documentedAt,
      status: STATUSES[i % STATUSES.length]!,
      sensitivity: 'health',
      createdAt: daysAgo(days + 14),
      updatedAt: documentedAt,
      visibility: 'team',
    };
  });
}

const INITIAL = buildWoundSeeds();
let woundStore: WoundDocumentation[] = INITIAL.map((w) => ({ ...w }));

export function getDemoWoundDocumentations(): WoundDocumentation[] {
  return woundStore.map((w) => ({ ...w }));
}

export function getDemoWoundById(id: string): WoundDocumentation | null {
  const wound = woundStore.find((w) => w.id === id);
  return wound ? { ...wound } : null;
}

export function createDemoWound(input: {
  clientId: string;
  bodyLocation: string;
  description: string;
}): WoundDocumentation {
  const now = new Date().toISOString();
  const wound: WoundDocumentation = {
    id: `wound-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    clientId: input.clientId,
    bodyLocation: input.bodyLocation,
    description: input.description,
    documentedAt: now,
    status: 'entwurf',
    sensitivity: 'health',
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
  };
  woundStore = [wound, ...woundStore];
  return { ...wound };
}

export function countOpenWoundCases(): number {
  return woundStore.filter((item) => item.status === 'aktiv' || item.status === 'in_bearbeitung')
    .length;
}

const woundPhotoStore: Record<string, string[]> = {};

export function getDemoWoundPhotoCount(woundId: string): number {
  return woundPhotoStore[woundId]?.length ?? 0;
}

export function addDemoWoundPhoto(woundId: string, fileName: string): number {
  const list = woundPhotoStore[woundId] ?? [];
  woundPhotoStore[woundId] = [...list, fileName];
  return woundPhotoStore[woundId]!.length;
}

export function updateDemoWound(
  id: string,
  patch: Partial<Pick<WoundDocumentation, 'bodyLocation' | 'description' | 'status'>>,
): WoundDocumentation | null {
  const index = woundStore.findIndex((w) => w.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  woundStore[index] = {
    ...woundStore[index]!,
    ...patch,
    updatedAt: now,
  };
  return { ...woundStore[index]! };
}
