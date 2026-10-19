import { clinicalControlVersion, controlReadModel } from './clinicalControlDomain.ts';
import { decodeControlSnapshot, type ControlRecord } from './clinicalControlGateway.ts';
import { woundInstant, woundUuid } from './woundCareDomain.ts';

export type HandoverTaskReference = Readonly<{
  handoverId: string;
  consequenceId: string;
  tenantId: string;
  clientId: string;
  nativeTaskId: string;
  responsibilityId: string;
  dueAt: string;
  receiptComplete: boolean;
}>;

export type HandoverTaskLink = Readonly<{
  handoverId: string;
  consequenceId: string;
  nativeTaskId: string;
  availability: 'available' | 'not_available';
  taskStatus: 'open' | 'completed' | 'not_fulfilled' | 'cancelled' | 'not_determined';
  overdue: boolean;
  escalationState: 'scheduled' | 'due' | 'awaiting_response' | 'failed_due' | 'acknowledged' | 'closed' | 'not_determined';
  currentPolicyChanged: boolean;
  receiptComplete: boolean;
  reminderCompletion: 'not_inferred';
  receiptCompletion: 'not_inferred';
}>;

export type HandoverTaskSummary = Readonly<{
  handoverId: string;
  total: number;
  open: number;
  completed: number;
  notFulfilled: number;
  cancelled: number;
  unavailable: number;
  actionDue: number;
  policyChanged: number;
  receiptComplete: boolean;
  allTasksCompleted: boolean;
  taskCompletionSource: 'actual_control_history_only';
  reminderCompletion: 'not_inferred';
  receiptCompletion: 'not_inferred';
}>;

const uuid = (value: unknown): value is string => typeof value === 'string' && woundUuid(value) && value === value.toLowerCase();
const instant = (value: unknown, label: string) => { const parsed = woundInstant(value); if (parsed === null) throw Error(`${label} benötigt einen exakten Zeitpunkt mit Zeitzone.`); return parsed; };

/**
 * Joins handover consequences only to complete, authorized native control histories.
 * A receipt or reminder is deliberately incapable of changing task completion.
 */
export function buildHandoverTaskMonitor(
  references: readonly HandoverTaskReference[],
  records: readonly ControlRecord[],
  tenantId: string,
  controlsAvailable: boolean,
  now = Date.now(),
): Readonly<{ links: readonly HandoverTaskLink[]; summaries: readonly HandoverTaskSummary[] }> {
  if (!uuid(tenantId) || typeof controlsAvailable !== 'boolean' || !Number.isSafeInteger(now)) throw Error('Verlässlicher Aufgaben- und Mandantenkontext fehlt.');
  const complete = controlsAvailable
    ? decodeControlSnapshot({ version: clinicalControlVersion, tenantId, clientId: null, count: records.length, tasks: records }, tenantId, null, now)
    : [];
  const controls = new Map(complete.map(record => [record.task.id, record]));
  const relationIds = new Set<string>(); const taskKeys = new Set<string>();
  const links = references.map(reference => {
    if (![reference.handoverId, reference.consequenceId, reference.tenantId, reference.clientId, reference.nativeTaskId, reference.responsibilityId].every(uuid) || reference.tenantId !== tenantId || typeof reference.receiptComplete !== 'boolean') throw Error('Übergabe-Auftragsbezug ist fremd oder unvollständig.');
    instant(reference.dueAt, 'Übergebene Aufgabenfrist');
    const relationKey = `${reference.handoverId}:${reference.consequenceId}`, taskKey = `${reference.handoverId}:${reference.nativeTaskId}`;
    if (relationIds.has(relationKey) || taskKeys.has(taskKey)) throw Error('Übergabefolge oder Originalauftrag ist innerhalb derselben Fassung doppelt.');
    relationIds.add(relationKey); taskKeys.add(taskKey);
    const record = controls.get(reference.nativeTaskId);
    if (!record) return Object.freeze({ handoverId: reference.handoverId, consequenceId: reference.consequenceId, nativeTaskId: reference.nativeTaskId, availability: 'not_available' as const, taskStatus: 'not_determined' as const, overdue: false, escalationState: 'not_determined' as const, currentPolicyChanged: false, receiptComplete: reference.receiptComplete, reminderCompletion: 'not_inferred' as const, receiptCompletion: 'not_inferred' as const });
    if (record.task.tenantId !== reference.tenantId || record.task.clientId !== reference.clientId) throw Error('Originalauftrag gehört nicht zu Mandant und Pflegefall der Übergabe.');
    const state = controlReadModel(record.task, record.events, now);
    const currentPolicyChanged = state.policy.assigneeId !== reference.responsibilityId || instant(state.policy.dueAt, 'Aktuelle Aufgabenfrist') !== instant(reference.dueAt, 'Übergebene Aufgabenfrist');
    return Object.freeze({ handoverId: reference.handoverId, consequenceId: reference.consequenceId, nativeTaskId: reference.nativeTaskId, availability: 'available' as const, taskStatus: state.status, overdue: state.overdue, escalationState: state.escalationState, currentPolicyChanged, receiptComplete: reference.receiptComplete, reminderCompletion: 'not_inferred' as const, receiptCompletion: 'not_inferred' as const });
  });
  const handovers = [...new Set(references.map(reference => reference.handoverId))];
  const summaries = handovers.map(handoverId => {
    const rows = links.filter(link => link.handoverId === handoverId), total = rows.length, completed = rows.filter(row => row.taskStatus === 'completed').length;
    return Object.freeze({ handoverId, total, open: rows.filter(row => row.taskStatus === 'open').length, completed, notFulfilled: rows.filter(row => row.taskStatus === 'not_fulfilled').length, cancelled: rows.filter(row => row.taskStatus === 'cancelled').length, unavailable: rows.filter(row => row.availability === 'not_available').length, actionDue: rows.filter(row => row.taskStatus === 'open' && (row.overdue || ['due', 'failed_due', 'awaiting_response'].includes(row.escalationState))).length, policyChanged: rows.filter(row => row.currentPolicyChanged).length, receiptComplete: rows.length > 0 && rows.every(row => row.receiptComplete), allTasksCompleted: total > 0 && completed === total, taskCompletionSource: 'actual_control_history_only' as const, reminderCompletion: 'not_inferred' as const, receiptCompletion: 'not_inferred' as const });
  });
  return Object.freeze({ links: Object.freeze(links), summaries: Object.freeze(summaries) });
}
