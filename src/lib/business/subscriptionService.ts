import type { RoleKey, ServiceResult } from '@/types';
import type { TenantSubscription } from '@/types/core/tenant';
import { demoTenant, demoTenantSubscription } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';
import { calculateBillingItems } from '@/lib/modules/moduleEntitlementService';
import {
  formatFreePlatformPrice,
  getFreePlatformModules,
  isFreePlatformEnabled,
} from '@/lib/billing/freePlatformService';
import { activateAllBaseModulesForTenant } from '@/lib/billing/moduleActivationService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

export type SubscriptionOverview = TenantSubscription & {
  tenantName: string;
  planLabel: string;
  moduleCount: number;
  billableModuleCount: number;
  includedModuleCount: number;
  officeIncludedAsBase: boolean;
  monthlyTotal: number;
  freePlatformEnabled: boolean;
  freePlatformPriceLabel: string;
  freeModuleCount: number;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchSubscriptionOverview(
  actorRoleKey?: RoleKey | null,
  tenantId?: string | null,
): Promise<ServiceResult<SubscriptionOverview>> {
  const denied = enforcePermission<SubscriptionOverview>(
    actorRoleKey,
    'business.subscription.view',
  );
  if (denied) return denied;

  return runService(async () => {
    await delay(280);
    const sub = {
      ...demoTenantSubscription,
      status: isFreePlatformEnabled() ? ('free_active' as const) : demoTenantSubscription.status,
      planKey: isFreePlatformEnabled() ? 'free_platform' : demoTenantSubscription.planKey,
    };
    const billingTenantId = tenantId?.trim() || DEMO_TENANT_ID;
    const billing = calculateBillingItems(billingTenantId);
    return {
      ok: true,
      data: {
        ...sub,
        tenantName: demoTenant.name,
        planLabel: isFreePlatformEnabled() ? 'CareSuite+ Plattform' : 'Kein Plan',
        moduleCount: billing.totalActiveCount,
        billableModuleCount: 0,
        includedModuleCount: billing.includedCount + billing.totalActiveCount,
        officeIncludedAsBase: true,
        monthlyTotal: 0,
        freePlatformEnabled: isFreePlatformEnabled(),
        freePlatformPriceLabel: formatFreePlatformPrice(),
        freeModuleCount: getFreePlatformModules().length,
      },
    };
  });
}

/** Legacy — Demo-Paketaktivierung durch Free Platform ersetzt. */
export async function activateDemoPackage(
  actorRoleKey: RoleKey | null | undefined,
  tenantId: string,
  _packageKey: string,
): Promise<ServiceResult<{ totalMonthly: number }>> {
  const denied = enforcePermission<{ totalMonthly: number }>(
    actorRoleKey,
    'business.subscription.manage',
  );
  if (denied) return denied;

  return runService(async () => {
    await delay(200);
    activateAllBaseModulesForTenant(tenantId);
    return { ok: true, data: { totalMonthly: 0 } };
  });
}

export async function previewCart(
  _selectedModules: import('@/types').ProductKey[],
): Promise<ServiceResult<{ totalMonthly: number }>> {
  return runService(async () => {
    await delay(80);
    return { ok: true, data: { totalMonthly: 0 } };
  });
}
