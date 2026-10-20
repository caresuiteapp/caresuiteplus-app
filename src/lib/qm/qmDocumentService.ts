import type { RoleKey, ServiceResult } from '@/types';
import { blockDemoOnlyInLiveMode, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { qmSupabaseRepository } from './qmRepository.supabase';
import { qmDemoRepository } from './qmRepository.demo';
import { getServiceMode } from '@/lib/services/mode';
import {
  enforceQmPermission,
  QM_APPROVE_DOCUMENT,
  QM_VIEW,
  QM_VIEW_VERSIONS,
} from './qmPermissions';
import type { QmDocument, QmDocumentVersion, QmReadConfirmation } from './qm.types';

export async function fetchQmDocuments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmDocument[]>> {
  const denied = enforceQmPermission<QmDocument[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return getServiceMode() === 'demo'
    ? qmDemoRepository.listDocuments(tenantId)
    : qmSupabaseRepository.listDocumentsMapped(tenantId);
}

export async function fetchQmDocument(
  tenantId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmDocument>> {
  const denied = enforceQmPermission<QmDocument>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'demo') {
    const result = await qmDemoRepository.getDocument(tenantId, documentId);
    return result.ok && !result.data ? { ok: false, error: 'Dokument nicht gefunden.' } : result as ServiceResult<QmDocument>;
  }
  return qmSupabaseRepository.getDocumentMapped(tenantId, documentId);
}

export async function fetchQmDocumentVersions(
  tenantId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmDocumentVersion[]>> {
  const denied = enforceQmPermission<QmDocumentVersion[]>(actorRoleKey, QM_VIEW_VERSIONS);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return getServiceMode() === 'demo'
    ? qmDemoRepository.listDocumentVersions(tenantId, documentId)
    : qmSupabaseRepository.listDocumentVersionsMapped(tenantId, documentId);
}

export async function approveQmDocument(
  tenantId: string,
  documentId: string,
  _approvedBy: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmDocument>> {
  const denied = enforceQmPermission<QmDocument>(actorRoleKey, QM_APPROVE_DOCUMENT);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'demo') return qmDemoRepository.approveDocument(tenantId, documentId, _approvedBy);
  const liveBlock = blockDemoOnlyInLiveMode<QmDocument>('QM-Dokumente');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Dokumente im Live-Modus noch nicht vollständig angebunden.' };
}

export async function fetchQmReadConfirmations(
  tenantId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmReadConfirmation[]>> {
  const denied = enforceQmPermission<QmReadConfirmation[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return getServiceMode() === 'demo'
    ? qmDemoRepository.listReadConfirmations(tenantId, documentId)
    : qmSupabaseRepository.listReadConfirmationsMapped(tenantId, documentId);
}
