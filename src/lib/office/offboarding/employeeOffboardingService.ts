import type { RoleKey, ServiceResult } from '@/types';
import type {
  EmployeeAccessRevocation,
  EmployeeOffboardingCheck,
  OffboardingBlocker,
  OffboardingCompletionProtocol,
  OffboardingProgressSummary,
  OffboardingStepKey,
  OffboardingStepStatus,
  TerminationType,
} from '@/types/modules/employeeOffboarding';
import {
  OFFBOARDING_STEP_LABELS,
  OFFBOARDING_STEP_ORDER,
} from '@/types/modules/employeeOffboarding';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  buildPersonnelAccessContext,
  canViewEmployeePersonnelFile,
} from '@/lib/office/employeePersonnelAccess';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import {
  buildOffboardingIntegrationSnapshot,
  countOpenReturnsByCategory,
  isExternalAccessProviderConnected,
  lockEmployeePortalAccess,
  recordWorkMaterialReturn,
  setEmployeeEmploymentStatusAfterOffboarding,
} from './employeeOffboardingIntegrationService';
import {
  appendOffboardingAuditEvent,
  EMPLOYEE_OFFBOARDING_PREPARED_MESSAGE,
  isOffboardingLiveReady,
  listAccessRevocations,
  listOffboardingAuditEvents,
  listOffboardingChecks,
  listOffboardingSteps,
  patchOffboardingSession,
  readFinalClearance,
  readOffboardingSession,
  replaceOffboardingChecks,
  updateOffboardingStep,
  upsertAccessRevocation,
  writeFinalClearance,
} from './employeeOffboardingStore';

const EXTERNAL_ACCESS_KINDS = ['email', 'phone', 'cloud'] as const;

function assertOffboardingAccess(
  tenantId: string,
  employeeId: string,
  actorRoleKey: RoleKey | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): ServiceResult<never> | null {
  const denied = enforcePermission<never>(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const accessCtx = buildPersonnelAccessContext({
    tenantId,
    roleKey: actorRoleKey,
    userId: workspaceContext?.userId,
    employeeId: workspaceContext?.employeeId,
    targetEmployeeId: employeeId,
  });

  const access = canViewEmployeePersonnelFile(accessCtx);
  if (!access.allowed) {
    return { ok: false, error: access.reason ?? 'Kein Zugriff auf Personalakte.' };
  }

  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  if (file.tenantId !== tenantId) {
    return { ok: false, error: 'Kein mandantenübergreifender Zugriff auf Personalakten.' };
  }

  return null;
}

function assertOffboardingViewAccess(
  tenantId: string,
  employeeId: string,
  actorRoleKey: RoleKey | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): ServiceResult<never> | null {
  const denied = enforcePermission<never>(actorRoleKey, 'office.employees.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const accessCtx = buildPersonnelAccessContext({
    tenantId,
    roleKey: actorRoleKey,
    userId: workspaceContext?.userId,
    employeeId: workspaceContext?.employeeId,
    targetEmployeeId: employeeId,
  });

  const access = canViewEmployeePersonnelFile(accessCtx);
  if (!access.allowed) {
    return { ok: false, error: access.reason ?? 'Kein Zugriff auf Personalakte.' };
  }

  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  if (file.tenantId !== tenantId) {
    return { ok: false, error: 'Kein mandantenübergreifender Zugriff auf Personalakten.' };
  }

  return null;
}

function guardOffboardingProduction<T>(): ServiceResult<T> | null {
  if (getServiceMode() === 'supabase' && !isOffboardingLiveReady()) {
    return guardLiveDemoFeature<T>('demo-tenant', 'Mitarbeiter-Offboarding');
  }
  return null;
}

function stepStatusFromCheck(
  failed: boolean,
  completed: boolean,
  warning = false,
): OffboardingStepStatus {
  if (failed) return 'blocked';
  if (completed) return 'completed';
  if (warning) return 'in_progress';
  return 'pending';
}

