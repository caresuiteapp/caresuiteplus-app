import { SYSTEM_PLACEHOLDER_SEEDS } from './systemPlaceholderSeeds';
import type {
  PlaceholderGroup,
  PlaceholderRegistry,
  PlaceholderRegistryEntry,
  PlaceholderSearchFilters,
} from './types';

export function buildSystemPlaceholderRegistry(): PlaceholderRegistry {
  return new Map(SYSTEM_PLACEHOLDER_SEEDS.map((entry) => [entry.key, entry]));
}

export const DEFAULT_PLACEHOLDER_REGISTRY: PlaceholderRegistry = buildSystemPlaceholderRegistry();

export function isKnownPlaceholder(key: string, registry: PlaceholderRegistry = DEFAULT_PLACEHOLDER_REGISTRY): boolean {
  return registry.has(key.trim().toLowerCase());
}

export function mergePlaceholderRegistries(
  system: PlaceholderRegistry,
  tenantEntries: PlaceholderRegistryEntry[],
): PlaceholderRegistry {
  const merged = new Map(system);
  for (const entry of tenantEntries) {
    merged.set(entry.key.toLowerCase(), entry);
  }
  return merged;
}

export function listPlaceholderEntries(registry: PlaceholderRegistry = DEFAULT_PLACEHOLDER_REGISTRY): PlaceholderRegistryEntry[] {
  return [...registry.values()].sort((a, b) => a.key.localeCompare(b.key, 'de'));
}

export function searchPlaceholders(
  filters: PlaceholderSearchFilters = {},
  registry: PlaceholderRegistry = DEFAULT_PLACEHOLDER_REGISTRY,
): PlaceholderRegistryEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  const group = filters.group ?? 'all';
  const scope = filters.scope ?? 'all';

  return listPlaceholderEntries(registry).filter((entry) => {
    if (group !== 'all' && entry.group !== group) return false;
    if (scope === 'system' && !entry.isSystem) return false;
    if (scope === 'tenant' && entry.isSystem) return false;
    if (!query) return true;
    const haystack = [
      entry.key,
      entry.label,
      entry.description ?? '',
      entry.exampleValue ?? '',
      entry.dataSource ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function getPlaceholdersByGroup(
  registry: PlaceholderRegistry = DEFAULT_PLACEHOLDER_REGISTRY,
): Record<PlaceholderGroup, PlaceholderRegistryEntry[]> {
  const groups = {} as Record<PlaceholderGroup, PlaceholderRegistryEntry[]>;
  for (const entry of registry.values()) {
    if (!groups[entry.group]) groups[entry.group] = [];
    groups[entry.group].push(entry);
  }
  for (const key of Object.keys(groups) as PlaceholderGroup[]) {
    groups[key].sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }
  return groups;
}

export function formatPlaceholderToken(key: string): string {
  return `{{${key.trim().toLowerCase()}}}`;
}

export function insertPlaceholderIntoContent(content: string, key: string, cursorPosition?: number): string {
  const token = formatPlaceholderToken(key);
  if (cursorPosition === undefined || cursorPosition < 0 || cursorPosition > content.length) {
    return content + token;
  }
  return content.slice(0, cursorPosition) + token + content.slice(cursorPosition);
}

export function getPlaceholderEntry(
  key: string,
  registry: PlaceholderRegistry = DEFAULT_PLACEHOLDER_REGISTRY,
): PlaceholderRegistryEntry | undefined {
  return registry.get(key.trim().toLowerCase());
}
