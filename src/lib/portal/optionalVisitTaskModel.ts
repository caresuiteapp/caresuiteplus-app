import { ASSIST_CATALOG_TASKS } from '@/data/assist/assistTaskCatalog';
import { ASSIST_LEISTUNGSBEREICH_LABELS } from '@/types/modules/assist/assistTaskCatalog';
import { validateAssistTaskTitle } from '@/lib/assist/assistTaskGuardService';
import { isUuid } from '@/lib/validation/uuid';
export { mergeConfirmedOptionalTasks } from './mergeConfirmedVisitTasks';

export const OPTIONAL_VISIT_TASKS_RELEASE = 'caresuite-optional-visit-tasks-20261008';
export const OPTIONAL_TASK_TITLE_LIMIT = 300;
export const OPTIONAL_TASK_BATCH_LIMIT = 25;
export type OptionalVisitTaskDraft = { id: string; title: string; catalogId?: string };
export type OptionalTaskChoice = { id: string; title: string; description: string; category: string };

export function cleanOptionalTaskTitle(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

export function optionalTaskTitleKey(value: string): string {
  return cleanOptionalTaskTitle(value).toLocaleLowerCase('de-DE');
}

function searchKey(value: string): string {
  return optionalTaskTitleKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
}

const uniqueChoices = new Map<string, OptionalTaskChoice>();
for (const task of ASSIST_CATALOG_TASKS) {
  if (!validateAssistTaskTitle(task.title, task.description).ok) continue;
  const key = optionalTaskTitleKey(task.title);
  if (!uniqueChoices.has(key)) uniqueChoices.set(key, { id: task.id, title: task.title,
    description: task.description, category: ASSIST_LEISTUNGSBEREICH_LABELS[task.leistungsbereich] });
}
export const OPTIONAL_TASK_CHOICES = [...uniqueChoices.values()];

/** Search descriptions and German category labels too; existing tasks remain visibly marked. */
export function searchOptionalTaskChoices(query: string): OptionalTaskChoice[] {
  const words = searchKey(query).split(' ').filter(Boolean);
  return OPTIONAL_TASK_CHOICES.filter(choice => {
    const text = searchKey(`${choice.title} ${choice.description} ${choice.category}`);
    return words.every(word => text.includes(word));
  });
}

export function validateOptionalTaskDrafts(drafts: OptionalVisitTaskDraft[]):
  { ok: true; data: OptionalVisitTaskDraft[] } | { ok: false; error: string } {
  if (!Array.isArray(drafts) || !drafts.length || drafts.length > OPTIONAL_TASK_BATCH_LIMIT)
    return { ok: false, error: `Bitte wählen Sie eine bis ${OPTIONAL_TASK_BATCH_LIMIT} Aufgaben aus.` };
  const ids = new Set<string>(), titles = new Set<string>();
  const data: OptionalVisitTaskDraft[] = [];
  for (const draft of drafts) {
    if (!draft || !isUuid(draft.id) || typeof draft.title !== 'string')
      return { ok: false, error: 'Die Aufgabenauswahl ist unvollständig. Bitte erneut auswählen.' };
    const title = cleanOptionalTaskTitle(draft.title);
    if (!title || Array.from(title).length > OPTIONAL_TASK_TITLE_LIMIT || /[\u0000-\u001f\u007f]/u.test(title))
      return { ok: false, error: `Bitte geben Sie eine Aufgabe mit höchstens ${OPTIONAL_TASK_TITLE_LIMIT} Zeichen ein.` };
    const validation = validateAssistTaskTitle(title);
    if (!validation.ok) return { ok: false, error: 'Bitte tragen Sie eine Alltags- oder Unterstützungsaufgabe ein. Medizinische und pflegerische Tätigkeiten werden im Pflegebereich erfasst.' };
    if (draft.catalogId !== undefined && !OPTIONAL_TASK_CHOICES.some(choice => choice.id === draft.catalogId && optionalTaskTitleKey(choice.title) === optionalTaskTitleKey(title)))
      return { ok: false, error: 'Die gewählte Vorlage konnte nicht bestätigt werden.' };
    if (ids.has(draft.id) || titles.has(optionalTaskTitleKey(title)))
      return { ok: false, error: 'Eine Aufgabe wurde mehrfach ausgewählt. Bitte die Auswahl prüfen.' };
    ids.add(draft.id); titles.add(optionalTaskTitleKey(title));
    data.push({ id: draft.id, title, ...(draft.catalogId ? { catalogId: draft.catalogId } : {}) });
  }
  return { ok: true, data };
}