function evaluateOffboardingChecks(
  tenantId: string,
  employeeId: string,
  sessionId: string,
): EmployeeOffboardingCheck[] {
  const session = readOffboardingSession(tenantId, employeeId);
  const snapshot = buildOffboardingIntegrationSnapshot(tenantId, employeeId);
  const now = new Date().toISOString();
  const checks: Omit<EmployeeOffboardingCheck, 'id'>[] = [];

  const push = (
    checkKey: EmployeeOffboardingCheck['checkKey'],
    status: EmployeeOffboardingCheck['status'],
    message: string,
    count: number | null = null,
  ) => {
    checks.push({
      sessionId,
      tenantId,
      employeeId,
      checkKey,
      status,
      message,
      count,
      evaluatedAt: now,
    });
  };

  push(
    'missing_exit_date',
    session.exitDate ? 'passed' : 'failed',
    session.exitDate ? 'Austrittsdatum erfasst.' : 'Austrittsdatum fehlt.',
  );

  push(
    'missing_termination_type',
    session.terminationType ? 'passed' : 'failed',
    session.terminationType ? 'Kündigungsart erfasst.' : 'Kündigungsart fehlt.',
  );

  push(
    'open_assignments',
    snapshot.openAssignments === 0 ? 'passed' : 'failed',
    snapshot.openAssignments === 0
      ? 'Keine offenen Einsätze.'
      : `${snapshot.openAssignments} offene Einsätze.`,
    snapshot.openAssignments,
  );

  push(
    'replacement_open',
    snapshot.openReplacements === 0 ? 'passed' : 'warning',
    snapshot.openReplacements === 0
      ? 'Vertretung geklärt.'
      : `${snapshot.openReplacements} offene Vertretungsanfragen.`,
    snapshot.openReplacements,
  );

  push(
    'open_documentation',
    snapshot.openDocumentation === 0 ? 'passed' : 'failed',
    snapshot.openDocumentation === 0
      ? 'Keine offene Dokumentation.'
      : `${snapshot.openDocumentation} offene Dokumentationen.`,
    snapshot.openDocumentation,
  );

  push(
    'open_corrections',
    snapshot.openCorrections === 0 ? 'passed' : 'failed',
    snapshot.openCorrections === 0
      ? 'Keine offenen Korrekturen.'
      : `${snapshot.openCorrections} offene Korrekturen.`,
    snapshot.openCorrections,
  );

  push(
    'open_signatures',
    snapshot.openSignatures === 0 ? 'passed' : 'failed',
    snapshot.openSignatures === 0
      ? 'Keine offenen Unterschriften.'
      : `${snapshot.openSignatures} offene Unterschriften.`,
    snapshot.openSignatures,
  );

  push(
    'work_time_open',
    snapshot.workTimeOpen ? 'failed' : 'passed',
    snapshot.workTimeOpen ? 'Arbeitszeitperioden noch offen.' : 'Arbeitszeit abgeschlossen.',
    snapshot.openPeriods.length,
  );

  push(
    'payroll_not_prepared',
    snapshot.payrollPrepared ? 'passed' : 'failed',
    snapshot.payrollPrepared ? 'Lohnexport vorbereitet.' : 'Lohnexport fehlt.',
  );

  push(
    'open_returns',
    snapshot.openReturns === 0 ? 'passed' : 'failed',
    snapshot.openReturns === 0
      ? 'Alle Rückgaben erledigt.'
      : `${snapshot.openReturns} offene Rückgaben.`,
    snapshot.openReturns,
  );

  const portalRevocation = listAccessRevocations(sessionId).find((r) => r.kind === 'portal');
  const portalLocked = portalRevocation?.status === 'locked' || !snapshot.portalActive;
  push(
    'portal_not_locked',
    portalLocked ? 'passed' : 'failed',
    portalLocked ? 'Portalzugang gesperrt.' : 'Portalzugang noch aktiv.',
  );

  const externalPrepared = listAccessRevocations(sessionId).filter((r) =>
    EXTERNAL_ACCESS_KINDS.includes(r.kind as (typeof EXTERNAL_ACCESS_KINDS)[number]),
  );
  const externalOk =
    externalPrepared.length === 0 ||
    externalPrepared.every((r) => r.status === 'prepared' || r.status === 'locked');
  push(
    'external_access_not_prepared',
    externalOk ? 'passed' : 'failed',
    externalOk ? 'Externe Zugänge vorbereitet/gesperrt.' : 'Externe Zugänge unvollständig.',
  );

  const completionDocs = listOffboardingSteps(sessionId).find(
    (s) => s.stepKey === 'completion_documents',
  );
  push(
    'documents_incomplete',
    completionDocs?.status === 'completed' ? 'passed' : 'warning',
    completionDocs?.status === 'completed'
      ? 'Abschlussdokumente vollständig.'
      : 'Abschlussdokumente ausstehend.',
  );

  const referenceStep = listOffboardingSteps(sessionId).find(
    (s) => s.stepKey === 'reference_prepared',
  );
  push(
    'reference_missing',
    referenceStep?.status === 'completed' ? 'passed' : 'warning',
    referenceStep?.status === 'completed' ? 'Zeugnis vorbereitet.' : 'Zeugnis ausstehend.',
  );

  const returnProtocol = listOffboardingSteps(sessionId).find(
    (s) => s.stepKey === 'return_protocol',
  );
  push(
    'return_protocol_missing',
    returnProtocol?.status === 'completed' ? 'passed' : 'warning',
    returnProtocol?.status === 'completed'
      ? 'Rückgabeprotokoll vorhanden.'
      : 'Rückgabeprotokoll ausstehend.',
  );

  return replaceOffboardingChecks(sessionId, checks);
}

