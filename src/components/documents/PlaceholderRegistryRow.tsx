import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import {
  formatPlaceholderToken,
  getRequiredDocumentTypesForField,
  getRequiredFieldLabel,
  type PlaceholderRegistryEntry,
} from '@/features/documents/templateEngine';
import { colors, spacing, typography } from '@/theme';

type Props = {
  entry: PlaceholderRegistryEntry;
  compact?: boolean;
};

function RequiredBadge({ entry }: { entry: PlaceholderRegistryEntry }) {
  const types = getRequiredDocumentTypesForField(entry.key);
  if (types.length === 0) {
    return <Text style={styles.optional}>Optional</Text>;
  }
  return (
    <Text style={styles.required}>
      Pflicht: {types.map((t) => getRequiredFieldLabel(t)).join(', ')}
    </Text>
  );
}

export function PlaceholderRegistryRow({ entry, compact }: Props) {
  return (
    <PremiumCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.token}>{formatPlaceholderToken(entry.key)}</Text>
        <Text style={styles.scope}>{entry.isSystem ? 'System' : 'Mandant'}</Text>
      </View>
      <Text style={styles.label}>{entry.label}</Text>
      {!compact && entry.description ? <Text style={styles.meta}>{entry.description}</Text> : null}
      {!compact && entry.exampleValue ? (
        <Text style={styles.meta}>Beispiel: {entry.exampleValue}</Text>
      ) : null}
      {!compact && entry.dataSource ? (
        <Text style={styles.meta}>Datenquelle: {entry.dataSource}</Text>
      ) : null}
      <RequiredBadge entry={entry} />
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  token: { ...typography.caption, fontFamily: 'monospace', color: colors.primary, flex: 1 },
  scope: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted },
  required: { ...typography.caption, color: colors.warning },
  optional: { ...typography.caption, color: colors.textMuted },
});
