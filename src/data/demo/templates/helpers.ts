import type {
  CareSuiteTemplate,
  CatalogEntry,
  CatalogType,
  TemplateModuleKey,
  TemplateType,
} from '@/types/templates';

export const SEED_TIMESTAMP = '2026-06-01T10:00:00.000Z';

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

export function tpl(
  id: string,
  moduleKey: TemplateModuleKey,
  templateType: TemplateType,
  title: string,
  content: string,
  opts: Partial<CareSuiteTemplate> = {},
): CareSuiteTemplate {
  const variables = [...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return {
    id,
    tenantId: null,
    scope: 'system',
    moduleKey,
    templateType,
    status: 'active',
    title,
    description: opts.description ?? null,
    categoryKey: opts.categoryKey ?? null,
    content,
    variables: opts.variables ?? variables,
    tags: opts.tags ?? [],
    sortOrder: opts.sortOrder ?? 0,
    isDefault: opts.isDefault ?? false,
    isRequired: opts.isRequired ?? false,
    createdBy: null,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function cat(
  id: string,
  catalogType: CatalogType,
  valueKey: string,
  label: string,
  moduleKey: TemplateModuleKey,
  sortOrder: number,
  description?: string,
): CatalogEntry {
  return {
    id,
    tenantId: null,
    catalogType,
    valueKey,
    label,
    description: description ?? null,
    moduleKey,
    isSystem: true,
    isActive: true,
    sortOrder,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function batchCat(
  catalogType: CatalogType,
  moduleKey: TemplateModuleKey,
  idPrefix: string,
  items: readonly { key: string; label: string; desc?: string }[],
): CatalogEntry[] {
  return items.map((item, i) =>
    cat(`${idPrefix}-${pad(i + 1)}`, catalogType, item.key, item.label, moduleKey, i + 1, item.desc),
  );
}

export function batchTpl(
  idPrefix: string,
  moduleKey: TemplateModuleKey,
  templateType: TemplateType,
  items: readonly {
    title: string;
    content: string;
    categoryKey?: string;
    opts?: Partial<CareSuiteTemplate>;
  }[],
): CareSuiteTemplate[] {
  return items.map((item, i) =>
    tpl(`${idPrefix}-${pad(i + 1)}`, moduleKey, templateType, item.title, item.content, {
      ...item.opts,
      categoryKey: item.categoryKey,
      sortOrder: i + 1,
    }),
  );
}

/** Erzeugt n Vorlagen aus Titel-/Inhalts-Paaren. */
export function seriesTpl(
  idPrefix: string,
  moduleKey: TemplateModuleKey,
  templateType: TemplateType,
  categoryKey: string | null,
  titles: readonly string[],
  contentFn: (title: string, index: number) => string = (title) => title,
): CareSuiteTemplate[] {
  return titles.map((title, i) =>
    tpl(`${idPrefix}-${pad(i + 1)}`, moduleKey, templateType, title, contentFn(title, i), {
      categoryKey: categoryKey ?? undefined,
      sortOrder: i + 1,
    }),
  );
}