function syncStepsFromChecks(
  tenantId: string,
  employeeId: string,
  sessionId: string,
  checks: EmployeeOffboardingCheck[],
): void {
  const session = readOffboardingSession(tenantId, employeeId);
  const snapshot = buildOffboardingIntegrationSnapshot(tenantId, employeeId);
  const byKey = new Map(checks.map((c) => [c.checkKey, c]));

  updateOffboardingStep(
    sessionId,
    'exit_date',
    stepStatusFromCheck(byKey.get('missing_exit_date')?.status === 'failed', !!session.exitDate),
  );
  updateOffboardingStep(
    sessionId,
    'termination_type',
    stepStatusFromCheck(
      byKey.get('missing_termination_type')?.status === 'failed',
      !!session.terminationType,
    ),
  );
  updateOffboardingStep(
    sessionId,
    'open_assignments',
    stepStatusFromCheck(
      (byKey.get('open_assignments')?.count ?? 0) > 0,
      (byKey.get('open_assignments')?.count ?? 0) === 0,
    ),
  );
  updateOffboardingStep(
    sessionId,
    'replacement_required',
    stepStatusFromCheck(
      false,
      (byKey.get('replacement_open')?.count ?? 0) === 0,
      (byKey.get('replacement_open')?.count ?? 0) > 0,
    ),
  );
  updateOffboardingStep(
    sessionId,
    'open_documentation',
    stepStatusFromCheck((byKey.get('open_documentation')?.count ?? 0) > 0, snapshot.openDocumentation === 0),
  );
  updateOffboardingStep(
    sessionId,
    'open_corrections',
    stepStatusFromCheck((byKey.get('open_corrections')?.count ?? 0) > 0, snapshot.openCorrections === 0),
  );
  updateOffboardingStep(
    sessionId,
    'open_signatures',
    stepStatusFromCheck((byKey.get('open_signatures')?.count ?? 0) > 0, snapshot.openSignatures === 0),
  );
  updateOffboardingStep(
    sessionId,
    'work_time_closure',
    stepStatusFromCheck(snapshot.workTimeOpen, !snapshot.workTimeOpen),
  );
  updateOffboardingStep(
    sessionId,
    'payroll_export_prepared',
    stepStatusFromCheck(!snapshot.payrollPrepared, snapshot.payrollPrepared),
  );
  updateOffboardingStep(
    sessionId,
    'inventory_return',
    stepStatusFromCheck(snapshot.openReturns > 0, snapshot.openReturns === 0),
  );
  updateOffboardingStep(
    sessionId,
    'uniform',
    stepStatusFromCheck(
      countOpenReturnsByCategory(tenantId, employeeId, 'uniform') > 0,
      countOpenReturnsByCategory(tenantId, employeeId, 'uniform') === 0,
    ),
  );
  updateOffboardingStep(
    sessionId,
    'keys_access',
    stepStatusFromCheck(
      countOpenReturnsByCategory(tenantId, employeeId, 'keys') > 0,
      countOpenReturnsByCategory(tenantId, employeeId, 'keys') === 0,
      countOpenReturnsByCategory(tenantId, employeeId, 'keys') === 0,
    ),
  );
  updateOffboardingStep(
    sessionId,
    'devices',
    stepStatusFromCheck(
      countOpenReturnsByCategory(tenantId, employeeId, 'equipment') > 0,
      countOpenReturnsByCategory(tenantId, employeeId, 'equipment') === 0,
    ),
  );

  const portalRevocation = listAccessRevocations(sessionId).find((r) => r.kind === 'portal');
  updateOffboardingStep(
    sessionId,
    'lock_portal_access',
    stepStatusFromCheck(
      snapshot.portalActive && portalRevocation?.status !== 'locked',
      portalRevocation?.status === 'locked' || !snapshot.portalActive,
    ),
  );

  const externalOk = byKey.get('external_access_not_prepared')?.status === 'passed';
  updateOffboardingStep(
    sessionId,
    'external_access_prepared',
    stepStatusFromCheck(!externalOk, externalOk),
  );
}

