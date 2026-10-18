import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type OfficeWorktimeSettings = { moduleEnabled: boolean; requirePrivacyConsent: boolean };
const columns = 'module_enabled,require_privacy_consent';

function decode(row: unknown): OfficeWorktimeSettings | null {
  if (!row || typeof row !== 'object') return null;
  const value = row as Record<string, unknown>;
  return typeof value.module_enabled === 'boolean' && typeof value.require_privacy_consent === 'boolean'
    ? { moduleEnabled: value.module_enabled, requirePrivacyConsent: value.require_privacy_consent } : null;
}

export async function loadOfficeWorktimeSettings(tenantId: string, roleKey: RoleKey | null): Promise<ServiceResult<OfficeWorktimeSettings | null>> {
  const denied = enforcePermission(roleKey, 'time.settings.manage') ?? guardServiceTenant(tenantId);
  if (denied) return denied;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine sichere Datenbankverbindung.' };
  const { data, error } = await fromUnknownTable(client, 'tenant_time_tracking_settings').select(columns).eq('tenant_id', tenantId).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (data && !decode(data)) return { ok: false, error: 'Die gespeicherten Arbeitszeiteinstellungen sind unvollständig.' };
  return { ok: true, data: decode(data) };
}

export async function saveOfficeWorktimeSettings(tenantId: string, roleKey: RoleKey | null, settings: OfficeWorktimeSettings): Promise<ServiceResult<OfficeWorktimeSettings>> {
  const denied = enforcePermission(roleKey, 'time.settings.manage') ?? guardServiceTenant(tenantId);
  if (denied) return denied;
  if (typeof settings.moduleEnabled !== 'boolean' || typeof settings.requirePrivacyConsent !== 'boolean') return { ok: false, error: 'Bitte gültige Arbeitszeiteinstellungen wählen.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine sichere Datenbankverbindung.' };
  const { data, error } = await fromUnknownTable(client, 'tenant_time_tracking_settings').upsert({ tenant_id: tenantId, module_enabled: settings.moduleEnabled, require_privacy_consent: settings.requirePrivacyConsent, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' }).select(columns).single();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const saved = decode(data);
  return saved ? { ok: true, data: saved } : { ok: false, error: 'Die Speicherung konnte nicht bestätigt werden. Bitte Einstellungen erneut laden.' };
}
