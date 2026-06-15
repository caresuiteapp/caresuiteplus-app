import type { ClientFullDetail } from '@/types/modules/client';
import { helgaSchneiderFull } from './helga-schneider';
import { wernerMuellerFull } from './werner-mueller';
import { buildDemoConstellationClients } from './constellations';

export { TASK_CATALOG, getTasksByCategory } from './taskCatalog';
export { helgaSchneiderFull } from './helga-schneider';
export { wernerMuellerFull } from './werner-mueller';
export { buildDemoConstellationClients, DEMO_CONSTELLATION_IDS } from './constellations';

const constellationMap = new Map(
  buildDemoConstellationClients().map((c) => [c.id, c]),
);

const FULL_CLIENT_MAP = new Map<string, ClientFullDetail>([
  ...constellationMap,
]);

let sessionFullMap = new Map(FULL_CLIENT_MAP);

export function getDemoClientFullDetail(clientId: string): ClientFullDetail | null {
  return sessionFullMap.get(clientId) ?? null;
}

export function getAllDemoFullClients(): ClientFullDetail[] {
  return [...sessionFullMap.values()];
}

export function upsertDemoClientFullDetail(detail: ClientFullDetail): void {
  sessionFullMap.set(detail.id, detail);
}

export function resetDemoFullClientStore(): void {
  sessionFullMap = new Map(FULL_CLIENT_MAP);
}
