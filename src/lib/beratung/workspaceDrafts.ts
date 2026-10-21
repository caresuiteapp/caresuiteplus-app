import type { ConsultationAnswers } from './workspaceModel';
import type { ConsultationContactDraft } from './firstContact';
export type ConsultationDraft = {
    answers: ConsultationAnswers;
    base: ConsultationAnswers;
    version: number;
    updatedAt: number;
};
let activeScope: string | null = null;
const drafts = new Map<string, ConsultationDraft>();
let contactDraft: { value: ConsultationContactDraft; updatedAt: number } | null = null;
const MAX_AGE = 60 * 60 * 1000;
/** Memory only: no health information is put in browser storage. */
export function activateConsultationDraftScope(scope: string) { if (activeScope !== scope) {
    drafts.clear();
    contactDraft = null;
    activeScope = scope;
} }
export function readConsultationDraft(scope: string, id: string): ConsultationDraft | null {
    if (scope !== activeScope)
        return null;
    const value = drafts.get(id);
    if (!value)
        return null;
    if (Date.now() - value.updatedAt > MAX_AGE) {
        drafts.delete(id);
        return null;
    }
    return structuredClone(value);
}
export function keepConsultationDraft(scope: string, id: string, draft: Omit<ConsultationDraft, 'updatedAt'>) {
    if (scope !== activeScope)
        return;
    for (const [key, value] of drafts)
        if (Date.now() - value.updatedAt > MAX_AGE)
            drafts.delete(key);
    drafts.set(id, { ...structuredClone(draft), updatedAt: Date.now() });
}
export function clearConsultationDraft(scope: string, id: string) { if (scope === activeScope)
    drafts.delete(id); }
export function readConsultationContactDraft(scope: string): ConsultationContactDraft | null {
    if (scope !== activeScope || !contactDraft || Date.now() - contactDraft.updatedAt > MAX_AGE) return null;
    return structuredClone(contactDraft.value);
}
export function keepConsultationContactDraft(scope: string, value: ConsultationContactDraft) {
    if (scope === activeScope) contactDraft = { value: structuredClone(value), updatedAt: Date.now() };
}
export function clearConsultationContactDraft(scope: string) { if (scope === activeScope) contactDraft = null; }
export function clearConsultationDrafts() { drafts.clear(); contactDraft = null; activeScope = null; }
