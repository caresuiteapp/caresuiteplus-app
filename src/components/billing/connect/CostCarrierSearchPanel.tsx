import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { CostCarrier } from '@/types/connect/billing';
import { EmptyState } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  carriers: CostCarrier[];
  query: string;
  onQueryChange: (query: string) => void;
};

export function CostCarrierSearchPanel({ carriers, query, onQueryChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Kostenträger suchen</Text>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Name, Kennung oder IK …"
        style={styles.input}
        accessibilityLabel="Kostenträger suchen"
      />
      {carriers.length === 0 ? (
        <EmptyState
          title="Keine Kostenträger"
          message="Importieren Sie Kostenträgerdateien oder legen Sie Stammdaten manuell an."
        />
      ) : (
        carriers.map((carrier) => (
          <View key={carrier.id} style={styles.row}>
            <Text style={styles.name}>{carrier.name}</Text>
            <Text style={styles.meta}>
              {carrier.costCarrierId}
              {carrier.ikNumber ? ` · IK ${carrier.ikNumber}` : ' · Kein IK hinterlegt'}
            </Text>
            <Text style={styles.meta}>
              DTA: {carrier.dtaSupported ? 'unterstützt (Referenz)' : 'nicht unterstützt'} · Quelle:{' '}
              {carrier.source}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSurface,
    color: colors.textPrimary,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
    gap: spacing.xs,
  },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
});
