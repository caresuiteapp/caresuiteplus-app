import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  COMPONENT_CATALOG,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import {
  colors,
  designTokens,
  elevationV2,
  gradients,
  spacing,
  typography,
  typographyScale,
} from '@/theme';
import { DesignSystemComponentsSection } from './components';

const CATEGORY_LABELS: Record<string, string> = {
  layout: 'Layout',
  input: 'Eingabe',
  feedback: 'Feedback',
  'data-display': 'Daten',
  navigation: 'Navigation',
};

const COLOR_SWATCHES: { key: keyof typeof colors; label: string }[] = [
  { key: 'orange', label: 'Orange' },
  { key: 'amber', label: 'Amber' },
  { key: 'cyan', label: 'Cyan' },
  { key: 'success', label: 'Success' },
  { key: 'bgSurface', label: 'Surface' },
  { key: 'bgElevated', label: 'Elevated' },
];

export default function DesignSystemScreen() {
  const router = useRouter();

  const categories = [...new Set(COMPONENT_CATALOG.map((c) => c.category))];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PremiumButton
            title="Zurück"
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
          />
          <Text style={styles.hero}>Design-System</Text>
          <Text style={styles.subtitle}>Premium Visual Identity — WP 021–040</Text>
          <PremiumBadge label={`${COMPONENT_CATALOG.length} Komponenten`} variant="cyan" dot />
        </View>

        <SectionPanel title="Farben" subtitle="Primär-, Akzent- und Oberflächenfarben">
          <View style={styles.swatchGrid}>
            {COLOR_SWATCHES.map((swatch) => (
              <View key={swatch.key} style={styles.swatchItem}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: colors[swatch.key] as string },
                  ]}
                />
                <Text style={styles.swatchLabel}>{swatch.label}</Text>
                <Text style={styles.swatchHex}>{colors[swatch.key]}</Text>
              </View>
            ))}
          </View>
          <LinearGradient
            colors={[...gradients.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientSample}
          />
          <Text style={styles.caption}>Primary Gradient (gradients.ts)</Text>
        </SectionPanel>

        <SectionPanel title="Typografie" subtitle="Display, Hero und Textstufen">
          <Text style={typographyScale.display}>Display</Text>
          <Text style={typographyScale.hero}>Hero</Text>
          <Text style={typography.h1}>Heading 1</Text>
          <Text style={typography.h2}>Heading 2</Text>
          <Text style={typography.body}>Body — CareSuite+ Premium Dark SaaS</Text>
          <Text style={typography.caption}>Caption — sekundäre Informationen</Text>
        </SectionPanel>

        <SectionPanel title="Buttons" subtitle="Primary, Secondary, Ghost">
          <PremiumButton title="Primary Action" />
          <PremiumButton title="Secondary" variant="secondary" />
          <PremiumButton title="Ghost" variant="ghost" size="sm" />
        </SectionPanel>

        <SectionPanel title="Karten" subtitle="Default, Elevated, Sheen">
          <PremiumCard accentColor={colors.orange}>
            <Text style={styles.cardTitle}>Default Card</Text>
            <Text style={styles.cardBody}>Standard-Verlauf mit Akzent-Rim.</Text>
          </PremiumCard>
          <PremiumCard accentColor={colors.cyan} variant="elevated">
            <Text style={styles.cardTitle}>Elevated Card</Text>
            <Text style={styles.cardBody}>Hellerer Verlauf für Hervorhebung.</Text>
          </PremiumCard>
          <PremiumCard accentColor={colors.orange} sheen>
            <Text style={styles.cardTitle}>Sheen Card</Text>
            <Text style={styles.cardBody}>
              Glossy Top-Sheen via LinearGradient (WP 027).
            </Text>
          </PremiumCard>
        </SectionPanel>

        <SectionPanel title="Badges" subtitle="Status- und Rollen-Badges">
          <View style={styles.badgeRow}>
            <PremiumBadge label="Orange" variant="orange" dot />
            <PremiumBadge label="Cyan" variant="cyan" />
            <PremiumBadge label="Grün" variant="green" />
            <PremiumBadge label="Muted" variant="muted" />
            <PremiumBadge label="Rot" variant="red" dot />
          </View>
        </SectionPanel>

        <SectionPanel title="Tokens" subtitle="Glass, Sheen, Elevation v2">
          <View style={[styles.tokenCard, elevationV2.glass]}>
            <Text style={styles.cardTitle}>Glass Panel</Text>
            <Text style={styles.cardBody}>
              Blur {designTokens.glass.blur.medium} · Opacity{' '}
              {designTokens.glass.opacity.panel}
            </Text>
          </View>
          <View style={[styles.tokenCard, elevationV2.floating]}>
            <Text style={styles.cardTitle}>Floating Elevation</Text>
            <Text style={styles.cardBody}>Elevation v2 — floating shadow tier.</Text>
          </View>
          <View style={[styles.tokenCard, elevationV2.cyanGlow]}>
            <Text style={styles.cardTitle}>Cyan Glow</Text>
            <Text style={styles.cardBody}>System-/Info-Akzent mit Glow.</Text>
          </View>
        </SectionPanel>

        <DesignSystemComponentsSection />

        <SectionPanel title="Komponenten-Katalog" subtitle="Metadaten aus catalog.ts">
          {categories.map((category) => (
            <View key={category} style={styles.catalogGroup}>
              <Text style={styles.catalogCategory}>
                {CATEGORY_LABELS[category] ?? category}
              </Text>
              {COMPONENT_CATALOG.filter((c) => c.category === category).map((entry) => (
                <View key={entry.id} style={styles.catalogRow}>
                  <Text style={styles.catalogName}>{entry.name}</Text>
                  <PremiumBadge
                    label={entry.status}
                    variant={entry.status === 'stable' ? 'green' : 'muted'}
                  />
                </View>
              ))}
            </View>
          ))}
        </SectionPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  hero: { ...typographyScale.hero },
  subtitle: { ...typography.body },
  cardTitle: { ...typography.h3, marginBottom: spacing.xs },
  cardBody: { ...typography.body },
  caption: { ...typography.caption, marginTop: spacing.xs },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  swatchItem: {
    width: '30%',
    minWidth: 90,
    gap: 4,
  },
  swatch: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  swatchLabel: { ...typography.label, fontSize: 11 },
  swatchHex: { ...typography.caption, fontSize: 10 },
  gradientSample: {
    height: 36,
    borderRadius: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tokenCard: {
    backgroundColor: designTokens.glass.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: designTokens.glass.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  catalogGroup: { gap: spacing.xs, marginBottom: spacing.sm },
  catalogCategory: { ...typography.label, marginBottom: 4 },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  catalogName: { ...typography.bodyStrong },
});
