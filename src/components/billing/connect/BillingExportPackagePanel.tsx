import { StyleSheet, Text, View } from 'react-native';
import type { BillingExportBatch, BillingProviderConfig } from '@/types/connect/billing';
import { getBillingProviderLabel } from '@/lib/billing/connect';
import { InfoBanner } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  batch: BillingExportBatch | null;
  providers: BillingProviderConfig[];
};

export function BillingExportPackagePanel({ batch, providers }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Exportpaket</Text>
      <InfoBanner
        title="Nicht als eingereicht markierbar"
        message={'Ohne konfigurierten Abrechnungsanbieter bleibt jedes Paket im Status „vorbereitet“.'}
      />
      {batch ? (
        <View style={styles.card}>
          <Text style={styles.label}>Paket {batch.batchNumber}</Text>
          <Text style={styles.meta}>Status: {batch.status}</Text>
          <Text style={styles.meta}>Format: {batch.exportFormat}</Text>
          <Text style={styles.meta}>Positionen: {batch.itemCount}</Text>
          <Text style={styles.note}>{batch.notes}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>Noch kein Exportpaket erstellt.</Text>
      )}
      <Text style={styles.subtitle}>Abrechnungszentren (vorbereitet)</Text>
      {providers.map((provider) => (
        <View key={provider.id} style={styles.providerRow}>
          <Text style={styles.providerName}>{getBillingProviderLabel(provider.providerKey)}</Text>
          <Text style={styles.meta}>
            {provider.status} · {provider.isActive ? 'aktiv' : 'inaktiv'} · API:{' '}
            {provider.apiReady ? 'bereit' : 'später'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
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
  providerRow: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgSurface,
  },
  providerName: { ...typography.body, color: colors.textPrimary },
});
