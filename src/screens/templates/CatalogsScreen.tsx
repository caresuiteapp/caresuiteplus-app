import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { PreparedTemplateBanner } from '@/components/templates';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useCatalogEntries } from '@/hooks/templates';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function CatalogsScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { entries, loading, error, refresh } = useCatalogEntries();

  if (!can('office.catalogs.view')) {
    return (
      <ScreenShell title="Kataloge" subtitle={roleLabel ?? 'Vorlagen'}>
        <LockedActionBanner message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'} />
      </ScreenShell>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <ScreenShell title="Kataloge" subtitle="Wird geladen…">
        <LoadingState message="Kataloge werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && entries.length === 0) {
    return (
      <ScreenShell title="Kataloge" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Kataloge" subtitle="Dropdown-Werte & Kategorien" scroll={false}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <PreparedTemplateBanner hint="System- und Mandanten-Kataloge für Dropdowns in allen Modulen." />
            <Text style={styles.count}>{entries.length} Einträge</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title="Keine Kataloge" message="Kataloge werden aus Systemdaten geladen." />}
        renderItem={({ item }) => (
          <PremiumCard style={styles.card}>
            <Text style={styles.title}>{item.label}</Text>
            <Text style={styles.meta}>
              {item.catalogType.replace(/_/g, ' ')} · {item.valueKey}
            </Text>
            <PremiumBadge label={item.isSystem ? 'System' : 'Mandant'} variant={item.isSystem ? 'cyan' : 'orange'} />
          </PremiumCard>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm },
  count: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  title: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
});
