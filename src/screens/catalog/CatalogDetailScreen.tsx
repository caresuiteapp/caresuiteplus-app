import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CatalogDetailHero } from '@/components/catalog/CatalogDetailHero';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useCatalogDetail } from '@/hooks/useCatalogDetail';
import { formatCatalogPrice } from '@/lib/catalog';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';
import { Text, View } from 'react-native';

export function CatalogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { catalog, items, loading, error, refresh, notFound } = useCatalogDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Katalog" subtitle="Wird geladen…">
        <LoadingState message="Katalog wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !catalog) {
    return (
      <ScreenShell title="Katalog" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Katalog nicht gefunden.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={catalog.name}
      subtitle="Katalogdetail"
      rightSlot={
        <View style={styles.headerActions}>
          <PremiumButton
            title="Workflow"
            size="sm"
            variant="secondary"
            onPress={() => router.push('/office/catalogs/workflow-builder' as never)}
          />
          <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <CatalogDetailHero catalog={catalog} itemCount={items.length} />

        <SectionPanel title={`Positionen (${items.length})`}>
          {items.length === 0 ? (
            <EmptyState title="Leer" message="Keine Katalogpositionen." />
          ) : (
            items.map((item) => (
              <PremiumCard key={item.id} style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <Text style={styles.code}>{item.code}</Text>
                  <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant="muted" />
                </View>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.meta}>
                  {item.unit} · {formatCatalogPrice(item.priceCents)}
                </Text>
              </PremiumCard>
            ))
          )}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  itemCard: { marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  code: { ...typography.caption, color: colors.cyan, fontWeight: '600' },
  label: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
