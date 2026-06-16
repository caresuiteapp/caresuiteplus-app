import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup, PremiumInput, SectionPanel } from '@/components/ui';
import { PlaceholderRegistryRow } from './PlaceholderRegistryRow';
import { usePlaceholderRegistry } from '@/hooks/documents/usePlaceholderRegistry';
import { colors, spacing, typography } from '@/theme';

export function PlaceholderRegistryPanel() {
  const { query, setQuery, group, setGroup, scope, setScope, entries, groupOptions } =
    usePlaceholderRegistry();

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label="Suche"
        value={query}
        onChangeText={setQuery}
        placeholder="Platzhalter, Beschreibung, Datenquelle…"
      />

      <SectionPanel title="Gruppe">
        <FilterChipGroup
          options={groupOptions}
          value={group}
          onChange={setGroup}
        />
      </SectionPanel>

      <SectionPanel title="Bereich">
        <FilterChipGroup
          options={[
            { key: 'all' as const, label: 'Alle' },
            { key: 'system' as const, label: 'System' },
            { key: 'tenant' as const, label: 'Mandant' },
          ]}
          value={scope}
          onChange={setScope}
        />
      </SectionPanel>

      <Text style={styles.count}>{entries.length} Platzhalter</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {entries.map((entry) => (
          <PlaceholderRegistryRow key={entry.key} entry={entry} />
        ))}
        {entries.length === 0 ? (
          <Text style={styles.empty}>Keine Platzhalter gefunden.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, flex: 1 },
  count: { ...typography.caption, color: colors.textMuted },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
