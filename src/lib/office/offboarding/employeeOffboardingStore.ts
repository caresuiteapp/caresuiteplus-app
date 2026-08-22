import type {
  AccessRevocationKind,
  EmployeeAccessRevocation,
  EmployeeFinalClearance,
  EmployeeOffboardingCheck,
  EmployeeOffboardingSession,
  EmployeeOffboardingStep,
  OffboardingAuditEvent,
  OffboardingOverallStatus,
  OffboardingStepKey,
  OffboardingStepStatus,
  TerminationType,
} from '@/types/modules/employeeOffboarding';
import {
  OFFBOARDING_STEP_ORDER,
} from '@/types/modules/employeeOffboarding';

type Store = {
  sessions: Map<string, EmployeeOffboardingSession>;
  steps: Map<string, EmployeeOffboardingStep>;
  checks: EmployeeOffboardingCheck[];
  revocations: Map<string, EmployeeAccessRevocation>;
  clearances: Map<string, EmployeeFinalClearance>;
  auditEvents: OffboardingAuditEvent[];
};

export type EmployeeOffboardingStoreSnapshot = {
  session: EmployeeOffboardingSession;
  steps: EmployeeOffboardingStep[];
  checks: EmployeeOffboardingCheck[];
  revocations: EmployeeAccessRevocation[];
  clearance: EmployeeFinalClearance | null;
  auditEvents: OffboardingAuditEvent[];
};

const STORE: Store = {
  sessions: new Map(),
  steps: new Map(),
  checks: [],
  revocations: new Map(),
  clearances: new Map(),
  auditEvents: [],
};

let sessionCounter = 0;
let stepCounter = 0;
let checkCounter = 0;
let revocationCounter = 0;
let clearanceCounter = 0;
let auditCounter = 0;

function sessionKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

function stepKey(sessionId: string, key: OffboardingStepKey): string {
  return `${sessionId}:${key}`;
}

function revocationKey(sessionId: string, kind: AccessRevocationKind): string {
  return `${sessionId}:${kind}`;
}

export function nextOffboardingSessionId(): string {
  sessionCounter += 1;
  return `offb-session-${sessionCounter}`;
}

export function nextOffboardingStepId(): string {
  stepCounter += 1;
  return `offb-step-${stepCounter}`;
}

export function nextOffboardingCheckId(): string {
  checkCounter += 1;
  return `offb-check-${checkCounter}`;
}

export function nextAccessRevocationId(): string {
  revocationCounter += 1;
  return `offb-revoke-${revocationCounter}`;
}

export function nextFinalClearanceId(): string {
  clearanceCounter += 1;
  return `offb-clearance-${clearanceCounter}`;
}

export function nextOffboardingAuditId(): string {
  auditCounter += 1;
  return `offb-audit-${auditCounter}`;
}

function defaultSteps(
  session: EmployeeOffboardingSession,
): EmployeeOffboardingStep[] {
  const now = new Date().toISOString();
  return OFFBOARDING_STEP_ORDER.map((key) => ({
    id: nextOffboardingStepId(),
    sessionId: session.id,
    tenantId: session.tenantId,
    employeeId: session.employeeId,
    stepKey: key,
    status: 'pending' as OffboardingStepStatus,
    responsibleUserId: session.responsibleUserId,
    completedAt: null,
    notes: null,
    updatedAt: now,
  }));
}

