import { normalizeConsultationAnswers, type ConsultationEncounter, type ConsultationWorkspace } from './workspaceModel';
import { berlinDate } from './workspaceTemplates';

export type ConsultationFilters = { search: string; kind: string; status: string; employee: string; sort: string; from: string; until: string };
const openStatuses = ['draft', 'scheduled', 'in_progress', 'documentation_pending', 'returned'];
const statusPriority: Partial<Record<ConsultationEncounter['status'], number>> = { returned: 0, documentation_pending: 1, in_progress: 2, draft: 3 };
export function nextConsultationFollowUp(e: ConsultationEncounter, workspace?: ConsultationWorkspace | null): string {
  const recorded = normalizeConsultationAnswers(e.answers).followUpDate;
  if (!workspace?.capabilities?.followUps) return recorded;
  const dates = (workspace.followUps ?? []).filter(t => t.encounter_id === e.id && t.status === 'open').map(t => t.due_date);
  if (e.status !== 'approved' && recorded) dates.push(recorded);
  return dates.sort()[0] ?? '';
}
export function matchesVisitStatus(e: ConsultationEncounter, filter: string, today: string, workspace?: ConsultationWorkspace | null): boolean {
  const due = nextConsultationFollowUp(e, workspace);
  switch (filter) {
    case 'all': return true;
    case 'open': return openStatuses.includes(e.status);
    case 'review': return e.status === 'submitted';
    case 'done': return e.status === 'approved';
    case 'followup': return Boolean(due);
    case 'due': return Boolean(due && due <= today && !['cancelled', 'no_show'].includes(e.status));
    case 'today': return Boolean(e.scheduled_start && berlinDate(new Date(e.scheduled_start)) === today && !['cancelled', 'no_show'].includes(e.status));
    default: return e.status === filter;
  }
}
export function filterConsultationVisits(workspace: ConsultationWorkspace | null, filters: ConsultationFilters, today = berlinDate()): ConsultationEncounter[] {
  const query = filters.search.trim().toLocaleLowerCase('de');
  const titles = new Map(workspace?.cases.map(c => [c.id, c.title]) ?? []);
  return (workspace?.encounters ?? []).filter(e => {
    const date = e.scheduled_start ? berlinDate(new Date(e.scheduled_start)) : '';
    return (filters.kind === 'all' || e.service_kind === filters.kind)
      && matchesVisitStatus(e, filters.status, today, workspace)
      && (filters.employee === 'all' || (filters.employee === 'unassigned' ? !e.assigned_employee_id : e.assigned_employee_id === filters.employee))
      && (!filters.from || Boolean(date && date >= filters.from)) && (!filters.until || Boolean(date && date <= filters.until))
      && (!query || [e.client_snapshot.name, e.employee_name, titles.get(e.case_id), e.client_snapshot.address].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(query));
  }).sort((a, b) => {
    if (filters.sort === 'name') return a.client_snapshot.name.localeCompare(b.client_snapshot.name, 'de') || a.id.localeCompare(b.id);
    if (filters.sort === 'followup') return (nextConsultationFollowUp(a, workspace) || '9999').localeCompare(nextConsultationFollowUp(b, workspace) || '9999') || a.id.localeCompare(b.id);
    if (filters.sort === 'priority') {
      const priority = (e: ConsultationEncounter) => statusPriority[e.status] ?? 4;
      const difference = priority(a) - priority(b);
      if (difference) return difference;
    }
    return (a.scheduled_start ?? '9999').localeCompare(b.scheduled_start ?? '9999') || a.id.localeCompare(b.id);
  });
}
