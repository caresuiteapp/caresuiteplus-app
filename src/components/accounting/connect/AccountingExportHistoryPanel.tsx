import { StyleSheet, Text, View } from 'react-native';
import type { AccountingExportBatch } from '@/types/connect/accounting';
import { ACCOUNTING_EXPORT_STATUS_LABELS, ACCOUNTING_PROVIDER_LABELS } from '@/types/accounting';
import { InfoBanner } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  batches: AccountingExportBatch[];
};

export function AccountingExportHistoryPanel({ batches }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Export-Historie</Text>
      <InfoBanner
        title="Nur Vorbereitung"
        message="Exports ohne externe Übertragung — kein produktiver DATEV/Lexware/sevDesk-Transfer."
      />
      {batches.length === 0 ? (
        <Text style={styles.hint}>Noch keine Export-Batches.</Text>
      ) : (
        batches.slice(0, 8).map((batch) => (
          <View key={batch.id} style={styles.card}>
            <Text style={styles.label}>{batch.batchNumber}</Text>
            <Text style={styles.meta}>
              {ACCOUNTING_PROVIDER_LABELS[batch.providerKey]} ·{' '}
              {ACCOUNTING_EXPORT_STATUS_LABELS[batch.status]} · {batch.exportType}
            </Text>
            <Text style={styles.meta}>
              Positionen: {batch.itemCount} · Transfer: {batch.externalTransfer ? 'ja' : 'nein'}
            </Text>
            {batch.packageLabel ? <Text style={styles.note}>{batch.packageLabel}</Text> : null}
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
  note: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  hint: { ...typography.caption, color: colors.textSecondary },
});