export function readOffboardingSession(
  tenantId: string,
  employeeId: string,
): EmployeeOffboardingSession {
  const key = sessionKey(tenantId, employeeId);
  const existing = STORE.sessions.get(key);
  if (existing) return existing;

  const now = new Date().toISOString();
  const session: EmployeeOffboardingSession = {
    id: nextOffboardingSessionId(),
    tenantId,
    employeeId,
    overallStatus: 'not_started',
    currentStepKey: 'exit_date',
    exitDate: null,
    terminationType: null,
    internalReason: null,
    responsibleUserId: null,
    startedAt: null,
    completedAt: null,
    lastSavedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  STORE.sessions.set(key, session);
  for (const step of defaultSteps(session)) {
    STORE.steps.set(stepKey(session.id, step.stepKey), step);
  }

  return session;
}

export function patchOffboardingSession(
  tenantId: string,
  employeeId: string,
  patch: Partial<
    Pick<
      EmployeeOffboardingSession,
      | 'overallStatus'
      | 'currentStepKey'
      | 'exitDate'
      | 'terminationType'
      | 'internalReason'
      | 'responsibleUserId'
      | 'startedAt'
      | 'completedAt'
    >
  >,
): EmployeeOffboardingSession {
  const session = readOffboardingSession(tenantId, employeeId);
  const now = new Date().toISOString();
  const updated: EmployeeOffboardingSession = {
    ...session,
    ...patch,
    lastSavedAt: now,
    updatedAt: now,
  };
  STORE.sessions.set(sessionKey(tenantId, employeeId), updated);
  return updated;
}

export function listOffboardingSteps(sessionId: string): EmployeeOffboardingStep[] {
  return [...STORE.steps.values()]
    .filter((s) => s.sessionId === sessionId)
    .sort(
      (a, b) =>
        OFFBOARDING_STEP_ORDER.indexOf(a.stepKey) - OFFBOARDING_STEP_ORDER.indexOf(b.stepKey),
    );
}

export function updateOffboardingStep(
  sessionId: string,
  stepKeyName: OffboardingStepKey,
  status: OffboardingStepStatus,
  notes?: string | null,
  responsibleUserId?: string | null,
): EmployeeOffboardingStep | null {
  const step = STORE.steps.get(stepKey(sessionId, stepKeyName));
  if (!step) return null;

  const now = new Date().toISOString();
  const updated: EmployeeOffboardingStep = {
    ...step,
    status,
    notes: notes ?? step.notes,
    responsibleUserId: responsibleUserId ?? step.responsibleUserId,
    completedAt: status === 'completed' ? now : step.completedAt,
    updatedAt: now,
  };
  STORE.steps.set(stepKey(sessionId, stepKeyName), updated);
  return updated;
}

export function replaceOffboardingChecks(
  sessionId: string,
  checks: Omit<EmployeeOffboardingCheck, 'id'>[],
): EmployeeOffboardingCheck[] {
  STORE.checks = STORE.checks.filter((c) => c.sessionId !== sessionId);
  const saved = checks.map((c) => ({
    ...c,
    id: nextOffboardingCheckId(),
  }));
  STORE.checks.push(...saved);
  return saved;
}

export function listOffboardingChecks(sessionId: string): EmployeeOffboardingCheck[] {
  return STORE.checks.filter((c) => c.sessionId === sessionId);
}

export function upsertAccessRevocation(
  input: Omit<EmployeeAccessRevocation, 'id' | 'updatedAt'>,
): EmployeeAccessRevocation {
  const key = revocationKey(input.sessionId, input.kind);
  const existing = STORE.revocations.get(key);
  const now = new Date().toISOString();
  const record: EmployeeAccessRevocation = {
    id: existing?.id ?? nextAccessRevocationId(),
    ...input,
    updatedAt: now,
  };
  STORE.revocations.set(key, record);
  return record;
}

export function listAccessRevocations(sessionId: string): EmployeeAccessRevocation[] {
  return [...STORE.revocations.values()].filter((r) => r.sessionId === sessionId);
}

export function readFinalClearance(sessionId: string): EmployeeFinalClearance | null {
  return STORE.clearances.get(sessionId) ?? null;
}

export function writeFinalClearance(
  input: Omit<EmployeeFinalClearance, 'id'>,
): EmployeeFinalClearance {
  const record: EmployeeFinalClearance = {
    id: STORE.clearances.get(input.sessionId)?.id ?? nextFinalClearanceId(),
    ...input,
  };
  STORE.clearances.set(input.sessionId, record);
  return record;
}

export function appendOffboardingAuditEvent(
  input: Omit<OffboardingAuditEvent, 'id' | 'createdAt'>,
): OffboardingAuditEvent {
  const event: OffboardingAuditEvent = {
    ...input,
    id: nextOffboardingAuditId(),
    createdAt: new Date().toISOString(),
  };
  STORE.auditEvents.unshift(event);
  return event;
}

export function listOffboardingAuditEvents(
  tenantId: string,
  sessionId?: string,
): OffboardingAuditEvent[] {
  return STORE.auditEvents.filter(
    (e) => e.tenantId === tenantId && (!sessionId || e.sessionId === sessionId),
  );
}

export function getOffboardingStoreSnapshot(tenantId: string, employeeId: string) {
  const session = readOffboardingSession(tenantId, employeeId);
  return {
    session,
    steps: listOffboardingSteps(session.id),
    checks: listOffboardingChecks(session.id),
    revocations: listAccessRevocations(session.id),
    clearance: readFinalClearance(session.id),
    auditEvents: listOffboardingAuditEvents(tenantId, session.id),
  };
}

/** Replaces one employee workflow with its durable Supabase representation. */
export function replaceOffboardingStoreSnapshot(
  snapshot: EmployeeOffboardingStoreSnapshot,
): void {
  const key = sessionKey(snapshot.session.tenantId, snapshot.session.employeeId);
  const previousSession = STORE.sessions.get(key);
  const sessionIds = new Set(
    [previousSession?.id, snapshot.session.id].filter((id): id is string => Boolean(id)),
  );

  for (const [keyName, step] of STORE.steps.entries()) {
    if (sessionIds.has(step.sessionId)) STORE.steps.delete(keyName);
  }
  STORE.checks = STORE.checks.filter((check) => !sessionIds.has(check.sessionId));
  for (const [keyName, revocation] of STORE.revocations.entries()) {
    if (sessionIds.has(revocation.sessionId)) STORE.revocations.delete(keyName);
  }
  for (const sessionId of sessionIds) STORE.clearances.delete(sessionId);
  STORE.auditEvents = STORE.auditEvents.filter(
    (event) =>
      event.tenantId !== snapshot.session.tenantId ||
      event.employeeId !== snapshot.session.employeeId,
  );

  STORE.sessions.set(key, snapshot.session);
  for (const step of snapshot.steps) {
    STORE.steps.set(stepKey(snapshot.session.id, step.stepKey), step);
  }
  STORE.checks.push(...snapshot.checks);
  for (const revocation of snapshot.revocations) {
    STORE.revocations.set(revocationKey(snapshot.session.id, revocation.kind), revocation);
  }
  if (snapshot.clearance) {
    STORE.clearances.set(snapshot.session.id, snapshot.clearance);
  }
  STORE.auditEvents.unshift(...snapshot.auditEvents);
}

export function resetEmployeeOffboardingStore(): void {
  STORE.sessions.clear();
  STORE.steps.clear();
  STORE.checks = [];
  STORE.revocations.clear();
  STORE.clearances.clear();
  STORE.auditEvents = [];
  sessionCounter = 0;
  stepCounter = 0;
  checkCounter = 0;
  revocationCounter = 0;
  clearanceCounter = 0;
  auditCounter = 0;
}

export function isOffboardingLiveReady(): boolean {
  return true;
}

export const EMPLOYEE_OFFBOARDING_PREPARED_MESSAGE =
  'Mitarbeiter-Offboarding ist live — alle Schritte werden dauerhaft und revisionssicher gespeichert.';

export type { OffboardingOverallStatus, TerminationType };
