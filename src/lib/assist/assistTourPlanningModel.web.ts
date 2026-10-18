import { addAssistDays, assistBerlinDate, assistBerlinTimestamp, assistText, validAssistDate, type AssistWorkspaceRow } from './assistClientsWorkspaceModel.web';
import { berlinTimestamp, mergeIntervals } from '../calendar/employeeMonthPlanning';
import { REQUIRED_QUALIFICATIONS_BY_ROLE } from '../office/employeePersonnelFieldRules';

export type AssistTourIssue = { code: string; message: string; severity: 'error' | 'warning' | 'unknown' };
export type AssistTourCheckState = 'ready' | 'unknown';
export type AssistTourChecks = { employees: AssistTourCheckState; availability: AssistTourCheckState; absences: AssistTourCheckState; qualifications: AssistTourCheckState };
export type AssistTourVisit = {
  id: string; clientId: string; clientName: string; address: string | null; title: string;
  employeeId: string | null; employeeName: string | null; scheduledStart: string; scheduledEnd: string;
  durationMinutes: number; status: 'planned' | 'confirmed' | 'active' | 'follow_up' | 'completed' | 'cancelled' | 'draft' | 'unknown';
  statusLabel: string; issues: AssistTourIssue[]; canReassign: boolean; isVirtual: boolean;
};
export type AssistTourEmployee = { id: string; name: string; active: boolean | null; qualificationStatus: 'verified' | 'missing' | 'unknown'; qualificationLabels: string[] };
export type AssistTour = { employeeId: string | null; name: string; visits: AssistTourVisit[]; workMinutes: number; issues: AssistTourIssue[] };
export type AssistTourPlanningSnapshot = {
  date: string; loadedAt: string; visits: AssistTourVisit[]; employees: AssistTourEmployee[]; tours: AssistTour[];
  warnings: string[]; checks: AssistTourChecks;
  availability: { employeeId: string; start: number; end: number; kind: 'available' | 'blocked' }[];
  absences: { employeeId: string; start: number; end: number; requested: boolean }[];
};
export type AssistReplacementCandidate = { employeeId: string; name: string; status: 'available' | 'blocked' | 'unknown'; issues: AssistTourIssue[] };
export type AssistTourPlanningSource = {
  tenantId: string; date: string; now: Date; visits: AssistWorkspaceRow[]; clients: AssistWorkspaceRow[]; employees: AssistWorkspaceRow[];
  legacyAssignments: AssistWorkspaceRow[]; executionStates: AssistWorkspaceRow[]; plans: AssistWorkspaceRow[];
  absences: AssistWorkspaceRow[]; qualifications: AssistWorkspaceRow[]; checks: AssistTourChecks; warnings?: string[];
};

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const rowObject = (value: unknown): AssistWorkspaceRow => value && typeof value === 'object' && !Array.isArray(value) ? value as AssistWorkspaceRow : {};
const scoped = (rows: AssistWorkspaceRow[], tenantId: string) => rows.filter(row => row.tenant_id === tenantId);
const name = (row: AssistWorkspaceRow | undefined) => row ? assistText([assistText(row.first_name), assistText(row.last_name)].filter(Boolean).join(' ')) ?? assistText(row.full_name) : null;
const issue = (code: string, message: string, severity: AssistTourIssue['severity'] = 'error'): AssistTourIssue => ({ code, message, severity });
const overlaps = (a: number, b: number, c: number, d: number) => a < d && c < b;
const CLOSED = new Set(['completed', 'abgeschlossen', 'invoiced', 'paid', 'abgerechnet']);
const CANCELLED = new Set(['cancelled', 'canceled', 'storniert', 'no_show', 'nicht_erschienen']);
const FOLLOW_UP = new Set(['finished', 'beendet', 'ended', 'documentation_open', 'documentation_pending', 'dokumentation_offen', 'signature_open', 'signature_pending', 'unterschrift_offen']);
const ACTIVE: Record<string, string> = { on_the_way: 'Unterwegs', on_way: 'Unterwegs', unterwegs: 'Unterwegs', arrived: 'Angekommen', angekommen: 'Angekommen', started: 'In Durchführung', in_progress: 'In Durchführung', gestartet: 'In Durchführung', paused: 'Pausiert', pausiert: 'Pausiert' };

