import { caseHandoverVersion, handoverObject, type CaseHandoverContext, type HandoverContent } from './caseHandoverDomain.web.ts';
import { sameWoundJson, woundUuid } from './woundCareDomain.ts';
import type { HandoverScope, JournalStorage } from './caseHandoverWorkflow.web.ts';

export type HandoverEditorDraft = {
  version: typeof caseHandoverVersion; scope: HandoverScope; previousHeadId: string | null; reason: string;
  content: Omit<HandoverContent, 'emergency'> & { emergency: Omit<HandoverContent['emergency'], 'reviewed'> & { reviewed: boolean } };
};
export function handoverDraftKey(scope: HandoverScope, previousHeadId: string | null) {
  if (![scope.tenantId, scope.clientId, scope.actorId, ...(previousHeadId ? [previousHeadId] : [])].every(woundUuid)) throw Error('Der Entwurfskontext ist ungültig.');
  return `caresuite.case-handover-draft.v1:${scope.tenantId}:${scope.actorId}:${scope.clientId}:${previousHeadId ?? 'new'}`;
}
function inspectDraft(v: unknown, scope: HandoverScope, head: string | null): asserts v is HandoverEditorDraft {
  if (!handoverObject(v) || Object.keys(v).sort().join(',') !== 'content,previousHeadId,reason,scope,version' || v.version !== caseHandoverVersion ||
    !sameWoundJson(v.scope, scope) || v.previousHeadId !== head || typeof v.reason !== 'string' || v.reason.length > 4000 || !handoverObject(v.content)) throw Error('Der Entwurf ist beschädigt oder gehört zu einem anderen Konto, Fall oder Fassungsstand.');
  const c = v.content;
  if (Object.keys(c).sort().join(',') !== 'client,documents,emergency,priority,recipients,sources,summary,tasks,title' ||
    !['title', 'summary'].every(k => typeof c[k] === 'string' && (c[k] as string).length <= (k === 'title' ? 200 : 8000)) ||
    !['normal', 'important', 'urgent', 'critical'].includes(String(c.priority)) || !handoverObject(c.client) || c.client.id !== scope.clientId || c.client.tenant_id !== scope.tenantId ||
    !['sources', 'tasks', 'documents', 'recipients'].every(k => Array.isArray(c[k]) && (c[k] as unknown[]).length <= 1000) || !handoverObject(c.emergency)) throw Error('Der gesicherte Entwurf ist unvollständig.');
  const e = c.emergency;
  if (Object.keys(e).sort().join(',') !== 'accessNote,contacts,limitations,plans,reviewed,risks' || !['contacts', 'risks', 'plans'].every(k => Array.isArray(e[k]) && (e[k] as unknown[]).length <= 1000) ||
    typeof e.accessNote !== 'string' || e.accessNote.length > 2000 || typeof e.limitations !== 'string' || e.limitations.length > 4000 || typeof e.reviewed !== 'boolean') throw Error('Die gespeicherten Notfallangaben sind unvollständig.');
}
export function saveHandoverDraft(storage: JournalStorage, draft: HandoverEditorDraft) {
  inspectDraft(draft, draft.scope, draft.previousHeadId);
  const raw = JSON.stringify(draft);
  if (raw.length > 750000 || !sameWoundJson(JSON.parse(raw), draft)) throw Error('Der Entwurf ist zu umfangreich oder nicht vollständig sicherbar.');
  const key = handoverDraftKey(draft.scope, draft.previousHeadId); storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw Error('Der Entwurf konnte auf diesem Gerät nicht bestätigt gesichert werden.');
}
/** Drafts never serve as current clinical originals. Revalidate every selected native row. */
export function restoreHandoverDraft(storage: JournalStorage, scope: HandoverScope, head: string | null, current: CaseHandoverContext): { draft: HandoverEditorDraft; changed: boolean } | null {
  const raw = storage.getItem(handoverDraftKey(scope, head)); if (raw === null) return null;
  if (raw.length > 750000) throw Error('Der gespeicherte Entwurf ist zu umfangreich.');
  const v: unknown = JSON.parse(raw); inspectDraft(v, scope, head);
  const c = v.content;
  const members = (selected: unknown[], pool: unknown[]) => selected.every(item => pool.some(p => sameWoundJson(p, item)));
  const changed = !sameWoundJson(c.client, current.client) || !members(c.sources, current.sources) || !members(c.tasks, current.controls) ||
    !members(c.recipients, current.recipients.rows) || !members(c.documents.map(d => d.document), current.documents.rows) ||
    !members(c.emergency.contacts, current.contacts.rows) || !members(c.emergency.risks, current.risks.rows) || !members(c.emergency.plans, current.sources);
  const draft = structuredClone(v); draft.content.client = structuredClone(current.client); draft.content.emergency.reviewed = false;
  if (changed) {
    draft.content.sources = []; draft.content.tasks = []; draft.content.documents = []; draft.content.recipients = [];
    draft.content.emergency.contacts = []; draft.content.emergency.risks = []; draft.content.emergency.plans = [];
  }
  return { draft, changed };
}
export function discardHandoverDraft(storage: JournalStorage, scope: HandoverScope, head: string | null) {
  const key = handoverDraftKey(scope, head); storage.removeItem(key);
  if (storage.getItem(key) !== null) throw Error('Der lokale Entwurf konnte nicht entfernt werden.');
}
