import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { normalizeTravelCompensationPolicy } from '@/lib/travel/travelCompensationPolicy';
import { saveWfmTravelRule, type WfmTravelRule } from './wfmPlanningService';

type TravelRuleInput = Parameters<typeof saveWfmTravelRule>[0];

/** Web updates retain the original creator; the native writer remains unchanged. */
export async function saveOfficeTravelRule(input: TravelRuleInput, roleKey: RoleKey | null, effectivePermissions?: readonly PermissionKey[]): Promise<ServiceResult<WfmTravelRule>> {
  const denied = enforcePermission(roleKey, 'time.settings.manage', { effectivePermissions }) ?? guardServiceTenant(input.tenantId);
  if (denied) return denied;
  if (input.id == null) return saveWfmTravelRule(input);
  if (!input.id.trim() || !input.name.trim()) return { ok: false, error: 'Bezeichnung und gültige Regel sind erforderlich.' };
  if (!Number.isInteger(input.minGapMinutes) || input.minGapMinutes < 0) return { ok: false, error: 'Der Mindestabstand muss eine ganze Zahl ab 0 sein.' };
  if (input.maxGapMinutes != null && (!Number.isInteger(input.maxGapMinutes) || input.maxGapMinutes < input.minGapMinutes)) return { ok: false, error: 'Der Maximalabstand darf nicht kleiner als der Mindestabstand sein.' };
  if (![1, 5, 10, 15, 30].includes(input.roundToMinutes)) return { ok: false, error: 'Bitte eine gültige Rundung wählen.' };
  if (!Number.isInteger(input.mileageRateCents) || input.mileageRateCents < 0 || !Number.isInteger(input.priority) || input.priority < 0) return { ok: false, error: 'Kilometerpauschale und Priorität müssen gültige nichtnegative Werte sein.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine sichere Datenbankverbindung.' };
  const payload = {
    name: input.name.trim(), min_gap_minutes: input.minGapMinutes, max_gap_minutes: input.maxGapMinutes,
    counts_as_work_time: input.countsAsWorkTime, round_to_minutes: input.roundToMinutes,
    mileage_rate_cents: input.mileageRateCents, travel_policy_json: normalizeTravelCompensationPolicy(input.travelPolicy),
    priority: input.priority, is_active: input.isActive, notes: input.notes.trim(), updated_at: new Date().toISOString(),
  };
  const { data, error } = await fromUnknownTable(client, 'workforce_travel_rules').update(payload)
    .eq('tenant_id', input.tenantId).eq('id', input.id).select('*').maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const row = data as Record<string, unknown> | null;
  if (!row || row.id !== input.id || row.tenant_id !== input.tenantId) return { ok: false, error: 'Die Regel konnte nicht bestätigt werden. Bitte die Übersicht aktualisieren.' };
  return { ok: true, data: {
    id: String(row.id), tenantId: String(row.tenant_id), name: String(row.name ?? ''),
    minGapMinutes: Number(row.min_gap_minutes), maxGapMinutes: row.max_gap_minutes == null ? null : Number(row.max_gap_minutes),
    countsAsWorkTime: Boolean(row.counts_as_work_time), roundToMinutes: Number(row.round_to_minutes),
    mileageRateCents: Number(row.mileage_rate_cents), travelPolicy: normalizeTravelCompensationPolicy(row.travel_policy_json),
    priority: Number(row.priority), isActive: Boolean(row.is_active), notes: String(row.notes ?? ''),
  } };
}

/** A concurrent completion must never be overwritten by a stale cancellation. */
export async function cancelOfficeTeamMeeting(tenantId: string, meetingId: string, roleKey: RoleKey | null, effectivePermissions?: readonly PermissionKey[]): Promise<ServiceResult<true>> {
  const denied = enforcePermission(roleKey, 'time.settings.manage', { effectivePermissions }) ?? guardServiceTenant(tenantId);
  if (denied) return denied;
  if (!meetingId.trim()) return { ok: false, error: 'Bitte ein gültiges Meeting auswählen.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine sichere Datenbankverbindung.' };
  const { data, error } = await fromUnknownTable(client, 'workforce_team_meetings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('id', meetingId).eq('status', 'scheduled')
    .select('id,tenant_id,status').maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const row = data as Record<string, unknown> | null;
  if (!row || row.id !== meetingId || row.tenant_id !== tenantId || row.status !== 'cancelled') {
    return { ok: false, error: 'Das Meeting wurde inzwischen geändert oder abgeschlossen. Bitte die Übersicht aktualisieren; es wurde nicht abgesagt.' };
  }
  return { ok: true, data: true };
}
