import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions/enforce';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';

export const TENANT_NOTIFICATION_SETTINGS_ROUTE = '/settings/tenant/notifications';
export const TENANT_PUSH_SETTING_KEYS = [
  'push_notifications_enabled', 'notify_assignment_changes', 'notify_new_message',
  'notify_signature_required', 'notify_service_record_ready',
] as const;
export type TenantPushSettingKey = typeof TENANT_PUSH_SETTING_KEYS[number];
export type TenantPushPreferences = Record<TenantPushSettingKey, boolean>;
export type TenantNotificationSettings = TenantPushPreferences & { tenantId: string; exists: boolean };
type NotificationRow = Pick<Database['public']['Tables']['tenant_notification_settings']['Row'], TenantPushSettingKey>;
const COLUMNS = TENANT_PUSH_SETTING_KEYS.join(',');
const demoSettings = new Map<string, TenantNotificationSettings>();

function mapSettings(tenantId: string, row: NotificationRow | null): TenantNotificationSettings {
  return {
    tenantId, exists: row !== null,
    push_notifications_enabled: row?.push_notifications_enabled === true,
    notify_assignment_changes: row?.notify_assignment_changes === true,
    notify_new_message: row?.notify_new_message === true,
    notify_signature_required: row?.notify_signature_required === true,
    notify_service_record_ready: row?.notify_service_record_ready === true,
  };
}

function checkAccess(tenantId: string, actorRoleKey?: RoleKey | null) {
  return enforcePermission<TenantNotificationSettings>(actorRoleKey, TENANT_SETTINGS_PERMISSION)
    ?? guardServiceTenant(tenantId);
}

export async function fetchTenantNotificationSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantNotificationSettings>> {
  const denied = checkAccess(tenantId, actorRoleKey);
  if (denied) return denied;
  if (!isLiveServiceMode()) {
    return { ok: true, data: { ...(demoSettings.get(tenantId) ?? mapSettings(tenantId, null)) } };
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  const { data, error } = await client.from('tenant_notification_settings')
    .select(COLUMNS).eq('tenant_id', tenantId).maybeSingle<NotificationRow>();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapSettings(tenantId, data) };
}

/** Normal authenticated client: tenant/admin RLS remains authoritative for every write. */
export async function saveTenantNotificationSettings(
  tenantId: string,
  patch: Partial<TenantPushPreferences>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantNotificationSettings>> {
  const denied = checkAccess(tenantId, actorRoleKey);
  if (denied) return denied;
  const keys = Object.keys(patch);
  if (!keys.length || keys.some(key => !TENANT_PUSH_SETTING_KEYS.some(allowed => allowed === key))
    || Object.values(patch).some(value => typeof value !== 'boolean')) {
    return { ok: false, error: 'Bitte gültige Änderungen an den Push-Einstellungen auswählen.' };
  }
  if (!isLiveServiceMode()) {
    const settings = { ...(demoSettings.get(tenantId) ?? mapSettings(tenantId, null)), ...patch, exists: true };
    demoSettings.set(tenantId, settings);
    return { ok: true, data: { ...settings } };
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  // Untouched preferences, including email/SMS/in-app channels, stay in the database.
  const { data, error } = await client.from('tenant_notification_settings')
    .upsert({ tenant_id: tenantId, ...patch }, { onConflict: 'tenant_id', defaultToNull: false })
    .select(COLUMNS).single<NotificationRow>();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: false, error: 'Die gespeicherten Einstellungen konnten nicht bestätigt werden.' };
  return { ok: true, data: mapSettings(tenantId, data) };
}
