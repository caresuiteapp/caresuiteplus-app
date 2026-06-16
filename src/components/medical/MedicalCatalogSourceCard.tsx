import { StyleSheet, Text, View } from 'react-native';
import { MedicalDocumentationDisclaimer } from '@/components/medical/MedicalDocumentationDisclaimer';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { MedicalCatalogSourceEntry } from '@/types/medical';
import { colors, spacing, typography } from '@/theme';

const LICENSE_LABELS: Record<MedicalCatalogSourceEntry['licenseStatus'], string> = {
  public: 'Öffentlich',
  licensed_required: 'Lizenz erforderlich',
  provider_required: 'Anbieter erforderlich',
  internal_only: 'Nur intern',
  disabled: 'Deaktiviert',
};

type MedicalCatalogSourceCardProps = {
  entry: MedicalCatalogSourceEntry;
};

export function MedicalCatalogSourceCard({ entry }: MedicalCatalogSourceCardProps) {
  const variant =
    entry.licenseStatus === 'public'
      ? 'cyan'
      : entry.licenseStatus === 'disabled'
        ? 'muted'
        : 'orange';

  return (
    <PremiumCard>
      <View style={styles.header}>
        <Text style={styles.title}>{entry.label}</Text>
        <PremiumBadge label={LICENSE_LABELS[entry.licenseStatus]} variant={variant} />
      </View>
      <Text style={styles.description}>{entry.description}</Text>
      <Text style={styles.meta}>
        Suche: {entry.isSearchEnabled ? 'vorbereitet' : 'gesperrt'} · Import:{' '}
        {entry.isImportEnabled ? 'vorbereitet' : 'gesperrt'}
      </Text>
    </PremiumCard>
  );
}

type MedicalCatalogHubHeroProps = {
  preparedCount: number;
  protectedCount: number;
};

export function MedicalCatalogHubHero({ preparedCount, protectedCount }: MedicalCatalogHubHeroProps) {
  return (
    <View style={styles.hero}>
      <MedicalDocumentationDisclaimer compact />
      <Text style={styles.heroTitle}>Medizinische Stammdaten & Dokumentation</Text>
      <Text style={styles.heroSubtitle}>
        Kodierhilfe · Medikationsübersicht · Vitalzeichen · BodyMap/Wunddokumentation
      </Text>
      <Text style={styles.heroStats}>
        {preparedCount} Quellen vorbereitet · {protectedCount} lizenzgeschützt/deaktiviert
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
  description: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  hero: { gap: spacing.sm, marginBottom: spacing.lg },
  heroTitle: { ...typography.h3, color: colors.textPrimary },
  heroSubtitle: { ...typography.body, color: colors.textMuted },
  heroStats: { ...typography.caption, color: colors.textMuted },
});
