import type { RoleKey, ServiceResult } from '@/types';
import type { IntegrationProviderListItem } from '@/types/modules/integrations';
import type { OutboxEntryListItem } from '@/types/modules/integrations';
import {
  getDemoIntegrationById,
  getDemoIntegrations,
  toggleDemoIntegrationStatus,
} from '@/data/demo/integrations';
import {
  createDemoOutboxEntry,
  getDemoOutboxEntries,
  retryDemoOutboxEntry,
} from '@/data/demo/outbox';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchIntegrationList(
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<IntegrationProviderListItem[]>> {
  const denied = enforcePermission<IntegrationProviderListItem[]>(
    actorRoleKey,
    'integrations.view',
  );
  if (denied) return denied;
  return runService(async () => {
    await delay(300);
    return { ok: true, data: getDemoIntegrations() };
  });
}

export async function fetchIntegrationDetail(
  id: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<IntegrationProviderListItem>> {
  const denied = enforcePermission<IntegrationProviderListItem>(
    actorRoleKey,
    'integrations.view',
  );
  if (denied) return denied;
  return runService(async () => {
    await delay(280);
    const item = getDemoIntegrationById(id);
    if (!item) return { ok: false, error: 'Integration nicht gefunden.' };
    return { ok: true, data: item };
  });
}

export async function toggleIntegration(
  id: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<IntegrationProviderListItem>> {
  const denied = enforcePermission<IntegrationProviderListItem>(
    actorRoleKey,
    'integrations.manage',
  );
  if (denied) return denied;
  return runService(async () => {
    await delay(400);
    const item = toggleDemoIntegrationStatus(id);
    if (!item) return { ok: false, error: 'Status konnte nicht geändert werden.' };
    return { ok: true, data: item };
  });
}

export async function fetchOutboxList(
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OutboxEntryListItem[]>> {
  const denied = enforcePermission<OutboxEntryListItem[]>(
    actorRoleKey,
    'integrations.outbox.view',
  );
  if (denied) return denied;
  return runService(async () => {
    await delay(300);
    return { ok: true, data: getDemoOutboxEntries() };
  });
}

export async function retryOutboxEntry(
  id: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OutboxEntryListItem>> {
  const denied = enforcePermission<OutboxEntryListItem>(
    actorRoleKey,
    'integrations.manage',
  );
  if (denied) return denied;
  return runService(async () => {
    await delay(350);
    const entry = retryDemoOutboxEntry(id);
    if (!entry) return { ok: false, error: 'Eintrag nicht gefunden.' };
    return { ok: true, data: entry };
  });
}

export async function queueInvoiceExport(
  invoiceNumber: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OutboxEntryListItem>> {
  const denied = enforcePermission<OutboxEntryListItem>(
    actorRoleKey,
    'integrations.manage',
  );
  if (denied) return denied;
  return runService(async () => {
    await delay(400);
    const entry = createDemoOutboxEntry(
      'webhook',
      'vault:integration-datev',
      `Rechnung ${invoiceNumber}`,
      `DATEV-Export ${invoiceNumber}`,
    );
    return { ok: true, data: entry };
  });
}
