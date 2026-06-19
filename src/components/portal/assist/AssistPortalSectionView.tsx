import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistPortalShell } from '@/components/portal/assist/AssistPortalShell';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { ASSIST_PORTAL_SECTIONS, getFeatureLabel, resolvePortalTerminology } from '@/lib/portal/engine';
import type { PortalContext } from '@/lib/portal/types';
import { PremiumButton } from '@/components/ui';

type AssistPortalSectionViewProps = {
  context: PortalContext;
  section: string;
};

/** Placeholder section screens for assist deep links until full views ship. */
export function AssistPortalSectionView({ context, section }: AssistPortalSectionViewProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const terminology = resolvePortalTerminology('assist');
  const featureKey = ASSIST_PORTAL_SECTIONS[section];
  const title = featureKey ? getFeatureLabel('assist', featureKey) : section;

  return (
    <AssistPortalShell>
      <ScrollView contentContainerStyle={styles.container}>
        <GlassCard>
          <Text style={[type.caption, { color: text.muted }]}>{terminology.moduleLabel.toUpperCase()}</Text>
          <Text style={[type.cardTitle, { color: text.primary }]}>{title}</Text>
          <Text style={[type.body, { color: text.secondary }]}>
            Inhalte für {title} werden hier angezeigt, sobald das Pflegebüro sie freigibt.
          </Text>
        </GlassCard>
        <PortalEmptyState
          title={`${title} im Portal`}
          message="Der Bereich ist für Ihr Profil noch nicht freigegeben oder es liegen noch keine Daten vor."
        />
        <PremiumButton
          title="Zur Übersicht"
          variant="secondary"
          onPress={() => router.replace('/portal/client' as never)}
          fullWidth
        />
      </ScrollView>
    </AssistPortalShell>
  );
}

export function AssistPortalSectionBlocked({ section }: { section: string }) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const featureKey = ASSIST_PORTAL_SECTIONS[section];
  const title = featureKey ? getFeatureLabel('assist', featureKey) : section;

  return (
    <AssistPortalShell>
      <View style={styles.container}>
        <PortalEmptyState
          title={`${title} nicht freigegeben`}
          message="Dieser Bereich ist für Ihr Profil nicht aktiv. Bitte wenden Sie sich an Ihr Pflegebüro."
        />
        <PremiumButton
          title="Zur Übersicht"
          onPress={() => router.replace('/portal/client' as never)}
          fullWidth
        />
        <Text style={[type.caption, { color: text.muted, textAlign: 'center' }]}>
          Bereich: {title}
        </Text>
      </View>
    </AssistPortalShell>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    padding: careSpacing.md,
    paddingBottom: careSpacing.xl,
  },
});