function lifecycle(row: AssistWorkspaceRow): Pick<AssistTourVisit, 'status' | 'statusLabel'> {
  const assignmentStates = [row.canonical_status, row.legacy_status, row.execution_state_status].map(value => String(value ?? ''));
  const states = [...assignmentStates, String(row.execution_status ?? '')];
  if (row.planning_status === 'cancelled' || states.some(value => CANCELLED.has(value))) return { status: 'cancelled', statusLabel: states.some(value => ['no_show', 'nicht_erschienen'].includes(value)) ? 'Nicht erschienen' : 'Abgesagt' };
  // execution_status=completed only means the service ended; documentation and signature can still be open.
  if (assignmentStates.some(value => CLOSED.has(value))) return { status: 'completed', statusLabel: 'Abgeschlossen' };
  if (row.actual_end_at || row.finished_at || row.service_ended_at || row.execution_status === 'completed' || states.some(value => FOLLOW_UP.has(value))) return { status: 'follow_up', statusLabel: 'Nacharbeit offen' };
  for (const value of states) if (ACTIVE[value]) return { status: 'active', statusLabel: ACTIVE[value] };
  if (row.actual_start_at || row.service_started_at) return { status: 'active', statusLabel: 'In Durchführung' };
  if (row.planning_status === 'draft') return { status: 'draft', statusLabel: 'Entwurf' };
  if (row.planning_status === 'confirmed' || states.some(value => ['confirmed', 'bestaetigt'].includes(value))) return { status: 'confirmed', statusLabel: 'Bestätigt' };
  if (['scheduled', 'at_risk'].includes(String(row.planning_status)) || states.some(value => ['planned', 'assigned', 'geplant'].includes(value))) return { status: 'planned', statusLabel: row.planning_status === 'at_risk' ? 'Planung prüfen' : 'Geplant' };
  return { status: 'unknown', statusLabel: 'Status prüfen' };
}

function recurrenceDates(row: AssistWorkspaceRow, date: string): string[] {
  const rule = rowObject(row.recurrence_json), pattern = String(rule.pattern ?? 'none');
  if (pattern === 'none') return [];
  if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(pattern)) throw new Error('Eine Serienregel wird nicht erkannt.');
  const anchor = String(rule.anchorDate ?? row.assignment_date), until = rule.endDate == null ? date : String(rule.endDate);
  if (!validAssistDate(anchor) || !validAssistDate(until)) throw new Error('Eine Serie enthält ein ungültiges Datum.');
  const end = until < date ? until : date, max = rule.occurrenceCount == null ? Infinity : Number(rule.occurrenceCount);
  if (!(max > 0) || (max !== Infinity && !Number.isInteger(max))) throw new Error('Die Terminanzahl einer Serie ist ungültig.');
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 86400000);
  if (days > 36600) throw new Error('Eine sehr alte Serie muss vor der Anzeige geprüft werden.');
  const weekdays: Record<string, number> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
  const start = new Date(`${anchor}T12:00:00Z`);
  const chosen = Array.isArray(rule.weekdays) && rule.weekdays.length ? rule.weekdays.map(day => weekdays[String(day)]) : [start.getUTCDay()];
  if (chosen.some(day => day == null)) throw new Error('Eine Serie enthält einen ungültigen Wochentag.');
  const result: string[] = []; let count = 0;
  for (let offset = 0; offset <= days && count < max; offset++) {
    const current = new Date(start.getTime() + offset * 86400000);
    const last = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
    if (!(pattern === 'daily' || (pattern === 'monthly' ? current.getUTCDate() === Math.min(start.getUTCDate(), last) : chosen.includes(current.getUTCDay()) && (pattern === 'weekly' || Math.floor(offset / 7) % 2 === 0)))) continue;
    count++;
    const key = current.toISOString().slice(0, 10);
    if (key >= addAssistDays(date, -1)) result.push(key);
  }
  return result;
}

