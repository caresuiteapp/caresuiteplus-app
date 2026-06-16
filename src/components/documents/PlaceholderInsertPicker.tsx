import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import {
  formatPlaceholderToken,
  insertPlaceholderIntoContent,
  PLACEHOLDER_GROUP_LABELS,
  searchPlaceholders,
  type PlaceholderGroup,
} from '@/features/documents/templateEngine';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  content: string;
  onInsert: (nextContent: string) => void;
  readOnly?: boolean;
};

export function PlaceholderInsertPicker({ content, onInsert, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<PlaceholderGroup | 'all'>('all');

  const groupOptions = useMemo(() => {
    const keys = Object.keys(PLACEHOLDER_GROUP_LABELS) as PlaceholderGroup[];
    return [{ key: 'all' as const, label: 'Alle' }, ...keys.map((k) => ({ key: k, label: PLACEHOLDER_GROUP_LABELS[k] }))];
  }, []);

  const entries = useMemo(
    () => searchPlaceholders({ query, group, scope: 'all' }),
    [query, group],
  );

  const handleInsert = (key: string) => {
    onInsert(insertPlaceholderIntoContent(content, key));
    setOpen(false);
  };

  if (readOnly) return null;

  return (
    <View style={styles.wrap}>
      <PremiumButton title="Platzhalter einfügen" variant="secondary" onPress={() => setOpen((v) => !v)} />
      {open ? (
        <SectionPanel title="Platzhalter auswählen">
          <PremiumInput
            label="Suche"
            value={query}
            onChangeText={setQuery}
            placeholder="z. B. invoice.number"
          />
          <FilterChipGroup options={groupOptions} value={group} onChange={setGroup} />
          <ScrollView style={styles.list} nestedScrollEnabled>
            {entries.map((entry) => (
              <Pressable
                key={entry.key}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => handleInsert(entry.key)}
              >
                <Text style={styles.token}>{formatPlaceholderToken(entry.key)}</Text>
                <Text style={styles.label}>{entry.label}</Text>
                {entry.exampleValue ? (
                  <Text style={styles.example}>z. B. {entry.exampleValue}</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  list: { maxHeight: 280 },
  row: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: spacing.xs,
    gap: 2,
  },
  rowPressed: { backgroundColor: colors.bgElevated },
  token: { ...typography.caption, fontFamily: 'monospace', color: colors.primary },
  label: { ...typography.bodyStrong },
  example: { ...typography.caption, color: colors.textMuted },
});
