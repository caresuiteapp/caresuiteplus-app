import type { AccountingExportFormat } from '@/types/accounting';
import type { AccountingProviderKey } from '@/types/accounting';

export function resolveExportFormat(providerKey: AccountingProviderKey): AccountingExportFormat | null {
  switch (providerKey) {
    case 'datev':
      return 'datev';
    case 'lexware_office':
      return 'lexware';
    case 'sevdesk':
      return 'sevdesk';
    case 'steuerberater_export':
      return 'csv';
    default:
      return 'csv';
  }
}
