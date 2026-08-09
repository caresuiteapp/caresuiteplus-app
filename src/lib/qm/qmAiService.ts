import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { blockDemoOnlyInLiveMode } from '@/lib/services/liveServiceGuard';
import { enforceQmPermission, QM_USE_AI, QM_VIEW } from './qmPermissions';
import type { QmAiDraft, QmAiDraftAction, QmTemplateSeed } from './qm.types';
import { qmDemoRepository } from './qmRepository.demo';
import { getServiceMode } from '@/lib/services/mode';

export async function fetchQmAiDrafts(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft[]>> {
  const denied = enforceQmPermission<QmAiDraft[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.listAiDrafts(tenantId);
  const liveBlock = blockDemoOnlyInLiveMode<QmAiDraft[]>('QM-KI');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
}

export async function createQmAiDraft(
  tenantId: string,
  input: {
    action: QmAiDraftAction;
    targetDocumentId?: string | null;
    targetChapterId?: string | null;
    promptSummary: string;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft>> {
  const denied = enforceQmPermission<QmAiDraft>(actorRoleKey, QM_USE_AI);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') {
    return qmDemoRepository.createAiDraft(tenantId, {
      ...input,
      targetDocumentId: input.targetDocumentId ?? null,
      targetChapterId: input.targetChapterId ?? null,
      suggestedContent: `Entwurf: ${input.promptSummary}`,
    });
  }
  const liveBlock = blockDemoOnlyInLiveMode<QmAiDraft>('QM-KI');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-KI im Live-Modus noch nicht vollständig angebunden.' };
}

export async function acceptQmAiDraft(
  tenantId: string,
  draftId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft>> {
  const denied = enforceQmPermission<QmAiDraft>(actorRoleKey, QM_USE_AI);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.updateAiDraft(tenantId, draftId, 'accepted');
  const liveBlock = blockDemoOnlyInLiveMode<QmAiDraft>('QM-KI');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-KI im Live-Modus noch nicht vollständig angebunden.' };
}

export async function rejectQmAiDraft(
  tenantId: string,
  draftId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft>> {
  const denied = enforceQmPermission<QmAiDraft>(actorRoleKey, QM_USE_AI);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.updateAiDraft(tenantId, draftId, 'rejected');
  const liveBlock = blockDemoOnlyInLiveMode<QmAiDraft>('QM-KI');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-KI im Live-Modus noch nicht vollständig angebunden.' };
}

export async function fetchQmTemplates(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmTemplateSeed[]>> {
  const denied = enforceQmPermission<QmTemplateSeed[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.listTemplates(tenantId);
  const liveBlock = blockDemoOnlyInLiveMode<QmTemplateSeed[]>('QM-Vorlagen');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
}
