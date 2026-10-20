import { StyleSheet, Text, View } from 'react-native';
import type { AccountingAuditEvent, AccountingExportBatch } from '@/types/connect/accounting';
import { ACCOUNTING_AUDIT_EVENT_LABELS } from '@/types/connect/accounting';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  exportErrors: AccountingExportBatch[];
  auditEvents: AccountingAuditEvent[];
};

export function AccountingErrorLogPanel({ exportErrors, auditEvents }: Props) {
  const errorEvents = auditEvents.filter(
    (event) => event.eventType === 'error_logged' || event.eventType === 'export_blocked',
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Fehlerprotokoll</Text>
      {exportErrors.length === 0 && errorEvents.length === 0 ? (
        <Text style={styles.hint}>Keine Fehler protokolliert.</Text>
      ) : (
        <>
          {exportErrors.map((entry) => (
            <View key={entry.id} style={styles.cardError}>
              <Text style={styles.label}>{entry.batchNumber}</Text>
              <Text style={styles.meta}>{entry.errorSummary ?? 'Export blockiert'}</Text>
            </View>
          ))}
          {errorEvents.slice(0, 6).map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.label}>{ACCOUNTING_AUDIT_EVENT_LABELS[event.eventType]}</Text>
              <Text style={styles.meta}>{event.summary}</Text>
            </View>
          ))}
        </>
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
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgSurface,
    gap: spacing.xs,
  },
  cardError: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgSurface,
    gap: spacing.xs,
  },
  label: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textSecondary },
});
