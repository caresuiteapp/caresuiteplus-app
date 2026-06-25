import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassChipStyles,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { moduleColor } from '@/design/tokens/modules';
import { spacing, typography } from '@/theme';
import type { CatalogItem } from '@/types/assistCatalog';

const FORM_CTX = { viewContext: 'form' as const };

const GROUP_LABELS: Record<string, string> = {
  regelversorgung: 'Regelversorgung',
  zusatzversorgung: 'Zusatzversorgung',
  aufnahme: 'Aufnahme',
  besonderheiten: 'Besonderheiten',
};

type AssistCatalogGroupedChipSelectProps = {
  label: string;
  items: CatalogItem[];
  value: string;
  onChange: (itemKey: string) => void;
  error?: string;
};

function groupItems(items: CatalogItem[]): { groupKey: string; label: string; items: CatalogItem[] }[] {
  const map = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const groupKey = String(item.payloadJson?.groupKey ?? 'sonstiges');
    const list = map.get(groupKey) ?? [];
    list.push(item);
    map.set(groupKey, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([groupKey, groupItems]) => ({
      groupKey,
      label: GROUP_LABELS[groupKey] ?? groupKey.replace(/_/g, ' '),
      items: groupItems.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    }));
}

export function AssistCatalogGroupedChipSelect({
  label,
  items,
  value,
  onChange,
  error,
}: AssistCatalogGroupedChipSelectProps) {
  const { isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const glassChips = useAuroraGlassChipStyles(FORM_CTX);
  const text = useAuroraAdaptiveText();
  const useGlass = isLight && auroraActive;
  const assistAccent = moduleColor('assist');
  const groups = groupItems(items);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: text.primary }]}>{label}</Text>
      {groups.map((group) => (
        <View key={group.groupKey} style={styles.group}>
          <Text style={[styles.groupTitle, { color: text.primary }]}>{group.label}</Text>
          <View style={styles.row}>
            {group.items.map((item) => {
              const selected = value === item.itemKey;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    useGlass ? glassChips.chip : styles.chip,
                    selected &&
                      (useGlass
                        ? glassChips.chipSelected
                        : { borderColor: assistAccent, backgroundColor: `${assistAccent}22` }),
                  ]}
                  onPress={() => onChange(item.itemKey)}
                >
                  <Text
                    style={[
                      useGlass ? glassChips.label : [styles.chipText, { color: text.primary }],
                      selected &&
                        (useGlass
                          ? glassChips.labelSelected
                          : { fontWeight: '600', color: assistAccent }),
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs },
  group: { marginBottom: spacing.sm },
  groupTitle: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipText: { ...typography.caption },
  error: { ...typography.caption, color: '#ef4444', marginTop: spacing.xs },
});
