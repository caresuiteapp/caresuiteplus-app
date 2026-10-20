import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

/** Only independently created calendar entries can be removed from the Web calendar. */
export async function archiveCustomCalendarEvent(
  tenantId: string,
  eventRecordId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  if (['office.appointments.edit', 'assist.assignments.manage', 'pflege.plans.manage'].every((permission) =>
    enforcePermission(actorRoleKey, permission as import('@/types/permissions').PermissionKey))) {
    return { ok: false, error: 'Keine Berechtigung, diesen Termin zu entfernen.' };
  }
  if (!eventRecordId.trim()) return { ok: false, error: 'Der Termin konnte nicht zugeordnet werden.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung. Der Termin wurde nicht entfernt.' };
  try {
    const existing = await fromUnknownTable(client, 'calendar_events')
      .select('id, module_key').eq('tenant_id', tenantId).eq('id', eventRecordId)
      .eq('source_type', 'custom_event').is('archived_at', null).maybeSingle();
    if (existing.error) return { ok: false, error: toGermanSupabaseError(existing.error) };
    if (!existing.data) return { ok: false, error: 'Dieser Termin ist nicht mehr verfügbar oder darf hier nicht geändert werden.' };
    const moduleKey = existing.data.module_key;
    const permission = moduleKey === 'office' ? 'office.appointments.edit'
      : moduleKey === 'assist' ? 'assist.assignments.manage'
        : moduleKey === 'pflege' ? 'pflege.plans.manage' : null;
    if (!permission) return { ok: false, error: 'Bitte diesen Termin im zugehörigen Bereich bearbeiten.' };
    const denied = enforcePermission<void>(actorRoleKey, permission);
    if (denied) return denied;
    const { data, error } = await fromUnknownTable(client, 'calendar_events')
      .update({ archived_at: new Date().toISOString(), status: 'archiviert' })
      .eq('tenant_id', tenantId)
      .eq('id', eventRecordId)
      .eq('source_type', 'custom_event')
      .eq('module_key', moduleKey)
      .is('archived_at', null)
      .select('id')
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Der Termin wurde nicht entfernt. Er ist nicht mehr verfügbar oder darf hier nicht geändert werden.' };
    return { ok: true, data: undefined };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Der Termin konnte nicht entfernt werden.' };
  }
}
