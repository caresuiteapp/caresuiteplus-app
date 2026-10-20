import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { CareDocumentationListItem } from './careDocumentationTypes';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
async function clientNames(tenantId: string, ids: string[]): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await fromUnknownTable(supabase, 'clients').select('id,first_name,last_name')
    .eq('tenant_id', tenantId).in('id', [...new Set(ids)]);
  return new Map(((data ?? []) as Row[]).map((row) => [text(row.id), `${text(row.first_name)} ${text(row.last_name)}`.trim()]));
}

export async function fetchClinicalHandovers(
  tenantId: string,
  role?: RoleKey | null,
): Promise<ServiceResult<CareDocumentationListItem[]>> {
  const denied = enforcePermission<CareDocumentationListItem[]>(role, 'pflege.handovers.view');
  if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(supabase, 'clinical_handovers').select('*')
    .eq('tenant_id', tenantId).neq('status', 'archived').order('created_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[]; const names = await clientNames(tenantId, rows.map((row) => text(row.client_id)));
  return { ok: true, data: rows.map((row) => ({
    id: text(row.id), tenantId, title: text(row.title), clientName: names.get(text(row.client_id)) ?? '—',
    employeeName: text(row.created_by_name), recordedAt: text(row.created_at), updatedAt: text(row.created_at),
    status: text(row.status) === 'closed' ? 'abgeschlossen' : text(row.status) === 'acknowledged' ? 'in_bearbeitung' : 'aktiv',
    hasSignature: text(row.status) !== 'open', pdfReady: false,
    contentPreview: `${text(row.situation)} · Empfehlung: ${text(row.recommendation)}`,
  })) };
}

export async function createClinicalHandover(
  tenantId: string, clientId: string, payload: Record<string, unknown>, role?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.handovers.manage'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await supabase.rpc('create_clinical_handover' as never, { p_client_id: clientId, p_payload: payload } as never);
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text((data as Row).id) } };
}

export type TreatmentExecutionListItem = {
  id: string; clientName: string; title: string; treatmentType: string; outcome: string;
  performedAt: string; employeeName: string; details: string;
};

export async function fetchTreatmentExecutions(
  tenantId: string, role?: RoleKey | null,
): Promise<ServiceResult<TreatmentExecutionListItem[]>> {
  const denied = enforcePermission<TreatmentExecutionListItem[]>(role, 'pflege.treatment.view'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(supabase, 'clinical_treatment_executions').select('*')
    .eq('tenant_id', tenantId).order('performed_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[]; const names = await clientNames(tenantId, rows.map((row) => text(row.client_id)));
  return { ok: true, data: rows.map((row) => ({ id: text(row.id), clientName: names.get(text(row.client_id)) ?? '—',
    title: text(row.title), treatmentType: text(row.treatment_type), outcome: text(row.outcome),
    performedAt: text(row.performed_at), employeeName: text(row.recorded_by_name), details: text(row.details) })) };
}

export async function recordTreatmentExecution(
  tenantId: string, clientId: string, payload: Record<string, unknown>, role?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.treatment.manage'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await supabase.rpc('record_clinical_treatment_execution' as never, { p_client_id: clientId, p_payload: payload } as never);
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text((data as Row).id) } };
}

export async function signClinicalDocumentation(
  tenantId: string, entryId: string, role?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.documentation.sign'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await supabase.rpc('sign_clinical_documentation' as never, { p_entry_id: entryId } as never);
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text((data as Row).id) } };
}

export async function createWoundAssessment(
  tenantId: string, woundCaseId: string, payload: Record<string, unknown>, role?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.wounds.manage'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await supabase.rpc('create_clinical_wound_assessment' as never, { p_wound_case_id: woundCaseId, p_payload: payload } as never);
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text((data as Row).id) } };
}
