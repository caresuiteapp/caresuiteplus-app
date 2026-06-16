import type { RoleKey, ServiceResult } from '@/types';
import type { PayrollExportBatch, PayrollProviderKey } from '@/types/modules/employeeTime';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  appendPayrollAudit,
  getPayrollBatch,
  getPeriod,
  getTenantWorkTimeSettings,
  listPayrollAudit,
  listPayrollBatches,
  listPayrollItems,
  listPeriods,
  listTimeEntries,
  nextPayrollAuditId,
  nextPayrollBatchId,
  nextPayrollItemId,
  savePayrollBatch,
  savePayrollItem,
  saveTenantWorkTimeSettings,
} from './employeeTimeStore';

export function isPayrollProviderConfigured(
  tenantId: string,
  providerKey: PayrollProviderKey,
): boolean {
  const settings = getTenantWorkTimeSettings(tenantId);
  if (providerKey === 'csv' || providerKey === 'generic') {
    return true;
  }
  return settings.payrollProviderConfigured[providerKey] === true;
}

export function configurePayrollProvider(
  tenantId: string,
  providerKey: PayrollProviderKey,
  configured: boolean,
  actorRoleKey: RoleKey | null,
): ServiceResult<{ providerKey: PayrollProviderKey; configured: boolean }> {
  const denied = enforcePermission<{ providerKey: PayrollProviderKey; configured: boolean }>(
    actorRoleKey,
    'office.employee_time.export',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const settings = getTenantWorkTimeSettings(tenantId);
  const next = {
    ...settings,
    payrollProviderConfigured: {
      ...settings.payrollProviderConfigured,
      [providerKey]: configured,
    },
  };
  saveTenantWorkTimeSettings(next);
  return { ok: true, data: { providerKey, configured } };
}

export function preparePayrollExport(input: {
  tenantId: string;
  providerKey: PayrollProviderKey;
  periodStart: string;
  periodEnd: string;
  actorRoleKey: RoleKey | null;
  initiatedBy?: string | null;
}): ServiceResult<{ batch: PayrollExportBatch; csvPreview?: string }> {
  const denied = enforcePermission<{ batch: PayrollExportBatch; csvPreview?: string }>(
    input.actorRoleKey,
    'office.employee_time.export',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const approvedPeriods = listPeriods(input.tenantId).filter(
    (p) =>
      p.status === 'approved' &&
      p.periodStart >= input.periodStart &&
      p.periodEnd <= input.periodEnd,
  );

  if (approvedPeriods.length === 0) {
    return {
      ok: false,
      error: 'Export nur möglich, wenn freigegebene Perioden im Zeitraum vorliegen.',
    };
  }

  const now = new Date().toISOString();
  const batchId = nextPayrollBatchId();
  const exportFormat =
    input.providerKey === 'csv'
      ? 'csv'
      : input.providerKey === 'generic'
        ? 'generic'
        : input.providerKey;

  const batch: PayrollExportBatch = {
    id: batchId,
    tenantId: input.tenantId,
    providerKey: input.providerKey,
    exportFormat,
    status: 'ready',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    employeeCount: new Set(approvedPeriods.map((p) => p.employeeId)).size,
    itemCount: approvedPeriods.length,
    externalTransfer: false,
    preparedAt: now,
    exportedAt: null,
    lockedAt: null,
    errorSummary: null,
    initiatedBy: input.initiatedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };

  for (const period of approvedPeriods) {
    const entries = listTimeEntries(input.tenantId, period.employeeId).filter(
      (e) => e.status === 'approved' || e.status === 'calculated' || e.status === 'corrected',
    );
    savePayrollItem({
      id: nextPayrollItemId(),
      tenantId: input.tenantId,
      batchId,
      employeeId: period.employeeId,
      periodId: period.id,
      timeEntryIds: entries.map((e) => e.id),
      payloadReference: `preparation://${batchId}/${period.employeeId}`,
      totalPaidMinutes: period.totalPaidMinutes,
      status: 'ready',
      createdAt: now,
      updatedAt: now,
    });
  }

  savePayrollBatch(batch);
  appendPayrollAudit({
    id: nextPayrollAuditId(),
    tenantId: input.tenantId,
    batchId,
    action: 'payroll.export_prepared',
    actorId: input.initiatedBy ?? null,
    summary: `Lohnexport vorbereitet (${batch.itemCount} Positionen, ${input.providerKey}).`,
    createdAt: now,
  });

  const csvPreview =
    input.providerKey === 'csv' || input.providerKey === 'generic'
      ? buildCsvPreview(input.tenantId, batchId)
      : undefined;

  return { ok: true, data: { batch, csvPreview } };
}

function buildCsvPreview(tenantId: string, batchId: string): string {
  const items = listPayrollItems(tenantId, batchId);
  const header = 'employee_id;period_id;total_paid_minutes;status';
  const rows = items.map(
    (i) => `${i.employeeId};${i.periodId ?? ''};${i.totalPaidMinutes};${i.status}`,
  );
  return [header, ...rows].join('\n');
}

export function executePayrollExport(
  tenantId: string,
  batchId: string,
  actorRoleKey: RoleKey | null,
  actorId?: string | null,
): ServiceResult<PayrollExportBatch> {
  const denied = enforcePermission<PayrollExportBatch>(actorRoleKey, 'office.employee_time.export');
  if (denied) return denied;

  const batch = getPayrollBatch(tenantId, batchId);
  if (!batch) return { ok: false, error: 'Export-Batch nicht gefunden.' };

  if (batch.status === 'locked') {
    return { ok: false, error: 'Export ist gesperrt.' };
  }

  const providerReady = isPayrollProviderConfigured(tenantId, batch.providerKey);
  const allowsLocalExport = batch.providerKey === 'csv' || batch.providerKey === 'generic';

  if (!providerReady) {
    const now = new Date().toISOString();
    const failed: PayrollExportBatch = {
      ...batch,
      status: 'export_failed',
      errorSummary: `Provider ${batch.providerKey} ist nicht konfiguriert — kein produktiver Transfer.`,
      updatedAt: now,
    };
    savePayrollBatch(failed);
    appendPayrollAudit({
      id: nextPayrollAuditId(),
      tenantId,
      batchId,
      action: 'payroll.export_failed',
      actorId: actorId ?? null,
      summary: failed.errorSummary ?? 'Export fehlgeschlagen.',
      createdAt: now,
    });
    return { ok: false, error: failed.errorSummary ?? 'Export fehlgeschlagen.' };
  }

  const now = new Date().toISOString();

  if (!allowsLocalExport) {
    const blocked: PayrollExportBatch = {
      ...batch,
      status: 'export_failed',
      externalTransfer: false,
      errorSummary: `${batch.providerKey} Connect nicht produktiv — nur Vorbereitung möglich.`,
      updatedAt: now,
    };
    savePayrollBatch(blocked);
    appendPayrollAudit({
      id: nextPayrollAuditId(),
      tenantId,
      batchId,
      action: 'payroll.export_blocked',
      actorId: actorId ?? null,
      summary: blocked.errorSummary ?? 'Export blockiert.',
      createdAt: now,
    });
    return { ok: false, error: blocked.errorSummary ?? 'Export blockiert.' };
  }

  const exported: PayrollExportBatch = {
    ...batch,
    status: 'exported',
    externalTransfer: false,
    exportedAt: now,
    updatedAt: now,
  };
  savePayrollBatch(exported);
  appendPayrollAudit({
    id: nextPayrollAuditId(),
    tenantId,
    batchId,
    action: 'payroll.export_csv',
    actorId: actorId ?? null,
    summary: 'CSV-Export erstellt — kein externer Provider-Transfer.',
    createdAt: now,
  });

  return { ok: true, data: exported };
}

export function lockPayrollExportBatch(
  tenantId: string,
  batchId: string,
  actorRoleKey: RoleKey | null,
  actorId?: string | null,
): ServiceResult<PayrollExportBatch> {
  const denied = enforcePermission<PayrollExportBatch>(actorRoleKey, 'office.employee_time.export');
  if (denied) return denied;

  const batch = getPayrollBatch(tenantId, batchId);
  if (!batch) return { ok: false, error: 'Export-Batch nicht gefunden.' };

  const now = new Date().toISOString();
  const locked: PayrollExportBatch = {
    ...batch,
    status: 'locked',
    lockedAt: now,
    updatedAt: now,
  };
  savePayrollBatch(locked);
  appendPayrollAudit({
    id: nextPayrollAuditId(),
    tenantId,
    batchId,
    action: 'payroll.export_locked',
    actorId: actorId ?? null,
    summary: 'Lohnexport gesperrt.',
    createdAt: now,
  });

  return { ok: true, data: locked };
}

export function markPeriodCorrectedAfterExport(
  tenantId: string,
  periodId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<{ periodId: string; batchStatus: PayrollExportBatch['status'] }> {
  const denied = enforcePermission<{ periodId: string; batchStatus: PayrollExportBatch['status'] }>(
    actorRoleKey,
    'office.employee_time.manage',
  );
  if (denied) return denied;

  const period = getPeriod(tenantId, periodId);
  if (!period) return { ok: false, error: 'Periode nicht gefunden.' };

  if (!period.exportedAt && period.status !== 'exported') {
    return { ok: false, error: 'Periode wurde noch nicht exportiert.' };
  }

  const relatedBatch = listPayrollBatches(tenantId).find((b) => b.status === 'exported');
  if (relatedBatch) {
    savePayrollBatch({
      ...relatedBatch,
      status: 'corrected_after_export',
      updatedAt: new Date().toISOString(),
    });
  }

  return { ok: true, data: { periodId, batchStatus: 'corrected_after_export' } };
}

export function fetchPayrollExportHistory(
  tenantId: string,
  roleKey: RoleKey | null,
): ServiceResult<{
  batches: PayrollExportBatch[];
  audit: ReturnType<typeof listPayrollAudit>;
}> {
  const denied = enforcePermission<{
    batches: PayrollExportBatch[];
    audit: ReturnType<typeof listPayrollAudit>;
  }>(roleKey, 'office.employee_time.export');
  if (denied) return denied;

  return {
    ok: true,
    data: {
      batches: listPayrollBatches(tenantId),
      audit: listPayrollAudit(tenantId),
    },
  };
}

export function assertPeriodExportable(
  tenantId: string,
  periodId: string,
): ServiceResult<true> {
  const period = getPeriod(tenantId, periodId);
  if (!period) return { ok: false, error: 'Periode nicht gefunden.' };
  if (period.status !== 'approved') {
    return { ok: false, error: 'Nur freigegebene Perioden sind exportierbar.' };
  }
  return { ok: true, data: true };
}
