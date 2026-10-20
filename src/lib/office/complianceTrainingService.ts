import type { RoleKey, ServiceResult } from '@/types';
import type {
  AcknowledgeComplianceTrainingInput,
  AssignComplianceTrainingInput,
  ComplianceEmployeeStatusRow,
  ComplianceProofExport,
  ComplianceTrainingAcknowledgement,
  ComplianceTrainingAssignment,
  ComplianceTrainingAuditEvent,
  ComplianceTrainingItem,
  ComplianceTrainingStatus,
  CreateComplianceTrainingItemInput,
} from '@/types/modules/complianceTraining';
import {
  COMPLIANCE_BLOCKING_STATUSES,
  COMPLIANCE_COMPLETED_STATUSES,
} from '@/types/modules/complianceTraining';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import {
  buildComplianceAccessContext,
  canAcknowledgeComplianceTraining,
  canManageComplianceTraining,
  canViewComplianceTrainingData,
  canViewEmployeeComplianceAssignments,
  filterComplianceAssignmentsForViewer,
} from './complianceTrainingAccess';
import {
  buildDefaultTrainingTitle,
  DEFAULT_COMPLIANCE_VALIDITY_MONTHS,
  getMandatoryAreasForRoleGroup,
  mapRoleKeyToComplianceGroup,
} from './complianceTrainingFieldRules';
import {
  COMPLIANCE_TRAINING_STORE,
  getComplianceAssignmentById,
  getComplianceItemById,
  listComplianceAssignmentsForTenant,
  listComplianceItemsForTenant,
  nextComplianceAcknowledgementId,
  nextComplianceAssignmentId,
  nextComplianceAuditId,
  nextComplianceItemId,
  resetComplianceTrainingStore,
} from './complianceTrainingStore';

function nowIso(): string {
  return new Date().toISOString();
}

function audit(input: Omit<ComplianceTrainingAuditEvent, 'id' | 'createdAt' | 'updatedAt'>): void {
  const now = nowIso();
  COMPLIANCE_TRAINING_STORE.auditEvents.push({
    id: nextComplianceAuditId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  });
}

