import type { RoleKey, ServiceResult } from '@/types';
import type {
  ServiceProofAuditEvent,
  ServiceProofAuditEventType,
  ServiceProofDeployment,
  ServiceProofRecord,
  ServiceProofTypeKey,
} from '@/types/documents/serviceProof';
import { SERVICE_PROOF_TYPE_LABELS } from '@/types/documents/serviceProof';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { computeDocumentPackageHash } from './documentHashService';
import {
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCorrection,
  createLifecycleDocument,
  finalizeLifecycleDocument,
} from './documentLifecycleService';
import { getPdfEngineInfo } from './pdfRenderJobService';
import {
  computeDurationMinutes,
  getServiceProofTemplateVersionId,
  sumDeploymentHours,
  validateServiceProofForSignature,
  validateServiceProofRecord,
  FINALIZE_SERVICE_PROOF_HTML_TEMPLATE,
} from './serviceProofValidation';

type Store = {
  proofs: Map<string, ServiceProofRecord>;
  auditEvents: ServiceProofAuditEvent[];
  numberSeq: Map<string, number>;
};

const STORE: Store = {
  proofs: new Map(),
  auditEvents: [],
  numberSeq: new Map(),
};

let proofCounter = 0;
let deploymentCounter = 0;
let auditCounter = 0;

