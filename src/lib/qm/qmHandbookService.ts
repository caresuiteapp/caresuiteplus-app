import type { RoleKey, ServiceResult } from '@/types';
import { blockDemoOnlyInLiveMode, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { qmSupabaseRepository } from './qmRepository.supabase';
import { enforceQmPermission, QM_MANAGE_HANDBOOK, QM_VIEW } from './qmPermissions';
import type { QmHandbook, QmHandbookChapter } from './qm.types';

export async function fetchQmHandbook(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmHandbook>> {
  const denied = enforceQmPermission<QmHandbook>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return qmSupabaseRepository.getHandbookMapped(tenantId);
}

export async function fetchQmChapters(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmHandbookChapter[]>> {
  const denied = enforceQmPermission<QmHandbookChapter[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return qmSupabaseRepository.listChaptersMapped(tenantId);
}

export async function fetchQmChapter(
  tenantId: string,
  chapterId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmHandbookChapter>> {
  const denied = enforceQmPermission<QmHandbookChapter>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return qmSupabaseRepository.getChapterMapped(tenantId, chapterId);
}

export async function createQmChapter(
  tenantId: string,
  input: { handbookId: string; parentId: string | null; title: string; content: string; sortOrder: number },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmHandbookChapter>> {
  const denied = enforceQmPermission<QmHandbookChapter>(actorRoleKey, QM_MANAGE_HANDBOOK);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const liveBlock = blockDemoOnlyInLiveMode<QmHandbookChapter>('QM-Handbuch');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Handbuch im Live-Modus noch nicht vollständig angebunden.' };
}

export async function updateQmChapter(
  tenantId: string,
  chapterId: string,
  patch: Partial<Pick<QmHandbookChapter, 'title' | 'content' | 'status'>>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmHandbookChapter>> {
  const denied = enforceQmPermission<QmHandbookChapter>(actorRoleKey, QM_MANAGE_HANDBOOK);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const liveBlock = blockDemoOnlyInLiveMode<QmHandbookChapter>('QM-Handbuch');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Handbuch im Live-Modus noch nicht vollständig angebunden.' };
}

export async function versionQmChapter(
  tenantId: string,
  chapterId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmHandbookChapter>> {
  const denied = enforceQmPermission<QmHandbookChapter>(actorRoleKey, QM_MANAGE_HANDBOOK);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const liveBlock = blockDemoOnlyInLiveMode<QmHandbookChapter>('QM-Handbuch');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Handbuch im Live-Modus noch nicht vollständig angebunden.' };
}
