import type { RoleKey, ServiceResult } from '@/types';
import type {
  OfficeCreateSignatureDocumentInput,
  PortalSignatureDashboardCounts,
  PortalSignatureDocument,
  PortalSignatureDocumentDetail,
  PortalSignatureFilterTab,
  PortalSignDocumentInput,
} from '@/types/portal/documentSignatures';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import {
  countPortalSignatureDashboard,
  filterPortalSignatureDocuments,
} from '@/lib/portal/portalDocumentSignatureHelpers';
import {
  createLiveOfficeSignatureDocument,
  fetchLiveOfficeSignatureDocuments,
  fetchLivePortalSignatureDashboardCounts,
  fetchLivePortalSignatureDocumentDetail,
  fetchLivePortalSignatureDocuments,
  signLivePortalDocument,
  withdrawLiveOfficeSignatureDocument,
} from '@/lib/portal/portalDocumentSignatureLiveService';

export {
  countPortalSignatureDashboard,
  filterPortalSignatureDocuments,
} from '@/lib/portal/portalDocumentSignatureHelpers';

function requireLiveMode<T>(): ServiceResult<T> | null {
  if (getServiceMode() !== 'supabase') {
    return {
      ok: false,
      error: 'Signaturdokumente sind nur im Live-Modus (Supabase) verfügbar.',
    };
  }
  return null;
}

export async function fetchPortalSignatureDocuments(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  tab: PortalSignatureFilterTab = 'open',
): Promise<ServiceResult<PortalSignatureDocument[]>> {
  const denied = enforcePermission<PortalSignatureDocument[]>(
    roleKey,
    'portal.employee.signatures.view',
  );
  if (denied) return denied;

  const liveBlock = requireLiveMode<PortalSignatureDocument[]>();
  if (liveBlock) return liveBlock;

  return fetchLivePortalSignatureDocuments(tenantId, employeeId, tab);
}

export async function fetchPortalSignatureDocumentDetail(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  documentId: string,
): Promise<ServiceResult<PortalSignatureDocumentDetail>> {
  const denied = enforcePermission<PortalSignatureDocumentDetail>(
    roleKey,
    'portal.employee.signatures.view',
  );
  if (denied) return denied;

  const liveBlock = requireLiveMode<PortalSignatureDocumentDetail>();
  if (liveBlock) return liveBlock;

  return fetchLivePortalSignatureDocumentDetail(tenantId, employeeId, documentId);
}

export async function signPortalDocument(
  input: PortalSignDocumentInput,
  roleKey: RoleKey | null,
  signerProfileId?: string | null,
): Promise<ServiceResult<PortalSignatureDocumentDetail>> {
  const denied = enforcePermission<PortalSignatureDocumentDetail>(
    roleKey,
    'portal.employee.signatures.sign',
  );
  if (denied) return denied;

  if (!input.signerName.trim()) {
    return { ok: false, error: 'Name für Unterschrift erforderlich.' };
  }

  const liveBlock = requireLiveMode<PortalSignatureDocumentDetail>();
  if (liveBlock) return liveBlock;

  return signLivePortalDocument(input, signerProfileId);
}

export async function fetchPortalSignatureDashboardCounts(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDashboardCounts>> {
  const denied = enforcePermission<PortalSignatureDashboardCounts>(
    roleKey,
    'portal.employee.signatures.view',
  );
  if (denied) return denied;

  const liveBlock = requireLiveMode<PortalSignatureDashboardCounts>();
  if (liveBlock) return liveBlock;

  return fetchLivePortalSignatureDashboardCounts(tenantId, employeeId);
}

export async function createOfficeSignatureDocument(
  input: OfficeCreateSignatureDocumentInput,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDocument>> {
  const denied = enforcePermission<PortalSignatureDocument>(
    roleKey,
    'office.documents.signatures.manage',
  );
  if (denied) return denied;

  const liveBlock = requireLiveMode<PortalSignatureDocument>();
  if (liveBlock) return liveBlock;

  if (!input.title.trim()) {
    return { ok: false, error: 'Dokumenttitel erforderlich.' };
  }

  return createLiveOfficeSignatureDocument(input);
}

export async function fetchOfficeSignatureDocuments(
  tenantId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDocument[]>> {
  const denied = enforcePermission<PortalSignatureDocument[]>(
    roleKey,
    'office.documents.signatures.view',
  );
  if (denied) return denied;

  const liveBlock = requireLiveMode<PortalSignatureDocument[]>();
  if (liveBlock) return liveBlock;

  return fetchLiveOfficeSignatureDocuments(tenantId);
}

export async function withdrawOfficeSignatureDocument(
  tenantId: string,
  documentId: string,
  roleKey: RoleKey | null,
  actorName: string,
): Promise<ServiceResult<PortalSignatureDocument>> {
  const denied = enforcePermission<PortalSignatureDocument>(
    roleKey,
    'office.documents.signatures.manage',
  );
  if (denied) return denied;

  const liveBlock = requireLiveMode<PortalSignatureDocument>();
  if (liveBlock) return liveBlock;

  return withdrawLiveOfficeSignatureDocument(tenantId, documentId, actorName);
}

/** @deprecated Demo-Store entfernt — Live-only. */
export function resetPortalDocumentSignatureStore(): void {
  // no-op
}
