import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  countReadyItemsForMonth,
  finalizeBillingRunInvoices,
  generateInvoiceDraftsFromRun,
  listBillingAuditEvents,
  listBillingRuns,
  prepareBillingRun,
} from '@/lib/careBilling';
import type { BillingRun } from '@/types/careBilling';

export type MonthEndClosingSummary = {
  billingMonth: string;
  readyItemCount: number;
  runs: BillingRun[];
  recentAudit: { action: string; summary: string; createdAt: string }[];
};

async function demoDelay(ms = 180): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchMonthEndClosingSummary(
  tenantId: string,
  billingMonth: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MonthEndClosingSummary>> {
  const denied = enforcePermission<MonthEndClosingSummary>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Monatsabschluss im Live-Modus: Migration 0054 anwenden.' };
  }
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Monatsabschluss: Mandant nicht im Demo-Store.' };
  }

  await demoDelay();
  const runs = listBillingRuns(tenantId);
  const audit = listBillingAuditEvents(tenantId).slice(0, 8);

  return {
    ok: true,
    data: {
      billingMonth,
      readyItemCount: countReadyItemsForMonth(tenantId, billingMonth),
      runs,
      recentAudit: audit.map((e) => ({
        action: e.action,
        summary: e.summary,
        createdAt: e.createdAt,
      })),
    },
  };
}

export async function executePrepareBillingRun(
  tenantId: string,
  billingMonth: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ billingRunId: string; itemCount: number }>> {
  const denied = enforcePermission<{ billingRunId: string; itemCount: number }>(
    actorRoleKey,
    'office.invoices.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Monatsabschluss im Live-Modus: Migration 0054 anwenden.' };
  }

  await demoDelay();
  const result = prepareBillingRun({ tenantId, billingMonth, preparedBy: actorRoleKey ?? null });
  if (!result.ok) return { ok: false, error: result.blockedReason ?? 'Rechnungslauf blockiert.' };
  return {
    ok: true,
    data: { billingRunId: result.billingRunId!, itemCount: result.itemCount },
  };
}

export async function executeGenerateDrafts(
  tenantId: string,
  billingRunId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ draftsCreated: number; blockedCount: number }>> {
  const denied = enforcePermission<{ draftsCreated: number; blockedCount: number }>(
    actorRoleKey,
    'office.invoices.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Rechnungslauf im Live-Modus: Migration 0054 anwenden.' };
  }

  await demoDelay();
  const result = generateInvoiceDraftsFromRun(tenantId, billingRunId);
  if (!result.ok) return { ok: false, error: result.blockedReason ?? 'Entwürfe blockiert.' };
  return {
    ok: true,
    data: { draftsCreated: result.draftsCreated, blockedCount: result.blockedCount },
  };
}

export async function executeFinalizeRun(
  tenantId: string,
  billingRunId: string,
  previewConfirmed: boolean,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ invoicesFinalized: number; receivablesCreated: number }>> {
  const denied = enforcePermission<{ invoicesFinalized: number; receivablesCreated: number }>(
    actorRoleKey,
    'office.invoices.view',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Finalisierung im Live-Modus: Migration 0054 anwenden.' };
  }

  await demoDelay();
  const result = finalizeBillingRunInvoices({
    tenantId,
    billingRunId,
    previewConfirmed,
    actorId: actorRoleKey ?? null,
  });
  if (!result.ok) return { ok: false, error: result.blockedReason ?? 'Finalisierung blockiert.' };
  return {
    ok: true,
    data: {
      invoicesFinalized: result.invoicesFinalized,
      receivablesCreated: result.receivablesCreated,
    },
  };
}
