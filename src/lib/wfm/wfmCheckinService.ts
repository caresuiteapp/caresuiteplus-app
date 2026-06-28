import type { RoleKey, ServiceResult } from '@/types';
import type { WfmTodayStatus } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  fetchTodaySession,
  insertTimeEvent,
  insertWorkSession,
  resolveEmployeeIdForUser,
  todayWorkDate,
  updateWorkSession,
  updateWorkSessionLocation,
} from './wfmWorkSessionRepository';
import { getWfmTodayStatus, isWfmSessionActive } from './wfmClockService';

const TOKEN_TABLE = 'workforce_checkin_tokens';
const TOKEN_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type WfmCheckinToken = {
  id: string;
  tenantId: string;
  tokenCode: string;
  locationLabel: string;
  locationLat: number | null;
  locationLng: number | null;
  geofenceRadiusM: number | null;
  isActive: boolean;
  expiresAt: string | null;
};

type TokenRow = {
  id: string;
  tenant_id: string;
  token_code: string;
  location_label: string;
  location_lat: number | null;
  location_lng: number | null;
  geofence_radius_m: number | null;
  is_active: boolean;
  expires_at: string | null;
};

const demoTokens = new Map<string, WfmCheckinToken>();

function mapTokenRow(row: TokenRow): WfmCheckinToken {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tokenCode: row.token_code,
    locationLabel: row.location_label,
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    geofenceRadiusM: row.geofence_radius_m,
    isActive: row.is_active,
    expiresAt: row.expires_at,
  };
}

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-000000000000'.replace(/0/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

function generateTokenCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += TOKEN_CHARSET[Math.floor(Math.random() * TOKEN_CHARSET.length)];
  }
  return code;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resetWfmCheckinDemoStore(): void {
  demoTokens.clear();
}

export function buildCheckinQrPayload(token: WfmCheckinToken): string {
  return `CARESUITE-WFM-CHECKIN:${token.tenantId}:${token.tokenCode}`;
}

export async function listWfmCheckinTokens(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmCheckinToken[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: [...demoTokens.values()].filter((t) => t.tenantId === tenantId && t.isActive),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TOKEN_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data as TokenRow[]).map(mapTokenRow) };
}

