import { buildTenantStoragePath } from '@/lib/storage/storagePaths';

export const ASSIST_EXECUTION_STORAGE_BUCKET = 'office-documents';

export function buildAssistVisitSignatureStoragePath(
  tenantId: string,
  visitId: string,
  signatureId: string,
): string {
  return buildTenantStoragePath(tenantId, 'assist', 'visits', visitId, 'signatures', `${signatureId}.png`);
}

export function buildAssistVisitProofStoragePath(
  tenantId: string,
  visitId: string,
  proofId: string,
  extension: 'json' | 'pdf' = 'json',
): string {
  return buildTenantStoragePath(tenantId, 'assist', 'visits', visitId, 'proofs', `${proofId}.${extension}`);
}
