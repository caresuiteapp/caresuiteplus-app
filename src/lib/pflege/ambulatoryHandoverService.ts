import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { buildAmbulatoryHandover, type AmbulatoryHandoverInput } from './ambulatoryHandoverDomain';
import { buildHandoverTaskMonitor, type HandoverTaskReference } from './ambulatoryHandoverTaskDomain';
import { fetchClinicalControls } from './clinicalControlService';
import type { CareDocumentationListItem } from './careDocumentationTypes';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);

export async function fetchAmbulatoryHandovers(tenantId: string, role: RoleKey | null | undefined): Promise<ServiceResult<CareDocumentationListItem[]>> {
  const denied = enforcePermission<CareDocumentationListItem[]>(role, 'pflege.handovers.view'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Verbindliche Übergaben sind ausschließlich live verfügbar.' };
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(client, 'ambulatory_handovers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) }; const rows = (data ?? []) as Row[]; if (!rows.length) return { ok: true, data: [] };
  const ids = rows.map(row => text(row.id)); const clientIds = [...new Set(rows.map(row => text(row.client_id)))];
  const [recipientResult, acknowledgementResult, consequenceResult, clientResult, controlResult] = await Promise.all([
    fromUnknownTable(client, 'ambulatory_handover_recipients').select('handover_id').eq('tenant_id', tenantId).in('handover_id', ids),
    fromUnknownTable(client, 'ambulatory_handover_acknowledgements').select('handover_id').eq('tenant_id', tenantId).in('handover_id', ids),
    fromUnknownTable(client, 'ambulatory_handover_consequences').select('id,handover_id,native_task_id,responsibility_id,due_at').eq('tenant_id', tenantId).in('handover_id', ids),
    fromUnknownTable(client, 'clients').select('id,first_name,last_name').eq('tenant_id', tenantId).in('id', clientIds),
    fetchClinicalControls(tenantId, null, role),
  ]);
  const childError = recipientResult.error ?? acknowledgementResult.error ?? consequenceResult.error ?? clientResult.error; if (childError) return { ok: false, error: toGermanSupabaseError(childError) };
  const counts = (items: unknown[] | null, id: string) => (items ?? []).filter(item => text((item as Row).handover_id) === id).length;
  const names = new Map(((clientResult.data ?? []) as Row[]).map(row => [text(row.id), `${text(row.first_name)} ${text(row.last_name)}`.trim()]));
  const receiptComplete = new Map(rows.map(row => { const id = text(row.id), expected = counts(recipientResult.data, id), received = counts(acknowledgementResult.data, id); return [id, expected > 0 && received === expected]; }));
  const roots = new Map(rows.map(row => [text(row.id), row]));
  const references = ((consequenceResult.data ?? []) as Row[]).map(row => { const root = roots.get(text(row.handover_id)); return { handoverId: text(row.handover_id), consequenceId: text(row.id), tenantId, clientId: text(root?.client_id), nativeTaskId: text(row.native_task_id), responsibilityId: text(row.responsibility_id), dueAt: text(row.due_at), receiptComplete: receiptComplete.get(text(row.handover_id)) ?? false } satisfies HandoverTaskReference; });
  let summaries = new Map<string, ReturnType<typeof buildHandoverTaskMonitor>['summaries'][number]>();
  try { summaries = new Map(buildHandoverTaskMonitor(references, controlResult.ok ? controlResult.data : [], tenantId, controlResult.ok).summaries.map(summary => [summary.handoverId, summary])); } catch { summaries = new Map(); }
  return { ok: true, data: rows.map(row => { const id = text(row.id), expected = counts(recipientResult.data, id), received = counts(acknowledgementResult.data, id), complete = expected > 0 && received === expected, task = summaries.get(id); const taskText = !task ? 'Auftragsstatus nicht ermittelt' : task.unavailable ? `${task.unavailable}/${task.total} Originalaufträge nicht zugänglich` : `${task.completed}/${task.total} tatsächlich erledigt${task.actionDue ? ` · ${task.actionDue} fällig/eskalationsrelevant` : ''}${task.policyChanged ? ` · ${task.policyChanged} Zuständigkeit/Frist fortgeschrieben` : ''}`; return { id, tenantId, title: text(row.title), clientName: names.get(text(row.client_id)) ?? '—', employeeName: text(row.created_by_name), recordedAt: text(row.created_at), updatedAt: text(row.created_at), status: received === 0 ? 'aktiv' : received < expected ? 'in_bearbeitung' : 'abgeschlossen', hasSignature: complete, pdfReady: false, contentPreview: `${text(row.priority)} · Empfang ${received}/${expected} · ${taskText}. Empfang und Erinnerungen erledigen keinen Auftrag.` }; }) };
}

export async function createAmbulatoryHandover(tenantId: string, role: RoleKey | null | undefined, input: AmbulatoryHandoverInput): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.handovers.manage'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Verbindliche Übergaben sind ausschließlich live verfügbar.' };
  if (input.tenantId !== tenantId) return { ok: false, error: 'Mandant der Übergabe stimmt nicht mit dem aktiven Mandanten überein.' };
  try { buildAmbulatoryHandover(input); } catch (caught) { return { ok: false, error: caught instanceof Error ? caught.message : 'Übergabe ist unvollständig.' }; }
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await client.rpc('create_ambulatory_handover' as never, { p_payload: input, p_client_request_id: input.clientRequestId } as never);
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text((data as Row).id) } };
}
