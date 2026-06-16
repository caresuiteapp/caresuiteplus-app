import type { RoleKey, ServiceResult } from '@/types';
import type { AccountingProviderConfig, AccountingProviderKey } from '@/types/accounting';
import {
  getDemoAccountingProviderConfigs,
  upsertDemoAccountingProviderConfig,
} from '@/data/demo/accounting';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { maskConnectCredentialReference } from '@/lib/connect/gateway';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ACCOUNTING_LIVE_REPOSITORY = false;

export type AccountingProviderConfigView = Omit<AccountingProviderConfig, 'hasCredentialReference'> & {
  credentialMasked: string;
};

function toView(config: AccountingProviderConfig): AccountingProviderConfigView {
  return {
    id: config.id,
    tenantId: config.tenantId,
    providerKey: config.providerKey,
    configStatus: config.configStatus,
    environment: config.environment,
    configuredAt: config.configuredAt,
    notes: config.notes,
    credentialMasked: maskConnectCredentialReference(
      config.hasCredentialReference ? `vault:accounting/${config.providerKey}` : null,
    ),
  };
}

/** Nur connect.configure — normale Nutzer sehen keine Anbieter-Konfiguration. */
export async function fetchAccountingProviderConfigs(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AccountingProviderConfigView[]>> {
  const denied = enforcePermission<AccountingProviderConfigView[]>(actorRoleKey, 'connect.configure');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (ACCOUNTING_LIVE_REPOSITORY) {
    return { ok: true, data: [] };
  }

  await delay(250);
  return { ok: true, data: getDemoAccountingProviderConfigs().map(toView) };
}

export async function isAccountingProviderConfigured(
  tenantId: string,
  providerKey: AccountingProviderKey,
  actorRoleKey?: RoleKey | null,
): Promise<boolean> {
  const result = await fetchAccountingProviderConfigs(tenantId, actorRoleKey);
  if (!result.ok) return false;
  const config = result.data.find((c) => c.providerKey === providerKey);
  return (
    config?.configStatus === 'configured' ||
    config?.configStatus === 'sandbox' ||
    config?.configStatus === 'production'
  );
}

/** Intern für Demo-Setup — nicht für UI ohne connect.configure. */
export function seedDemoAccountingProviderConfig(
  providerKey: AccountingProviderKey,
  patch: Partial<AccountingProviderConfig>,
): AccountingProviderConfig {
  return upsertDemoAccountingProviderConfig(providerKey, patch);
}

export function canViewAccountingProviderConfig(actorRoleKey?: RoleKey | null): boolean {
  return enforcePermission(actorRoleKey, 'connect.configure') === null;
}