function collectBlockers(checks: EmployeeOffboardingCheck[]): OffboardingBlocker[] {
  return checks
    .filter((c) => c.status === 'failed')
    .map((c) => ({
      checkKey: c.checkKey,
      message: c.message,
      count: c.count,
    }));
}

export function buildOffboardingProgressSummary(
  tenantId: string,
  employeeId: string,
): OffboardingProgressSummary {
  const session = readOffboardingSession(tenantId, employeeId);
  const checks = evaluateOffboardingChecks(tenantId, employeeId, session.id);
  syncStepsFromChecks(tenantId, employeeId, session.id, checks);

  const steps = listOffboardingSteps(session.id);
  const blockers = collectBlockers(checks);
  const completedStepCount = steps.filter((s) => s.status === 'completed').length;
  const totalStepCount = OFFBOARDING_STEP_ORDER.length;
  const planningPhase = Boolean(session.startedAt && !session.exitDate);

  const overallStatus =
    session.overallStatus === 'completed' || session.overallStatus === 'reopened'
      ? session.overallStatus
      : planningPhase
        ? 'in_progress'
        : blockers.length > 0
          ? 'blocked'
          : completedStepCount === totalStepCount
            ? 'ready_for_clearance'
            : session.startedAt
              ? 'in_progress'
              : 'not_started';

  if (overallStatus !== session.overallStatus && session.overallStatus !== 'completed') {
    patchOffboardingSession(tenantId, employeeId, { overallStatus });
  }

  return {
    session: readOffboardingSession(tenantId, employeeId),
    steps,
    checks,
    accessRevocations: listAccessRevocations(session.id),
    clearance: readFinalClearance(session.id),
    blockers,
    completedStepCount,
    totalStepCount,
    progressPercent: Math.round((completedStepCount / totalStepCount) * 100),
  };
}

