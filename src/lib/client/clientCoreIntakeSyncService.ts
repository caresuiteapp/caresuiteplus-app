import type { ServiceResult } from '@/types';
import type { ClientServiceTypeKey } from '@/types/clientCore';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { runService } from '@/lib/services/serviceRunner';
import {
  careContextsToServiceTypeKeys,
  listClientServiceProfiles,
  syncClientServiceProfiles,
} from './clientServiceTypeService';
import { initializeClientBudgetFromDefaults, listClientBudgetSettings } from './clientBudgetSettingsService';
import { fetchClientPortalSettingsResolved, upsertClientPortalSettings } from './clientPortalSettingsService';

function resolvePrimaryServiceTypeKey(
  keys: ClientServiceTypeKey[],
  existingPrimary?: ClientServiceTypeKey,
): ClientServiceTypeKey | undefined {
  if (existingPrimary && keys.includes(existingPrimary)) return existingPrimary;
  return keys[0];
}

/** After intake create/update — sync profiles, budget init, portal defaults (no hard delete). */
export async function syncClientCoreAfterIntake(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
): Promise<ServiceResult<void>> {
  return runService(async () => {
    const serviceTypeKeys = careContextsToServiceTypeKeys(form.careContexts);

    const existingProfiles = await listClientServiceProfiles(tenantId, clientId);
    if (!existingProfiles.ok) return existingProfiles;
    const primaryKey = resolvePrimaryServiceTypeKey(
      serviceTypeKeys,
      existingProfiles.data.find((p) => p.isPrimary)?.serviceTypeKey,
    );

    if (serviceTypeKeys.length > 0) {
      const syncResult = await syncClientServiceProfiles(
        tenantId,
        clientId,
        serviceTypeKeys,
        primaryKey,
      );
      if (!syncResult.ok) return syncResult;
    }

    const budgets = await listClientBudgetSettings(tenantId, clientId);
    if (!budgets.ok) return budgets;
    if (budgets.data.length === 0) {
      const budgetYear = new Date(form.serviceStart || Date.now()).getFullYear();
      if (!Number.isFinite(budgetYear)) return { ok: false, error: 'Der Leistungsbeginn ist ungültig. Bitte korrigieren Sie das Datum.' };
      const initResult = await initializeClientBudgetFromDefaults(tenantId, clientId, budgetYear);
      if (!initResult.ok) return initResult;
    }

    const portal = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!portal.ok) return portal;
    if (portal.data.source === 'tenant') {
      const upsertResult = await upsertClientPortalSettings(tenantId, clientId, {
        inheritTenantDefaults: true,
      });
      if (!upsertResult.ok) return upsertResult;
    }

    return { ok: true, data: undefined };
  });
}
