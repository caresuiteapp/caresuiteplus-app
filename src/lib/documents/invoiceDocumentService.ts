import type { RoleKey, ServiceResult } from '@/types';
import type {
  ElectronicInvoiceData,
  InvoiceAuditEvent,
  InvoiceAuditEventType,
  InvoiceDocumentStatus,
  InvoiceRecord,
  InvoiceTaxMode,
} from '@/types/documents/invoice';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  buildElectronicInvoiceData,
  canExportElectronicInvoice,
  canGeneratePdfPlusXml,
  canGenerateXml,
  EINVOICE_ENGINE_INFO,
  exportElectronicInvoice,
  validateElectronicInvoiceData,
} from './eInvoiceService';
import {
  allocateInvoiceNumber,
  isInvoiceNumberUsed,
  reserveInvoiceNumber,
} from './invoiceNumberService';
import { calculateInvoiceTax } from './invoiceTaxLogic';
import { validateInvoiceRecord } from './invoiceValidation';
import {
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCancellation,
  createDocumentCorrection,
  createLifecycleDocument,
  finalizeLifecycleDocument,
  getLifecycleDocument,
} from './documentLifecycleService';

type Store = {
  invoices: Map<string, InvoiceRecord>;
  eInvoiceData: Map<string, ElectronicInvoiceData>;
  auditEvents: InvoiceAuditEvent[];
};

const STORE: Store = {
  invoices: new Map(),
  eInvoiceData: new Map(),
  auditEvents: [],
};

let invoiceCounter = 0;
let auditCounter = 0;

