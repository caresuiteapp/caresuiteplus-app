import type { RoleKey, ServiceResult } from '@/types';
import type {
  BodyMapMarker,
  BodyMapMarkerCreateInput,
  BodyMapSubjectType,
} from '@/types/modules/bodyMap';
import {
  deleteDemoBodyMapMarker,
  getDemoBodyMapMarkers,
  saveDemoBodyMapMarker,
  updateDemoBodyMapMarker,
} from '@/data/demo/bodyMapMarkers';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { bodyMapSupabaseRepository } from '@/lib/pflege/bodyMapRepository.supabase';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchBodyMapMarkers(
  tenantId: string,
  clientId: string,
  actorRoleKey?: RoleKey | null,
  subjectType: BodyMapSubjectType = 'client',
): Promise<ServiceResult<BodyMapMarker[]>> {
  const denied = enforcePermission<BodyMapMarker[]>(
    actorRoleKey,
    subjectType === 'resident' ? 'stationaer.residents.view' : 'pflege.plans.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!clientId.trim()) return { ok: false, error: 'Klient:in fehlt.' };
  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.listByClient(tenantId, clientId, subjectType);
  }
  await demoDelay();
  return { ok: true, data: getDemoBodyMapMarkers(clientId, subjectType) };
}

export async function createBodyMapMarker(
  tenantId: string,
  input: BodyMapMarkerCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BodyMapMarker>> {
  const subjectType = input.subjectType ?? 'client';
  const denied = enforcePermission<BodyMapMarker>(
    actorRoleKey,
    subjectType === 'resident' ? 'stationaer.residents.view' : 'pflege.plans.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!input.clientId.trim()) return { ok: false, error: 'Klient:in fehlt.' };
  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.create(tenantId, input);
  }
  await demoDelay(280);
  const marker = saveDemoBodyMapMarker(input.clientId, {
    tenantId,
    clientId: input.clientId,
    subjectType,
    subjectId: input.subjectId ?? input.clientId,
    woundId: input.woundId ?? null,
    gender: input.gender,
    view: input.view,
    region: input.region,
    markerType: input.markerType,
    xPercent: input.xPercent,
    yPercent: input.yPercent,
    note: input.note,
    modelId: input.modelId ?? null,
    anatomyPackId: input.anatomyPackId ?? null,
    ageGroup: input.ageGroup ?? null,
    sex: input.sex ?? null,
    genitalAnatomy: input.genitalAnatomy ?? null,
    chestAnatomy: input.chestAnatomy ?? null,
    skinTone: input.skinTone ?? null,
    anatomicalZoneId: input.anatomicalZoneId ?? null,
    surfacePoint: input.surfacePoint ?? null,
    pressureClassification: input.pressureClassification ?? null,
    findingStatus: input.findingStatus ?? 'aktiv',
    findingDetails: input.findingDetails ?? {},
  }, subjectType);
  return { ok: true, data: marker };
}

export async function patchBodyMapMarker(
  tenantId: string,
  clientId: string,
  markerId: string,
  patch: Partial<Pick<BodyMapMarker, 'markerType' | 'note' | 'region' | 'view' | 'xPercent' | 'yPercent'>>,
  actorRoleKey?: RoleKey | null,
  subjectType: BodyMapSubjectType = 'client',
): Promise<ServiceResult<BodyMapMarker>> {
  const denied = enforcePermission<BodyMapMarker>(
    actorRoleKey,
    subjectType === 'resident' ? 'stationaer.residents.view' : 'pflege.plans.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!clientId.trim()) return { ok: false, error: 'Klient:in fehlt.' };
  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.update(
      tenantId,
      clientId,
      markerId,
      patch,
      subjectType,
    );
  }
  await demoDelay(220);
  const updated = updateDemoBodyMapMarker(clientId, markerId, patch, subjectType);
  if (!updated) return { ok: false, error: 'Marker nicht gefunden.' };
  return { ok: true, data: updated };
}

export async function removeBodyMapMarker(
  tenantId: string,
  clientId: string,
  markerId: string,
  actorRoleKey?: RoleKey | null,
  subjectType: BodyMapSubjectType = 'client',
): Promise<ServiceResult<{ removed: boolean }>> {
  const denied = enforcePermission<{ removed: boolean }>(
    actorRoleKey,
    subjectType === 'resident' ? 'stationaer.residents.view' : 'pflege.plans.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!clientId.trim()) return { ok: false, error: 'Klient:in fehlt.' };
  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.remove(
      tenantId,
      clientId,
      markerId,
      subjectType,
    );
  }
  await demoDelay(180);
  const removed = deleteDemoBodyMapMarker(clientId, markerId, subjectType);
  if (!removed) return { ok: false, error: 'Marker nicht gefunden.' };
  return { ok: true, data: { removed: true } };
}
