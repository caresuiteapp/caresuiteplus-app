import type { AccountingConnectDashboard } from '@/types/connect/accounting';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import type { ServiceResult } from '@/types';
import {
  getAccountingConnectStoreSnapshot,
  listAccountingAuditEvents,
  listBankImports,
  listBankTransactions,
  listExportBatches,
  listExportErrors,
  listPaymentSuggestions,
  listTaxAdvisorPackages,
} from './accountingConnectStore';

export function fetchAccountingConnectDashboard(
  tenantId: string,
): ServiceResult<AccountingConnectDashboard> {
  const liveBlock = guardLiveDemoFeature<AccountingConnectDashboard>(
    tenantId,
    'Buchhaltungs-Dashboard',
  );
  if (liveBlock) return liveBlock;

  return {
    ok: true,
    data: {
      exportBatches: listExportBatches(tenantId),
      exportErrors: listExportErrors(tenantId),
      taxAdvisorPackages: listTaxAdvisorPackages(tenantId),
      bankImports: listBankImports(tenantId),
      bankTransactions: listBankTransactions(tenantId),
      paymentSuggestions: listPaymentSuggestions(tenantId),
      auditEvents: listAccountingAuditEvents(tenantId),
    },
  };
}

export function getAccountingConnectStoreForTests(tenantId: string) {
  return getAccountingConnectStoreSnapshot(tenantId);
}