function audit(input: {
  tenantId: string;
  invoiceId: string;
  eventType: InvoiceAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
}): InvoiceAuditEvent {
  auditCounter += 1;
  const event: InvoiceAuditEvent = {
    id: `inv-audit-${auditCounter}`,
    tenantId: input.tenantId,
    invoiceId: input.invoiceId,
    eventType: input.eventType,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
  STORE.auditEvents.push(event);
  return event;
}

function updateInvoice(invoice: InvoiceRecord): InvoiceRecord {
  const next = { ...invoice, updatedAt: new Date().toISOString() };
  STORE.invoices.set(invoice.id, next);
  return next;
}

function isLocked(invoice: InvoiceRecord): boolean {
  return Boolean(invoice.lockedAt) || invoice.status === 'finalized';
}

const DEMO_LINE_ITEM = {
  id: 'li-1',
  description: 'Grundpflege',
  quantity: 1,
  unit: 'Pauschale',
  unitPriceNetCents: 32311,
  taxRatePercent: 0,
};

export function createInvoiceDraft(input: {
  tenantId: string;
  taxMode: InvoiceTaxMode;
  recipient?: Partial<InvoiceRecord['recipient']>;
}): InvoiceRecord {
  invoiceCounter += 1;
  const now = new Date().toISOString();
  const taxResult = calculateInvoiceTax({
    taxMode: input.taxMode,
    lineItems: [{ ...DEMO_LINE_ITEM }],
  });

  const invoice: InvoiceRecord = {
    id: `inv-doc-${invoiceCounter}`,
    tenantId: input.tenantId,
    invoiceNumber: null,
    status: 'draft',
    taxMode: input.taxMode,
    invoiceDate: now.slice(0, 10),
    servicePeriod: '01.06.–15.06.2026',
    dueDate: '2026-06-29',
    paymentReference: null,
    recipient: {
      fullName: input.recipient?.fullName ?? 'Helga Schneider',
      street: input.recipient?.street ?? 'Beispielweg 5',
      zip: input.recipient?.zip ?? '10115',
      city: input.recipient?.city ?? 'Berlin',
      customerNumber: input.recipient?.customerNumber ?? 'K-10042',
      careLevel: input.recipient?.careLevel ?? 'PG 2',
    },
    lineItems: taxResult.lineItems,
    netTotalCents: taxResult.netTotalCents,
    taxTotalCents: taxResult.taxTotalCents,
    grossTotalCents: taxResult.grossTotalCents,
    taxNotice: taxResult.taxNotice,
    costCarrierName: null,
    costCarrierIk: null,
    companyIk: '123456789',
    bankName: 'Sparkasse Berlin',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    lockedAt: null,
    correctedFromInvoiceId: null,
    cancelledFromInvoiceId: null,
    lifecycleDocumentId: null,
    previewConfirmed: false,
    createdAt: now,
    updatedAt: now,
  };

  STORE.invoices.set(invoice.id, invoice);
  audit({
    tenantId: input.tenantId,
    invoiceId: invoice.id,
    eventType: 'invoice_created',
    summary: `Rechnungsentwurf angelegt (${input.taxMode}).`,
  });
  return invoice;
}

export function getInvoice(tenantId: string, invoiceId: string): InvoiceRecord | undefined {
  const inv = STORE.invoices.get(invoiceId);
  if (!inv || inv.tenantId !== tenantId) return undefined;
  return inv;
}

export function getInvoiceAuditTrail(tenantId: string, invoiceId: string): InvoiceAuditEvent[] {
  return STORE.auditEvents.filter((e) => e.tenantId === tenantId && e.invoiceId === invoiceId);
}

export function getElectronicInvoiceData(tenantId: string, invoiceId: string): ElectronicInvoiceData | undefined {
  const inv = getInvoice(tenantId, invoiceId);
  if (!inv) return undefined;
  return STORE.eInvoiceData.get(invoiceId);
}

export function validateInvoiceForFinalization(
  tenantId: string,
  invoiceId: string,
): ServiceResult<{ invoice: InvoiceRecord; validation: ReturnType<typeof validateInvoiceRecord>; eInvoice: ElectronicInvoiceData }> {
  const invoice = getInvoice(tenantId, invoiceId);
  if (!invoice) return { ok: false, error: 'Rechnung nicht gefunden.' };

  const taxResult = calculateInvoiceTax({ taxMode: invoice.taxMode, lineItems: invoice.lineItems });
  const validation = validateInvoiceRecord(invoice, taxResult);
  const eInvoice = buildElectronicInvoiceData(invoice, taxResult);
  STORE.eInvoiceData.set(invoiceId, eInvoice);

  audit({
    tenantId,
    invoiceId,
    eventType: validation.status === 'error' ? 'invoice_validation_failed' : 'invoice_validated',
    summary: validation.status === 'error' ? 'Rechnungsvalidierung fehlgeschlagen.' : 'Rechnungsvalidierung bestanden.',
    metadata: { eInvoiceStatus: eInvoice.electronicInvoiceStatus },
  });

  return { ok: true, data: { invoice, validation, eInvoice } };
}

export async function confirmInvoicePreview(
  tenantId: string,
  invoiceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceRecord>> {
  const denied = enforcePermission<InvoiceRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const invoice = getInvoice(tenantId, invoiceId);
  if (!invoice) return { ok: false, error: 'Rechnung nicht gefunden.' };
  if (isLocked(invoice)) return { ok: false, error: 'Finalisierte Rechnung gesperrt.' };

  let lifecycleId = invoice.lifecycleDocumentId;
  if (!lifecycleId) {
    const lifecycle = createLifecycleDocument({
      tenantId,
      title: `Rechnung Entwurf ${invoiceId}`,
      documentType: 'invoice',
    });
    lifecycleId = lifecycle.id;
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  return {
    ok: true,
    data: updateInvoice({
      ...invoice,
      lifecycleDocumentId: lifecycleId,
      previewConfirmed: true,
    }),
  };
}

export async function finalizeInvoice(
  tenantId: string,
  invoiceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceRecord>> {
  const denied = enforcePermission<InvoiceRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const invoice = getInvoice(tenantId, invoiceId);
  if (!invoice) return { ok: false, error: 'Rechnung nicht gefunden.' };
  if (isLocked(invoice)) return { ok: false, error: 'Rechnung bereits finalisiert.' };

  let invoiceNumber: string;
  if (invoice.invoiceNumber) {
    const reserved = reserveInvoiceNumber(tenantId, invoice.invoiceNumber);
    if (!reserved.ok) return reserved;
    invoiceNumber = invoice.invoiceNumber;
  } else {
    const allocated = allocateInvoiceNumber(tenantId);
    if (!allocated.ok) return allocated;
    invoiceNumber = allocated.data;
  }

  const withNumber = updateInvoice({
    ...invoice,
    invoiceNumber,
    paymentReference: invoiceNumber,
  });

  const check = validateInvoiceForFinalization(tenantId, invoiceId);
  if (!check.ok) return check;
  if (check.data.validation.status === 'error') {
    updateInvoice({ ...withNumber, status: 'draft' });
    return { ok: false, error: check.data.validation.issues[0]?.message ?? 'Pflichtfeldprüfung fehlgeschlagen.' };
  }

  if (!withNumber.previewConfirmed) {
    return { ok: false, error: 'Live-Vorschau muss vor Finalisierung bestätigt werden.' };
  }

  const lifecycleId =
    withNumber.lifecycleDocumentId ??
    createLifecycleDocument({
      tenantId,
      title: `Rechnung ${withNumber.invoiceNumber}`,
      documentType: 'invoice',
    }).id;

  if (!withNumber.lifecycleDocumentId) {
    updateInvoice({ ...withNumber, lifecycleDocumentId: lifecycleId });
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  const VALID_HTML = `<h1>Rechnung ${withNumber.invoiceNumber}</h1>
<p>{{recipient.full_name}} — {{recipient.address}}</p>
<p>Zeitraum: {{invoice.service_period}}</p>
<p>Netto: {{invoice.net_total}} · Brutto: {{invoice.gross_total}} · Steuer: {{invoice.tax_total}}</p>
<p>Fällig: {{invoice.due_date}}</p>
<p>{{invoice.tax_notice}}</p>
<p>{{company.legal_name}} · {{company.iban}} · {{company.bank_name}} · {{company.tax_id}}</p>`;

  const finalized = await finalizeLifecycleDocument(
    {
      tenantId,
      documentId: lifecycleId,
      templateVersionId: 'dtplv-invoice',
      htmlTemplate: VALID_HTML,
      documentType: 'invoice',
      sampleEntityType: 'invoice',
      sampleEntityId: 'inv-demo-1',
    },
    actorRoleKey,
  );

  if (!finalized.ok) {
    updateInvoice({ ...withNumber, status: 'render_failed' });
    return { ok: false, error: finalized.error };
  }

  const locked = updateInvoice({
    ...withNumber,
    status: 'finalized',
    lockedAt: new Date().toISOString(),
    lifecycleDocumentId: lifecycleId,
  });

  audit({
    tenantId,
    invoiceId,
    eventType: 'invoice_number_assigned',
    summary: `Rechnungsnummer ${locked.invoiceNumber} vergeben.`,
    metadata: { number: locked.invoiceNumber! },
  });

  audit({
    tenantId,
    invoiceId,
    eventType: 'invoice_finalized',
    summary: 'Rechnung finalisiert und archiviert.',
  });

  audit({
    tenantId,
    invoiceId,
    eventType: 'invoice_locked',
    summary: 'Rechnung gesperrt — direkte Änderung blockiert.',
  });

  return { ok: true, data: locked };
}

export async function attemptEditInvoice(
  tenantId: string,
  invoiceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<never>> {
  const invoice = getInvoice(tenantId, invoiceId);
  if (!invoice) return { ok: false, error: 'Rechnung nicht gefunden.' };

  if (isLocked(invoice)) {
    audit({
      tenantId,
      invoiceId,
      eventType: 'invoice_edit_blocked',
      summary: 'Direkte Bearbeitung finalisierter Rechnung blockiert.',
    });
    return { ok: false, error: 'Finalisierte Rechnung ist gesperrt — Korrektur oder Storno erforderlich.' };
  }

  if (invoice.lifecycleDocumentId) {
    return attemptDirectDocumentEdit(tenantId, invoice.lifecycleDocumentId, actorRoleKey);
  }

  return { ok: false, error: 'Bearbeitung im Entwurf erlaubt.' };
}

export async function createInvoiceCorrection(
  tenantId: string,
  sourceInvoiceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceRecord>> {
  const denied = enforcePermission<InvoiceRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const source = getInvoice(tenantId, sourceInvoiceId);
  if (!source || !isLocked(source)) {
    return { ok: false, error: 'Korrektur nur für finalisierte Rechnungen.' };
  }

  const correction = createInvoiceDraft({
    tenantId,
    taxMode: source.taxMode,
    recipient: source.recipient,
  });

  const updated = updateInvoice({
    ...correction,
    status: 'correction',
    correctedFromInvoiceId: sourceInvoiceId,
    invoiceNumber: null,
  });

  if (source.lifecycleDocumentId) {
    await createDocumentCorrection(tenantId, source.lifecycleDocumentId, actorRoleKey);
  }

  audit({
    tenantId,
    invoiceId: updated.id,
    eventType: 'invoice_correction_created',
    summary: `Korrekturrechnung für ${source.invoiceNumber ?? sourceInvoiceId}.`,
    metadata: { correctedFrom: sourceInvoiceId },
  });

  return { ok: true, data: updated };
}

export async function createInvoiceCancellation(
  tenantId: string,
  sourceInvoiceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceRecord>> {
  const denied = enforcePermission<InvoiceRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const source = getInvoice(tenantId, sourceInvoiceId);
  if (!source || !isLocked(source)) {
    return { ok: false, error: 'Storno nur für finalisierte Rechnungen.' };
  }

  const cancellation = createInvoiceDraft({
    tenantId,
    taxMode: source.taxMode,
    recipient: source.recipient,
  });

  const stornoNumber = source.invoiceNumber ? `ST-${source.invoiceNumber}` : null;
  if (stornoNumber) reserveInvoiceNumber(tenantId, stornoNumber);

  const updated = updateInvoice({
    ...cancellation,
    status: 'cancellation',
    cancelledFromInvoiceId: sourceInvoiceId,
    invoiceNumber: stornoNumber,
    paymentReference: stornoNumber,
  });

  if (source.lifecycleDocumentId) {
    await createDocumentCancellation(tenantId, source.lifecycleDocumentId, actorRoleKey);
  }

  audit({
    tenantId,
    invoiceId: updated.id,
    eventType: 'invoice_cancellation_created',
    summary: `Stornorechnung für ${source.invoiceNumber ?? sourceInvoiceId}.`,
    metadata: { cancelledFrom: sourceInvoiceId },
  });

  return { ok: true, data: updated };
}

export function checkElectronicInvoice(
  tenantId: string,
  invoiceId: string,
): ServiceResult<ElectronicInvoiceData> {
  const invoice = getInvoice(tenantId, invoiceId);
  if (!invoice) return { ok: false, error: 'Rechnung nicht gefunden.' };

  const taxResult = calculateInvoiceTax({ taxMode: invoice.taxMode, lineItems: invoice.lineItems });
  const data = validateElectronicInvoiceData(buildElectronicInvoiceData(invoice, taxResult));
  STORE.eInvoiceData.set(invoiceId, data);

  audit({
    tenantId,
    invoiceId,
    eventType: 'einvoice_validated',
    summary: `E-Rechnungsstatus: ${data.electronicInvoiceStatus}`,
    metadata: { errors: String(data.validationErrors.length) },
  });

  return { ok: true, data };
}

export function getEInvoiceUiState(tenantId: string, invoiceId: string) {
  const data = STORE.eInvoiceData.get(invoiceId);

  return {
    engineInfo: EINVOICE_ENGINE_INFO,
    canCheck: true,
    canGenerateXml: data ? canGenerateXml(data) : false,
    canGeneratePdfPlusXml: data ? canGeneratePdfPlusXml(data) : false,
    status: data?.electronicInvoiceStatus ?? 'not_prepared',
    validationErrors: data?.validationErrors ?? [],
    isComplete: data ? data.electronicInvoiceStatus !== 'incomplete' : false,
  };
}

export function tryExportInvoiceXml(tenantId: string, invoiceId: string): ServiceResult<string> {
  const data = STORE.eInvoiceData.get(invoiceId);
  if (!data) return { ok: false, error: 'E-Rechnungsdaten zuerst prüfen.' };
  const result = exportElectronicInvoice(data, 'xml');
  if (!result.ok) return result;
  audit({
    tenantId,
    invoiceId,
    eventType: 'einvoice_export_prepared',
    summary: 'XML-Export vorbereitet.',
  });
  return { ok: true, data: result.path };
}

/** Nur für Tests — Rechnung mutieren. */
export function patchInvoiceForTest(invoice: InvoiceRecord): InvoiceRecord {
  return updateInvoice(invoice);
}

export function resetInvoiceDocumentStore(): void {
  STORE.invoices.clear();
  STORE.eInvoiceData.clear();
  STORE.auditEvents.length = 0;
  invoiceCounter = 0;
  auditCounter = 0;
}

export { isInvoiceNumberUsed, EINVOICE_ENGINE_INFO, canExportElectronicInvoice };