export function expandAssistTourPlanningRows(source: Pick<AssistTourPlanningSource, 'tenantId' | 'date' | 'visits'>): AssistWorkspaceRow[] {
  const unique = new Map<string, AssistWorkspaceRow>();
  for (const row of scoped(source.visits, source.tenantId)) {
    if (!assistText(row.id) || !assistText(row.client_id) || row.employee_id != null && !assistText(row.employee_id)) throw new Error('Eine Einsatzzuordnung ist unvollständig.');
    const rule = rowObject(row.recurrence_json), key = rule.parentSeriesId && validAssistDate(rule.sourceOccurrenceDate) ? `${rule.parentSeriesId}::${rule.sourceOccurrenceDate}` : String(row.id);
    const previous = unique.get(key), cancelled = lifecycle(row).status === 'cancelled';
    if (!previous || cancelled && lifecycle(previous).status !== 'cancelled' || cancelled === (lifecycle(previous).status === 'cancelled') && String(row.updated_at ?? '') > String(previous.updated_at ?? '')) unique.set(key, row);
  }
  const rows = [...unique.values()], result = [...rows];
  for (const row of rows) {
    const rule = rowObject(row.recurrence_json);
    if (!rule.pattern || rule.pattern === 'none' || rule.parentSeriesId || row.planning_status === 'draft' || row.planning_status === 'cancelled') continue;
    const masterDate = String(rule.masterOccurrenceDate ?? row.assignment_date), detached = Array.isArray(rule.detachedOccurrenceDates) ? rule.detachedOccurrenceDates : [];
    const start = new Date(String(row.planned_start_at)), end = new Date(String(row.planned_end_at));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error('Eine Serie enthält ungültige Einsatzzeiten.');
    const dayDelta = Math.round((Date.parse(assistBerlinDate(end)) - Date.parse(assistBerlinDate(start))) / 86400000);
    for (const date of recurrenceDates(row, source.date)) {
      const id = `${row.id}::${date}`;
      if (date === masterDate || detached.includes(date) || unique.has(id) || rowObject(rule.materializedOccurrences)[date]) continue;
      result.push({ ...row, id, is_virtual: true, legacy_assignment_id: null, planned_start_at: assistBerlinTimestamp(date, clock.format(start)), planned_end_at: assistBerlinTimestamp(addAssistDays(date, dayDelta), clock.format(end)),
        canonical_status: 'confirmed', execution_status: 'pending', planning_status: 'confirmed', actual_start_at: null, actual_end_at: null, finished_at: null, on_the_way_at: null, arrived_at: null, documentation_status: 'none', proof_status: 'none', billing_status: 'none' });
    }
  }
  return result;
}

function employeeIssues(snapshot: AssistTourPlanningSnapshot, visit: AssistTourVisit, employeeId: string): AssistTourIssue[] {
  const issues: AssistTourIssue[] = [], employee = snapshot.employees.find(row => row.id === employeeId);
  const start = Date.parse(visit.scheduledStart), end = Date.parse(visit.scheduledEnd);
  if (!employee) issues.push(issue('employee_unknown', 'Personalangaben konnten nicht geprüft werden.', 'unknown'));
  else {
    if (employee.active === false) issues.push(issue('employee_inactive', 'Am Einsatztag nicht als aktiv geführt.'));
    if (employee.active === null) issues.push(issue('employee_status_unknown', 'Der Personalstatus konnte nicht geprüft werden.', 'unknown'));
    if (employee.qualificationStatus !== 'verified') issues.push(issue('qualification_' + employee.qualificationStatus, employee.qualificationStatus === 'missing' ? 'Erforderliche Qualifikationsnachweise sind nicht vollständig gültig und bestätigt.' : 'Qualifikationsnachweise konnten nicht geprüft werden.', employee.qualificationStatus === 'missing' ? 'warning' : 'unknown'));
  }
  if (snapshot.checks.absences === 'unknown') issues.push(issue('absence_unknown', 'Abwesenheiten konnten nicht geprüft werden.', 'unknown'));
  else for (const absence of snapshot.absences) if (absence.employeeId === employeeId && overlaps(start, end, absence.start, absence.end)) issues.push(issue('absence', absence.requested ? 'Abwesenheit für diesen Zeitraum beantragt.' : 'Abwesenheit überschneidet sich mit dem Einsatz.'));
  const windows = snapshot.availability.filter(row => row.employeeId === employeeId);
  if (snapshot.checks.availability === 'unknown' || !windows.some(row => row.kind === 'available')) issues.push(issue('availability_unknown', 'Keine bestätigte Verfügbarkeit für diesen Zeitraum.', 'unknown'));
  else {
    const allowed = mergeIntervals(windows.filter(row => row.kind === 'available').map(row => ({ start: row.start, end: row.end })));
    if (!allowed.some(row => row.start <= start && row.end >= end)) issues.push(issue('outside_availability', 'Einsatz liegt außerhalb der hinterlegten Verfügbarkeit.'));
  }
  if (windows.some(row => row.kind === 'blocked' && overlaps(start, end, row.start, row.end))) issues.push(issue('blocked_time', 'Zeitfenster ist gesperrt.'));
  for (const other of snapshot.visits) if (other.id !== visit.id && other.employeeId === employeeId && !['draft', 'cancelled'].includes(other.status) && overlaps(start, end, Date.parse(other.scheduledStart), Date.parse(other.scheduledEnd))) issues.push(issue('employee_overlap', `Überschneidung mit ${other.clientName} (${other.title}).`));
  return issues;
}

