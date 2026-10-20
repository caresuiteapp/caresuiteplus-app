import type { BodyMapMarker, BodyMapSubjectType } from '@/types/modules/bodyMap';
import { DEMO_TENANT_ID } from './tenant';

const store = new Map<string, BodyMapMarker[]>();

function key(clientId: string, subjectType: BodyMapSubjectType = 'client'): string {
  return `${subjectType}:${clientId}`;
}

export function getDemoBodyMapMarkers(
  clientId: string,
  subjectType: BodyMapSubjectType = 'client',
): BodyMapMarker[] {
  return (store.get(key(clientId, subjectType)) ?? []).map((m) => ({ ...m }));
}

export function saveDemoBodyMapMarker(
  clientId: string,
  marker: Omit<BodyMapMarker, 'id' | 'createdAt' | 'updatedAt'>,
  subjectType: BodyMapSubjectType = marker.subjectType ?? 'client',
): BodyMapMarker {
  const now = new Date().toISOString();
  const saved: BodyMapMarker = {
    ...marker,
    id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenantId: marker.tenantId || DEMO_TENANT_ID,
    createdAt: now,
    updatedAt: now,
  };
  const list = store.get(key(clientId, subjectType)) ?? [];
  store.set(key(clientId, subjectType), [saved, ...list]);
  return { ...saved };
}

export function updateDemoBodyMapMarker(
  clientId: string,
  markerId: string,
  patch: Partial<
    Pick<
      BodyMapMarker,
      | 'markerType'
      | 'note'
      | 'region'
      | 'view'
      | 'xPercent'
      | 'yPercent'
      | 'findingStatus'
      | 'findingDetails'
      | 'pressureClassification'
    >
  >,
  subjectType: BodyMapSubjectType = 'client',
): BodyMapMarker | null {
  const list = store.get(key(clientId, subjectType)) ?? [];
  const idx = list.findIndex((m) => m.id === markerId);
  if (idx < 0) return null;
  const updated: BodyMapMarker = {
    ...list[idx]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list];
  next[idx] = updated;
  store.set(key(clientId, subjectType), next);
  return { ...updated };
}

export function deleteDemoBodyMapMarker(
  clientId: string,
  markerId: string,
  subjectType: BodyMapSubjectType = 'client',
): boolean {
  const list = store.get(key(clientId, subjectType)) ?? [];
  const next = list.filter((m) => m.id !== markerId);
  if (next.length === list.length) return false;
  store.set(key(clientId, subjectType), next);
  return true;
}
