import { StyleSheet, Text, View } from 'react-native';
import type { PaymentMatchingSuggestion } from '@/types/connect/accounting';
import { InfoBanner } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  suggestions: PaymentMatchingSuggestion[];
};

export function AccountingBankReconciliationPanel({ suggestions }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Bankabgleich</Text>
      <InfoBanner
        title="Beleg erforderlich"
        message="Abgleichsvorschläge erfordern Zahlungsbeleg — kein automatisches Bezahlt-Markieren."
      />
      {suggestions.length === 0 ? (
        <Text style={styles.hint}>Noch keine Abgleichsvorschläge.</Text>
      ) : (
        suggestions.slice(0, 6).map((entry) => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.label}>
              Rechnung {entry.invoiceId} · {(entry.confidenceScore * 100).toFixed(0)} %
            </Text>
            <Text style={styles.meta}>
              Status: {entry.status} · Beleg: {entry.receiptReference ?? 'fehlt'}
            </Text>
            {entry.errorMessage ? <Text style={styles.error}>{entry.errorMessage}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  card: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
    gap: spacing.xs,
  },
  label: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.error },
  hint: { ...typography.caption, color: colors.textSecondary },
});
