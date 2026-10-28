// Generated native presentation from src/lib/office/tenantCalendarSettingsService.web.ts. Update through scripts/port-native-workspaces.mjs.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoleKey, ServiceResult } from '@/types';
import type { TenantCalendarSettings, TenantCalendarSettingsForm } from '@/types/modules/calendarEvent';
import { buildDefaultTenantCalendarSettings, buildDefaultAssistCalendarSettings, DEFAULT_VISIBLE_TYPES } from '@/types/modules/calendarEvent';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';
export type TenantCalendarSettingsOptions = {
    scope?: 'office' | 'assist';
};
const listeners = new Set<(settings: TenantCalendarSettings) => void>();
const storageKey = (tenant: string, scope: string) => `caresuite:web-calendar-settings:${scope}:${tenant}`;
export function subscribeTenantCalendarSettings(listener: (settings: TenantCalendarSettings) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
function settingsError(error: unknown, operation: 'load' | 'save'): string {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (isSupabaseMissingTableError(error) || code === '42P01') {
        return operation === 'load'
            ? 'Die Kalendereinstellungen sind derzeit nicht verfügbar. Bitte erneut laden.'
            : 'Die Kalendereinstellungen konnten nicht gespeichert werden. Bitte erneut versuchen.';
    }
    return toGermanSupabaseError(error);
}
function normalizeSettings(tenantId: string, raw: unknown, scope: 'office' | 'assist'): TenantCalendarSettings {
    const base = scope === 'assist' ? buildDefaultAssistCalendarSettings(tenantId) : buildDefaultTenantCalendarSettings(tenantId);
    if (!raw || typeof raw !== 'object')
        return base;
    const input = raw as Partial<TenantCalendarSettingsForm>;
    const visibleTypes = { ...base.visibleTypes };
    for (const key of Object.keys(DEFAULT_VISIBLE_TYPES) as (keyof typeof visibleTypes)[]) {
        if (typeof input.visibleTypes?.[key] === 'boolean')
            visibleTypes[key] = input.visibleTypes[key];
    }
    return { ...base, visibleTypes,
        defaultView: ['day', 'week', 'month', 'year', 'agenda', 'list'].includes(input.defaultView ?? '') ? input.defaultView! : base.defaultView,
        weekStartDay: input.weekStartDay === 0 || input.weekStartDay === 1 ? input.weekStartDay : base.weekStartDay,
        dayViewStartHour: Number.isFinite(input.dayViewStartHour) ? Math.min(23, Math.max(0, Math.floor(input.dayViewStartHour!))) : base.dayViewStartHour,
        weekFullDay: typeof input.weekFullDay === 'boolean' ? input.weekFullDay : base.weekFullDay,
        maxCollapsedEvents: Number.isFinite(input.maxCollapsedEvents) ? Math.min(20, Math.max(1, Math.floor(input.maxCollapsedEvents!))) : base.maxCollapsedEvents,
    };
}
/** Live settings come only from the server; stale browser data cannot override a failed save. */
export async function fetchTenantCalendarSettings(tenantId: string, actorRoleKey?: RoleKey | null, options?: TenantCalendarSettingsOptions): Promise<ServiceResult<TenantCalendarSettings>> {
    const scope = options?.scope ?? 'office';
    const denied = enforcePermission<TenantCalendarSettings>(actorRoleKey, scope === 'assist' ? 'assist.assignments.view' : 'office.appointments.view');
    if (denied)
        return denied;
    const blocked = guardServiceTenant(tenantId);
    if (blocked)
        return blocked;
    try {
        if (!isLiveServiceMode()) {
            const raw = await AsyncStorage.getItem(storageKey(tenantId, scope));
            return { ok: true, data: normalizeSettings(tenantId, raw ? JSON.parse(raw) : null, scope) };
        }
        const client = getSupabaseClient();
        if (!client)
            return { ok: false, error: 'Kalendereinstellungen konnten nicht geladen werden. Keine Datenbankverbindung.' };
        const { data, error } = await fromUnknownTable(client, 'tenant_calendar_settings')
            .select('settings, updated_at').eq('tenant_id', tenantId).maybeSingle();
        if (error)
            return { ok: false, error: settingsError(error, 'load') };
        return { ok: true, data: normalizeSettings(tenantId, data?.settings, scope) };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'Kalendereinstellungen konnten nicht geladen werden.' };
    }
}
export async function saveTenantCalendarSettings(tenantId: string, form: TenantCalendarSettingsForm, actorRoleKey?: RoleKey | null, options?: TenantCalendarSettingsOptions): Promise<ServiceResult<TenantCalendarSettings>> {
    const denied = enforcePermission<TenantCalendarSettings>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
    if (denied)
        return denied;
    const blocked = guardServiceTenant(tenantId);
    if (blocked)
        return blocked;
    const scope = options?.scope ?? 'office';
    const settings = normalizeSettings(tenantId, form, scope);
    try {
        if (!isLiveServiceMode()) {
            await AsyncStorage.setItem(storageKey(tenantId, scope), JSON.stringify(toTenantCalendarSettingsForm(settings)));
        }
        else {
            const client = getSupabaseClient();
            if (!client)
                return { ok: false, error: 'Die Einstellungen wurden nicht gespeichert. Keine Datenbankverbindung.' };
            const { data, error } = await fromUnknownTable(client, 'tenant_calendar_settings')
                .upsert({ tenant_id: tenantId, settings: toTenantCalendarSettingsForm(settings), updated_at: settings.updatedAt }, { onConflict: 'tenant_id' })
                .select('tenant_id, settings, updated_at').single();
            if (error)
                return { ok: false, error: settingsError(error, 'save') };
            if (!data || data.tenant_id !== tenantId)
                return { ok: false, error: 'Die Speicherung der Kalendereinstellungen wurde nicht bestätigt.' };
        }
        // The existing database stores one tenant-wide setting shared by Office and Assist.
        listeners.forEach((listener) => listener(settings));
        return { ok: true, data: settings };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'Die Einstellungen konnten nicht gespeichert werden.' };
    }
}
export function toTenantCalendarSettingsForm(settings: TenantCalendarSettings): TenantCalendarSettingsForm {
    const { tenantId: _tenantId, updatedAt: _updatedAt, ...form } = settings;
    return form;
}
