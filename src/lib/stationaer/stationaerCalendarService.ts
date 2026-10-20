import type { RoleKey, ServiceResult } from '@/types';
import type { StationaerCalendarSourceType } from '@/types/calendar';
import type {
  StationaerCalendarCreateInput,
  StationaerCalendarEntity,
  StationaerCalendarUpdateInput,
} from '@/types/modules/stationaerCalendar';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  archiveDemoStationaerCalendarEntity,
  cancelDemoStationaerCalendarEntity,
  createDemoStationaerCalendarEntity,
  getDemoStationaerCalendarEntities,
  getDemoStationaerCalendarEntityById,
  updateDemoStationaerCalendarEntity,
} from '@/data/demo/stationaerCalendar';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { stationaerCalendarSupabaseRepository } from '@/lib/services/repositories/stationaerCalendarRepository.supabase';
import {
  archiveStationaerCalendarEventAsync,
  cancelStationaerCalendarEventAsync,
  syncCalendarEventFromStationaerEntityAsync,
} from '@/lib/calendar/calendarSyncService';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function rejectNonDemoTenant<T>(tenantId: string): ServiceResult<T> | null {
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }
  return null;
}

function syncEntity(entity: StationaerCalendarEntity): void {
  syncCalendarEventFromStationaerEntityAsync(entity);
}

export async function fetchStationaerCalendarEvents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerCalendarEntity[]>> {
  const denied = enforcePermission<StationaerCalendarEntity[]>(
    actorRoleKey,
    'stationaer.residents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerCalendarSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    if (result.data.length > 0 || !result.tableMissing) {
      return { ok: true, data: result.data };
    }
  }

  const live = rejectNonDemoTenant<StationaerCalendarEntity[]>(tenantId);
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoStationaerCalendarEntities() };
}

