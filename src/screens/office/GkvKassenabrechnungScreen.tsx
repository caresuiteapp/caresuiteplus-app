import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { InfoBanner } from '@/components/ui';
import { spacing, typography, colors } from '@/theme';
import {
  GKV_EXPORT_BATCH_STATUS_LABELS,
  GKV_STATUTORY_SECTOR_LABELS,
} from '@/types/gkvBilling';

export function GkvKassenabrechnungScreen() {
  return (
    <ScreenShell
      title="Kassenabrechnung"
      subtitle="Mehr → Abrechnung → Kassenabrechnung"
      scroll
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner
          title="Nur strukturelle Vorbereitung"
          message="GKV/Pflegekassenabrechnung (SGB XI/V, DTA-Export, Kostenträgerdateien) ist vorbereitet. DTA-Dateien sind nicht produktiv validiert. Einreichung ohne Validator/Provider ist blockiert."
        />

        <Section title="Statusmodell">
          <Text style={styles.body}>
            Export-Status: {Object.values(GKV_EXPORT_BATCH_STATUS_LABELS).join(' · ')}
          </Text>
        </Section>

        <Section title="SGB XI / SGB V">
          <Text style={styles.body}>
            Unterstützte Sektoren (Vorbereitung):{' '}
            {Object.values(GKV_STATUTORY_SECTOR_LABELS).join(', ')}
          </Text>
        </Section>

        <Section title="Funktionen (vorbereitet)">
          <Text style={styles.listItem}>• Kostenträgerdaten verwalten (Kostenträgerdatei/manuell)</Text>
          <Text style={styles.listItem}>• IK-Profil prüfen (Format, keine echte Verifikation)</Text>
          <Text style={styles.listItem}>• Leistungsdatensätze bündeln</Text>
          <Text style={styles.listItem}>• Export/DTA vorbereiten (nicht validiert)</Text>
          <Text style={styles.listItem}>• Prüfprotokoll generieren</Text>
          <Text style={styles.listItem}>• Fehlerliste anzeigen</Text>
          <Text style={styles.listItem}>• Rückläufer/Absetzungen vorbereiten</Text>
        </Section>

        <Section title="Nicht produktionsbereit">
          <Text style={styles.warning}>
            Keine produktive DTA-Einreichung · Kein Validator · Keine echten IK/Kostenträger-Daten
          </Text>
        </Section>
      </ScrollView>
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  listItem: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  warning: {
    ...typography.body,
    color: colors.warning,
  },
});