function addMonthsIso(from: string, months: number): string {
  const date = new Date(from);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

export function resolveEffectiveComplianceStatus(
  assignment: ComplianceTrainingAssignment,
  item: ComplianceTrainingItem | null,
  at = new Date(),
): ComplianceTrainingStatus {
  if (assignment.status === 'waived' || assignment.status === 'archived') {
    return assignment.status;
  }

  if (COMPLIANCE_COMPLETED_STATUSES.has(assignment.status)) {
    if (assignment.expiresAt && new Date(assignment.expiresAt) < at) {
      return 'expired';
    }
    return assignment.status;
  }

  if (assignment.dueAt && new Date(assignment.dueAt) < at) {
    return 'overdue';
  }

  if (item?.requiresQuiz && assignment.status === 'viewed') {
    return 'quiz_required';
  }

  return assignment.status;
}

export function isComplianceAssignmentBlocking(
  assignment: ComplianceTrainingAssignment,
  item: ComplianceTrainingItem | null,
  at = new Date(),
): boolean {
  if (!assignment.mandatory) return false;
  const effective = resolveEffectiveComplianceStatus(assignment, item, at);
  return COMPLIANCE_BLOCKING_STATUSES.has(effective) || effective === 'expired';
}

export function getBlockingMandatoryComplianceAssignments(
  tenantId: string,
  employeeId: string,
  at = new Date(),
): ComplianceTrainingAssignment[] {
  const assignments = listComplianceAssignmentsForTenant(tenantId, employeeId);
  return assignments.filter((assignment) => {
    const item = getComplianceItemById(tenantId, assignment.trainingItemId);
    return isComplianceAssignmentBlocking(assignment, item, at);
  });
}

export function evaluateComplianceDeployability(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  at = new Date(),
): { ok: boolean; blockers: string[] } {
  const blocking = getBlockingMandatoryComplianceAssignments(tenantId, employeeId, at);
  if (blocking.length === 0) return { ok: true, blockers: [] };

  const blockers = blocking.map((assignment) => {
    const item = getComplianceItemById(tenantId, assignment.trainingItemId);
    const title = item?.title ?? assignment.trainingItemId;
    const status = resolveEffectiveComplianceStatus(assignment, item, at);
    return `Pflichtunterweisung „${title}" (${status}) fehlt oder abgelaufen.`;
  });

  return { ok: false, blockers };
}

export async function seedDefaultComplianceItemsForTenant(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ComplianceTrainingItem[]>> {
  const ctx = buildComplianceAccessContext({ tenantId, roleKey: actorRoleKey ?? 'business_admin' });
  if (!canManageComplianceTraining(ctx)) {
    return { ok: false, error: 'Keine Berechtigung für Pflichtunterweisungen.' };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceTrainingItem[]>(tenantId, 'Pflichtunterweisungen');
  if (liveBlock) return liveBlock;

  const existing = listComplianceItemsForTenant(tenantId);
  if (existing.length > 0) {
    return { ok: true, data: existing };
  }

  const now = nowIso();
  const created: ComplianceTrainingItem[] = [];
  const areaGroups = new Map<
    ComplianceTrainingItem['areaKey'],
    ComplianceTrainingItem['assignedRoleGroups']
  >();

  for (const group of ['caregiver_employee', 'office', 'billing', 'qm', 'admin_owner'] as const) {
    for (const areaKey of getMandatoryAreasForRoleGroup(group)) {
      const groups = areaGroups.get(areaKey) ?? [];
      if (!groups.includes(group)) groups.push(group);
      areaGroups.set(areaKey, groups);
    }
  }

  for (const [areaKey, assignedRoleGroups] of areaGroups) {
    const item: ComplianceTrainingItem = {
      id: nextComplianceItemId(),
      tenantId,
      areaKey,
      title: buildDefaultTrainingTitle(areaKey),
      description: `Pflichtunterweisung — ${buildDefaultTrainingTitle(areaKey)}`,
      mandatory: true,
      requiresQuiz: areaKey === 'dsgvo_grundlagen',
      requiresSignature: true,
      validityMonths: DEFAULT_COMPLIANCE_VALIDITY_MONTHS,
      documentId: null,
      policyDocumentId: null,
      linkedCourseId: null,
      assignedRoleGroups,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    COMPLIANCE_TRAINING_STORE.items.push(item);
    created.push(item);
  }

  audit({
    tenantId,
    employeeId: null,
    trainingItemId: null,
    assignmentId: null,
    action: 'default_items_seeded',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    summary: `${created.length} Standard-Pflichtunterweisungen angelegt.`,
  });

  return { ok: true, data: created };
}

function canManageCompliance(actorRoleKey?: RoleKey | null): boolean {
  if (!enforcePermission(actorRoleKey, 'office.employees.compliance.manage')) return true;
  if (!enforcePermission(actorRoleKey, 'qm.manage_compliance')) return true;
  return false;
}

export async function createComplianceTrainingItem(
  input: CreateComplianceTrainingItemInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ComplianceTrainingItem>> {
  if (!canManageCompliance(actorRoleKey)) {
    return {
      ok: false,
      error: 'Keine Berechtigung für Pflichtunterweisungen.',
    };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceTrainingItem>(input.tenantId, 'Pflichtunterweisungen');
  if (liveBlock) return liveBlock;

  if (!input.tenantId?.trim()) {
    return { ok: false, error: 'Unterweisung ohne tenant_id nicht möglich.' };
  }

  const now = nowIso();
  const item: ComplianceTrainingItem = {
    id: nextComplianceItemId(),
    tenantId: input.tenantId,
    areaKey: input.areaKey,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    mandatory: input.mandatory ?? true,
    requiresQuiz: input.requiresQuiz ?? false,
    requiresSignature: input.requiresSignature ?? true,
    validityMonths: input.validityMonths ?? DEFAULT_COMPLIANCE_VALIDITY_MONTHS,
    documentId: input.documentId ?? null,
    policyDocumentId: input.policyDocumentId ?? null,
    linkedCourseId: input.linkedCourseId ?? null,
    assignedRoleGroups: input.assignedRoleGroups,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  COMPLIANCE_TRAINING_STORE.items.push(item);

  audit({
    tenantId: item.tenantId,
    employeeId: null,
    trainingItemId: item.id,
    assignmentId: null,
    action: 'training_item_created',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Unterweisung „${item.title}" angelegt.`,
    metadata: { areaKey: item.areaKey },
  });

  return { ok: true, data: item };
}

export async function assignComplianceTraining(
  input: AssignComplianceTrainingInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ComplianceTrainingAssignment>> {
  if (!canManageCompliance(actorRoleKey)) {
    return { ok: false, error: 'Keine Berechtigung für Zuweisung.' };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceTrainingAssignment>(
    input.tenantId,
    'Pflichtunterweisungen',
  );
  if (liveBlock) return liveBlock;

  const item = getComplianceItemById(input.tenantId, input.trainingItemId);
  if (!item || item.status !== 'active') {
    return { ok: false, error: 'Unterweisung nicht gefunden oder archiviert.' };
  }

  const existing = listComplianceAssignmentsForTenant(input.tenantId, input.employeeId).find(
    (row) => row.trainingItemId === input.trainingItemId && row.status !== 'archived',
  );
  if (existing) {
    return { ok: true, data: existing };
  }

  const now = nowIso();
  const assignment: ComplianceTrainingAssignment = {
    id: nextComplianceAssignmentId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    trainingItemId: input.trainingItemId,
    status: 'assigned',
    mandatory: input.mandatory ?? item.mandatory,
    assignedAt: now,
    dueAt: input.dueAt ?? null,
    expiresAt: null,
    viewedAt: null,
    acknowledgedAt: null,
    waivedAt: null,
    waivedBy: null,
    waiverReason: null,
    createdAt: now,
    updatedAt: now,
  };

  COMPLIANCE_TRAINING_STORE.assignments.push(assignment);

  audit({
    tenantId: assignment.tenantId,
    employeeId: assignment.employeeId,
    trainingItemId: assignment.trainingItemId,
    assignmentId: assignment.id,
    action: 'training_assigned',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Unterweisung „${item.title}" zugewiesen.`,
  });

  return { ok: true, data: assignment };
}

export async function assignMandatoryComplianceForEmployee(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<ComplianceTrainingAssignment[]>> {
  const group = mapRoleKeyToComplianceGroup(roleKey);
  if (!group) {
    return { ok: false, error: 'Rollengruppe für Pflichtunterweisungen nicht ermittelbar.' };
  }

  await seedDefaultComplianceItemsForTenant(tenantId, actorRoleKey);

  const mandatoryAreas = getMandatoryAreasForRoleGroup(group);
  const items = listComplianceItemsForTenant(tenantId).filter(
    (item) =>
      item.status === 'active' &&
      item.assignedRoleGroups.includes(group) &&
      mandatoryAreas.includes(item.areaKey),
  );

  const assignments: ComplianceTrainingAssignment[] = [];
  for (const item of items) {
    const result = await assignComplianceTraining(
      {
        tenantId,
        employeeId,
        trainingItemId: item.id,
        mandatory: true,
        actorProfileId,
      },
      actorRoleKey,
    );
    if (result.ok) assignments.push(result.data);
  }

  return { ok: true, data: assignments };
}

export async function markComplianceTrainingViewed(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<ComplianceTrainingAssignment>> {
  const portalDenied = canViewComplianceTrainingData(
    buildComplianceAccessContext({ tenantId, roleKey: actorRoleKey ?? null, employeeId }),
  );
  if (!portalDenied.allowed) {
    return { ok: false, error: portalDenied.reason ?? 'Keine Berechtigung.' };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceTrainingAssignment>(
    tenantId,
    'Pflichtunterweisungen',
  );
  if (liveBlock) return liveBlock;

  const assignment = getComplianceAssignmentById(tenantId, assignmentId);
  if (!assignment || assignment.employeeId !== employeeId) {
    return { ok: false, error: 'Zuweisung nicht gefunden.' };
  }

  const ctx = buildComplianceAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    employeeId,
  });
  if (!canAcknowledgeComplianceTraining(ctx, assignment)) {
    return { ok: false, error: 'Keine Berechtigung für diese Unterweisung.' };
  }

  const now = nowIso();
  assignment.viewedAt = now;
  assignment.status = 'viewed';
  assignment.updatedAt = now;

  const item = getComplianceItemById(tenantId, assignment.trainingItemId);
  if (item?.requiresQuiz) {
    assignment.status = 'quiz_required';
  }

  audit({
    tenantId,
    employeeId,
    trainingItemId: assignment.trainingItemId,
    assignmentId: assignment.id,
    action: 'training_viewed',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Unterweisungsinhalt als gelesen markiert.',
  });

  return { ok: true, data: assignment };
}

export async function acknowledgeComplianceTraining(
  input: AcknowledgeComplianceTrainingInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ComplianceTrainingAcknowledgement>> {
  const portalDenied = canViewComplianceTrainingData(
    buildComplianceAccessContext({
      tenantId: input.tenantId,
      roleKey: actorRoleKey ?? null,
      employeeId: input.employeeId,
    }),
  );
  if (!portalDenied.allowed) {
    return { ok: false, error: portalDenied.reason ?? 'Keine Berechtigung.' };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceTrainingAcknowledgement>(
    input.tenantId,
    'Pflichtunterweisungen',
  );
  if (liveBlock) return liveBlock;

  const assignment = getComplianceAssignmentById(input.tenantId, input.assignmentId);
  if (!assignment || assignment.employeeId !== input.employeeId) {
    return { ok: false, error: 'Zuweisung nicht gefunden.' };
  }

  const item = getComplianceItemById(input.tenantId, assignment.trainingItemId);
  if (!item) {
    return { ok: false, error: 'Unterweisung nicht gefunden.' };
  }

  const ctx = buildComplianceAccessContext({
    tenantId: input.tenantId,
    roleKey: actorRoleKey ?? null,
    employeeId: input.employeeId,
  });
  if (!canAcknowledgeComplianceTraining(ctx, assignment)) {
    return { ok: false, error: 'Keine Berechtigung für Bestätigung.' };
  }

  if (item.requiresSignature && !input.signatureName?.trim()) {
    return { ok: false, error: 'Digitale Bestätigung erfordert Namensangabe (Signatur).' };
  }

  if (!input.viewedDocument) {
    return { ok: false, error: 'Bestätigung ohne Nachweis des Lesens nicht möglich.' };
  }

  if (item.requiresQuiz) {
    const score = input.quizScore ?? null;
    if (score == null) {
      return { ok: false, error: 'Quiz-Nachweis erforderlich.' };
    }
    if (score < 80) {
      assignment.status = 'failed';
      assignment.updatedAt = nowIso();
      return { ok: false, error: 'Quiz nicht bestanden (Mindestpunktzahl 80 %).' };
    }
  }

  const now = nowIso();
  const acknowledgement: ComplianceTrainingAcknowledgement = {
    id: nextComplianceAcknowledgementId(),
    tenantId: input.tenantId,
    assignmentId: assignment.id,
    employeeId: input.employeeId,
    trainingItemId: assignment.trainingItemId,
    viewedDocument: input.viewedDocument,
    viewedAt: assignment.viewedAt ?? now,
    signatureName: input.signatureName.trim(),
    signatureCapturedAt: now,
    quizScore: input.quizScore ?? null,
    quizPassed: item.requiresQuiz ? (input.quizScore ?? 0) >= 80 : null,
    proofExportPath: null,
    createdAt: now,
    updatedAt: now,
  };

  COMPLIANCE_TRAINING_STORE.acknowledgements.push(acknowledgement);

  assignment.status = item.requiresQuiz ? 'passed' : 'acknowledged';
  assignment.acknowledgedAt = now;
  assignment.viewedAt = assignment.viewedAt ?? now;
  if (item.validityMonths) {
    assignment.expiresAt = addMonthsIso(now, item.validityMonths);
  }
  assignment.updatedAt = now;

  acknowledgement.proofExportPath = `compliance-proof/${input.tenantId}/${assignment.id}.json`;

  audit({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    trainingItemId: assignment.trainingItemId,
    assignmentId: assignment.id,
    action: 'training_acknowledged',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Unterweisung „${item.title}" bestätigt (Nachweis erstellt).`,
    metadata: { acknowledgementId: acknowledgement.id },
  });

  return { ok: true, data: acknowledgement };
}

export async function fetchEmployeeComplianceAssignments(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  viewerEmployeeId?: string | null,
): Promise<ServiceResult<ComplianceTrainingAssignment[]>> {
  const portalDenied = canViewComplianceTrainingData(
    buildComplianceAccessContext({
      tenantId,
      roleKey: actorRoleKey ?? null,
      employeeId: viewerEmployeeId ?? employeeId,
    }),
  );
  if (!portalDenied.allowed) {
    return { ok: false, error: portalDenied.reason ?? 'Keine Berechtigung.' };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceTrainingAssignment[]>(
    tenantId,
    'Pflichtunterweisungen',
  );
  if (liveBlock) return liveBlock;

  const ctx = buildComplianceAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    employeeId: viewerEmployeeId ?? employeeId,
  });

  if (!canViewEmployeeComplianceAssignments(ctx, employeeId)) {
    return { ok: false, error: 'Nur eigene Pflichtunterweisungen sichtbar.' };
  }

  const assignments = filterComplianceAssignmentsForViewer(
    ctx,
    listComplianceAssignmentsForTenant(tenantId, employeeId),
  );

  return { ok: true, data: assignments };
}

export async function fetchComplianceStatusForAdmin(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ComplianceEmployeeStatusRow[]>> {
  const canView =
    !enforcePermission(actorRoleKey, 'office.employees.compliance.view') ||
    !enforcePermission(actorRoleKey, 'office.employees.view');
  if (!canView) {
    return { ok: false, error: 'Keine Berechtigung für Unterweisungsstatus.' };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceEmployeeStatusRow[]>(
    tenantId,
    'Pflichtunterweisungen',
  );
  if (liveBlock) return liveBlock;

  const rows: ComplianceEmployeeStatusRow[] = [];
  const assignments = listComplianceAssignmentsForTenant(tenantId);

  for (const assignment of assignments) {
    const item = getComplianceItemById(tenantId, assignment.trainingItemId);
    if (!item) continue;
    const status = resolveEffectiveComplianceStatus(assignment, item);
    rows.push({
      employeeId: assignment.employeeId,
      assignmentId: assignment.id,
      trainingItemId: assignment.trainingItemId,
      areaKey: item.areaKey,
      title: item.title,
      status,
      mandatory: assignment.mandatory,
      dueAt: assignment.dueAt,
      expiresAt: assignment.expiresAt,
      blocking: isComplianceAssignmentBlocking(assignment, item),
    });
  }

  return { ok: true, data: rows };
}

export function exportComplianceProof(
  tenantId: string,
  assignmentId: string,
): ServiceResult<ComplianceProofExport> {
  const assignment = getComplianceAssignmentById(tenantId, assignmentId);
  if (!assignment) {
    return { ok: false, error: 'Zuweisung nicht gefunden.' };
  }

  const item = getComplianceItemById(tenantId, assignment.trainingItemId);
  if (!item) {
    return { ok: false, error: 'Unterweisung nicht gefunden.' };
  }

  const acknowledgement = COMPLIANCE_TRAINING_STORE.acknowledgements.find(
    (row) => row.tenantId === tenantId && row.assignmentId === assignmentId,
  );

  const status = resolveEffectiveComplianceStatus(assignment, item);

  return {
    ok: true,
    data: {
      employeeId: assignment.employeeId,
      employeeName: null,
      trainingItemId: item.id,
      trainingTitle: item.title,
      areaKey: item.areaKey,
      status,
      acknowledgedAt: assignment.acknowledgedAt,
      signatureName: acknowledgement?.signatureName ?? null,
      expiresAt: assignment.expiresAt,
      proofAvailable: Boolean(acknowledgement),
    },
  };
}

export async function renewComplianceTraining(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<ComplianceTrainingAssignment>> {
  if (!canManageCompliance(actorRoleKey)) {
    return { ok: false, error: 'Keine Berechtigung für Erneuerung.' };
  }

  const liveBlock = guardLiveDemoFeature<ComplianceTrainingAssignment>(
    tenantId,
    'Pflichtunterweisungen',
  );
  if (liveBlock) return liveBlock;

  const assignment = getComplianceAssignmentById(tenantId, assignmentId);
  if (!assignment) {
    return { ok: false, error: 'Zuweisung nicht gefunden.' };
  }

  const now = nowIso();
  assignment.status = 'assigned';
  assignment.viewedAt = null;
  assignment.acknowledgedAt = null;
  assignment.expiresAt = null;
  assignment.assignedAt = now;
  assignment.updatedAt = now;

  audit({
    tenantId,
    employeeId: assignment.employeeId,
    trainingItemId: assignment.trainingItemId,
    assignmentId: assignment.id,
    action: 'training_renewed',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Unterweisung zur Erneuerung zurückgesetzt.',
  });

  return { ok: true, data: assignment };
}

export function listComplianceAuditEvents(tenantId: string): ComplianceTrainingAuditEvent[] {
  return COMPLIANCE_TRAINING_STORE.auditEvents.filter((row) => row.tenantId === tenantId);
}

export { resetComplianceTrainingStore };
