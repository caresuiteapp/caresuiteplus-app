import type { RoleKey, ServiceResult } from '@/types';
import type {
  CreateEmployeeHrCaseInput,
  EmployeeHrAuditEvent,
  EmployeeHrAuditEventType,
  EmployeeHrCase,
  EmployeeHrCaseAreaKey,
  EmployeeHrCaseEvent,
  EmployeePortalHrDocumentView,
} from '@/types/modules/employeeHr';
import {
  EMPLOYEE_HR_AREA_LABELS,
  HR_CONVERSATION_AREAS,
} from '@/types/modules/employeeHr';
import type { TemplateValidationResult } from '@/features/documents/templateEngine/types';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCorrection,
  createLifecycleDocument,
  finalizeLifecycleDocument,
} from '@/lib/documents/documentLifecycleService';
import { SYSTEM_TEMPLATE_LEGAL_DISCLAIMER } from '@/lib/documents/systemTemplateLegal';
import {
  getHrCaseById,
  HR_STORE,
  listHrCasesForTenant,
  nextHrAuditId,
  nextHrCaseEventId,
  nextHrCaseId,
  resetEmployeeHrStore,
} from './employeeHrStore';
import {
  defaultConversationPayload,
  defaultReferencePayload,
  defaultReturnProtocolPayload,
  defaultTerminationPayload,
  defaultWarningPayload,
  getHrTemplateVersionId,
  hrCaseToPreviewHtml,
  validateHrCaseRecord,
} from './employeeHrValidation';

const DEMO_EMPLOYEE_NAMES: Record<string, string> = {
  'employee-001': 'Anna Weber',
  'employee-002': 'Thomas Klein',
  'employee-003': 'Sandra Meier',
};

function nowIso(): string {
  return new Date().toISOString();
}

function isLocked(hrCase: EmployeeHrCase): boolean {
  return Boolean(hrCase.lockedAt) || hrCase.status === 'finalized' || hrCase.status === 'archived';
}

