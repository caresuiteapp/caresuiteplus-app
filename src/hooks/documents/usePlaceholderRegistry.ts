import { useMemo, useState } from 'react';
import {
  getRequiredDocumentTypesForField,
  PLACEHOLDER_GROUP_LABELS,
  searchPlaceholders,
  type PlaceholderGroup,
  type PlaceholderRegistryEntry,
} from '@/features/documents/templateEngine';

export type PlaceholderRegistryFilters = {
  query: string;
  group: PlaceholderGroup | 'all';
  scope: 'all' | 'system' | 'tenant';
};

export function usePlaceholderRegistry(initial?: Partial<PlaceholderRegistryFilters>) {
  const [query, setQuery] = useState(initial?.query ?? '');
  const [group, setGroup] = useState<PlaceholderGroup | 'all'>(initial?.group ?? 'all');
  const [scope, setScope] = useState<'all' | 'system' | 'tenant'>(initial?.scope ?? 'all');

  const entries = useMemo(
    () => searchPlaceholders({ query, group, scope }),
    [query, group, scope],
  );

  const groupOptions = useMemo(() => {
    const keys = Object.keys(PLACEHOLDER_GROUP_LABELS) as PlaceholderGroup[];
    return [{ key: 'all' as const, label: 'Alle Gruppen' }, ...keys.map((k) => ({ key: k, label: PLACEHOLDER_GROUP_LABELS[k] }))];
  }, []);

  return {
    query,
    setQuery,
    group,
    setGroup,
    scope,
    setScope,
    entries,
    groupOptions,
  };
}

export function getPlaceholderRequiredLabel(entry: PlaceholderRegistryEntry): string {
  const types = getRequiredDocumentTypesForField(entry.key);
  if (types.length === 0) return 'Optional';
  return types.join(', ');
}
