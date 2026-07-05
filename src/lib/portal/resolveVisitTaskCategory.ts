import { ASSIST_SUBCATEGORY_LABELS, type AssistSubcategoryKey } from '@/types/modules/assist/assistTaskCatalog';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import type { VisitTaskCategoryKey } from '@/lib/portal/groupEmployeePortalTasks';
import { VISIT_TASK_CATEGORY_LABELS } from '@/lib/portal/groupEmployeePortalTasks';

const CATEGORY_ALIASES: Record<string, VisitTaskCategoryKey> = {
  haushalt: 'haushalt',
  haushaltshilfe: 'haushalt',
  haeusliche_alltagsunterstuetzung: 'haushalt',
  waesche: 'haushalt',
  betreuung: 'betreuung',
  begleitung: 'betreuung',
  soziale_betreuung: 'betreuung',
  demenzbegleitung: 'betreuung',
  aktivierung: 'betreuung',
  einkauf: 'einkauf',
  pflege: 'pflege',
  koerperpflege: 'pflege',
  mobilisation: 'pflege',
  ernaehrung: 'pflege',
  medikation: 'pflege',
  standard: 'sonstiges',
  service: 'sonstiges',
  dokumentation: 'sonstiges',
  einsatzvorbereitung: 'sonstiges',
  sicherheitsbeobachtung: 'sonstiges',
  tagesstruktur: 'betreuung',
};

function normalizeKey(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function resolveVisitTaskCategory(task: EmployeePortalTaskItem): {
  key: VisitTaskCategoryKey;
  label: string;
} {
  if (task.categoryLabel?.trim()) {
    const normalized = normalizeKey(task.categoryKey ?? task.categoryLabel);
    const mapped = CATEGORY_ALIASES[normalized] ?? 'sonstiges';
    return { key: mapped, label: task.categoryLabel.trim() };
  }

  const normalized = normalizeKey(task.categoryKey);
  if (normalized) {
    const mapped = CATEGORY_ALIASES[normalized] ?? 'sonstiges';
    const catalogLabel = ASSIST_SUBCATEGORY_LABELS[normalized as AssistSubcategoryKey];
    return {
      key: mapped,
      label: catalogLabel ?? humanizeCategoryKey(normalized) ?? VISIT_TASK_CATEGORY_LABELS[mapped],
    };
  }

  return inferFromTitle(task);
}

function humanizeCategoryKey(key: string): string | null {
  if (!key) return null;
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const CATEGORY_KEYWORDS: Record<Exclude<VisitTaskCategoryKey, 'sonstiges'>, string[]> = {
  haushalt: ['haushalt', 'staub', 'wisch', 'putz', 'geschirr', 'müll', 'fenster', 'bügel', 'wäsche'],
  betreuung: ['betreu', 'begleit', 'spazier', 'aktivier', 'demenz', 'gespräch', 'sozial'],
  einkauf: ['einkauf', 'apotheke', 'lebensmittel', 'besorg'],
  pflege: ['pflege', 'körper', 'anzieh', 'medik', 'mobilis', 'ernähr', 'essen', 'trink'],
};

function inferFromTitle(task: EmployeePortalTaskItem): { key: VisitTaskCategoryKey; label: string } {
  const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<VisitTaskCategoryKey, 'sonstiges'>, string[]]
  >) {
    if (keywords.some((word) => haystack.includes(word))) {
      return { key, label: VISIT_TASK_CATEGORY_LABELS[key] };
    }
  }
  return { key: 'sonstiges', label: VISIT_TASK_CATEGORY_LABELS.sonstiges };
}
