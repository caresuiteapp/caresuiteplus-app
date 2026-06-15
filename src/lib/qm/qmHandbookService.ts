import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { qmDemoRepository } from './qmRepository.demo';
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

  if (getServiceMode() === 'supabase') {
    return qmSupabaseRepository.getHandbookMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 120));
  return qmDemoRepository.getHandbook(tenantId);
}

export async function fetchQmChapters(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmHandbookChapter[]>> {
  const denied = enforceQmPermission<QmHandbookChapter[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return qmSupabaseRepository.listChaptersMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 120));
  return qmDemoRepository.listChapters(tenantId);
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

  if (getServiceMode() === 'supabase') {
    return qmSupabaseRepository.getChapterMapped(tenantId, chapterId);
  }

  const result = await qmDemoRepository.getChapter(tenantId, chapterId);
  if (!result.ok) return result;
  if (!result.data) return { ok: false, error: 'Kapitel nicht gefunden.' };
  return { ok: true, data: result.data };
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
  return qmDemoRepository.createChapter(tenantId, {
    handbookId: input.handbookId,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
    title: input.title,
    content: input.content,
    version: '1.0',
    status: 'draft',
    lastReviewedAt: null,
  });
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
  return qmDemoRepository.updateChapter(tenantId, chapterId, patch);
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
  return qmDemoRepository.versionChapter(tenantId, chapterId);
}
