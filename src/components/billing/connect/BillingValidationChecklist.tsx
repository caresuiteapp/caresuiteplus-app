import { StyleSheet, Text, View } from 'react-native';
import type { BillingValidationReport } from '@/types/connect/billing';
import { getValidationCheckLabel } from '@/lib/billing/connect';
import { EmptyState } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  report: BillingValidationReport | null;
};

const STATUS_COLORS: Record<string, string> = {
  passed: colors.success,
  failed: colors.error,
  warning: colors.warning,
  skipped: colors.textMuted,
};

export function BillingValidationChecklist({ report }: Props) {
  if (!report) {
    return (
      <EmptyState
        title="Noch keine Prüfung"
        message="Starten Sie die Abrechnungsvorbereitung, um die Validierungs-Checkliste zu erzeugen."
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Validierungs-Checkliste</Text>
      <Text style={styles.summary}>
        {report.passed
          ? 'Alle Pflichtprüfungen bestanden (Vorbereitung).'
          : `${report.failedCount} Fehler, ${report.warningCount} Hinweise`}
      </Text>
      {report.checks.map((check) => (
        <View key={check.checkKey} style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={styles.checkLabel}>{getValidationCheckLabel(check.checkKey)}</Text>
            <Text style={[styles.status, { color: STATUS_COLORS[check.status] ?? colors.textSecondary }]}>
              {check.status}
            </Text>
          </View>
          <Text style={styles.message}>{check.message}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  summary: { ...typography.caption, color: colors.textSecondary },
  row: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
    gap: spacing.xs,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  status: { ...typography.caption, textTransform: 'uppercase' },
  message: { ...typography.caption, color: colors.textSecondary },
});
