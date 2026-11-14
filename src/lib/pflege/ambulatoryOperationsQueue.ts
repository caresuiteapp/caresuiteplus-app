import { admissionBlockers, admissionLabels, isCalendarDate, type CareAdmission, type CareTask } from './ambulatoryOperationsDomain';

export type OperationsArea = 'admissions' | 'tariffs' | 'tasks';
export const operationRoutes = { admissions: '/pflege/aufnahme', tariffs: '/pflege/leistungskatalog', tasks: '/pflege/aufgaben' } as const;
export const admissionFilters = [
  { key: 'all', label: 'Alle Aufnahmen' }, { key: 'draft', label: 'Entwürfe' }, { key: 'ready', label: 'Freigabebereit' },
  { key: 'active', label: 'In Versorgung' }, { key: 'paused', label: 'Pausiert' }, { key: 'closed', label: 'Beendet' },
] as const;
export const taskFilters = [
  { key: 'open', label: 'Offen' }, { key: 'overdue', label: 'Überfällig' }, { key: 'today', label: 'Heute fällig' },
  { key: 'unassigned', label: 'Ohne Zuständigkeit' }, { key: 'done', label: 'Erledigt' }, { key: 'cancelled', label: 'Abgesagt' },
  { key: 'all', label: 'Alle Aufgaben' },
] as const;
export type AdmissionFilter = typeof admissionFilters[number]['key'];
export type TaskFilter = typeof taskFilters[number]['key'];
export const validOperationsId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export type OperationsCaseScope = { state: 'all' } | { state: 'case'; clientId: string } | { state: 'invalid' };
export function operationsCaseScope(value: unknown, area: OperationsArea): OperationsCaseScope {
  if (value === undefined || area === 'tariffs') return { state: 'all' };
  return validOperationsId(value) ? { state: 'case', clientId: value.toLowerCase() } : { state: 'invalid' };
}
export function operationsQueueRoute(area: OperationsArea, caseId: string | null) {
  return caseId && validOperationsId(caseId) && area !== 'tariffs'
    ? `${operationRoutes[area]}?clientId=${encodeURIComponent(caseId)}`
    : operationRoutes[area];
}
const normalize = (value: string) => value.toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function matchesOperationSearch(query: string, value: string) {
  const words = normalize(query).split(/[\s,]+/).filter(Boolean);
  const text = normalize(value);
  return words.every(word => text.includes(word));
}
export const dueText = (value: string) => isCalendarDate(value) ? value.split('-').reverse().join('.') : 'Datum nicht verfügbar';

export function filterAdmissions(rows: CareAdmission[], options: { filter: AdmissionFilter; search: string; caseId: string | null; name(id: string): string }) {
  const rank = { draft: 0, paused: 1, active: 2, closed: 3 };
  return rows.filter(row => (!options.caseId || row.clientId === options.caseId)
      && (options.filter === 'all' || (options.filter === 'ready' ? row.status === 'draft' && admissionBlockers(row).length === 0 : row.status === options.filter))
      && matchesOperationSearch(options.search, `${options.name(row.clientId)} ${row.payerName} ${admissionLabels[row.status]}`))
    .sort((a, b) => rank[a.status] - rank[b.status] || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

export function filterCareTasks(rows: CareTask[], options: { filter: TaskFilter; search: string; caseId: string | null; today: string; name(id: string): string; employeeName(id: string): string }) {
  const rank = { open: 0, done: 1, cancelled: 2 };
  const due = (row: CareTask) => isCalendarDate(row.dueOn) ? row.dueOn : '9999-99-99';
  return rows.filter(row => {
    if (options.caseId && row.clientId !== options.caseId) return false;
    const { filter, today } = options;
    if (filter === 'overdue' && !(row.status === 'open' && due(row) < today)) return false;
    if (filter === 'today' && !(row.status === 'open' && due(row) === today)) return false;
    if (filter === 'unassigned' && !(row.status === 'open' && !row.assignedEmployeeId)) return false;
    if ((filter === 'open' || filter === 'done' || filter === 'cancelled') && row.status !== filter) return false;
    return matchesOperationSearch(options.search, `${row.title} ${row.description} ${row.clientId ? options.name(row.clientId) : 'Betriebsorganisation'} ${row.assignedEmployeeId ? options.employeeName(row.assignedEmployeeId) : ''}`);
  }).sort((a, b) => rank[a.status] - rank[b.status] || (a.status === 'open'
    ? due(a).localeCompare(due(b)) || Number(b.priority === 'urgent') - Number(a.priority === 'urgent')
    : b.updatedAt.localeCompare(a.updatedAt)) || a.id.localeCompare(b.id));
}

export type OperationAction =
  | { kind: 'admission'; id: string; status: 'active' | 'paused' | 'closed'; version: string }
  | { kind: 'task'; id: string; status: 'done' | 'cancelled'; version: string };

export function validateOperationAction(action: OperationAction, rows: { admissions: CareAdmission[]; tasks: CareTask[] }, caseId: string | null, reason: string) {
  const row = (action.kind === 'admission' ? rows.admissions : rows.tasks).find(item => item.id === action.id);
  if (!row || (caseId && row.clientId !== caseId) || row.updatedAt !== action.version || !row.updatedAt)
    return 'Dieser Vorgang hat sich geändert. Bitte aktualisieren und erneut auswählen.';
  const status = row.status;
  if (action.kind === 'task') {
    if (status !== 'open') return 'Diese Aufgabe ist bereits abgeschlossen.';
    if (!reason.trim()) return action.status === 'done' ? 'Bitte ein Ergebnis eintragen.' : 'Bitte einen Absagegrund eintragen.';
  } else {
    if (action.status === 'active') {
      if (status !== 'draft' && status !== 'paused') return 'Diese Versorgung kann jetzt nicht freigegeben werden.';
      const blockers = admissionBlockers(row as CareAdmission);
      if (blockers.length) return blockers.join(' ');
    }
    if ((action.status === 'closed' && status === 'closed') || (action.status === 'paused' && status !== 'active'))
      return 'Dieser Versorgungsstatus kann nicht mehr geändert werden.';
    if (action.status !== 'active' && !reason.trim()) return 'Bitte eine Begründung eintragen.';
  }
  return null;
}
