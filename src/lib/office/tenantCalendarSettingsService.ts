import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoleKey, ServiceResult } from '@/types';
import type {
  CalendarEventType,
  CalendarViewMode,
  TenantCalendarSettings,
  TenantCalendarSettingsForm,
  WeekStartDay,
} from '@/types/modules/calendarEvent';
import {
  buildDefaultTenantCalendarSettings,
  DEFAULT_VISIBLE_TYPES,
} from '@/types/modules/calendarEvent';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';

const STORAGE_PREFIX = 'caresuite:tenant-calendar-settings:';
const DEMO_STORE = new Map<string, TenantCalendarSettings>();

function storageKey(tenantId: string): string {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function isViewMode(value: unknown): value is CalendarViewMode {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year';
}

function isWeekStart(value: unknown): value is WeekStartDay {
  return value === 0 || value === 1;
}

function parseVisibleTypes(raw: unknown): Record<CalendarEventType, boolean> {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VISIBLE_TYPES };
  const input = raw as Record<string, unknown>;
  const result = { ...DEFAULT_VISIBLE_TYPES };
  for (const key of Object.keys(DEFAULT_VISIBLE_TYPES) as CalendarEventType[]) {
    if (typeof input[key] === 'boolean') {
      result[key] = input[key];
    }
  }
  return result;
}

function normalizeSettings(
  tenantId: string,
  partial?: Partial<TenantCalendarSettingsForm>,
): TenantCalendarSettings {
  const base = buildDefaultTenantCalendarSettings(tenantId);
  if (!partial) return base;
  return {
    tenantId,
    defaultView: isViewMode(partial.defaultView) ? partial.defaultView : base.defaultView,
    weekStartDay: isWeekStart(partial.weekStartDay) ? partial.weekStartDay : base.weekStartDay,
    dayViewStartHour:
      typeof partial.dayViewStartHour === 'number'
        ? Math.min(23, Math.max(0, partial.dayViewStartHour))
        : base.dayViewStartHour,
    weekFullDay: typeof partial.weekFullDay === 'boolean' ? partial.weekFullDay : base.weekFullDay,
    maxCollapsedEvents:
      typeof partial.maxCollapsedEvents === 'number'
        ? Math.min(20, Math.max(1, partial.maxCollapsedEvents))
        : base.maxCollapsedEvents,
    visibleTypes: partial.visibleTypes ? parseVisibleTypes(partial.visibleTypes) : base.visibleTypes,
    updatedAt: new Date().toISOString(),
  };
}

function mapRowToSettings(tenantId: string, row: Record<string, unknown>): TenantCalendarSettings {
  const settingsJson = row.settings ?? row;
  const partial =
    typeof settingsJson === 'object' && settingsJson !== null
      ? (settingsJson as Partial<TenantCalendarSettingsForm>)
      : undefined;
  return normalizeSettings(tenantId, partial);
}

function ensureDemoSettings(tenantId: string): TenantCalendarSettings {
  if (!DEMO_STORE.has(tenantId)) {
    DEMO_STORE.set(tenantId, buildDefaultTenantCalendarSettings(tenantId));
  }
  return DEMO_STORE.get(tenantId)!;
}

async function loadFromStorage(tenantId: string): Promise<TenantCalendarSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TenantCalendarSettingsForm>;
    return normalizeSettings(tenantId, parsed);
  } catch {
    return null;
  }
}

async function saveToStorage(settings: TenantCalendarSettings): Promise<void> {
  const { tenantId, ...form } = settings;
  try {
    await AsyncStorage.setItem(storageKey(tenantId), JSON.stringify(form));
  } catch {
    // Vitest / SSR — in-memory store remains authoritative
  }
}

async function fetchFromSupabase(tenantId: string): Promise<ServiceResult<TenantCalendarSettings>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const cached = await loadFromStorage(tenantId);
    return { ok: true, data: cached ?? buildDefaultTenantCalendarSettings(tenantId) };
  }

  const { data, error } = await fromUnknownTable(supabase, 'tenant_calendar_settings')
    .select('settings, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    const cached = await loadFromStorage(tenantId);
    if (cached) return { ok: true, data: cached };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) {
    const cached = await loadFromStorage(tenantId);
    return { ok: true, data: cached ?? buildDefaultTenantCalendarSettings(tenantId) };
  }

  const row = data as Record<string, unknown>;
  const settings = mapRowToSettings(tenantId, row);
  await saveToStorage(settings);
  return { ok: true, data: settings };
}

async function saveToSupabase(settings: TenantCalendarSettings): Promise<ServiceResult<TenantCalendarSettings>> {
  const supabase = getSupabaseClient();
  await saveToStorage(settings);

  if (!supabase) {
    DEMO_STORE.set(settings.tenantId, settings);
    return { ok: true, data: settings };
  }

  const { tenantId, updatedAt, ...form } = settings;
  const { error } = await fromUnknownTable(supabase, 'tenant_calendar_settings').upsert({
    tenant_id: tenantId,
    settings: form,
    updated_at: updatedAt,
  } as Record<string, unknown>);

  if (error) {
    DEMO_STORE.set(settings.tenantId, settings);
    return { ok: true, data: settings };
  }

  return { ok: true, data: settings };
}

export async function fetchTenantCalendarSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCalendarSettings>> {
  const denied = enforcePermission<TenantCalendarSettings>(actorRoleKey, 'office.appointments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isLiveServiceMode()) {
    const cached = await loadFromStorage(tenantId);
    if (cached) {
      DEMO_STORE.set(tenantId, cached);
      return { ok: true, data: cached };
    }
    return { ok: true, data: ensureDemoSettings(tenantId) };
  }

  if (DEMO_STORE.has(tenantId)) {
    return { ok: true, data: DEMO_STORE.get(tenantId)! };
  }

  return fetchFromSupabase(tenantId);
}

export async function saveTenantCalendarSettings(
  tenantId: string,
  form: TenantCalendarSettingsForm,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantCalendarSettings>> {
  const denied = enforcePermission<TenantCalendarSettings>(
    actorRoleKey,
    TENANT_SETTINGS_PERMISSION,
  );
  if (denied) {
    const viewDenied = enforcePermission<TenantCalendarSettings>(
      actorRoleKey,
      'office.appointments.view',
    );
    if (viewDenied) return viewDenied;
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const settings = normalizeSettings(tenantId, form);
  DEMO_STORE.set(tenantId, settings);

  if (!isLiveServiceMode()) {
    await saveToStorage(settings);
    return { ok: true, data: settings };
  }

  return saveToSupabase(settings);
}

export function toTenantCalendarSettingsForm(
  settings: TenantCalendarSettings,
): TenantCalendarSettingsForm {
  const { tenantId: _tenantId, updatedAt: _updatedAt, ...form } = settings;
  return form;
}
