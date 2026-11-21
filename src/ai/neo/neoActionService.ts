import { getSupabaseClient } from '@/lib/supabase/client';
import { enforcePermission } from '@/lib/permissions';
import type { RoleKey } from '@/types';
import { fetchVisitDispositionDetail, updateVisitFromWizard } from '@/lib/assist/visitService';
import { mapVisitDetailToEditForm } from '@/lib/assist/visitEditMappers';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { loadPlanningSnapshot } from '@/lib/calendar/employeeMonthPlanningService';
import { dayPlanability, timeMinutes } from '@/lib/calendar/employeeMonthPlanning';
import { assertNeoScope, neoUuid, type NeoScope } from './neoDomain';
import { neoBerlinTimestamp } from './neoActions';

export type NeoAppointment = { title: string; startsAt: string; endsAt: string; location: string; clientId: string };
export type NeoActionResult = { ok: true; id: string; message: string } | { ok: false; error: string; uncertain?: boolean };
async function actor(scope: NeoScope) {
  assertNeoScope(scope); const client = getSupabaseClient(); if (!client) throw Error('Keine Datenverbindung.');
  const auth = await client.auth.getUser(); if (auth.error || auth.data.user?.id !== scope.actorId) throw Error('Der aktuelle Teamzugang muss erneut bestätigt werden.');
  return client;
}
export async function createNeoAppointment(scope: NeoScope, requestId: string, input: NeoAppointment, role: RoleKey | null): Promise<NeoActionResult> {
  const denied = enforcePermission(role, 'office.appointments.edit'); if (denied && !denied.ok) return { ok: false, error: denied.error };
  if (!neoUuid(requestId) || input.clientId !== scope.subjectId || !input.title.trim() || input.title.length > 180 || input.location.length > 500 || !Number.isFinite(Date.parse(input.startsAt)) || !Number.isFinite(Date.parse(input.endsAt)) || Date.parse(input.endsAt) <= Date.parse(input.startsAt) || Date.parse(input.endsAt) - Date.parse(input.startsAt) > 12 * 3600000) return { ok: false, error: 'Bitte Titel, Person und Terminzeit prüfen.' };
  try {
    const client = await actor(scope);
    const rpc = client as unknown as { rpc(name: string, args: unknown): Promise<{ data: any; error: any }> };
    const result = await rpc.rpc('neo_create_appointment', { p_tenant_id: scope.tenantId, p_request_id: requestId, p_payload: input });
    if (result.error) return { ok: false, error: result.error.message ?? 'Der Termin wurde abgelehnt.', uncertain: !['42501', '23514', '40001', '22023', 'P0002'].includes(result.error.code) };
    if (result.data?.requestId !== requestId || result.data?.tenantId !== scope.tenantId || !neoUuid(result.data?.id)) return { ok: false, uncertain: true, error: 'Die Terminbestätigung fehlt. Bitte dieselbe Anfrage erneut prüfen.' };
    return { ok: true, id: result.data.id, message: 'Termin und Kalendereintrag wurden gespeichert.' };
  } catch { return { ok: false, uncertain: true, error: 'Die Speicherbestätigung fehlt. Bitte dieselbe Anfrage erneut prüfen.' }; }
}
export async function moveNeoVisit(scope: NeoScope, input: { visitId: string; date: string; time: string; expectedUpdatedAt: string }, role: RoleKey | null): Promise<NeoActionResult> {
  const denied = enforcePermission(role, 'assist.assignments.manage'); if (denied && !denied.ok) return { ok: false, error: denied.error };
  try {
    await actor(scope);
    const before = await fetchVisitDispositionDetail(input.visitId, scope.tenantId, role);
    if (!before.ok || !before.data) return { ok: false, error: before.ok ? 'Einsatz nicht gefunden.' : before.error };
    const visit = before.data;
    if (visit.tenantId !== scope.tenantId || visit.clientId !== scope.subjectId || visit.updatedAt !== input.expectedUpdatedAt) return { ok: false, error: 'Person oder Einsatzstand hat sich geändert. Bitte den Auftrag neu prüfen.' };
    if (!['pending'].includes(visit.executionStatus) || visit.actualStartAt || visit.onTheWayAt || visit.arrivedAt || visit.finishedAt || visit.persistedSignature || ['completed', 'signed', 'verified'].includes(String(visit.proofStatus)) || Date.parse(visit.scheduledStart) < Date.now()) return { ok: false, error: 'NEO verändert hier nur zukünftige, noch nicht begonnene einzelne Einsätze.' };
    const start = neoBerlinTimestamp(input.date, input.time), duration = Date.parse(visit.scheduledEnd) - Date.parse(visit.scheduledStart);
    if (!(duration > 0 && duration <= 12 * 3600000) || Date.parse(start) < Date.now()) return { ok: false, error: 'Die neue Einsatzzeit ist ungültig oder liegt in der Vergangenheit.' };
    const end = new Date(Date.parse(start) + duration).toISOString();
    const dateLabel = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(end));
    if (dateLabel !== input.date) return { ok: false, error: 'Bitte tagübergreifende Einsätze in der vollständigen Einsatzplanung bearbeiten.' };
    const conflicts = await visitSupabaseRepository.listPlanningConflictCandidates(scope.tenantId, { clientId: scope.subjectId, employeeId: visit.employeeId, periods: [{ plannedStartAt: start, plannedEndAt: end }] });
    if (!conflicts.ok) return { ok: false, error: conflicts.error };
    if (conflicts.data.some(item => item.id !== input.visitId && item.id !== visit.id && item.canonicalStatus !== 'cancelled')) return { ok: false, error: 'Die neue Zeit überschneidet sich mit einer bestehenden Planung für diese Person oder die zugewiesenen Mitarbeitenden.' };
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    if (visit.employeeId) {
      const snapshot = await loadPlanningSnapshot(scope.tenantId, input.date.slice(0, 7), input.date.slice(0, 7), visit.employeeId);
      const plan = dayPlanability(input.date, snapshot.plans.flatMap(item => item.slots), snapshot.absences);
      const begin = timeMinutes(input.time), finish = timeMinutes(parts.format(new Date(end)));
      if (!plan.free.some(interval => interval.start <= begin && interval.end >= finish)) return { ok: false, error: 'Für die neue Zeit liegt keine bestätigte freie Verfügbarkeit vor. Bitte die Einsatzplanung prüfen.' };
    }
    const current = await fetchVisitDispositionDetail(input.visitId, scope.tenantId, role);
    if (!current.ok || !current.data || current.data.updatedAt !== input.expectedUpdatedAt) return { ok: false, error: 'Der Einsatz wurde während der Prüfung geändert. Bitte den Auftrag neu vorbereiten.' };
    await actor(scope);
    const form = { ...mapVisitDetailToEditForm(visit), assignmentDate: input.date, plannedStartTime: input.time, plannedEndTime: parts.format(new Date(end)) };
    // The existing planning writer owns task, budget, calendar, portal and series bookkeeping.
    // Never issue a parallel direct-table write that would skip those follow-up effects.
    const result = await updateVisitFromWizard(scope.tenantId, input.visitId, form, role, 'this_only');
    if (!result.ok) return { ok: false, error: result.error, uncertain: Boolean(result.persistedVisitId) };
    const saved = await fetchVisitDispositionDetail(result.data.id, scope.tenantId, role);
    if (!saved.ok || !saved.data || saved.data.clientId !== scope.subjectId || Date.parse(saved.data.scheduledStart) !== Date.parse(start) || Date.parse(saved.data.scheduledEnd) !== Date.parse(end)) return { ok: false, uncertain: true, error: 'Der ursprüngliche Einsatz muss zur Speicherbestätigung erneut geöffnet werden.' };
    return { ok: true, id: result.data.id, message: 'Der einzelne Einsatz wurde mit unveränderter Dauer verschoben.' };
  } catch (error) { return { ok: false, uncertain: true, error: error instanceof Error ? error.message : 'Die Einsatzänderung ist noch nicht bestätigt.' }; }
}
