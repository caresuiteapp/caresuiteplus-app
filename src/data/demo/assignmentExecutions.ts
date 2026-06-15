import type { AssignmentExecution, ActiveExecutionItem, ExecutionPhase } from '@/types/modules/assist';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { getAllowedAssignmentTransitions } from '@/lib/assist/assignmentStatusMachine';
import { getDemoAssignmentSeedById, getDemoAssignmentListItems } from './assistAssignments';
import { demoClients } from './clients';
import { DEMO_TENANT_ID } from './tenant';

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

const executionStore = new Map<string, AssignmentExecution>();

function phaseFromStatus(status: AssignmentStatus): ExecutionPhase {
  switch (status) {
    case 'geplant':
    case 'bestaetigt':
      return 'pending';
    case 'unterwegs':
    case 'angekommen':
      return 'checked_in';
    case 'gestartet':
    case 'pausiert':
    case 'beendet':
    case 'dokumentation_offen':
    case 'unterschrift_offen':
      return 'in_progress';
    case 'abgeschlossen':
      return 'completed';
    case 'storniert':
    case 'nicht_erschienen':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function buildExecution(assignmentId: string, status: AssignmentStatus, patch: Partial<AssignmentExecution> = {}): AssignmentExecution {
  const seed = getDemoAssignmentSeedById(assignmentId);
  const now = new Date().toISOString();
  const base: AssignmentExecution = {
    assignmentId,
    tenantId: DEMO_TENANT_ID,
    status,
    phase: phaseFromStatus(status),
    plannedStartAt: seed?.scheduledStart ?? null,
    plannedEndAt: seed?.scheduledEnd ?? null,
    onTheWayAt: null,
    arrivedAt: null,
    actualStartAt: null,
    actualEndAt: null,
    finishedAt: null,
    documentationNotes: null,
    durationMinutes: null,
    locationNote: seed?.location ?? null,
    activityNote: null,
    tasks: [],
    allowedTransitions: getAllowedAssignmentTransitions(status),
    serviceRecordId: null,
    updatedAt: now,
    checkedInAt: null,
    checkedOutAt: null,
  };
  const merged = { ...base, ...patch, status, phase: phaseFromStatus(status) };
  merged.checkedInAt = merged.onTheWayAt ?? merged.arrivedAt;
  merged.checkedOutAt = merged.finishedAt ?? merged.actualEndAt;
  merged.allowedTransitions = getAllowedAssignmentTransitions(status);
  return merged;
}

export function getDemoAssignmentExecution(assignmentId: string): AssignmentExecution {
  const existing = executionStore.get(assignmentId);
  if (existing) return { ...existing };

  const seed = getDemoAssignmentSeedById(assignmentId);
  const status: AssignmentStatus =
    seed?.status === 'abgeschlossen'
      ? 'abgeschlossen'
      : seed?.status === 'in_bearbeitung'
        ? 'gestartet'
        : seed?.status === 'aktiv'
          ? 'bestaetigt'
          : 'geplant';

  return buildExecution(assignmentId, status);
}

export function markDemoOnTheWay(assignmentId: string): AssignmentExecution | null {
  const seed = getDemoAssignmentSeedById(assignmentId);
  if (!seed) return null;

  const now = new Date().toISOString();
  const execution = buildExecution(assignmentId, 'unterwegs', {
    onTheWayAt: now,
    locationNote: seed.location,
    updatedAt: now,
  });
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function markDemoArrived(assignmentId: string): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.status !== 'unterwegs') return null;

  const now = new Date().toISOString();
  const execution = buildExecution(assignmentId, 'angekommen', {
    ...current,
    arrivedAt: now,
    onTheWayAt: current.onTheWayAt ?? now,
    updatedAt: now,
  });
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function checkInDemoAssignment(
  assignmentId: string,
  locationNote?: string,
): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.status !== 'angekommen' && current.status !== 'bestaetigt' && current.status !== 'unterwegs') {
    if (current.status === 'geplant') {
      markDemoOnTheWay(assignmentId);
      markDemoArrived(assignmentId);
    } else {
      return null;
    }
  }

  const now = new Date().toISOString();
  const execution = buildExecution(assignmentId, 'gestartet', {
    ...getDemoAssignmentExecution(assignmentId),
    actualStartAt: now,
    locationNote: locationNote ?? current.locationNote,
    updatedAt: now,
  });
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function markDemoPaused(assignmentId: string): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.status !== 'gestartet') return null;

  const execution = buildExecution(assignmentId, 'pausiert', {
    ...current,
    updatedAt: new Date().toISOString(),
  });
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function startDemoAssignmentWork(assignmentId: string): AssignmentExecution | null {
  return checkInDemoAssignment(assignmentId);
}

export function markDemoFinished(assignmentId: string): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.status !== 'gestartet' && current.status !== 'pausiert') return null;

  const now = new Date().toISOString();
  const start = current.actualStartAt ? new Date(current.actualStartAt).getTime() : Date.now();
  const durationMinutes = Math.max(1, Math.round((Date.now() - start) / 60_000));

  const execution = buildExecution(assignmentId, 'beendet', {
    ...current,
    finishedAt: now,
    actualEndAt: now,
    durationMinutes,
    updatedAt: now,
  });
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function submitDemoDocumentation(
  assignmentId: string,
  documentationNotes: string,
): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.status !== 'beendet' && current.status !== 'dokumentation_offen') return null;

  const execution = buildExecution(assignmentId, 'dokumentation_offen', {
    ...current,
    documentationNotes,
    activityNote: documentationNotes,
    updatedAt: new Date().toISOString(),
  });
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function checkOutDemoAssignment(
  assignmentId: string,
  activityNote?: string,
): AssignmentExecution | null {
  const current = getDemoAssignmentExecution(assignmentId);
  if (current.status !== 'dokumentation_offen' && current.status !== 'beendet') {
    if (current.status === 'gestartet' || current.status === 'pausiert') {
      markDemoFinished(assignmentId);
      if (activityNote) submitDemoDocumentation(assignmentId, activityNote);
    } else {
      return null;
    }
  }

  const now = new Date().toISOString();
  const base = getDemoAssignmentExecution(assignmentId);
  const execution = buildExecution(assignmentId, 'abgeschlossen', {
    ...base,
    documentationNotes: activityNote ?? base.documentationNotes,
    activityNote: activityNote ?? base.activityNote,
    actualEndAt: base.actualEndAt ?? now,
    finishedAt: base.finishedAt ?? now,
    updatedAt: now,
  });
  executionStore.set(assignmentId, execution);
  return { ...execution };
}

export function getActiveDemoExecutions(): ActiveExecutionItem[] {
  const items = getDemoAssignmentListItems().filter(
    (a) => a.status === 'aktiv' || a.status === 'in_bearbeitung' || a.status === 'entwurf',
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
      assignmentStatus: a.status,
    };
  });
}

export function isExecutionActive(phase: ExecutionPhase): boolean {
  return phase === 'checked_in' || phase === 'in_progress';
}
