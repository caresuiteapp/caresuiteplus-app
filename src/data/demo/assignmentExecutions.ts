import type { AssignmentExecution, ActiveExecutionItem, ExecutionPhase } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types';
import { getDemoAssignmentSeedById, getDemoAssignmentListItems } from './assistAssignments';
import { demoClients } from './clients';
import { DEMO_TENANT_ID } from './tenant';

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

const executionStore = new Map<string, AssignmentExecution>();

function defaultExecution(assignmentId: string): AssignmentExecution {
  return {
    assignmentId,
    tenantId: DEMO_TENANT_ID,
    phase: 'pending',
    checkedInAt: null,
    checkedOutAt: null,
    actualStartAt: null,
    actualEndAt: null,
    durationMinutes: null,
    locationNote: null,
    activityNote: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getDemoAssignmentExecution(assignmentId: string): AssignmentExecution {
  const existing = executionStore.get(assignmentId);
  if (existing) return { ...existing };
  return defaultExecution(assignmentId);
}

export function checkInDemoAssignment(
  assignmentId: string,
  locationNote?: string,
): AssignmentExecution | null {
  const seed = getDemoAssignmentSeedById(assignmentId);
  if (!seed) return null;

  const now = new Date().toISOString();
  const execution: AssignmentExecution = {
    ...getDemoAssignmentExecution(assignmentId),
    phase: 'checked_in',
    checkedInAt: now,
    actualStartAt: now,
    locationNote: locationNote ?? seed.location,
    updatedAt: now,
  };
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function startDemoAssignmentWork(assignmentId: string): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.phase !== 'checked_in') return null;

  const now = new Date().toISOString();
  const execution: AssignmentExecution = {
    ...current,
    phase: 'in_progress',
    actualStartAt: current.actualStartAt ?? now,
    updatedAt: now,
  };
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function checkOutDemoAssignment(
  assignmentId: string,
  activityNote?: string,
): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.phase !== 'in_progress' && current.phase !== 'checked_in') return null;

  const now = new Date().toISOString();
  const start = current.actualStartAt ? new Date(current.actualStartAt).getTime() : Date.now();
  const durationMinutes = Math.max(1, Math.round((Date.now() - start) / 60_000));

  const execution: AssignmentExecution = {
    ...current,
    phase: 'completed',
    checkedOutAt: now,
    actualEndAt: now,
    durationMinutes,
    activityNote: activityNote ?? current.activityNote,
    updatedAt: now,
  };
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function getActiveDemoExecutions(): ActiveExecutionItem[] {
  const items = getDemoAssignmentListItems().filter(
    (a) => a.status === 'aktiv' || a.status === 'in_bearbeitung',
  );

  return items.map((a) => {
    const exec = getDemoAssignmentExecution(a.id);
    const seed = getDemoAssignmentSeedById(a.id);
    return {
      assignmentId: a.id,
      title: a.title,
      clientName: clientName(seed?.clientId ?? ''),
      location: a.location,
      scheduledStart: a.scheduledStart,
      scheduledEnd: a.scheduledEnd,
      phase: exec.phase,
      assignmentStatus: a.status as WorkflowStatus,
    };
  });
}

export function isExecutionActive(phase: ExecutionPhase): boolean {
  return phase === 'checked_in' || phase === 'in_progress';
}
