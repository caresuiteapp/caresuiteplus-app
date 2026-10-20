import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { QmReadConfirmation } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

type Props = { confirmations: QmReadConfirmation[] };

export function QmReadConfirmationPanel({ confirmations }: Props) {
  return (
    <PremiumCard accentColor={colors.cyan}>
      <Text style={styles.title}>Lesebestätigungen ({confirmations.length})</Text>
      {confirmations.length === 0 ? (
        <Text style={styles.empty}>Noch keine Lesebestätigungen.</Text>
      ) : (
        confirmations.map((c) => (
          <View key={c.id} style={styles.row}>
            <Text style={styles.name}>{c.userDisplayName}</Text>
            <Text style={styles.date}>{new Date(c.confirmedAt).toLocaleDateString('de-DE')}</Text>
          </View>
        ))
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.sm },
  empty: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  name: { ...typography.body },
  date: { ...typography.caption, color: colors.textMuted },
});
