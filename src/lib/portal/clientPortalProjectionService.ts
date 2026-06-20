/**
 * Client portal projections — sanitized, settings-gated payloads only.
 */
import type { ServiceResult } from '@/types';
import type {
  ClientPortalBudgetProjection,
  ClientPortalDashboardProjection,
  ClientPortalProjection,
  ClientPortalVisitProjection,
} from '@/types/portalSystem';
import type { ClientPortalAssistVisitProof } from '@/types/assistExecutionPersistence';
import {
  canClientPortalSeeFeature,
  fetchClientPortalSettingsResolved,
} from '@/lib/client/clientPortalSettingsService';
import { listClientBudgetSettings } from '@/lib/client/clientBudgetSettingsService';
import {
  getReleasedProofForClientPortal,
  listReleasedProofsForClientPortal,
} from '@/lib/portal/assist/portalAssistVisitProofService';
import { getPortalVisibilityMatrixForClient, sanitizeClientPortalPayload } from './portalVisibilityService';
import { runService } from '@/lib/services/serviceRunner';

export {
  canClientPortalSeeFeature,
  canClientPortalSeeServiceFeature,
} from '@/lib/client/clientPortalSettingsService';

export {
  getReleasedProofForClientPortal as getReleasedProofsForClientPortal,
  listReleasedProofsForClientPortal,
} from '@/lib/portal/assist/portalAssistVisitProofService';

function mapVisitProjection(raw: Record<string, unknown>): ClientPortalVisitProjection {
  const sanitized = sanitizeClientPortalPayload(raw);
  return {
    id: String(sanitized.id ?? ''),
    title: String(sanitized.title ?? 'Einsatz'),
    scheduledStart: (sanitized.scheduledStart as string | null) ?? (sanitized.scheduled_start as string | null) ?? null,
    scheduledEnd: (sanitized.scheduledEnd as string | null) ?? (sanitized.scheduled_end as string | null) ?? null,
    statusLabel: (sanitized.statusLabel as string | null) ?? (sanitized.status as string | null) ?? null,
    serviceName: (sanitized.serviceName as string | null) ?? null,
  };
}

export async function getClientPortalVisitProjection(
  tenantId: string,
  clientId: string,
  visit: Record<string, unknown>,
): Promise<ServiceResult<ClientPortalVisitProjection | null>> {
  return runService(async () => {
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'appointments')) {
      return { ok: true, data: null };
    }
    return { ok: true, data: mapVisitProjection(visit) };
  });
}

export async function getClientPortalBudgetProjection(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientPortalBudgetProjection | null>> {
  return runService(async () => {
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'budget')) {
      return { ok: true, data: null };
    }

    const budgets = await listClientBudgetSettings(tenantId, clientId);
    if (!budgets.ok) return budgets;

    const items = budgets.data.map((row) => ({
      budgetTypeKey: row.budgetTypeKey ?? null,
      budgetTypeName: row.budgetTypeName ?? null,
      allocatedCents: row.allocatedCents,
      usedCents: row.usedCents,
      reservedCents: row.reservedCents,
      remainingCents: row.remainingCents ?? row.allocatedCents - row.usedCents - row.reservedCents,
    }));

    return {
      ok: true,
      data: {
        budgetYear: budgets.data[0]?.budgetYear ?? null,
        items,
      },
    };
  });
}

export async function getClientPortalDocumentProjection(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<{ count: number }>> {
  return runService(async () => {
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'documents')) {
      return { ok: true, data: { count: 0 } };
    }
    return { ok: true, data: { count: 0 } };
  });
}

export async function getClientPortalDashboardProjection(
  tenantId: string,
  clientId: string,
  options?: { visits?: Record<string, unknown>[] },
): Promise<ServiceResult<ClientPortalDashboardProjection>> {
  return runService(async () => {
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;

    const proofsResult = canClientPortalSeeFeature(settings.data, 'proofs')
      ? await listReleasedProofsForClientPortal(tenantId, clientId)
      : ({ ok: true, data: [] } as ServiceResult<ClientPortalAssistVisitProof[]>);

    if (!proofsResult.ok) return proofsResult;

    const budgetResult = await getClientPortalBudgetProjection(tenantId, clientId);
    if (!budgetResult.ok) return budgetResult;

    const visits = (options?.visits ?? [])
      .map(mapVisitProjection)
      .slice(0, 5);

    const showMessages = canClientPortalSeeFeature(settings.data, 'messages');
    const showDocuments = canClientPortalSeeFeature(settings.data, 'documents');

    return {
      ok: true,
      data: {
        nextVisits: canClientPortalSeeFeature(settings.data, 'appointments') ? visits : [],
        recentProofs: proofsResult.data.slice(0, 5),
        documentCount: showDocuments ? 0 : 0,
        messageCount: showMessages ? 0 : 0,
        budgetSummary: budgetResult.data,
        helpAvailable: settings.data.portalEnabled,
      },
    };
  });
}

export async function getClientPortalProjection(
  tenantId: string,
  clientId: string,
  options?: { visits?: Record<string, unknown>[] },
): Promise<ServiceResult<ClientPortalProjection>> {
  return runService(async () => {
    const [settings, visibility, dashboard] = await Promise.all([
      fetchClientPortalSettingsResolved(tenantId, clientId),
      getPortalVisibilityMatrixForClient(tenantId, clientId),
      getClientPortalDashboardProjection(tenantId, clientId, options),
    ]);

    if (!settings.ok) return settings;
    if (!visibility.ok) return visibility;
    if (!dashboard.ok) return dashboard;

    return {
      ok: true,
      data: {
        tenantId,
        clientId,
        settings: settings.data,
        visibility: visibility.data,
        dashboard: dashboard.data,
      },
    };
  });
}
