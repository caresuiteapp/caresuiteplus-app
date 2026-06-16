import { StyleSheet, Text, View } from 'react-native';
import type { BankTransactionImport } from '@/types/connect/accounting';
import { InfoBanner } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  imports: BankTransactionImport[];
};

export function AccountingPaymentImportPanel({ imports }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Zahlungsimport (CSV)</Text>
      <InfoBanner
        title="Kein automatischer Zahlungsstatus"
        message="CSV-Import bereitet Bankbuchungen vor — markiert Rechnungen nicht als bezahlt."
      />
      {imports.length === 0 ? (
        <Text style={styles.hint}>Noch kein Zahlungsimport.</Text>
      ) : (
        imports.slice(0, 5).map((entry) => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.label}>{entry.fileName}</Text>
            <Text style={styles.meta}>
              {entry.status} · {entry.rowCount} Zeilen · {entry.importFormat.toUpperCase()}
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
  hint: { ...typography.caption, color: colors.textSecondary },
});