export function getAssistReplacementCandidates(snapshot: AssistTourPlanningSnapshot, visitId: string): AssistReplacementCandidate[] {
  const visit = snapshot.visits.find(row => row.id === visitId);
  if (!visit || !visit.canReassign) return [];
  return snapshot.employees.filter(employee => employee.id !== visit.employeeId).map(employee => {
    const issues = employeeIssues(snapshot, visit, employee.id);
    return { employeeId: employee.id, name: employee.name, status: issues.some(item => item.severity === 'error') ? 'blocked' as const : issues.length ? 'unknown' as const : 'available' as const, issues };
  }).sort((a, b) => ({ available: 0, unknown: 1, blocked: 2 }[a.status] - { available: 0, unknown: 1, blocked: 2 }[b.status]) || a.name.localeCompare(b.name, 'de'));
}

export function buildAssistTourPlanning(source: AssistTourPlanningSource): AssistTourPlanningSnapshot {
  if (!validAssistDate(source.date) || !Number.isFinite(source.now.getTime())) throw new Error('Bitte einen gültigen Planungstag wählen.');
  const dayStart = Date.parse(assistBerlinTimestamp(source.date)), dayEnd = Date.parse(assistBerlinTimestamp(addAssistDays(source.date, 1)));
  const clients = new Map(scoped(source.clients, source.tenantId).map(row => [String(row.id), row]));
  const employees = scoped(source.employees, source.tenantId).filter(row => !row.deleted_at).map(row => {
    const qualifications = scoped(source.qualifications, source.tenantId).filter(item => item.employee_id === row.id && ['valid', 'expires_soon'].includes(String(item.status)) && Number.isFinite(Date.parse(String(item.verified_at))) && Date.parse(String(item.verified_at)) < dayEnd && (!item.issued_at || (validAssistDate(item.issued_at) && item.issued_at <= source.date)) && (!item.valid_until || (validAssistDate(item.valid_until) && item.valid_until >= source.date)));
    const roleTitle = assistText(row.role_title);
    const required = roleTitle ? REQUIRED_QUALIFICATIONS_BY_ROLE[roleTitle] : undefined;
    const validDates = (!row.entry_date || validAssistDate(row.entry_date)) && (!row.exit_date || validAssistDate(row.exit_date));
    const activeStatus = ['active', 'aktiv'].includes(String(row.status));
    const knownStatus = activeStatus || ['inactive', 'inaktiv', 'paused', 'pausiert', 'suspended', 'gesperrt', 'archived', 'archiviert', 'terminated', 'deleted', 'entwurf', 'applicant', 'on_leave', 'sick_long_term', 'onboarding', 'in_bearbeitung', 'abgeschlossen', 'fehlerhaft'].includes(String(row.status));
    const active = validDates && knownStatus ? activeStatus && (!row.entry_date || String(row.entry_date) <= source.date) && (!row.exit_date || String(row.exit_date) >= source.date) : null;
    return { id: String(row.id), name: name(row) ?? 'Name nicht verfügbar', active, qualificationStatus: source.checks.qualifications === 'unknown' || !required?.length ? 'unknown' as const : required.every(type => qualifications.some(item => item.qualification_type === type)) ? 'verified' as const : 'missing' as const, qualificationLabels: qualifications.map(item => assistText(item.title) ?? 'Qualifikationsnachweis') };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const legacy = new Map(scoped(source.legacyAssignments, source.tenantId).map(row => [String(row.id), row]));
  const execution = new Map(scoped(source.executionStates, source.tenantId).map(row => [String(row.visit_id), row]));
  const sourceById = new Map(scoped(source.visits, source.tenantId).map(row => [String(row.id), row]));
  const snapshot: AssistTourPlanningSnapshot = { date: source.date, loadedAt: source.now.toISOString(), employees, visits: [], tours: [], warnings: [...source.warnings ?? []], checks: { ...source.checks }, availability: [], absences: [] };
  for (const plan of scoped(source.plans, source.tenantId)) {
    if (!Array.isArray(plan.slots)) { snapshot.checks.availability = 'unknown'; continue; }
    for (const raw of plan.slots) {
      const slot = rowObject(raw);
      if (![addAssistDays(source.date, -1), source.date, addAssistDays(source.date, 1)].includes(String(slot.date))) continue;
      if (!['available', 'blocked'].includes(String(slot.kind))) { snapshot.checks.availability = 'unknown'; continue; }
      try {
        if (!validAssistDate(slot.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(slot.startTime)) || !/^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(String(slot.endTime))) throw new Error('Ungültiges Zeitfenster');
        const start = Date.parse(berlinTimestamp(String(slot.date), String(slot.startTime))), end = Date.parse(berlinTimestamp(String(slot.date), String(slot.endTime)));
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Ungültiges Zeitfenster');
        snapshot.availability.push({ employeeId: String(plan.employee_id), start, end, kind: slot.kind as 'available' | 'blocked' });
      } catch { snapshot.checks.availability = 'unknown'; }
    }
  }
  for (const row of scoped(source.absences, source.tenantId)) {
    if (!['requested', 'approved', 'active', 'completed'].includes(String(row.status))) continue;
    if (row.all_day && (!validAssistDate(String(row.starts_at).slice(0, 10)) || !validAssistDate(String(row.ends_at).slice(0, 10)))) { snapshot.checks.absences = 'unknown'; continue; }
    const start = row.all_day ? Date.parse(assistBerlinTimestamp(String(row.starts_at).slice(0, 10))) : Date.parse(String(row.starts_at));
    const end = row.all_day ? Date.parse(assistBerlinTimestamp(addAssistDays(String(row.ends_at).slice(0, 10), 1))) : Date.parse(String(row.ends_at));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { snapshot.checks.absences = 'unknown'; continue; }
    snapshot.absences.push({ employeeId: String(row.employee_id), start, end, requested: row.status === 'requested' });
  }
  for (const row of expandAssistTourPlanningRows(source)) {
    const start = Date.parse(String(row.planned_start_at)), end = Date.parse(String(row.planned_end_at));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Ein Einsatz enthält ungültige Anfangs- oder Endzeiten.');
    if (!overlaps(start, end, dayStart, dayEnd)) continue;
    const rule = rowObject(row.recurrence_json), parent = sourceById.get(String(rule.parentSeriesId));
    const sharedMirror = Boolean(parent && row.legacy_assignment_id && row.legacy_assignment_id === parent.legacy_assignment_id);
    const mirror = !row.is_virtual && !sharedMirror ? legacy.get(String(row.legacy_assignment_id)) : undefined;
    const state = !row.is_virtual ? execution.get(String(row.id)) ?? (!sharedMirror ? execution.get(String(row.legacy_assignment_id)) : undefined) : undefined;
    let data: AssistWorkspaceRow = { ...row, legacy_status: mirror?.status, execution_state_status: state?.assignment_status, actual_start_at: row.actual_start_at ?? mirror?.actual_start_at, actual_end_at: row.actual_end_at ?? mirror?.actual_end_at, finished_at: row.finished_at ?? mirror?.finished_at, service_started_at: state?.service_started_at, service_ended_at: state?.service_ended_at };
    const ownEvidence = Boolean(data.actual_start_at || data.actual_end_at || data.finished_at || data.service_started_at || data.service_ended_at || row.on_the_way_at || row.arrived_at || state?.travel_started_at || state?.travel_ended_at || state?.documentation_complete || state?.signature_complete || ['complete', 'review'].includes(String(row.documentation_status)) || ['signed', 'verified', 'rejected'].includes(String(row.proof_status)) || ['invoiced', 'paid'].includes(String(row.billing_status)));
    const initial = lifecycle(data);
    if (((rule.pattern && rule.pattern !== 'none') || rule.parentSeriesId) && !ownEvidence && ['active', 'follow_up', 'completed'].includes(initial.status)) data = { ...data, canonical_status: 'confirmed', execution_status: 'pending', planning_status: 'confirmed', legacy_status: undefined, execution_state_status: undefined };
    const status = lifecycle(data), client = clients.get(String(row.client_id)), employeeId = assistText(row.employee_id);
    const streetName = assistText(client?.street), houseNumber = assistText(client?.house_number), postalCode = assistText(client?.postal_code), cityName = assistText(client?.city);
    const address = assistText(row.address_snapshot) ?? (streetName && houseNumber && postalCode && cityName ? `${streetName} ${houseNumber}, ${postalCode} ${cityName}` : null);
    const visit: AssistTourVisit = { id: String(row.id), clientId: String(row.client_id), clientName: name(client) ?? 'Klientenname nicht verfügbar', address, title: assistText(row.title) ?? assistText(row.service_name) ?? 'Einsatz', employeeId, employeeName: employees.find(item => item.id === employeeId)?.name ?? null, scheduledStart: new Date(start).toISOString(), scheduledEnd: new Date(end).toISOString(), durationMinutes: Math.round((end - start) / 60000), ...status, issues: [], canReassign: ['planned', 'confirmed'].includes(status.status) && !ownEvidence, isVirtual: row.is_virtual === true };
    if (!address) visit.issues.push(issue('missing_address', 'Vollständige Einsatzadresse fehlt.', 'warning'));
    if (!client) visit.issues.push(issue('client_unknown', 'Klientenakte konnte nicht geladen werden.', 'unknown'));
    if (status.status === 'unknown') visit.issues.push(issue('status_unknown', 'Einsatzstatus muss geprüft werden.', 'unknown'));
    snapshot.visits.push(visit);
  }
  snapshot.visits.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart) || a.id.localeCompare(b.id));
  for (const visit of snapshot.visits) if (!['cancelled', 'draft'].includes(visit.status)) {
    if (!visit.employeeId) visit.issues.push(issue('unassigned', 'Noch niemandem zugewiesen.', 'warning'));
    else visit.issues.push(...employeeIssues(snapshot, visit, visit.employeeId));
    for (const other of snapshot.visits) if (other.id !== visit.id && other.clientId === visit.clientId && !['draft', 'cancelled'].includes(other.status) && overlaps(Date.parse(visit.scheduledStart), Date.parse(visit.scheduledEnd), Date.parse(other.scheduledStart), Date.parse(other.scheduledEnd))) visit.issues.push(issue('client_overlap', 'Weitere Planung für dieselbe Person überschneidet sich.', 'warning'));
  }
  const groups = new Map<string | null, AssistTourVisit[]>();
  for (const visit of snapshot.visits) groups.set(visit.employeeId, [...groups.get(visit.employeeId) ?? [], visit]);
  snapshot.tours = [...groups].map(([employeeId, visits]) => {
    const workMinutes = visits.filter(visit => !['draft', 'cancelled'].includes(visit.status)).reduce((total, visit) => total + Math.round((Math.min(dayEnd, Date.parse(visit.scheduledEnd)) - Math.max(dayStart, Date.parse(visit.scheduledStart))) / 60000), 0);
    const issues = visits.flatMap(visit => visit.issues);
    if (workMinutes > 600) issues.push(issue('long_day', 'Mehr als zehn Stunden Einsatzzeit geplant. Arbeitszeit und Pausen prüfen.', 'warning'));
    return { employeeId, name: employeeId ? employees.find(item => item.id === employeeId)?.name ?? 'Mitarbeitende zugeordnet' : 'Ohne Zuweisung', visits, workMinutes, issues };
  }).sort((a, b) => Number(Boolean(a.employeeId)) - Number(Boolean(b.employeeId)) || a.name.localeCompare(b.name, 'de'));
  return snapshot;
}
