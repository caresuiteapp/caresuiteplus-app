import { ASSIST_CATALOG_TASKS } from '@/data/assist/assistTaskCatalog';
import { ASSIST_SUBCATEGORY_LABELS } from '@/types/modules/assist/assistTaskCatalog';
import { resolveVisitTaskCategory } from '@/lib/portal/resolveVisitTaskCategory';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

const CATALOG_BY_TITLE = new Map(
  ASSIST_CATALOG_TASKS.map((entry) => [normalizeTitle(entry.title), entry] as const),
);

export function lookupAssistCatalogCategoryByTitle(title: string): {
  categoryKey: string;
  categoryLabel: string;
} | null {
  const match = CATALOG_BY_TITLE.get(normalizeTitle(title));
  if (!match) return null;
  return {
    categoryKey: match.subcategory,
    categoryLabel: ASSIST_SUBCATEGORY_LABELS[match.subcategory],
  };
}

/** UI-only enrichment — no workflow or persistence changes. */
export function enrichPortalTaskCategory(task: EmployeePortalTaskItem): EmployeePortalTaskItem {
  if (task.categoryKey?.trim() && task.categoryLabel?.trim()) {
    return task;
  }

  const catalog = lookupAssistCatalogCategoryByTitle(task.title);
  if (catalog) {
    return {
      ...task,
      categoryKey: task.categoryKey?.trim() ? task.categoryKey : catalog.categoryKey,
      categoryLabel: task.categoryLabel?.trim() ? task.categoryLabel : catalog.categoryLabel,
    };
  }

  const resolved = resolveVisitTaskCategory({
    ...task,
    categoryKey: task.categoryKey ?? null,
    categoryLabel: task.categoryLabel ?? null,
  });

  return {
    ...task,
    categoryKey: task.categoryKey?.trim() ? task.categoryKey : resolved.key,
    categoryLabel: task.categoryLabel?.trim() ? task.categoryLabel : resolved.label,
  };
}

export function enrichPortalTaskCategories(tasks: EmployeePortalTaskItem[]): EmployeePortalTaskItem[] {
  return tasks.map(enrichPortalTaskCategory);
}
