import {
  ASSIST_FORBIDDEN_TASK_KEYWORDS,
  ASSIST_LEISTUNGSBEREICH_LABELS,
  type AssistLeistungsbereichKey,
} from '@/types/modules/assist/assistTaskCatalog';
import { ASSIST_MEDICAL_CARE_KEYWORDS } from '@/types/assistServiceCatalog';

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function findForbiddenKeyword(text: string): string | null {
  const normalized = normalizeText(text);
  for (const keyword of ASSIST_FORBIDDEN_TASK_KEYWORDS) {
    if (normalized.includes(keyword)) return keyword;
  }
  for (const keyword of ASSIST_MEDICAL_CARE_KEYWORDS) {
    if (normalized.includes(keyword)) return keyword;
  }
  return null;
}

export type AssistTaskValidationResult =
  | { ok: true }
  | { ok: false; error: string; keyword: string };

/** Prüft, ob eine Aufgabe im Assist-Modul verboten ist (Behandlungspflege). */
export function validateAssistTaskTitle(
  title: string,
  description = '',
): AssistTaskValidationResult {
  const combined = `${title} ${description}`;
  const keyword = findForbiddenKeyword(combined);

  if (keyword) {
    return {
      ok: false,
      keyword,
      error:
        `„${title.trim()}" ist keine Assist-Leistung (${keyword}). ` +
        'Medizinische und pflegerische Aufgaben gehören in das Pflege-Modul, nicht in CareSuite+ Assist.',
    };
  }

  return { ok: true };
}

export function isForbiddenAssistTask(title: string, description = ''): boolean {
  return !validateAssistTaskTitle(title, description).ok;
}

export function getAssistModuleBoundaryWarning(leistungsbereich?: AssistLeistungsbereichKey): string {
  const bereich = leistungsbereich
    ? ASSIST_LEISTUNGSBEREICH_LABELS[leistungsbereich]
    : 'Assist';
  return (
    `${bereich} — CareSuite+ Assist (keine Behandlungspflege). ` +
    'Verboten: Medikamentengabe, Injektionen, Wundversorgung, Insulin, medizinische Beratung, Diagnosen.'
  );
}
