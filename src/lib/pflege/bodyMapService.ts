import type { RoleKey, ServiceResult } from '@/types';
import type { BodyMapGender, BodyMapMarker, BodyMapMarkerType, BodyMapRegion, BodyMapView } from '@/types/modules/bodyMap';
import {
  deleteDemoBodyMapMarker,
  getDemoBodyMapMarkers,
  saveDemoBodyMapMarker,
  updateDemoBodyMapMarker,
} from '@/data/demo/bodyMapMarkers';
import { enforcePermission } from '@/lib/permissions';
import { bodyMapSupabaseRepository } from '@/lib/pflege/bodyMapRepository.supabase';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function guardBodyMapWriteInput(
  tenantId: string,
  clientId: string,
): ServiceResult<never> | null {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!clientId?.trim()) {
    return { ok: false, error: 'Klient:in fehlt.' };
  }
  return null;
}

export async function fetchBodyMapMarkers(
  tenantId: string,
  clientId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BodyMapMarker[]>> {
  const denied = enforcePermission<BodyMapMarker[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!clientId?.trim()) {
    return { ok: false, error: 'Klient:in fehlt.' };
  }

  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.listByClient(tenantId, clientId);
  }

  await demoDelay();
  return { ok: true, data: getDemoBodyMapMarkers(clientId) };
}

export async function createBodyMapMarker(
  tenantId: string,
  input: {
    clientId: string;
    gender: BodyMapGender;
    view: BodyMapView;
    region: BodyMapRegion;
    markerType: BodyMapMarkerType;
    xPercent: number;
    yPercent: number;
    note: string;
    woundId?: string | null;
  },
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<BodyMapMarker>> {
  const denied = enforcePermission<BodyMapMarker>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const inputBlock = guardBodyMapWriteInput(tenantId, input.clientId);
  if (inputBlock) return inputBlock;

  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.create(tenantId, {
      ...input,
      createdBy: actorProfileId ?? null,
    });
  }

  await demoDelay(280);
  const marker = saveDemoBodyMapMarker(input.clientId, {
    tenantId,
    clientId: input.clientId,
    woundId: input.woundId ?? null,
    gender: input.gender,
    view: input.view,
    region: input.region,
    markerType: input.markerType,
    xPercent: input.xPercent,
    yPercent: input.yPercent,
    note: input.note,
  });
  return { ok: true, data: marker };
}

export async function patchBodyMapMarker(
  tenantId: string,
  clientId: string,
  markerId: string,
  patch: Partial<Pick<BodyMapMarker, 'markerType' | 'note' | 'region' | 'view' | 'xPercent' | 'yPercent'>>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BodyMapMarker>> {
  const denied = enforcePermission<BodyMapMarker>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const inputBlock = guardBodyMapWriteInput(tenantId, clientId);
  if (inputBlock) return inputBlock;

  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.update(tenantId, clientId, markerId, patch);
  }

  await demoDelay(220);
  const updated = updateDemoBodyMapMarker(clientId, markerId, patch);
  if (!updated) return { ok: false, error: 'Marker nicht gefunden.' };
  return { ok: true, data: updated };
}

export async function removeBodyMapMarker(
  tenantId: string,
  clientId: string,
  markerId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ removed: boolean }>> {
  const denied = enforcePermission<{ removed: boolean }>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const inputBlock = guardBodyMapWriteInput(tenantId, clientId);
  if (inputBlock) return inputBlock;

  if (getServiceMode() === 'supabase') {
    return bodyMapSupabaseRepository.remove(tenantId, clientId, markerId);
  }

  await demoDelay(180);
  const removed = deleteDemoBodyMapMarker(clientId, markerId);
  if (!removed) return { ok: false, error: 'Marker nicht gefunden.' };
  return { ok: true, data: { removed: true } };
}