export async function fetchStationaerCalendarEventById(
  tenantId: string,
  eventId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerCalendarEntity>> {
  const denied = enforcePermission<StationaerCalendarEntity>(
    actorRoleKey,
    'stationaer.residents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerCalendarSupabaseRepository.getById(tenantId, eventId);
    if (!result.ok) return result;
    if (result.data) return { ok: true, data: result.data };
  }

  const live = rejectNonDemoTenant<StationaerCalendarEntity>(tenantId);
  if (live) return live;

  await demoDelay(120);
  const entity = getDemoStationaerCalendarEntityById(eventId);
  if (!entity) return { ok: false, error: 'Kalendereintrag nicht gefunden.' };
  return { ok: true, data: entity };
}

export async function createStationaerCalendarEvent(
  tenantId: string,
  input: StationaerCalendarCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerCalendarEntity>> {
  const denied = enforcePermission<StationaerCalendarEntity>(
    actorRoleKey,
    'stationaer.residents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerCalendarSupabaseRepository.create(tenantId, input);
    if (!result.ok) return result;
    syncEntity(result.data);
    return result;
  }

  const live = rejectNonDemoTenant<StationaerCalendarEntity>(tenantId);
  if (live) return live;

  await demoDelay(180);
  const entity = createDemoStationaerCalendarEntity(tenantId, {
    sourceType: input.sourceType,
    title: input.title,
    description: input.description ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: input.allDay ?? false,
    status: input.status ?? 'aktiv',
    relatedResidentId: input.relatedResidentId ?? null,
    relatedWardId: input.relatedWardId ?? null,
    relatedEmployeeId: input.relatedEmployeeId ?? null,
    room: input.room ?? null,
    locationType: input.locationType ?? null,
    locationName: input.locationName ?? null,
    isClientPortalVisible: input.isClientPortalVisible ?? false,
    isEmployeePortalVisible: input.isEmployeePortalVisible ?? false,
    isRelativePortalVisible: input.isRelativePortalVisible ?? false,
  });
  syncEntity(entity);
  return { ok: true, data: entity };
}

export async function updateStationaerCalendarEvent(
  tenantId: string,
  eventId: string,
  input: StationaerCalendarUpdateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerCalendarEntity>> {
  const denied = enforcePermission<StationaerCalendarEntity>(
    actorRoleKey,
    'stationaer.residents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerCalendarSupabaseRepository.update(tenantId, eventId, input);
    if (!result.ok) return result;
    syncEntity(result.data);
    return result;
  }

  const live = rejectNonDemoTenant<StationaerCalendarEntity>(tenantId);
  if (live) return live;

  await demoDelay(160);
  const existing = getDemoStationaerCalendarEntityById(eventId);
  if (!existing) return { ok: false, error: 'Kalendereintrag nicht gefunden.' };

  const updated = updateDemoStationaerCalendarEntity(eventId, {
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    startAt: input.startAt ?? existing.startAt,
    endAt: input.endAt ?? existing.endAt,
    allDay: input.allDay ?? existing.allDay,
    status: input.status ?? existing.status,
    relatedResidentId:
      input.relatedResidentId !== undefined ? input.relatedResidentId : existing.relatedResidentId,
    relatedWardId:
      input.relatedWardId !== undefined ? input.relatedWardId : existing.relatedWardId,
    relatedEmployeeId:
      input.relatedEmployeeId !== undefined
        ? input.relatedEmployeeId
        : existing.relatedEmployeeId,
    room: input.room !== undefined ? input.room : existing.room,
    locationType: input.locationType !== undefined ? input.locationType : existing.locationType,
    locationName: input.locationName !== undefined ? input.locationName : existing.locationName,
    isClientPortalVisible:
      input.isClientPortalVisible !== undefined
        ? input.isClientPortalVisible
        : existing.isClientPortalVisible,
    isEmployeePortalVisible:
      input.isEmployeePortalVisible !== undefined
        ? input.isEmployeePortalVisible
        : existing.isEmployeePortalVisible,
    isRelativePortalVisible:
      input.isRelativePortalVisible !== undefined
        ? input.isRelativePortalVisible
        : existing.isRelativePortalVisible,
  });
  if (!updated) return { ok: false, error: 'Kalendereintrag nicht gefunden.' };
  syncEntity(updated);
  return { ok: true, data: updated };
}

export async function archiveStationaerCalendarEvent(
  tenantId: string,
  eventId: string,
  sourceType: StationaerCalendarSourceType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerCalendarSupabaseRepository.archive(tenantId, eventId);
    if (!result.ok) return result;
    archiveStationaerCalendarEventAsync(tenantId, sourceType, eventId);
    return result;
  }

  const live = rejectNonDemoTenant<void>(tenantId);
  if (live) return live;

  await demoDelay(120);
  if (!archiveDemoStationaerCalendarEntity(eventId)) {
    return { ok: false, error: 'Kalendereintrag nicht gefunden.' };
  }
  archiveStationaerCalendarEventAsync(tenantId, sourceType, eventId);
  return { ok: true, data: undefined };
}

export async function cancelStationaerCalendarEvent(
  tenantId: string,
  eventId: string,
  sourceType: StationaerCalendarSourceType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerCalendarSupabaseRepository.cancel(tenantId, eventId);
    if (!result.ok) return result;
    cancelStationaerCalendarEventAsync(tenantId, sourceType, eventId);
    return result;
  }

  const live = rejectNonDemoTenant<void>(tenantId);
  if (live) return live;

  await demoDelay(120);
  if (!cancelDemoStationaerCalendarEntity(eventId)) {
    return { ok: false, error: 'Kalendereintrag nicht gefunden.' };
  }
  cancelStationaerCalendarEventAsync(tenantId, sourceType, eventId);
  return { ok: true, data: undefined };
}

/** Bootstrap-Sync: Demo-/Live-Stationär-Events in calendar_events schreiben */
export async function syncStationaerCalendarBootstrap(tenantId: string): Promise<void> {
  const result = await fetchStationaerCalendarEvents(tenantId);
  if (!result.ok) return;
  for (const entity of result.data) {
    syncEntity(entity);
  }
}
