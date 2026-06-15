import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SuccessState,
} from '@/components/ui';
import {
  getDemoFoundationSnapshot,
  getDemoSeedSummary,
  PRODUCT_LABELS,
  ROLE_LABELS,
} from '@/data/demo';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

type PreviewState = 'content' | 'loading' | 'empty' | 'error' | 'success';

const STATE_OPTIONS: { key: PreviewState; label: string }[] = [
  { key: 'content', label: 'Inhalt' },
  { key: 'loading', label: 'Laden' },
  { key: 'empty', label: 'Leer' },
  { key: 'error', label: 'Fehler' },
  { key: 'success', label: 'Erfolg' },
];

export function FundamentScreen() {
  const router = useRouter();
  const [previewState, setPreviewState] = useState<PreviewState>('content');

  const snapshot = useMemo(
    () => getDemoFoundationSnapshot(isDemoMode(), isSupabaseConfigured()),
    [],
  );
  const seed = useMemo(() => getDemoSeedSummary(), []);

  const activeModules = snapshot.tenantProducts.filter((tp) => tp.isActive);
  const inactiveModules = snapshot.tenantProducts.filter((tp) => !tp.isActive);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.hero}>CareSuite+ Fundament</Text>
          <Text style={styles.subtitle}>Architektur & Datenmodell — Arbeitspaket 001</Text>
          <PremiumBadge
            label={
              snapshot.isDemoMode
                ? 'Demo-Modus aktiv — Supabase nicht verbunden'
                : 'Live-Modus'
            }
            variant="cyan"
            dot
          />
        </View>

        <PremiumCard accentColor={colors.orange}>
          <Text style={styles.cardTitle}>Produktvision</Text>
          <Text style={styles.cardBody}>
            CareSuite+ ist eine modulare, mandantenfähige SaaS-Mobile-App für Pflege- und
            Betreuungsunternehmen.
          </Text>
        </PremiumCard>

        <PremiumCard accentColor={colors.cyan} variant="elevated">
          <Text style={styles.cardTitle}>Demo-Mandant</Text>
          <Text style={styles.tenantName}>{snapshot.tenant.name}</Text>
          <Text style={styles.tenantMeta}>
            tenant_id: <Text style={styles.cyan}>{snapshot.tenantId}</Text>
          </Text>
        </PremiumCard>

        {previewState === 'content' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Module ({activeModules.length} aktiv)</Text>
              <View style={styles.badgeRow}>
                {snapshot.products.map((product) => {
                  const tp = snapshot.tenantProducts.find((t) => t.productKey === product.key);
                  return (
                    <PremiumBadge
                      key={product.key}
                      label={PRODUCT_LABELS[product.key]}
                      variant={tp?.isActive ? 'green' : 'muted'}
                      dot={tp?.isActive}
                    />
                  );
                })}
              </View>
              {inactiveModules.length > 0 ? (
                <Text style={styles.hint}>
                  Inaktiv: {inactiveModules.map((m) => PRODUCT_LABELS[m.productKey]).join(', ')}
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rollen</Text>
              <View style={styles.badgeRow}>
                {snapshot.roles.map((role) => (
                  <PremiumBadge key={role.key} label={ROLE_LABELS[role.key]} variant="orange" />
                ))}
              </View>
            </View>

            <PremiumCard accentColor={colors.orange}>
              <Text style={styles.cardTitle}>Demo-Daten (WP 011)</Text>
              <Text style={styles.cardBody}>
                {seed.profileCount} Demo-Profile · {seed.clientCount} Klient:innen ·{' '}
                {seed.employeeCount} Mitarbeitende · {seed.appointmentCount} Termine ·{' '}
                {seed.invoiceCount} Rechnungen
              </Text>
              {seed.statusCoverage.map((coverage) => (
                <View key={coverage.entity} style={styles.coverageBlock}>
                  <Text style={styles.coverageTitle}>{coverage.label}</Text>
                  <View style={styles.badgeRow}>
                    {Object.entries(coverage.counts).map(([status, count]) => (
                      <PremiumBadge
                        key={status}
                        label={`${WORKFLOW_STATUS_LABELS[status as keyof typeof WORKFLOW_STATUS_LABELS]}: ${count}`}
                        variant="cyan"
                      />
                    ))}
                  </View>
                </View>
              ))}
            </PremiumCard>
          </>
        ) : null}

        {previewState === 'loading' ? (
          <PremiumCard><LoadingState message="Fundament-Daten werden geladen…" /></PremiumCard>
        ) : null}
        {previewState === 'empty' ? (
          <PremiumCard>
            <EmptyState
              title="Keine Einträge"
              message="Für diesen Bereich sind noch keine Daten vorhanden."
              actionLabel="Demo laden"
              onAction={() => setPreviewState('content')}
            />
          </PremiumCard>
        ) : null}
        {previewState === 'error' ? (
          <PremiumCard>
            <ErrorState
              message="Die Fundament-Daten konnten nicht geladen werden."
              onRetry={() => setPreviewState('content')}
            />
          </PremiumCard>
        ) : null}
        {previewState === 'success' ? (
          <PremiumCard>
            <SuccessState message="Das Fundament wurde erfolgreich initialisiert." />
          </PremiumCard>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zustände demonstrieren</Text>
          <View style={styles.stateButtons}>
            {STATE_OPTIONS.map((option) => (
              <PremiumButton
                key={option.key}
                title={option.label}
                variant={previewState === option.key ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => setPreviewState(option.key)}
              />
            ))}
          </View>
        </View>

        <PremiumButton
          title="Design System (WP 021–040)"
          variant="secondary"
          onPress={() => router.push('/design-system' as never)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  hero: { ...typography.hero },
  subtitle: { ...typography.body },
  cardTitle: { ...typography.h3, marginBottom: spacing.sm },
  cardBody: { ...typography.body },
  tenantName: { ...typography.h2, marginBottom: spacing.xs },
  tenantMeta: { ...typography.caption, marginTop: 4 },
  cyan: { color: colors.cyan, fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.h3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  stateButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  coverageBlock: { marginTop: spacing.sm, gap: spacing.xs },
  coverageTitle: { ...typography.label },
});
