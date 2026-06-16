import { getConnectIntegration } from '@/lib/connect/connectCatalog';
import type { AccountingProviderKey } from '@/types/accounting';

export const ACCOUNTING_PROVIDER_KEYS: readonly AccountingProviderKey[] = [
  'datev',
  'lexware_office',
  'sevdesk',
  'fastbill',
  'agenda',
  'steuerberater_export',
  'gobd_archiv',
] as const;

export const ACCOUNTING_EXPORT_PROVIDER_KEYS: readonly AccountingProviderKey[] = [
  'datev',
  'lexware_office',
  'sevdesk',
  'fastbill',
  'agenda',
  'steuerberater_export',
] as const;

export function isAccountingProviderKey(key: string): key is AccountingProviderKey {
  return (ACCOUNTING_PROVIDER_KEYS as readonly string[]).includes(key);
}

export function getAccountingProviderCatalogLabel(providerKey: AccountingProviderKey): string {
  const integration = getConnectIntegration('accounting', providerKey);
  return integration?.label ?? providerKey;
}

export function isAccountingProviderProductive(_providerKey: AccountingProviderKey): boolean {
  return false;
}
