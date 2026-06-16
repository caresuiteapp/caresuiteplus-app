import type { RoleKey, ServiceResult } from '@/types';
import type {
  ContractAuditEvent,
  ContractAuditEventType,
  ContractRecord,
  ContractTypeKey,
} from '@/types/documents/contract';
import { CONTRACT_TYPE_LABELS } from '@/types/documents/contract';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCorrection,
  createLifecycleDocument,
  finalizeLifecycleDocument,
} from './documentLifecycleService';
import {
  getContractTemplateVersionId,
  validateContractRecord,
  FINALIZE_CONTRACT_HTML_TEMPLATE,
} from './contractValidation';

type Store = {
  contracts: Map<string, ContractRecord>;
  auditEvents: ContractAuditEvent[];
  numberSeq: Map<string, number>;
};

const STORE: Store = {
  contracts: new Map(),
  auditEvents: [],
  numberSeq: new Map(),
};

let contractCounter = 0;
let auditCounter = 0;

function audit(input: {
  tenantId: string;
  contractId: string;
  eventType: ContractAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
}): ContractAuditEvent {
  auditCounter += 1;
  const event: ContractAuditEvent = {
    id: `ctr-audit-${auditCounter}`,
    tenantId: input.tenantId,
    contractId: input.contractId,
    eventType: input.eventType,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
  STORE.auditEvents.push(event);
  return event;
}

function updateContract(contract: ContractRecord): ContractRecord {
  const next = { ...contract, updatedAt: new Date().toISOString() };
  STORE.contracts.set(contract.id, next);
  return next;
}

function isLocked(contract: ContractRecord): boolean {
  return Boolean(contract.lockedAt) || contract.status === 'finalized';
}

function allocateContractNumber(tenantId: string): string {
  const n = (STORE.numberSeq.get(tenantId) ?? 0) + 1;
  STORE.numberSeq.set(tenantId, n);
  return `V-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

const DEMO_PARTY = {
  name: 'CareSuite Demo Pflegedienst GmbH',
  street: 'Musterstraße 1',
  zip: '10115',
  city: 'Berlin',
};

const DEMO_CLIENT = {
  name: 'Helga Schneider',
  street: 'Beispielweg 5',
  zip: '10115',
  city: 'Berlin',
  customerNumber: 'K-10042',
  careLevel: 'PG 2',
};

export function createContractDraft(input: {
  tenantId: string;
  contractType: ContractTypeKey;
}): ContractRecord {
  contractCounter += 1;
  const now = new Date().toISOString();
  const contract: ContractRecord = {
    id: `ctr-doc-${contractCounter}`,
    tenantId: input.tenantId,
    contractType: input.contractType,
    contractNumber: null,
    status: 'draft',
    contractDate: now.slice(0, 10),
    logoUrl: null,
    partyA: { ...DEMO_PARTY },
    partyB: { name: DEMO_CLIENT.name, street: DEMO_CLIENT.street, zip: DEMO_CLIENT.zip, city: DEMO_CLIENT.city },
    companyData: { ...DEMO_PARTY, legalName: DEMO_PARTY.name, taxId: '27/123/45678', ikNumber: '123456789' },
    clientData: { ...DEMO_CLIENT },
    legalRepresentative: null,
    serviceDescription: 'Ambulante Pflege nach vereinbarter Leistung',
    compensation: 'Monatspauschale',
    hourlyRate: '38,00',
    billingType: 'SGB XI',
    paymentTerms: '14 Tage netto',
    termStart: '2026-01-01',
    termEnd: '2026-12-31',
    noticePeriod: '4 Wochen zum Monatsende',
    privacySection: 'Verarbeitung personenbezogener Daten gemäß DSGVO.',
    confidentialityConsents: 'Schweigepflicht und Einwilligungen gemäß Vereinbarung.',
    liabilityClause: 'Haftung im gesetzlichen Rahmen.',
    finalProvisions: 'Gerichtsstand Berlin. Salvatorische Klausel.',
    placeAndDate: 'Berlin',
    signatures: {
      companySigned: false,
      clientSigned: false,
      legalRepSigned: false,
      employeeSigned: false,
      companySignedAt: null,
      clientSignedAt: null,
      legalRepSignedAt: null,
      employeeSignedAt: null,
    },
    lockedAt: null,
    correctedFromContractId: null,
    cancelledFromContractId: null,
    lifecycleDocumentId: null,
    previewConfirmed: false,
    contentHash: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  STORE.contracts.set(contract.id, contract);
  audit({
    tenantId: input.tenantId,
    contractId: contract.id,
    eventType: 'contract_created',
    summary: `${CONTRACT_TYPE_LABELS[input.contractType]}-Entwurf angelegt.`,
    metadata: { contractType: input.contractType },
  });
  return contract;
}

export function getContract(tenantId: string, contractId: string): ContractRecord | undefined {
  const c = STORE.contracts.get(contractId);
  if (!c || c.tenantId !== tenantId) return undefined;
  return c;
}

export function getContractAuditTrail(tenantId: string, contractId: string): ContractAuditEvent[] {
  return STORE.auditEvents.filter((e) => e.tenantId === tenantId && e.contractId === contractId);
}

export function validateContractForFinalization(
  tenantId: string,
  contractId: string,
): ServiceResult<{ contract: ContractRecord; validation: ReturnType<typeof validateContractRecord> }> {
  const contract = getContract(tenantId, contractId);
  if (!contract) return { ok: false, error: 'Vertrag nicht gefunden.' };

  const validation = validateContractRecord(contract);
  audit({
    tenantId,
    contractId,
    eventType: validation.status === 'error' ? 'contract_validation_failed' : 'contract_validated',
    summary: validation.status === 'error' ? 'Vertragsvalidierung fehlgeschlagen.' : 'Vertragsvalidierung bestanden.',
  });

  return { ok: true, data: { contract, validation } };
}

export async function confirmContractPreview(
  tenantId: string,
  contractId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ContractRecord>> {
  const denied = enforcePermission<ContractRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const contract = getContract(tenantId, contractId);
  if (!contract) return { ok: false, error: 'Vertrag nicht gefunden.' };
  if (isLocked(contract)) return { ok: false, error: 'Finalisierter Vertrag gesperrt.' };

  let lifecycleId = contract.lifecycleDocumentId;
  if (!lifecycleId) {
    const lifecycle = createLifecycleDocument({
      tenantId,
      title: `Vertrag Entwurf ${contractId}`,
      documentType: 'contract',
    });
    lifecycleId = lifecycle.id;
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  return {
    ok: true,
    data: updateContract({
      ...contract,
      lifecycleDocumentId: lifecycleId,
      previewConfirmed: true,
    }),
  };
}

export async function finalizeContract(
  tenantId: string,
  contractId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ContractRecord>> {
  const denied = enforcePermission<ContractRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const contract = getContract(tenantId, contractId);
  if (!contract) return { ok: false, error: 'Vertrag nicht gefunden.' };
  if (isLocked(contract)) return { ok: false, error: 'Vertrag bereits finalisiert.' };

  const contractNumber = contract.contractNumber ?? allocateContractNumber(tenantId);
  const withNumber = updateContract({ ...contract, contractNumber });

  const check = validateContractForFinalization(tenantId, contractId);
  if (!check.ok) return check;
  if (check.data.validation.status === 'error') {
    return { ok: false, error: check.data.validation.issues[0]?.message ?? 'Pflichtfeldprüfung fehlgeschlagen.' };
  }

  if (!withNumber.previewConfirmed) {
    return { ok: false, error: 'Live-Vorschau muss vor Finalisierung bestätigt werden.' };
  }

  const lifecycleId =
    withNumber.lifecycleDocumentId ??
    createLifecycleDocument({
      tenantId,
      title: `Vertrag ${withNumber.contractNumber}`,
      documentType: 'contract',
    }).id;

  if (!withNumber.lifecycleDocumentId) {
    updateContract({ ...withNumber, lifecycleDocumentId: lifecycleId });
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  const finalized = await finalizeLifecycleDocument(
    {
      tenantId,
      documentId: lifecycleId,
      templateVersionId: getContractTemplateVersionId(withNumber.contractType),
      htmlTemplate: FINALIZE_CONTRACT_HTML_TEMPLATE,
      documentType: 'contract',
      sampleEntityType: 'contract',
      sampleEntityId: 'contract-demo-1',
    },
    actorRoleKey,
  );

  if (!finalized.ok) {
    updateContract({ ...withNumber, status: 'render_failed' });
    return { ok: false, error: finalized.error };
  }

  const locked = updateContract({
    ...withNumber,
    status: 'finalized',
    lockedAt: new Date().toISOString(),
    lifecycleDocumentId: lifecycleId,
    contentHash: finalized.data.contentHash,
    version: withNumber.version + 1,
  });

  audit({
    tenantId,
    contractId,
    eventType: 'contract_number_assigned',
    summary: `Vertragsnummer ${locked.contractNumber} vergeben.`,
    metadata: { number: locked.contractNumber! },
  });
  audit({ tenantId, contractId, eventType: 'contract_finalized', summary: 'Vertrag finalisiert und archiviert.' });
  audit({ tenantId, contractId, eventType: 'contract_locked', summary: 'Vertrag gesperrt — direkte Änderung blockiert.' });

  return { ok: true, data: locked };
}

export async function attemptEditContract(
  tenantId: string,
  contractId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<never>> {
  const contract = getContract(tenantId, contractId);
  if (!contract) return { ok: false, error: 'Vertrag nicht gefunden.' };

  if (isLocked(contract)) {
    audit({
      tenantId,
      contractId,
      eventType: 'contract_edit_blocked',
      summary: 'Direkte Bearbeitung finalisierter Verträge blockiert.',
    });
    return { ok: false, error: 'Finalisierter Vertrag ist gesperrt — Korrektur erforderlich.' };
  }

  if (contract.lifecycleDocumentId) {
    return attemptDirectDocumentEdit(tenantId, contract.lifecycleDocumentId, actorRoleKey);
  }

  return { ok: false, error: 'Bearbeitung im Entwurf erlaubt.' };
}

export async function createContractCorrection(
  tenantId: string,
  sourceContractId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ContractRecord>> {
  const denied = enforcePermission<ContractRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const source = getContract(tenantId, sourceContractId);
  if (!source || !isLocked(source)) {
    return { ok: false, error: 'Korrektur nur für finalisierte Verträge.' };
  }

  const correction = createContractDraft({ tenantId, contractType: source.contractType });
  const updated = updateContract({
    ...correction,
    status: 'correction' as const,
    correctedFromContractId: sourceContractId,
    contractNumber: null,
  });

  if (source.lifecycleDocumentId) {
    await createDocumentCorrection(tenantId, source.lifecycleDocumentId, actorRoleKey);
  }

  audit({
    tenantId,
    contractId: updated.id,
    eventType: 'contract_correction_created',
    summary: `Korrekturvertrag für ${source.contractNumber ?? sourceContractId}.`,
    metadata: { correctedFrom: sourceContractId },
  });

  return { ok: true, data: updated };
}

/** Nur für Tests — Vertrag mutieren. */
export function patchContractForTest(contract: ContractRecord): ContractRecord {
  return updateContract(contract);
}

export function resetContractDocumentStore(): void {
  STORE.contracts.clear();
  STORE.auditEvents.length = 0;
  STORE.numberSeq.clear();
  contractCounter = 0;
  auditCounter = 0;
}

export { CONTRACT_TYPE_LABELS };
