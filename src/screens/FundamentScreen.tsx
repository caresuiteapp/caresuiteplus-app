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
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { PRODUCT_LABELS, ROLE_LABELS } from '@/data/constants';
import type { ProductKey, RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type PreviewState = 'content' | 'loading' | 'empty' | 'error' | 'success';

const STATE_OPTIONS: { key: PreviewState; label: string }[] = [
  { key: 'content', label: 'Inhalt' },
  { key: 'loading', label: 'Laden' },
  { key: 'empty', label: 'Leer' },
  { key: 'error', label: 'Fehler' },
  { key: 'success', label: 'Erfolg' },
];

const ACTIVE_PRODUCT_KEYS: ProductKey[] = ['office', 'assist', 'pflege', 'beratung', 'akademie'];
const PREVIEW_ROLE_KEYS: RoleKey[] = [
  'business_admin',
  'business_manager',
  'billing',
  'dispatch',
  'nurse',
  'caregiver',
  'counselor',
  'akademie_admin',
  'employee_portal',
  'client_portal',
  'family_portal',
];

function buildDevFoundationPreview() {
  const productKeys = Object.keys(PRODUCT_LABELS) as ProductKey[];
  return {
    tenant: { name: 'CareSuite+ Entwicklungsmandant' },
    tenantId: DEMO_TENANT_ID,
    products: productKeys.map((key) => ({ key })),
    tenantProducts: productKeys.map((key) => ({
      productKey: key,
      isActive: ACTIVE_PRODUCT_KEYS.includes(key),
    })),
    roles: PREVIEW_ROLE_KEYS.map((key) => ({ key })),
  };
}

export function FundamentScreen() {
  const router = useRouter();
  const [previewState, setPreviewState] = useState<PreviewState>('content');

  const snapshot = useMemo(() => buildDevFoundationPreview(), []);

  const activeModules = snapshot.tenantProducts.filter((tp) => tp.isActive);
  const inactiveModules = snapshot.tenantProducts.filter((tp) => !tp.isActive);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.hero}>CareSuite+ Fundament</Text>
          <Text style={styles.subtitle}>Architektur & Datenmodell — Arbeitspaket 001</Text>
          <PremiumBadge label="Entwicklungsvorschau" variant="cyan" dot />
        </View>

        <PremiumCard accentColor={colors.orange}>
          <Text style={styles.cardTitle}>Produktvision</Text>
          <Text style={styles.cardBody}>
            CareSuite+ ist eine modulare, mandantenfähige SaaS-Mobile-App für Pflege- und
            Betreuungsunternehmen.
          </Text>
        </PremiumCard>

        <PremiumCard accentColor={colors.cyan} variant="elevated">
          <Text style={styles.cardTitle}>Referenz-Mandant</Text>
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
              <Text style={styles.cardTitle}>Statische Entwicklungsvorschau</Text>
              <Text style={styles.cardBody}>
                Modul- und Rollenlabels stammen aus @/data/constants. Live-Daten werden über
                Supabase geladen — keine Demo-Snapshots mehr.
              </Text>
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
              actionLabel="Vorschau laden"
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
});
