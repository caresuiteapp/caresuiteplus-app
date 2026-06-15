import type { BodyMapMarker } from '@/types/modules/bodyMap';
import { DEMO_TENANT_ID } from './tenant';

const store = new Map<string, BodyMapMarker[]>();

function key(clientId: string): string {
  return clientId;
}

export function getDemoBodyMapMarkers(clientId: string): BodyMapMarker[] {
  return (store.get(key(clientId)) ?? []).map((m) => ({ ...m }));
}

export function saveDemoBodyMapMarker(
  clientId: string,
  marker: Omit<BodyMapMarker, 'id' | 'createdAt' | 'updatedAt'>,
): BodyMapMarker {
  const now = new Date().toISOString();
  const saved: BodyMapMarker = {
    ...marker,
    id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenantId: marker.tenantId || DEMO_TENANT_ID,
    createdAt: now,
    updatedAt: now,
  };
  const list = store.get(key(clientId)) ?? [];
  store.set(key(clientId), [saved, ...list]);
  return { ...saved };
}

export function updateDemoBodyMapMarker(
  clientId: string,
  markerId: string,
  patch: Partial<Pick<BodyMapMarker, 'markerType' | 'note' | 'region' | 'view' | 'xPercent' | 'yPercent'>>,
): BodyMapMarker | null {
  const list = store.get(key(clientId)) ?? [];
  const idx = list.findIndex((m) => m.id === markerId);
  if (idx < 0) return null;
  const updated: BodyMapMarker = {
    ...list[idx]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list];
  next[idx] = updated;
  store.set(key(clientId), next);
  return { ...updated };
}

export function deleteDemoBodyMapMarker(clientId: string, markerId: string): boolean {
  const list = store.get(key(clientId)) ?? [];
  const next = list.filter((m) => m.id !== markerId);
  if (next.length === list.length) return false;
  store.set(key(clientId), next);
  return true;
}