export function fetchOffboardingProgress(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingViewAccess(
    tenantId,
    employeeId,
    actorRoleKey ?? null,
    workspaceContext,
  );
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function startOffboardingSession(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(
    tenantId,
    employeeId,
    actorRoleKey ?? null,
    workspaceContext,
  );
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const now = new Date().toISOString();
  const session = readOffboardingSession(tenantId, employeeId);
  patchOffboardingSession(tenantId, employeeId, {
    overallStatus: 'in_progress',
    currentStepKey: 'exit_date',
    startedAt: session.startedAt ?? now,
  });

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: 'session_started',
    stepKey: 'exit_date',
    detail: 'Offboarding gestartet',
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function saveOffboardingExitDetails(
  tenantId: string,
  employeeId: string,
  input: {
    exitDate: string;
    terminationType: TerminationType;
    internalReason?: string | null;
  },
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(
    tenantId,
    employeeId,
    actorRoleKey ?? null,
    workspaceContext,
  );
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  if (!input.exitDate?.trim()) {
    return { ok: false, error: 'Austrittsdatum ist erforderlich.' };
  }
  if (!input.terminationType) {
    return { ok: false, error: 'Kündigungsart ist erforderlich.' };
  }

  const file = getDemoEmployeePersonnelFile(employeeId);
  if (file) {
    file.masterData.exitDate = input.exitDate.trim();
  }

  const session = readOffboardingSession(tenantId, employeeId);
  patchOffboardingSession(tenantId, employeeId, {
    exitDate: input.exitDate.trim(),
    terminationType: input.terminationType,
    internalReason: input.internalReason?.trim() ?? null,
    currentStepKey: 'open_assignments',
  });

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: 'exit_recorded',
    stepKey: 'exit_date',
    detail: `Austritt ${input.exitDate} (${input.terminationType})`,
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function assignOffboardingResponsible(
  tenantId: string,
  employeeId: string,
  responsibleUserId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const session = readOffboardingSession(tenantId, employeeId);
  patchOffboardingSession(tenantId, employeeId, { responsibleUserId });

  for (const step of listOffboardingSteps(session.id)) {
    updateOffboardingStep(session.id, step.stepKey, step.status, step.notes, responsibleUserId);
  }

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: 'step_updated',
    detail: `Verantwortliche Person zugewiesen: ${responsibleUserId}`,
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function refreshOffboardingChecks(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingViewAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const session = readOffboardingSession(tenantId, employeeId);
  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: 'checks_refreshed',
    detail: 'Offboarding-Prüfungen aktualisiert',
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function recordOffboardingReturn(
  tenantId: string,
  employeeId: string,
  materialId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const material = recordWorkMaterialReturn(tenantId, employeeId, materialId, 'returned');
  if (!material) {
    return { ok: false, error: 'Arbeitsmaterial nicht gefunden.' };
  }

  const session = readOffboardingSession(tenantId, employeeId);
  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: 'return_recorded',
    stepKey: 'inventory_return',
    detail: `Rückgabe erfasst: ${material.itemName}`,
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

function ensureAccessRevocationRecords(
  sessionId: string,
  tenantId: string,
  employeeId: string,
): EmployeeAccessRevocation[] {
  const providerConnected = isExternalAccessProviderConnected(tenantId);
  const kinds: Array<{ kind: EmployeeAccessRevocation['kind']; providerConnected: boolean }> = [
    { kind: 'portal', providerConnected: false },
    { kind: 'email', providerConnected },
    { kind: 'phone', providerConnected },
    { kind: 'cloud', providerConnected },
  ];

  for (const entry of kinds) {
    const existing = listAccessRevocations(sessionId).find((r) => r.kind === entry.kind);
    if (!existing) {
      upsertAccessRevocation({
        sessionId,
        tenantId,
        employeeId,
        kind: entry.kind,
        status: 'pending',
        providerConnected: entry.providerConnected,
        preparedAt: null,
        lockedAt: null,
        actorId: null,
        notes: null,
      });
    }
  }

  return listAccessRevocations(sessionId);
}

export function lockOffboardingPortalAccess(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const session = readOffboardingSession(tenantId, employeeId);
  ensureAccessRevocationRecords(session.id, tenantId, employeeId);

  const locked = lockEmployeePortalAccess(tenantId, employeeId);
  if (!locked) {
    return { ok: false, error: 'Portalzugang konnte nicht gesperrt werden.' };
  }

  const now = new Date().toISOString();
  upsertAccessRevocation({
    sessionId: session.id,
    tenantId,
    employeeId,
    kind: 'portal',
    status: 'locked',
    providerConnected: false,
    preparedAt: now,
    lockedAt: now,
    actorId: actorId ?? null,
    notes: 'Portalzugang gesperrt',
  });

  updateOffboardingStep(session.id, 'lock_portal_access', 'completed');

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: 'access_locked',
    stepKey: 'lock_portal_access',
    detail: 'Portalzugang gesperrt',
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function prepareOffboardingExternalAccess(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const session = readOffboardingSession(tenantId, employeeId);
  ensureAccessRevocationRecords(session.id, tenantId, employeeId);
  const providerConnected = isExternalAccessProviderConnected(tenantId);
  const now = new Date().toISOString();

  for (const kind of EXTERNAL_ACCESS_KINDS) {
    upsertAccessRevocation({
      sessionId: session.id,
      tenantId,
      employeeId,
      kind,
      status: providerConnected ? 'locked' : 'prepared',
      providerConnected,
      preparedAt: now,
      lockedAt: providerConnected ? now : null,
      actorId: actorId ?? null,
      notes: providerConnected
        ? 'Externer Provider verbunden — Sperre ausgelöst'
        : 'Kein Provider — Sperre vorbereitet',
    });
  }

  updateOffboardingStep(session.id, 'external_access_prepared', 'completed');

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: providerConnected ? 'access_locked' : 'access_prepared',
    stepKey: 'external_access_prepared',
    detail: providerConnected
      ? 'Externe Zugänge über Provider gesperrt'
      : 'Externe Zugänge vorbereitet (kein Provider)',
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function markOffboardingManualStep(
  tenantId: string,
  employeeId: string,
  stepKey: OffboardingStepKey,
  status: OffboardingStepStatus = 'completed',
  notes?: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const session = readOffboardingSession(tenantId, employeeId);
  updateOffboardingStep(session.id, stepKey, status, notes ?? null);

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: session.id,
    employeeId,
    action: 'step_updated',
    stepKey,
    detail: `${OFFBOARDING_STEP_LABELS[stepKey]} → ${status}`,
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function generateOffboardingCompletionProtocol(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingCompletionProtocol> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingCompletionProtocol>();
  if (prodBlock) return prodBlock;

  const progress = buildOffboardingProgressSummary(tenantId, employeeId);
  if (progress.blockers.some((b) => b.checkKey !== 'reference_missing' && b.checkKey !== 'return_protocol_missing')) {
    const hardBlockers = progress.blockers.filter(
      (b) => !['reference_missing', 'return_protocol_missing', 'documents_incomplete'].includes(b.checkKey),
    );
    if (hardBlockers.length > 0) {
      return {
        ok: false,
        error: `Abschlussprotokoll blockiert: ${hardBlockers.map((b) => b.message).join('; ')}`,
      };
    }
  }

  const now = new Date().toISOString();
  const protocol: OffboardingCompletionProtocol = {
    sessionId: progress.session.id,
    employeeId,
    tenantId,
    generatedAt: now,
    exitDate: progress.session.exitDate,
    terminationType: progress.session.terminationType,
    stepsCompleted: progress.steps.filter((s) => s.status === 'completed').map((s) => s.stepKey),
    blockersResolved: progress.blockers.length === 0,
    accessLocked: progress.accessRevocations.some(
      (r) => r.kind === 'portal' && r.status === 'locked',
    ),
    returnsCompleted: (progress.checks.find((c) => c.checkKey === 'open_returns')?.count ?? 0) === 0,
    documentReference: `offb-protocol-${progress.session.id}-${Date.now()}`,
  };

  writeFinalClearance({
    sessionId: progress.session.id,
    tenantId,
    employeeId,
    clearedBy: actorId ?? null,
    clearedAt: null,
    protocolDocumentId: protocol.documentReference,
    protocolGeneratedAt: now,
    archivedAt: null,
    employmentStatusAfter: null,
    notes: null,
  });

  updateOffboardingStep(progress.session.id, 'return_protocol', 'completed');

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: progress.session.id,
    employeeId,
    action: 'protocol_generated',
    stepKey: 'return_protocol',
    detail: `Abschlussprotokoll ${protocol.documentReference}`,
    actorId: actorId ?? null,
  });

  return { ok: true, data: protocol };
}

export async function completeOffboardingFinalClearance(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): Promise<ServiceResult<OffboardingProgressSummary>> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const progress = buildOffboardingProgressSummary(tenantId, employeeId);

  const hardBlockerKeys = new Set([
    'open_assignments',
    'open_returns',
    'open_documentation',
    'open_corrections',
    'open_signatures',
    'portal_not_locked',
    'missing_exit_date',
    'missing_termination_type',
  ]);

  const hardBlockers = progress.blockers.filter((b) => hardBlockerKeys.has(b.checkKey));
  if (hardBlockers.length > 0) {
    return {
      ok: false,
      error: `Endfreigabe blockiert: ${hardBlockers.map((b) => b.message).join('; ')}`,
    };
  }

  const portalLocked = progress.accessRevocations.some(
    (r) => r.kind === 'portal' && r.status === 'locked',
  );
  if (!portalLocked && buildOffboardingIntegrationSnapshot(tenantId, employeeId).portalActive) {
    return { ok: false, error: 'Portalzugang muss vor Abschluss gesperrt sein.' };
  }

  const now = new Date().toISOString();
  writeFinalClearance({
    sessionId: progress.session.id,
    tenantId,
    employeeId,
    clearedBy: actorId ?? null,
    clearedAt: now,
    protocolDocumentId:
      progress.clearance?.protocolDocumentId ?? `offb-protocol-${progress.session.id}`,
    protocolGeneratedAt: progress.clearance?.protocolGeneratedAt ?? now,
    archivedAt: null,
    employmentStatusAfter: 'terminated',
    notes: null,
  });

  setEmployeeEmploymentStatusAfterOffboarding(tenantId, employeeId, 'terminated');
  updateOffboardingStep(progress.session.id, 'final_clearance', 'completed');

  patchOffboardingSession(tenantId, employeeId, {
    overallStatus: 'ready_for_clearance',
    currentStepKey: 'archiving',
  });

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: progress.session.id,
    employeeId,
    action: 'clearance_completed',
    stepKey: 'final_clearance',
    detail: 'Endfreigabe erteilt',
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function archiveOffboardingPersonnelFile(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<OffboardingProgressSummary> {
  const accessBlock = assertOffboardingAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const prodBlock = guardOffboardingProduction<OffboardingProgressSummary>();
  if (prodBlock) return prodBlock;

  const progress = buildOffboardingProgressSummary(tenantId, employeeId);
  const clearance = readFinalClearance(progress.session.id);
  if (!clearance?.clearedAt) {
    return { ok: false, error: 'Archivierung erst nach Endfreigabe möglich.' };
  }

  const now = new Date().toISOString();
  setEmployeeEmploymentStatusAfterOffboarding(tenantId, employeeId, 'archived');

  writeFinalClearance({
    ...clearance,
    archivedAt: now,
    employmentStatusAfter: 'archived',
  });

  updateOffboardingStep(progress.session.id, 'archiving', 'completed');
  patchOffboardingSession(tenantId, employeeId, {
    overallStatus: 'completed',
    completedAt: now,
    currentStepKey: 'archiving',
  });

  appendOffboardingAuditEvent({
    tenantId,
    sessionId: progress.session.id,
    employeeId,
    action: 'personnel_archived',
    stepKey: 'archiving',
    detail: 'Personalakte archiviert',
    actorId: actorId ?? null,
  });

  return { ok: true, data: buildOffboardingProgressSummary(tenantId, employeeId) };
}

export function listOffboardingBlockers(
  tenantId: string,
  employeeId: string,
): OffboardingBlocker[] {
  return buildOffboardingProgressSummary(tenantId, employeeId).blockers;
}

export function fetchOffboardingAuditTrail(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ReturnType<typeof listOffboardingAuditEvents>> {
  const accessBlock = assertOffboardingViewAccess(tenantId, employeeId, actorRoleKey ?? null);
  if (accessBlock) return accessBlock;

  const session = readOffboardingSession(tenantId, employeeId);
  return { ok: true, data: listOffboardingAuditEvents(tenantId, session.id) };
}

export {
  EMPLOYEE_OFFBOARDING_PREPARED_MESSAGE,
  isOffboardingLiveReady,
};
