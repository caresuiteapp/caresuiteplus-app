import type { PortalOfficeAudience } from '@/lib/office/portalofficemessageservice';

export type PortalNewChatDraft = {
  subject: string;
  initialMessage: string;
  categoryId: string | null;
  updatedAt: number;
};

// Native has no sessionStorage. Keep unsent drafts across screen changes in this app session.
const sessionDrafts = new Map<string, PortalNewChatDraft>();

const STORAGE_PREFIX = 'portal-new-chat-draft-';

function storageKey(tenantId: string, audience: PortalOfficeAudience, actorId: string | null): string {
  return `${STORAGE_PREFIX}${tenantId}:${audience}:${actorId ?? 'anonymous'}`;
}

export function readPortalNewChatDraft(
  tenantId: string | null,
  audience: PortalOfficeAudience,
  actorId: string | null,
): PortalNewChatDraft | null {
  if (!tenantId?.trim()) return null;
  const key = storageKey(tenantId, audience, actorId);
  if (typeof globalThis.sessionStorage === 'undefined') return sessionDrafts.get(key) ?? null;

  try {
    const raw = globalThis.sessionStorage.getItem(storageKey(tenantId, audience, actorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalNewChatDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      initialMessage: typeof parsed.initialMessage === 'string' ? parsed.initialMessage : '',
      categoryId: typeof parsed.categoryId === 'string' ? parsed.categoryId : null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writePortalNewChatDraft(
  tenantId: string | null,
  audience: PortalOfficeAudience,
  actorId: string | null,
  draft: Omit<PortalNewChatDraft, 'updatedAt'>,
): void {
  if (!tenantId?.trim()) return;

  sessionDrafts.set(storageKey(tenantId, audience, actorId), { ...draft, updatedAt: Date.now() });
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.setItem(
      storageKey(tenantId, audience, actorId),
      JSON.stringify({ ...draft, updatedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearPortalNewChatDraft(
  tenantId: string | null,
  audience: PortalOfficeAudience,
  actorId: string | null,
): void {
  if (!tenantId?.trim()) return;

  sessionDrafts.delete(storageKey(tenantId, audience, actorId));
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.removeItem(storageKey(tenantId, audience, actorId));
  } catch {
    /* ignore */
  }
}
