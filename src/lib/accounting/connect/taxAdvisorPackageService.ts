import type { ServiceResult } from '@/types';
import type { AccountingExportFormat } from '@/types/accounting';
import type { TaxAdvisorPackage } from '@/types/connect/accounting';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { appendAccountingConnectAudit } from './accountingExportService';
import { saveTaxAdvisorPackage, listTaxAdvisorPackages } from './accountingConnectStore';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PrepareTaxAdvisorPackageInput = {
  tenantId: string;
  invoiceIds: string[];
  invoiceNumbers: string[];
  formats?: AccountingExportFormat[];
  preparedBy?: string | null;
};

export function prepareTaxAdvisorPackageZip(
  input: PrepareTaxAdvisorPackageInput,
): ServiceResult<TaxAdvisorPackage> {
  const liveBlock = guardLiveDemoFeature<TaxAdvisorPackage>(input.tenantId, 'Steuerberater-Paket');
  if (liveBlock) return liveBlock;

  if (input.invoiceIds.length === 0) {
    return { ok: false, error: 'Steuerberater-Paket erfordert mindestens eine Rechnung.' };
  }

  const formats = input.formats?.length ? input.formats : (['csv', 'xml', 'pdf'] as AccountingExportFormat[]);
  const now = new Date().toISOString();
  const packageId = newId('tax-pkg');
  const labelNumbers = input.invoiceNumbers.slice(0, 3).join(', ');
  const suffix = input.invoiceNumbers.length > 3 ? '…' : '';

  const pkg: TaxAdvisorPackage = {
    id: packageId,
    tenantId: input.tenantId,
    packageLabel: `Steuerberater-ZIP (${labelNumbers}${suffix})`,
    formats,
    status: 'prepared',
    itemCount: input.invoiceIds.length,
    zipReference: `preparation://${packageId}/steuerberater.zip.stub`,
    externalTransfer: false,
    errorSummary: null,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };

  saveTaxAdvisorPackage(input.tenantId, pkg);
  appendAccountingConnectAudit(
    input.tenantId,
    'steuerberater_package_prepared',
    `Steuerberater-Paket vorbereitet (${formats.join('/')}) — ZIP-Stub, keine Übergabe.`,
    { exportId: packageId },
  );

  return { ok: true, data: pkg };
}

export function listTenantTaxAdvisorPackages(tenantId: string): TaxAdvisorPackage[] {
  return listTaxAdvisorPackages(tenantId);
}
