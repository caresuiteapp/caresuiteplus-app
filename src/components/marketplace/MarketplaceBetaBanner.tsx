import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner } from '@/components/ui';
import {
  MARKETPLACE_MODULE_READINESS,
  MARKETPLACE_NO_MEDICAL_NOTICE,
  MARKETPLACE_PREPARED_NOTICE,
} from '@/lib/marketplace';
import { colors, spacing, typography } from '@/theme';

export function MarketplaceBetaBanner() {
  const title =
    MARKETPLACE_MODULE_READINESS === 'beta'
      ? 'Partner-Marktplatz (Beta)'
      : 'Partner-Marktplatz (Demnächst)';

  return (
    <View style={styles.stack}>
      <InfoBanner title={title} message={MARKETPLACE_PREPARED_NOTICE} />
      <InfoBanner variant="warning" title="Kein medizinischer Rat" message={MARKETPLACE_NO_MEDICAL_NOTICE} />
    </View>
  );
}

type MarketplaceDataSharingPanelProps = {
  categories: string[];
};

export function MarketplaceDataSharingPanel({ categories }: MarketplaceDataSharingPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Datenfreigabe-Umfang</Text>
      {categories.length === 0 ? (
        <Text style={styles.panelText}>Keine Datenkategorien ausgewählt.</Text>
      ) : (
        categories.map((item) => (
          <Text key={item} style={styles.panelItem}>
            • {item}
          </Text>
        ))
      )}
      <Text style={styles.panelHint}>
        Es werden keine sensiblen Kundendaten vorausgefüllt. Übertragung nur nach Einwilligung.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  panel: {
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  panelTitle: { ...typography.bodyStrong },
  panelText: { ...typography.body },
  panelItem: { ...typography.body, color: colors.textPrimary },
  panelHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