function audit(input: {
  tenantId: string;
  proofId: string;
  eventType: ServiceProofAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
}): ServiceProofAuditEvent {
  auditCounter += 1;
  const event: ServiceProofAuditEvent = {
    id: `sp-audit-${auditCounter}`,
    tenantId: input.tenantId,
    proofId: input.proofId,
    eventType: input.eventType,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
  STORE.auditEvents.push(event);
  return event;
}

function updateProof(proof: ServiceProofRecord): ServiceProofRecord {
  const next = { ...proof, updatedAt: new Date().toISOString() };
  STORE.proofs.set(proof.id, next);
  return next;
}

function isLocked(proof: ServiceProofRecord): boolean {
  return Boolean(proof.lockedAt) || proof.status === 'finalized' || proof.status === 'signed';
}

function allocateProofNumber(tenantId: string): string {
  const n = (STORE.numberSeq.get(tenantId) ?? 0) + 1;
  STORE.numberSeq.set(tenantId, n);
  return `LN-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

function createDeployment(input: Partial<ServiceProofDeployment>): ServiceProofDeployment {
  deploymentCounter += 1;
  const startTime = input.startTime ?? '09:00';
  const endTime = input.endTime ?? '10:30';
  return {
    id: `dep-${deploymentCounter}`,
    deploymentDate: input.deploymentDate ?? '2026-06-15',
    startTime,
    endTime,
    durationMinutes: input.durationMinutes ?? computeDurationMinutes(startTime, endTime),
    serviceType: input.serviceType ?? 'Grundpflege',
    tasks: input.tasks ?? 'Körperpflege',
    shortDescription: input.shortDescription ?? 'Einsatz durchgeführt',
    documentation: input.documentation ?? 'Leistung dokumentiert',
  };
}

export function createServiceProofDraft(input: {
  tenantId: string;
  proofType: ServiceProofTypeKey;
}): ServiceProofRecord {
  proofCounter += 1;
  const now = new Date().toISOString();
  const deployment = createDeployment({});

  const proof: ServiceProofRecord = {
    id: `sp-doc-${proofCounter}`,
    tenantId: input.tenantId,
    proofType: input.proofType,
    proofNumber: null,
    status: 'draft',
    logoUrl: null,
    companyName: 'CareSuite Demo Pflegedienst GmbH',
    serviceMonth: '2026-06',
    clientName: 'Helga Schneider',
    clientId: 'client-demo-1',
    careLevel: 'PG 2',
    costBearer: 'AOK Nordost',
    employeeName: 'Anna Pflege',
    deploymentDate: deployment.deploymentDate,
    startTime: deployment.startTime,
    endTime: deployment.endTime,
    durationMinutes: deployment.durationMinutes,
    serviceType: deployment.serviceType,
    tasks: deployment.tasks,
    shortDescription: deployment.shortDescription,
    documentation: deployment.documentation,
    deployments: input.proofType === 'monatsnachweis' ? [deployment] : [],
    totalHours: deployment.durationMinutes / 60,
    billingAmountCents: 5700,
    budgetAllocation: 'SGB XI — Entlastungsleistung',
    footerText: 'Leistungsnachweis — strukturell vorbereitet, kein produktiver PDF-Dienst.',
    signatures: {
      clientSigned: false,
      employeeSigned: false,
      clientSignedAt: null,
      employeeSignedAt: null,
    },
    lockedAt: null,
    contentHash: null,
    pdfPath: null,
    lifecycleDocumentId: null,
    previewConfirmed: false,
    version: 1,
    correctedFromProofId: null,
    createdAt: now,
    updatedAt: now,
  };

  if (input.proofType === 'monatsnachweis') {
    proof.totalHours = sumDeploymentHours(proof.deployments);
  }

  STORE.proofs.set(proof.id, proof);
  audit({
    tenantId: input.tenantId,
    proofId: proof.id,
    eventType: 'service_proof_created',
    summary: `${SERVICE_PROOF_TYPE_LABELS[input.proofType]}-Entwurf angelegt.`,
    metadata: { proofType: input.proofType },
  });
  return proof;
}

export function addServiceProofDeployment(
  tenantId: string,
  proofId: string,
  deployment: Partial<ServiceProofDeployment>,
): ServiceResult<ServiceProofRecord> {
  const proof = getServiceProof(tenantId, proofId);
  if (!proof) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  if (isLocked(proof)) return { ok: false, error: 'Gesperrter Leistungsnachweis.' };
  if (proof.proofType !== 'monatsnachweis') {
    return { ok: false, error: 'Einsätze nur für Monatsnachweis.' };
  }

  const dep = createDeployment(deployment);
  const deployments = [...proof.deployments, dep];
  const totalHours = sumDeploymentHours(deployments);

  return {
    ok: true,
    data: updateProof({ ...proof, deployments, totalHours }),
  };
}

export function recalculateMonthlyProofTotals(tenantId: string, proofId: string): ServiceResult<ServiceProofRecord> {
  const proof = getServiceProof(tenantId, proofId);
  if (!proof) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  if (proof.proofType !== 'monatsnachweis') {
    return { ok: false, error: 'Summierung nur für Monatsnachweis.' };
  }

  const deployments = proof.deployments.map((d) => ({
    ...d,
    durationMinutes: computeDurationMinutes(d.startTime, d.endTime),
  }));
  const totalHours = sumDeploymentHours(deployments);

  return { ok: true, data: updateProof({ ...proof, deployments, totalHours }) };
}

export function getServiceProof(tenantId: string, proofId: string): ServiceProofRecord | undefined {
  const p = STORE.proofs.get(proofId);
  if (!p || p.tenantId !== tenantId) return undefined;
  return p;
}

export function getServiceProofAuditTrail(tenantId: string, proofId: string): ServiceProofAuditEvent[] {
  return STORE.auditEvents.filter((e) => e.tenantId === tenantId && e.proofId === proofId);
}

export function validateServiceProofForFinalization(
  tenantId: string,
  proofId: string,
): ServiceResult<{ proof: ServiceProofRecord; validation: ReturnType<typeof validateServiceProofRecord> }> {
  const proof = getServiceProof(tenantId, proofId);
  if (!proof) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };

  const validation = validateServiceProofRecord(proof);
  audit({
    tenantId,
    proofId,
    eventType: validation.status === 'error' ? 'service_proof_validation_failed' : 'service_proof_validated',
    summary: validation.status === 'error' ? 'Validierung fehlgeschlagen.' : 'Validierung bestanden.',
  });

  return { ok: true, data: { proof, validation } };
}

export async function confirmServiceProofPreview(
  tenantId: string,
  proofId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ServiceProofRecord>> {
  const denied = enforcePermission<ServiceProofRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const proof = getServiceProof(tenantId, proofId);
  if (!proof) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  if (isLocked(proof)) return { ok: false, error: 'Gesperrter Leistungsnachweis.' };

  let lifecycleId = proof.lifecycleDocumentId;
  if (!lifecycleId) {
    const lifecycle = createLifecycleDocument({
      tenantId,
      title: `Leistungsnachweis Entwurf ${proofId}`,
      documentType: 'service_record',
    });
    lifecycleId = lifecycle.id;
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  return {
    ok: true,
    data: updateProof({ ...proof, lifecycleDocumentId: lifecycleId, previewConfirmed: true }),
  };
}

export async function signAndFinalizeServiceProof(
  tenantId: string,
  proofId: string,
  input: { clientSignature: boolean; employeeSignature?: boolean },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ServiceProofRecord>> {
  const denied = enforcePermission<ServiceProofRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const proof = getServiceProof(tenantId, proofId);
  if (!proof) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  if (isLocked(proof)) return { ok: false, error: 'Leistungsnachweis bereits gesperrt.' };

  const now = new Date().toISOString();
  const withSignatures = updateProof({
    ...proof,
    proofNumber: proof.proofNumber ?? allocateProofNumber(tenantId),
    signatures: {
      clientSigned: input.clientSignature,
      employeeSigned: input.employeeSignature ?? false,
      clientSignedAt: input.clientSignature ? now : null,
      employeeSignedAt: input.employeeSignature ? now : null,
    },
  });

  const validation = validateServiceProofForSignature(withSignatures);
  if (validation.status === 'error') {
    audit({
      tenantId,
      proofId,
      eventType: 'service_proof_validation_failed',
      summary: 'Finalisierung ohne Pflichtdaten blockiert.',
    });
    return { ok: false, error: validation.issues[0]?.message ?? 'Pflichtfeldprüfung fehlgeschlagen.' };
  }

  if (!withSignatures.previewConfirmed) {
    return { ok: false, error: 'Live-Vorschau muss vor Finalisierung bestätigt werden.' };
  }

  const lifecycleId =
    withSignatures.lifecycleDocumentId ??
    createLifecycleDocument({
      tenantId,
      title: `Leistungsnachweis ${withSignatures.proofNumber}`,
      documentType: 'service_record',
    }).id;

  if (!withSignatures.lifecycleDocumentId) {
    updateProof({ ...withSignatures, lifecycleDocumentId: lifecycleId });
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  const finalized = await finalizeLifecycleDocument(
    {
      tenantId,
      documentId: lifecycleId,
      templateVersionId: getServiceProofTemplateVersionId(withSignatures.proofType),
      htmlTemplate: FINALIZE_SERVICE_PROOF_HTML_TEMPLATE,
      documentType: 'service_record',
      sampleEntityType: 'service_record',
      sampleEntityId: 'service-record-demo-1',
    },
    actorRoleKey,
  );

  if (!finalized.ok) {
    updateProof({ ...withSignatures, status: 'render_failed' });
    return { ok: false, error: finalized.error };
  }

  const pdfInfo = getPdfEngineInfo();
  audit({
    tenantId,
    proofId,
    eventType: 'service_proof_pdf_prepared',
    summary: pdfInfo.productionAvailable
      ? 'PDF erzeugt.'
      : 'PDF-Render-Job vorbereitet (nicht produktiv).',
    metadata: { simulated: String(!pdfInfo.productionAvailable) },
  });

  const contentHash =
    finalized.data.contentHash ??
    computeDocumentPackageHash({
      html: finalized.data.htmlOutput ?? '',
      pdfPath: finalized.data.pdfPath ?? '',
      documentNumber: withSignatures.proofNumber!,
    });

  const locked = updateProof({
    ...withSignatures,
    status: 'finalized',
    lockedAt: now,
    contentHash,
    pdfPath: finalized.data.pdfPath,
    lifecycleDocumentId: lifecycleId,
    version: withSignatures.version + 1,
  });

  audit({ tenantId, proofId, eventType: 'service_proof_signed', summary: 'Klientenunterschrift erfasst.' });
  audit({ tenantId, proofId, eventType: 'service_proof_finalized', summary: 'Leistungsnachweis finalisiert und archiviert.' });
  audit({ tenantId, proofId, eventType: 'service_proof_locked', summary: 'Leistungsnachweis gesperrt — direkte Änderung blockiert.' });

  return { ok: true, data: locked };
}

export async function attemptEditServiceProof(
  tenantId: string,
  proofId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<never>> {
  const proof = getServiceProof(tenantId, proofId);
  if (!proof) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };

  if (isLocked(proof)) {
    audit({
      tenantId,
      proofId,
      eventType: 'service_proof_edit_blocked',
      summary: 'Direkte Bearbeitung gesperrter Leistungsnachweise blockiert.',
    });
    return { ok: false, error: 'Gesperrter Leistungsnachweis — Korrektur erforderlich.' };
  }

  if (proof.lifecycleDocumentId) {
    return attemptDirectDocumentEdit(tenantId, proof.lifecycleDocumentId, actorRoleKey);
  }

  return { ok: false, error: 'Bearbeitung im Entwurf erlaubt.' };
}

export async function createServiceProofCorrection(
  tenantId: string,
  sourceProofId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ServiceProofRecord>> {
  const denied = enforcePermission<ServiceProofRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const source = getServiceProof(tenantId, sourceProofId);
  if (!source || !isLocked(source)) {
    return { ok: false, error: 'Korrektur nur für finalisierte Leistungsnachweise.' };
  }

  const correction = createServiceProofDraft({ tenantId, proofType: source.proofType });
  const updated = updateProof({
    ...correction,
    correctedFromProofId: sourceProofId,
    proofNumber: null,
  });

  if (source.lifecycleDocumentId) {
    await createDocumentCorrection(tenantId, source.lifecycleDocumentId, actorRoleKey);
  }

  audit({
    tenantId,
    proofId: updated.id,
    eventType: 'service_proof_correction_created',
    summary: `Korrektur für ${source.proofNumber ?? sourceProofId}.`,
    metadata: { correctedFrom: sourceProofId },
  });

  return { ok: true, data: updated };
}

export function getServiceProofPdfState() {
  const info = getPdfEngineInfo();
  return {
    engineInfo: info,
    isPdfProductionAvailable: info.productionAvailable,
    disclaimer: 'PDF-Erzeugung vorbereitet — kein produktiver Render-Dienst.',
  };
}

/** Nur für Tests — Leistungsnachweis mutieren. */
export function patchServiceProofForTest(proof: ServiceProofRecord): ServiceProofRecord {
  return updateProof(proof);
}

export function resetServiceProofDocumentStore(): void {
  STORE.proofs.clear();
  STORE.auditEvents.length = 0;
  STORE.numberSeq.clear();
  proofCounter = 0;
  deploymentCounter = 0;
  auditCounter = 0;
}

export { SERVICE_PROOF_TYPE_LABELS };
