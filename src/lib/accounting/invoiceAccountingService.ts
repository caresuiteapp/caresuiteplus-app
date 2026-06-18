import type { RoleKey, ServiceResult } from '@/types';
import type {
  AccountingExportFormat,
  AccountingExportRecord,
  AccountingProviderKey,
  GobdAuditEvent,
  InvoiceAccountingSnapshot,
  InvoiceAccountingStatusKey,
} from '@/types/accounting';
import {
  appendDemoAccountingExport,
  appendDemoGobdEvent,
  getDemoAccountingExportErrors,
  getDemoAccountingExportsForInvoice,
  getDemoGobdEvents,
  getDemoInvoiceAccountingStatus,
  setDemoInvoiceAccountingStatus,
} from '@/data/demo/accounting';
import {
  buildConnectExecutionContext,
  executeConnectAction,
  assertConnectFeatureAllowed,
  buildConnectFeatureGateContextFromFeatureKey,
} from '@/lib/connect/gateway';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isAccountingProviderConfigured } from './accountingProviderConfigService';
import {
  assertInvoiceEditable,
  buildGobdAuditEvent,
  canApplyCorrection,
  canDirectlyEditInvoice,
  isInvoiceGobdArchived,
  mapCorrectionToAccountingStatus,
} from './gobdGuard';
import { resolveExportFormat } from './connect/accountingFormat';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import type { GobdCorrectionType } from './gobdGuard';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Migration 0046 prepared — Demo-Store bis Live-Repository angebunden ist. */
const ACCOUNTING_LIVE_REPOSITORY = false;