function allocateCaseNumber(tenantId: string): string {
  const n = (HR_STORE.numberSeq.get(tenantId) ?? 0) + 1;
  HR_STORE.numberSeq.set(tenantId, n);
  return `PV-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

function updateCase(hrCase: EmployeeHrCase): EmployeeHrCase {
  const next = { ...hrCase, updatedAt: nowIso() };
  const idx = HR_STORE.cases.findIndex((c) => c.id === hrCase.id);
  if (idx >= 0) HR_STORE.cases[idx] = next;
  else HR_STORE.cases.push(next);
  return next;
}

function audit(input: {
  tenantId: string;
  caseId: string;
  eventType: EmployeeHrAuditEventType;
  summary: string;
  actorId?: string | null;
  actorRole?: RoleKey | null;
  metadata?: Record<string, string>;
}): EmployeeHrAuditEvent {
  const event: EmployeeHrAuditEvent = {
    id: nextHrAuditId(),
    tenantId: input.tenantId,
    caseId: input.caseId,
    eventType: input.eventType,
    summary: input.summary,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    metadata: input.metadata,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  HR_STORE.auditEvents.push(event);
  return event;
}

function recordCaseEvent(input: {
  tenantId: string;
  caseId: string;
  eventType: string;
  summary: string;
  actorId?: string | null;
  actorRole?: RoleKey | null;
  oldStatus?: EmployeeHrCase['status'] | null;
  newStatus?: EmployeeHrCase['status'] | null;
  metadata?: Record<string, string>;
}): EmployeeHrCaseEvent {
  const event: EmployeeHrCaseEvent = {
    id: nextHrCaseEventId(),
    tenantId: input.tenantId,
    caseId: input.caseId,
    eventType: input.eventType,
    summary: input.summary,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus ?? null,
    metadata: input.metadata,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  HR_STORE.caseEvents.push(event);
  return event;
}

function buildPayloads(input: CreateEmployeeHrCaseInput): Pick<
  EmployeeHrCase,
  'conversation' | 'warning' | 'termination' | 'reference' | 'returnProtocol'
> {
  const { areaKey } = input;

  if (HR_CONVERSATION_AREAS.includes(areaKey)) {
    return {
      conversation: defaultConversationPayload(areaKey, input.conversation),
      warning: null,
      termination: null,
      reference: null,
      returnProtocol: null,
    };
  }

  if (areaKey === 'abmahnung' || areaKey === 'ermahnung') {
    return {
      conversation: null,
      warning: defaultWarningPayload(areaKey, input.warning),
      termination: null,
      reference: null,
      returnProtocol: null,
    };
  }

  if (areaKey === 'kuendigung' || areaKey === 'aufhebungsvereinbarung') {
    return {
      conversation: null,
      warning: null,
      termination: defaultTerminationPayload(areaKey, input.termination),
      reference: null,
      returnProtocol: null,
    };
  }

  if (areaKey === 'arbeitszeugnis') {
    return {
      conversation: null,
      warning: null,
      termination: null,
      reference: defaultReferencePayload(input.reference),
      returnProtocol: null,
    };
  }

  if (areaKey === 'rueckgabe_uebergabeprotokoll') {
    return {
      conversation: null,
      warning: null,
      termination: null,
      reference: null,
      returnProtocol: defaultReturnProtocolPayload(input.returnProtocol),
    };
  }

  return {
    conversation: null,
    warning: null,
    termination: null,
    reference: null,
    returnProtocol: null,
  };
}

function resolveEmployeeName(employeeId: string): string {
  return DEMO_EMPLOYEE_NAMES[employeeId] ?? `Mitarbeitende:r ${employeeId}`;
}

function buildFinalizeHtml(hrCase: EmployeeHrCase): string {
  const content = hrCaseToPreviewHtml(hrCase, resolveEmployeeName(hrCase.employeeId));
  return `<!DOCTYPE html><html><body>${content}<p><em>${SYSTEM_TEMPLATE_LEGAL_DISCLAIMER}</em></p></body></html>`;
}

export function createHrCase(
  input: CreateEmployeeHrCaseInput,
  actorRoleKey?: RoleKey | null,
): ServiceResult<EmployeeHrCase> {
  const denied = enforcePermission<EmployeeHrCase>(actorRoleKey, 'office.employees.hr.manage');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeeHrCase>(input.tenantId, 'Personalvorgänge');
  if (liveBlock) return liveBlock;

  if (input.areaKey === 'dokumentenarchiv_personal') {
    return { ok: false, error: 'Archivbereich ist keine anlegbare Vorgangsart.' };
  }

  const now = nowIso();
  const payloads = buildPayloads(input);
  const hrCase: EmployeeHrCase = {
    id: nextHrCaseId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    areaKey: input.areaKey,
    status: 'draft',
    caseNumber: null,
    title: input.title?.trim() || EMPLOYEE_HR_AREA_LABELS[input.areaKey],
    templateId: input.templateId ?? getHrTemplateVersionId(input.areaKey),
    lifecycleDocumentId: null,
    previewConfirmed: false,
    lockedAt: null,
    contentHash: null,
    version: 1,
    correctedFromCaseId: null,
    releasedToPortal: false,
    releasedToPortalAt: null,
    ...payloads,
    createdAt: now,
    updatedAt: now,
  };

  HR_STORE.cases.push(hrCase);

  audit({
    tenantId: input.tenantId,
    caseId: hrCase.id,
    eventType: 'hr_case_created',
    summary: `${hrCase.title} angelegt.`,
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    metadata: { areaKey: input.areaKey },
  });

  recordCaseEvent({
    tenantId: input.tenantId,
    caseId: hrCase.id,
    eventType: 'created',
    summary: 'Personalvorgang angelegt.',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    newStatus: 'draft',
  });

  return { ok: true, data: hrCase };
}

export function getHrCase(tenantId: string, caseId: string): EmployeeHrCase | undefined {
  return getHrCaseById(tenantId, caseId);
}

export function listHrCases(
  tenantId: string,
  filter?: { employeeId?: string; areaKey?: EmployeeHrCaseAreaKey },
  actorRoleKey?: RoleKey | null,
): ServiceResult<EmployeeHrCase[]> {
  const denied = enforcePermission<EmployeeHrCase[]>(actorRoleKey, 'office.employees.hr.view');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeeHrCase[]>(tenantId, 'Personalvorgänge');
  if (liveBlock) return liveBlock;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const items = listHrCasesForTenant(tenantId, filter).filter(
    (c) => c.areaKey !== 'dokumentenarchiv_personal',
  );
  return { ok: true, data: items };
}

export function listHrArchiveDocuments(
  tenantId: string,
  employeeId?: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<EmployeeHrCase[]> {
  const denied = enforcePermission<EmployeeHrCase[]>(actorRoleKey, 'office.employees.hr.view');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeeHrCase[]>(tenantId, 'Personalvorgänge');
  if (liveBlock) return liveBlock;

  const items = listHrCasesForTenant(tenantId, { employeeId }).filter((c) =>
    ['finalized', 'delivered', 'acknowledged', 'archived'].includes(c.status),
  );
  return { ok: true, data: items };
}

export function validateHrCaseForFinalization(
  tenantId: string,
  caseId: string,
): ServiceResult<{ hrCase: EmployeeHrCase; validation: TemplateValidationResult }> {
  const hrCase = getHrCaseById(tenantId, caseId);
  if (!hrCase) return { ok: false, error: 'Personalvorgang nicht gefunden.' };

  const validation = validateHrCaseRecord(hrCase);
  audit({
    tenantId,
    caseId,
    eventType: validation.status === 'error' ? 'hr_case_validation_failed' : 'hr_case_validated',
    summary: validation.status === 'error' ? 'Validierung fehlgeschlagen.' : 'Validierung bestanden.',
  });

  return { ok: true, data: { hrCase, validation } };
}

export async function confirmHrCasePreview(
  tenantId: string,
  caseId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeHrCase>> {
  const denied = enforcePermission<EmployeeHrCase>(actorRoleKey, 'office.employees.hr.manage');
  if (denied) return denied;

  const hrCase = getHrCaseById(tenantId, caseId);
  if (!hrCase) return { ok: false, error: 'Personalvorgang nicht gefunden.' };
  if (isLocked(hrCase)) return { ok: false, error: 'Finalisierter Vorgang ist gesperrt.' };

  let lifecycleId = hrCase.lifecycleDocumentId;
  if (!lifecycleId) {
    const lifecycle = createLifecycleDocument({
      tenantId,
      title: `${hrCase.title} Entwurf`,
      documentType: 'generic',
    });
    lifecycleId = lifecycle.id;
  }

  const confirmResult = await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);
  if (!confirmResult.ok) {
    return { ok: false, error: confirmResult.error };
  }

  const updated = updateCase({
    ...hrCase,
    lifecycleDocumentId: lifecycleId,
    previewConfirmed: true,
    status: hrCase.status === 'draft' ? 'in_review' : hrCase.status,
  });

  audit({
    tenantId,
    caseId,
    eventType: 'hr_case_preview_confirmed',
    summary: 'Live-Vorschau bestätigt.',
    actorRole: actorRoleKey ?? null,
  });

  return { ok: true, data: updated };
}

export async function finalizeHrCase(
  tenantId: string,
  caseId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeHrCase>> {
  const denied = enforcePermission<EmployeeHrCase>(actorRoleKey, 'office.employees.hr.finalize');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = guardLiveDemoFeature<EmployeeHrCase>(tenantId, 'Personalvorgänge');
  if (liveBlock) return liveBlock;

  const hrCase = getHrCaseById(tenantId, caseId);
  if (!hrCase) return { ok: false, error: 'Personalvorgang nicht gefunden.' };
  if (isLocked(hrCase)) return { ok: false, error: 'Personalvorgang bereits finalisiert.' };

  const caseNumber = hrCase.caseNumber ?? allocateCaseNumber(tenantId);
  const withNumber = updateCase({ ...hrCase, caseNumber });

  const check = validateHrCaseForFinalization(tenantId, caseId);
  if (!check.ok) return check;
  if (check.data.validation.status === 'error') {
    return {
      ok: false,
      error: check.data.validation.issues[0]?.message ?? 'Pflichtfeldprüfung fehlgeschlagen.',
    };
  }

  if (!withNumber.previewConfirmed) {
    return { ok: false, error: 'Live-Vorschau muss vor Finalisierung bestätigt werden.' };
  }

  const lifecycleId =
    withNumber.lifecycleDocumentId ??
    createLifecycleDocument({
      tenantId,
      title: `${withNumber.title} ${withNumber.caseNumber}`,
      documentType: 'generic',
    }).id;

  if (!withNumber.lifecycleDocumentId) {
    updateCase({ ...withNumber, lifecycleDocumentId: lifecycleId });
  }

  const confirmResult = await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);
  if (!confirmResult.ok) {
    return { ok: false, error: confirmResult.error };
  }

  const htmlTemplate = buildFinalizeHtml(withNumber);
  const finalized = await finalizeLifecycleDocument(
    {
      tenantId,
      documentId: lifecycleId,
      templateVersionId: withNumber.templateId ?? getHrTemplateVersionId(withNumber.areaKey),
      htmlTemplate,
      documentType: 'generic',
      sampleEntityType: 'contract',
      sampleEntityId: 'contract-demo-1',
    },
    actorRoleKey,
  );

  if (!finalized.ok) {
    updateCase({ ...withNumber, status: 'in_review' });
    return { ok: false, error: finalized.error };
  }

  const now = nowIso();
  const locked = updateCase({
    ...withNumber,
    status: 'finalized',
    lockedAt: now,
    lifecycleDocumentId: lifecycleId,
    contentHash: finalized.data.contentHash,
    version: withNumber.version + 1,
  });

  audit({
    tenantId,
    caseId,
    eventType: 'hr_case_finalized',
    summary: `Personalvorgang ${locked.caseNumber} finalisiert.`,
    actorRole: actorRoleKey ?? null,
    metadata: { caseNumber: locked.caseNumber ?? '' },
  });
  audit({
    tenantId,
    caseId,
    eventType: 'hr_case_locked',
    summary: 'Personalvorgang gesperrt — direkte Änderung blockiert.',
    actorRole: actorRoleKey ?? null,
  });

  recordCaseEvent({
    tenantId,
    caseId,
    eventType: 'finalized',
    summary: 'Personalvorgang finalisiert.',
    oldStatus: withNumber.status,
    newStatus: 'finalized',
  });

  return { ok: true, data: locked };
}

export async function attemptEditHrCase(
  tenantId: string,
  caseId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<never>> {
  const hrCase = getHrCaseById(tenantId, caseId);
  if (!hrCase) return { ok: false, error: 'Personalvorgang nicht gefunden.' };

  if (isLocked(hrCase)) {
    audit({
      tenantId,
      caseId,
      eventType: 'hr_case_edit_blocked',
      summary: 'Direkte Bearbeitung finalisierter Personalvorgänge blockiert.',
      actorRole: actorRoleKey ?? null,
    });
    return { ok: false, error: 'Finalisierter Personalvorgang ist gesperrt — Korrektur erforderlich.' };
  }

  if (hrCase.lifecycleDocumentId) {
    return attemptDirectDocumentEdit(tenantId, hrCase.lifecycleDocumentId, actorRoleKey);
  }

  return { ok: false, error: 'Bearbeitung im Entwurf erlaubt.' };
}

export async function createHrCaseCorrection(
  tenantId: string,
  sourceCaseId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeHrCase>> {
  const denied = enforcePermission<EmployeeHrCase>(actorRoleKey, 'office.employees.hr.manage');
  if (denied) return denied;

  const source = getHrCaseById(tenantId, sourceCaseId);
  if (!source || !isLocked(source)) {
    return { ok: false, error: 'Korrektur nur für finalisierte Personalvorgänge.' };
  }

  const created = createHrCase(
    {
      tenantId,
      employeeId: source.employeeId,
      areaKey: source.areaKey,
      title: `${source.title} (Korrektur)`,
      templateId: source.templateId,
      conversation: source.conversation ?? undefined,
      warning: source.warning ?? undefined,
      termination: source.termination ?? undefined,
      reference: source.reference ?? undefined,
      returnProtocol: source.returnProtocol ?? undefined,
    },
    actorRoleKey,
  );

  if (!created.ok) return created;

  const correction = updateCase({
    ...created.data,
    status: 'corrected',
    correctedFromCaseId: sourceCaseId,
    caseNumber: null,
    previewConfirmed: false,
    lifecycleDocumentId: null,
    lockedAt: null,
    contentHash: null,
  });

  if (source.lifecycleDocumentId) {
    await createDocumentCorrection(tenantId, source.lifecycleDocumentId, actorRoleKey);
  }

  audit({
    tenantId,
    caseId: correction.id,
    eventType: 'hr_case_correction_created',
    summary: `Korrektur für ${source.caseNumber ?? sourceCaseId}.`,
    actorRole: actorRoleKey ?? null,
    metadata: { correctedFrom: sourceCaseId },
  });

  return { ok: true, data: correction };
}

export function releaseHrCaseToEmployeePortal(
  tenantId: string,
  caseId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<EmployeeHrCase> {
  const denied = enforcePermission<EmployeeHrCase>(actorRoleKey, 'office.employees.hr.finalize');
  if (denied) return denied;

  const hrCase = getHrCaseById(tenantId, caseId);
  if (!hrCase) return { ok: false, error: 'Personalvorgang nicht gefunden.' };
  if (!isLocked(hrCase)) {
    return { ok: false, error: 'Nur finalisierte Vorgänge können freigegeben werden.' };
  }

  const released = updateCase({
    ...hrCase,
    releasedToPortal: true,
    releasedToPortalAt: nowIso(),
    status: hrCase.status === 'finalized' ? 'delivered' : hrCase.status,
  });

  audit({
    tenantId,
    caseId,
    eventType: 'hr_case_released_to_portal',
    summary: 'Dokument für Mitarbeiterportal freigegeben.',
    actorRole: actorRoleKey ?? null,
  });

  return { ok: true, data: released };
}

export function listEmployeePortalHrDocuments(
  tenantId: string,
  viewerEmployeeId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<EmployeePortalHrDocumentView[]> {
  const denied = enforcePermission<EmployeePortalHrDocumentView[]>(actorRoleKey, 'portal.employee.hr.view');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeePortalHrDocumentView[]>(tenantId, 'Personalvorgänge');
  if (liveBlock) return liveBlock;

  const items = listHrCasesForTenant(tenantId, { employeeId: viewerEmployeeId }).filter(
    (c) =>
      c.releasedToPortal &&
      c.employeeId === viewerEmployeeId &&
      ['finalized', 'delivered', 'acknowledged', 'archived'].includes(c.status),
  );

  return {
    ok: true,
    data: items.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      employeeId: c.employeeId,
      areaKey: c.areaKey,
      status: c.status,
      caseNumber: c.caseNumber,
      title: c.title,
      version: c.version,
      releasedToPortalAt: c.releasedToPortalAt,
      lifecycleDocumentId: c.lifecycleDocumentId,
    })),
  };
}

export function blockHrDataForClientPortal(): EmployeePortalHrDocumentView[] {
  return [];
}

export function getHrAuditTrail(tenantId: string, caseId: string): EmployeeHrAuditEvent[] {
  return HR_STORE.auditEvents.filter((e) => e.tenantId === tenantId && e.caseId === caseId);
}

export function getHrCaseEvents(tenantId: string, caseId: string): EmployeeHrCaseEvent[] {
  return HR_STORE.caseEvents.filter((e) => e.tenantId === tenantId && e.caseId === caseId);
}

/** Nur für Tests — Personalvorgang mutieren. */
export function patchHrCaseForTest(hrCase: EmployeeHrCase): EmployeeHrCase {
  return updateCase(hrCase);
}

export { resetEmployeeHrStore };
