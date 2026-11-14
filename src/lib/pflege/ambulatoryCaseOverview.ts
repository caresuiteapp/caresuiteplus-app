import { admissionLabels, isCalendarDate, type CareAdmission, type CareTask } from './ambulatoryOperationsDomain';
import type { ServiceResult } from '@/types';
import type { CareAssessmentListItem, CareAssessmentSubjectOption } from '@/types/modules/careAssessment';
import type { CareMedicalOrder, CarePlanListItem, PflegeBillingCaseItem, PflegeServiceProofItem } from '@/types/modules/pflege';

export type OverviewSource<T> = { state: 'ready'; data: T } | { state: 'unavailable' } | { state: 'restricted' };
type OperationRows = {
  admissions: Pick<CareAdmission, 'id' | 'clientId' | 'status' | 'updatedAt'>[];
  tasks: Pick<CareTask, 'clientId' | 'status' | 'dueOn'>[];
};

export type OverviewSources = {
  operations: OverviewSource<OperationRows>;
  plans: OverviewSource<Pick<CarePlanListItem, 'id' | 'clientId' | 'status'>[]>;
  assessments: OverviewSource<Pick<CareAssessmentListItem, 'subjectId'>[]>;
  orders: OverviewSource<Pick<CareMedicalOrder, 'clientId' | 'status' | 'validUntil' | 'insurerApprovalRequired' | 'insurerApprovalStatus'>[]>;
  proofs: OverviewSource<Pick<PflegeServiceProofItem, 'clientId' | 'status'>[]>;
  billing: OverviewSource<Pick<PflegeBillingCaseItem, 'clientId' | 'status'>[]>;
};
export const overviewSourceLabels: Record<keyof OverviewSources, string> = {
  operations: 'Aufnahme und Wiedervorlagen', plans: 'Pflegeplanung', assessments: 'SIS und Assessments',
  orders: 'Verordnungen', proofs: 'Leistungsnachweise', billing: 'Abrechnung',
};
export const standardCareReadLimit = 1000;

export async function readCaseOverviewSource<T>(
  isAllowed: () => boolean,
  loader: () => Promise<ServiceResult<T>>,
  mightBeIncomplete?: (data: T) => boolean,
): Promise<OverviewSource<T>> {
  if (!isAllowed()) return { state: 'restricted' };
  try {
    const result = await loader();
    if (!isAllowed()) return { state: 'restricted' };
    if (!result.ok || result.usedDemoFallback || result.tableMissing || mightBeIncomplete?.(result.data)) {
      return { state: 'unavailable' };
    }
    return { state: 'ready', data: result.data };
  } catch {
    return { state: 'unavailable' };
  }
}

type Section<T> = { state: 'ready'; value: T } | { state: 'unavailable' } | { state: 'restricted' };
function section<T, V>(source: OverviewSource<T>, evaluate: (rows: T) => V): Section<V> {
  return source.state === 'ready' ? { state: 'ready', value: evaluate(source.data) } : source;
}
function byCase<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}
const deOrder = new Intl.Collator('de-DE');
const searchKey = (value: string) => value.toLocaleLowerCase('de-DE').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function buildAmbulatoryCaseOverview(clients: CareAssessmentSubjectOption[], sources: OverviewSources, today: string) {
  const admissions = section(sources.operations, rows => byCase(rows.admissions, item => item.clientId));
  const tasks = section(sources.operations, rows => byCase(rows.tasks, item => item.clientId));
  const plans = section(sources.plans, rows => byCase(rows, item => item.clientId));
  const assessments = section(sources.assessments, rows => byCase(rows, item => item.subjectId));
  const orders = section(sources.orders, rows => byCase(rows, item => item.clientId));
  const proofs = section(sources.proofs, rows => byCase(rows, item => item.clientId));
  const billing = section(sources.billing, rows => byCase(rows, item => item.clientId));

  const forClient = <T, V>(index: Section<Map<string, T[]>>, id: string, get: (items: T[]) => V): Section<V> =>
    index.state === 'ready' ? { state: 'ready', value: get(index.value.get(id) ?? []) } : index;

  return Array.from(new Map(clients.map(client => [client.id, client])).values())
    .filter(client => isCaseOverviewId(client.id)).map(client => {
      const admission = forClient(admissions, client.id, (list): CareAdmission['status'] | 'missing' => {
        const latest = list.find(row => row.status !== 'closed') ?? [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).at(0);
        return latest?.status ?? 'missing';
      });
      const openTasks = forClient(tasks, client.id, list => {
        const open = list.filter(item => item.status === 'open');
        return { open: open.length, overdue: open.filter(item => isCalendarDate(item.dueOn) && item.dueOn < today).length };
      });
      const plan = forClient(plans, client.id, list => {
        const active = list.filter(item => item.status === 'aktiv');
        return { active: active.length, onlyId: active.length === 1 && isCaseOverviewId(active[0].id) ? active[0].id : null };
      });
      const assessment = forClient(assessments, client.id, list => list.length);
      const order = forClient(orders, client.id, list => {
        const current = list.filter(item => item.status === 'active' || item.status === 'paused');
        return {
          approvals: current.filter(item => item.insurerApprovalRequired && item.insurerApprovalStatus !== 'approved').length,
          expired: current.filter(item => item.validUntil && isCalendarDate(item.validUntil) && item.validUntil < today).length,
          running: current.length,
        };
      });
      const proof = forClient(proofs, client.id, list => list.filter(item => item.status !== 'approved' && item.status !== 'cancelled').length);
      const bill = forClient(billing, client.id, list => ({
        blocked: list.filter(item => item.status === 'blocked').length, ready: list.filter(item => item.status === 'ready').length,
      }));
      const attention = (admission.state === 'ready' && (admission.value === 'missing' || admission.value === 'draft'))
        || (openTasks.state === 'ready' && openTasks.value.overdue > 0)
        || (order.state === 'ready' && (order.value.expired > 0 || order.value.approvals > 0))
        || (bill.state === 'ready' && bill.value.blocked > 0);
      return { id: client.id, firstName: client.firstName, lastName: client.lastName, careLevel: client.careLevel,
        admission, openTasks, plan, assessment, order, proof, bill, attention };
    }).sort((a, b) => deOrder.compare(a.lastName, b.lastName) || deOrder.compare(a.firstName, b.firstName) || a.id.localeCompare(b.id));
}
export type AmbulatoryCaseRow = ReturnType<typeof buildAmbulatoryCaseOverview>[number];
export type CaseOverviewFilter = 'all' | 'attention' | 'active' | 'paused';
export type CaseOverviewSection<T> = Section<T>;

export function filterAmbulatoryCases(rows: AmbulatoryCaseRow[], search: string, filter: CaseOverviewFilter) {
  const words = searchKey(search).split(/[\s,]+/).filter(Boolean);
  return rows.filter(row => {
    if (filter === 'attention' && !row.attention) return false;
    if ((filter === 'active' || filter === 'paused') && (row.admission.state !== 'ready' || row.admission.value !== filter)) return false;
    const name = searchKey(`${row.firstName} ${row.lastName}`);
    return words.every(word => name.includes(word));
  });
}

export function caseAdmissionLabel(value: 'missing' | CareAdmission['status']) {
  return value === 'missing' ? 'Aufnahme fehlt' : admissionLabels[value];
}

export function isCaseOverviewId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
