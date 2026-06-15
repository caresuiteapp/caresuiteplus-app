import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { qmDemoRepository } from './qmRepository.demo';
import { qmSupabaseRepository } from './qmRepository.supabase';
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

  if (getServiceMode() === 'supabase') {
    return qmSupabaseRepository.listDocumentsMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 120));
  return qmDemoRepository.listDocuments(tenantId);
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

  if (getServiceMode() === 'supabase') {
    return qmSupabaseRepository.getDocumentMapped(tenantId, documentId);
  }

  const result = await qmDemoRepository.getDocument(tenantId, documentId);
  if (!result.ok) return result;
  if (!result.data) return { ok: false, error: 'Dokument nicht gefunden.' };
  return { ok: true, data: result.data };
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

  if (getServiceMode() === 'supabase') {
    return qmSupabaseRepository.listDocumentVersionsMapped(tenantId, documentId);
  }

  return qmDemoRepository.listDocumentVersions(tenantId, documentId);
}

export async function approveQmDocument(
  tenantId: string,
  documentId: string,
  approvedBy: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmDocument>> {
  const denied = enforceQmPermission<QmDocument>(actorRoleKey, QM_APPROVE_DOCUMENT);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return qmDemoRepository.approveDocument(tenantId, documentId, approvedBy);
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

  if (getServiceMode() === 'supabase') {
    return qmSupabaseRepository.listReadConfirmationsMapped(tenantId, documentId);
  }

  return qmDemoRepository.listReadConfirmations(tenantId, documentId);
}