export async function createWfmCheckinToken(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  input: {
    locationLabel: string;
    locationLat?: number | null;
    locationLng?: number | null;
    geofenceRadiusM?: number | null;
    expiresInDays?: number;
  },
): Promise<ServiceResult<WfmCheckinToken>> {
  const denied = enforcePermission(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const tokenCode = generateTokenCode();
  const id = newUuid();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86400000).toISOString()
    : null;

  const token: WfmCheckinToken = {
    id,
    tenantId,
    tokenCode,
    locationLabel: input.locationLabel.trim() || 'Hauptstandort',
    locationLat: input.locationLat ?? null,
    locationLng: input.locationLng ?? null,
    geofenceRadiusM: input.geofenceRadiusM ?? null,
    isActive: true,
    expiresAt,
  };

  if (getServiceMode() !== 'supabase') {
    demoTokens.set(id, token);
    return { ok: true, data: token };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TOKEN_TABLE)
    .insert({
      id,
      tenant_id: tenantId,
      token_code: tokenCode,
      location_label: token.locationLabel,
      location_lat: token.locationLat,
      location_lng: token.locationLng,
      geofence_radius_m: token.geofenceRadiusM,
      is_active: true,
      expires_at: expiresAt,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      demoTokens.set(id, token);
      return { ok: true, data: token };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapTokenRow(data as TokenRow) };
}

async function resolveToken(
  tenantId: string,
  tokenCode: string,
): Promise<ServiceResult<WfmCheckinToken>> {
  const normalized = tokenCode.trim().toUpperCase();

  if (getServiceMode() !== 'supabase') {
    const found = [...demoTokens.values()].find(
      (t) => t.tenantId === tenantId && t.tokenCode === normalized && t.isActive,
    );
    if (!found) return { ok: false, error: 'Ungültiger oder abgelaufener Check-in-Code.' };
    if (found.expiresAt && Date.parse(found.expiresAt) < Date.now()) {
      return { ok: false, error: 'Der Check-in-Code ist abgelaufen.' };
    }
    return { ok: true, data: found };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TOKEN_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('token_code', normalized)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Büro-Check-in ist noch nicht eingerichtet.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: false, error: 'Ungültiger oder abgelaufener Check-in-Code.' };

  const token = mapTokenRow(data as TokenRow);
  if (token.expiresAt && Date.parse(token.expiresAt) < Date.now()) {
    return { ok: false, error: 'Der Check-in-Code ist abgelaufen.' };
  }

  return { ok: true, data: token };
}

export async function wfmOfficeCheckInByToken(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  tokenCode: string,
  options?: {
    employeeId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.start');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const tokenResult = await resolveToken(tenantId, tokenCode);
  if (!tokenResult.ok) return tokenResult;
  const token = tokenResult.data;

  if (
    token.geofenceRadiusM != null &&
    token.locationLat != null &&
    token.locationLng != null &&
    options?.latitude != null &&
    options?.longitude != null
  ) {
    const distance = haversineMeters(
      token.locationLat,
      token.locationLng,
      options.latitude,
      options.longitude,
    );
    if (distance > token.geofenceRadiusM) {
      return {
        ok: false,
        error: `Standort außerhalb des Büro-Bereichs (${Math.round(distance)} m, erlaubt: ${token.geofenceRadiusM} m).`,
      };
    }
  }

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;
  const employeeId = employeeResult.data;

  const existingResult = await fetchTodaySession(tenantId, employeeId);
  if (!existingResult.ok) return existingResult;
  if (existingResult.data && isWfmSessionActive(existingResult.data)) {
    return { ok: false, error: 'Es läuft bereits ein Arbeitstag. Bitte zuerst abschließen.' };
  }

  const now = new Date().toISOString();
  const workDate = todayWorkDate();
  const existing = existingResult.data;
  const sessionId = existing?.id ?? newUuid();

  if (existing) {
    const updateResult = await updateWorkSession(existing.id, {
      status: 'office',
      workMode: 'office',
      displayStatus: 'buero',
      startedAt: now,
      endedAt: null,
      lastEventAt: now,
      isOnline: true,
    });
    if (!updateResult.ok) return updateResult;
    await updateWorkSessionLocation(existing.id, token.locationLabel);
  } else {
    const sessionInsert = await insertWorkSession({
      id: sessionId,
      tenantId,
      employeeId,
      userId,
      workDate,
      status: 'office',
      workMode: 'office',
      displayStatus: 'buero',
      startedAt: now,
      endedAt: null,
      lastEventAt: now,
      isOnline: true,
    });
    if (!sessionInsert.ok) return sessionInsert;
    await updateWorkSessionLocation(sessionId, token.locationLabel);
  }

  const eventInsert = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId,
    userId,
    eventType: 'office_check_in',
    workMode: 'office',
    source: 'office',
    sessionId,
    note: `Büro-Check-in: ${token.locationLabel} (${token.tokenCode})`,
    occurredAt: now,
  });
  if (!eventInsert.ok) return eventInsert;

  return getWfmTodayStatus(tenantId, userId, actorRoleKey, {
    employeeId,
    source: 'office',
  });
}

export async function wfmOfficeCheckOut(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.close');
  if (denied) return denied;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const sessionResult = await fetchTodaySession(tenantId, employeeResult.data);
  if (!sessionResult.ok) return sessionResult;
  const session = sessionResult.data;
  if (!session || session.workMode !== 'office' || !isWfmSessionActive(session)) {
    return { ok: false, error: 'Kein aktiver Büro-Check-in zum Abschließen.' };
  }

  const now = new Date().toISOString();
  const startedAt = session.startedAt ? Date.parse(session.startedAt) : Date.parse(now);
  const grossMinutes = Math.max(0, Math.round((Date.parse(now) - startedAt) / 60000));

  const updateResult = await updateWorkSession(session.id, {
    status: 'ended',
    displayStatus: 'feierabend',
    endedAt: now,
    lastEventAt: now,
    isOnline: false,
    grossMinutes,
    netMinutes: Math.max(0, grossMinutes - session.pauseMinutes),
  });
  if (!updateResult.ok) return updateResult;

  const eventResult = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId: employeeResult.data,
    userId,
    eventType: 'office_check_out',
    workMode: 'office',
    source: 'office',
    sessionId: session.id,
    note: 'Büro-Check-out',
    occurredAt: now,
  });
  if (!eventResult.ok) return eventResult;

  return getWfmTodayStatus(tenantId, userId, actorRoleKey, {
    employeeId: employeeResult.data,
    source: 'office',
  });
}