function useAccountingDemoStore(): boolean {
  return !ACCOUNTING_LIVE_REPOSITORY;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveAccountingFeatureKey(providerKey: AccountingProviderKey): 'accounting.datev' | null {
  if (providerKey === 'datev') return 'accounting.datev';
  return null;
}

function recordAccountingExportFailure(input: {
  invoiceId: string;
  tenantId: string;
  providerKey: AccountingProviderKey;
  message: string;
  configured: boolean;
  eventType: 'export_blocked' | 'export_failed';
}): void {
  if (!useAccountingDemoStore()) return;

  const exportRecord: AccountingExportRecord = {
    id: newId('exp'),
    tenantId: input.tenantId,
    providerKey: input.providerKey,
    exportType: 'invoice',
    exportFormat: resolveExportFormat(input.providerKey),
    status: input.configured ? 'blocked' : 'failed',
    externalTransfer: false,
    itemCount: 1,
    errorSummary: input.message,
    packageLabel: null,
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };

  appendDemoAccountingExport(exportRecord);
  setDemoInvoiceAccountingStatus(input.invoiceId, {
    accountingStatus: 'export_fehler',
    providerKey: input.providerKey,
    lastExportId: exportRecord.id,
  });
  appendDemoGobdEvent(
    input.invoiceId,
    buildGobdAuditEvent({
      id: newId('gobd'),
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      eventType: input.eventType,
      summary: input.message,
    }),
  );
}

export async function fetchInvoiceAccountingSnapshot(
  invoiceId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<InvoiceAccountingSnapshot>> {
  const denied = enforcePermission<InvoiceAccountingSnapshot>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = guardLiveDemoFeature<InvoiceAccountingSnapshot>(tenantId, 'Buchhaltungsstatus');
  if (liveBlock && !useAccountingDemoStore()) return liveBlock;

  if (!useAccountingDemoStore()) {
    return {
      ok: true,
      data: {
        status: {
          invoiceId,
          tenantId,
          accountingStatus: 'erstellt',
          providerKey: null,
          archiveVersion: 0,
          archivedAt: null,
          lastExportId: null,
          updatedAt: new Date().toISOString(),
        },
        exportHistory: [],
        exportErrors: [],
        gobdAuditEvents: [],
        selectedProvider: 'datev',
        isGobdArchived: false,
        canDirectEdit: true,
        canPrepareExport: false,
      },
    };
  }

  await delay(200);
  const status = getDemoInvoiceAccountingStatus(invoiceId);
  const selectedProvider = defaultProvider(status.providerKey);
  const isGobdArchived = isInvoiceGobdArchived(status.accountingStatus);

  return {
    ok: true,
    data: {
      status,
      exportHistory: getDemoAccountingExportsForInvoice(invoiceId),
      exportErrors: getDemoAccountingExportErrors(),
      gobdAuditEvents: getDemoGobdEvents(invoiceId),
      selectedProvider,
      isGobdArchived,
      canDirectEdit: canDirectlyEditInvoice(status.accountingStatus),
      canPrepareExport: !isGobdArchived && status.accountingStatus !== 'exportiert',
    },
  };
}

export async function prepareInvoiceAccountingExport(
  invoiceId: string,
  invoiceNumber: string,
  tenantId: string,
  providerKey: AccountingProviderKey,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<InvoiceAccountingSnapshot>> {
  const denied = enforcePermission<InvoiceAccountingSnapshot>(actorRoleKey, 'integrations.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const snapshotResult = await fetchInvoiceAccountingSnapshot(invoiceId, tenantId, actorRoleKey);
  if (!snapshotResult.ok) return snapshotResult;

  const editGuard = assertInvoiceEditable(snapshotResult.data.status.accountingStatus, 'direct_edit');
  if (!editGuard.allowed) {
    appendDemoGobdEvent(
      invoiceId,
      buildGobdAuditEvent({
        id: newId('gobd'),
        tenantId,
        invoiceId,
        eventType: 'edit_blocked',
        summary: editGuard.message,
      }),
    );
    return { ok: false, error: editGuard.message };
  }

  const exportRecord: AccountingExportRecord = {
    id: newId('exp'),
    tenantId,
    providerKey,
    exportType: 'invoice',
    exportFormat: resolveExportFormat(providerKey),
    status: 'prepared',
    externalTransfer: false,
    itemCount: 1,
    errorSummary: null,
    packageLabel: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };

  if (useAccountingDemoStore()) {
    appendDemoAccountingExport(exportRecord);
    setDemoInvoiceAccountingStatus(invoiceId, {
      accountingStatus: 'export_bereit',
      providerKey,
      lastExportId: exportRecord.id,
    });
    appendDemoGobdEvent(
      invoiceId,
      buildGobdAuditEvent({
        id: newId('gobd'),
        tenantId,
        invoiceId,
        eventType: 'export_prepared',
        summary: `Export vorbereitet für ${providerKey} — noch kein externer Transfer.`,
      }),
    );
  }

  return fetchInvoiceAccountingSnapshot(invoiceId, tenantId, actorRoleKey);
}

export async function executeInvoiceAccountingExport(
  invoiceId: string,
  invoiceNumber: string,
  tenantId: string,
  providerKey: AccountingProviderKey,
  actorRoleKey?: RoleKey | null,
  actorUserId = 'demo-user',
): Promise<ServiceResult<InvoiceAccountingSnapshot>> {
  const denied = enforcePermission<InvoiceAccountingSnapshot>(actorRoleKey, 'integrations.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const configured = await isAccountingProviderConfigured(tenantId, providerKey, actorRoleKey);
  const featureGate = assertConnectFeatureAllowed(
    'accounting.datev',
    'accounting_export',
    buildConnectFeatureGateContextFromFeatureKey('accounting.datev', {
      userId: actorUserId,
      tenantId,
      role: actorRoleKey ?? 'business_admin',
      integrationStatus: configured ? 'configured' : 'not_configured',
      hasCredentialReference: configured,
      connectorStatus: 'coming_soon',
      hasExternalTransferConsent: false,
    }),
  );
  if (!featureGate.allowed) {
    return { ok: false, error: featureGate.message };
  }

  const ctx = buildConnectExecutionContext({
    tenantId,
    userId: actorUserId,
    role: actorRoleKey ?? 'business_admin',
    providerKey,
    category: 'accounting',
    integrationId: configured ? `int-${providerKey}` : null,
    integrationStatus: configured ? 'configured' : 'not_configured',
    connectorStatus: 'coming_soon',
    hasCredentialReference: configured,
    allowedActions: ['test_connection', 'accounting_export'],
    permissions: ['connect.configure', 'integrations.manage'],
    environment: 'sandbox',
  });

  if (!ctx) {
    return { ok: false, error: 'Connect-Kontext konnte nicht erstellt werden.' };
  }

  const gatewayResult = await executeConnectAction(
    'accounting_export',
    { invoiceId, invoiceNumber, providerKey },
    ctx,
  );

  const isRealExternalTransfer =
    gatewayResult.ok &&
    !gatewayResult.blocked &&
    !gatewayResult.demo &&
    configured &&
    ctx.connectorStatus !== 'coming_soon' &&
    ctx.environment === 'production';

  const blocked = !isRealExternalTransfer;

  if (useAccountingDemoStore()) {
    recordAccountingExportFailure({
      invoiceId,
      tenantId,
      providerKey,
      message: gatewayResult.message,
      configured,
      eventType: blocked ? 'export_blocked' : 'export_failed',
    });
  }

  const snapshot = await fetchInvoiceAccountingSnapshot(invoiceId, tenantId, actorRoleKey);
  if (!snapshot.ok) return snapshot;

  if (blocked) {
    return {
      ok: false,
      error: gatewayResult.message,
    };
  }

  return snapshot;
}

export async function createSteuerberaterPackage(
  invoiceId: string,
  invoiceNumber: string,
  tenantId: string,
  formats: AccountingExportFormat[],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceAccountingSnapshot>> {
  const denied = enforcePermission<InvoiceAccountingSnapshot>(actorRoleKey, 'integrations.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const formatLabel = formats.join('/') || 'csv/xml/pdf';
  const exportRecord: AccountingExportRecord = {
    id: newId('exp'),
    tenantId,
    providerKey: 'steuerberater_export',
    exportType: 'steuerberater_package',
    exportFormat: formats[0] ?? 'csv',
    status: 'prepared',
    externalTransfer: false,
    itemCount: 1,
    errorSummary: null,
    packageLabel: `Steuerberater-Paket ${invoiceNumber} (${formatLabel})`,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };

  if (useAccountingDemoStore()) {
    appendDemoAccountingExport(exportRecord);
    setDemoInvoiceAccountingStatus(invoiceId, {
      providerKey: 'steuerberater_export',
      lastExportId: exportRecord.id,
    });
    appendDemoGobdEvent(
      invoiceId,
      buildGobdAuditEvent({
        id: newId('gobd'),
        tenantId,
        invoiceId,
        eventType: 'steuerberater_package_prepared',
        summary: `Steuerberater-Paket vorbereitet (${formatLabel}) — Übergabe noch nicht erfolgt.`,
      }),
    );
  }

  return fetchInvoiceAccountingSnapshot(invoiceId, tenantId, actorRoleKey);
}

export async function applyInvoiceAccountingCorrection(
  invoiceId: string,
  tenantId: string,
  correctionType: GobdCorrectionType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceAccountingSnapshot>> {
  const denied = enforcePermission<InvoiceAccountingSnapshot>(actorRoleKey, 'office.invoices.status_change');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const snapshotResult = await fetchInvoiceAccountingSnapshot(invoiceId, tenantId, actorRoleKey);
  if (!snapshotResult.ok) return snapshotResult;

  const correctionGuard = canApplyCorrection(
    snapshotResult.data.status.accountingStatus,
    correctionType,
  );
  if (!correctionGuard.allowed) {
    return { ok: false, error: correctionGuard.message };
  }

  const nextStatus = mapCorrectionToAccountingStatus(correctionType);
  const eventType = correctionType === 'storno' ? 'storno_created' : 'korrektur_created';

  if (useAccountingDemoStore()) {
    setDemoInvoiceAccountingStatus(invoiceId, { accountingStatus: nextStatus });
    appendDemoGobdEvent(
      invoiceId,
      buildGobdAuditEvent({
        id: newId('gobd'),
        tenantId,
        invoiceId,
        eventType,
        summary:
          correctionType === 'storno'
            ? 'Stornobeleg angelegt — GoBD-Audit protokolliert.'
            : 'Korrekturbeleg angelegt — GoBD-Audit protokolliert.',
      }),
    );
  }

  return fetchInvoiceAccountingSnapshot(invoiceId, tenantId, actorRoleKey);
}

export function assertInvoiceAccountingEditable(
  accountingStatus: InvoiceAccountingStatusKey,
): { ok: false; error: string } | null {
  const guard = assertInvoiceEditable(accountingStatus, 'direct_edit');
  if (!guard.allowed) {
    return { ok: false, error: guard.message };
  }
  return null;
}

function defaultProvider(statusProvider: AccountingProviderKey | null): AccountingProviderKey {
  return statusProvider ?? 'datev';
}

export type { GobdAuditEvent, AccountingExportRecord };
