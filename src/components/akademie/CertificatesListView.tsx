import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CertificatesListHero } from './CertificatesListHero';
import { CertificatesListTable } from './CertificatesListTable';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchCertificateList } from '@/lib/akademie/moduleExtensionService';
import type { CertificateListItem } from '@/types/modules/akademie';
import { colors, spacing, typography } from '@/theme';

function CertificateCard({ item, onPress }: { item: CertificateListItem; onPress: () => void }) {
  const expires = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('de-DE') : 'unbegrenzt';

  return (
    <Pressable onPress={onPress}>
      <PremiumCard style={styles.card} accentColor={colors.success}>
        <Text style={styles.title}>{item.participantName}</Text>
        <Text style={styles.meta}>{item.courseTitle}</Text>
        <Text style={styles.meta}>
          Ausgestellt: {new Date(item.issuedAt).toLocaleDateString('de-DE')} · gültig bis: {expires}
        </Text>
        <PremiumBadge label={item.status} variant="green" />
      </PremiumCard>
    </Pressable>
  );
}

export function CertificatesListView() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'akademie_admin';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('akademie.certificates');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCertificateList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  const handlePress = (id: string) => {
    router.push(`/akademie/zertifikate/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <CertificatesListHero
        items={items}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <ModuleExtensionNavStrip productKey="akademie" currentPath="/akademie/zertifikate" />
    </View>
  );

  if (query.loading && items.length === 0) {
    return <LoadingState message="Zertifikate werden geladen…" />;
  }

  if (query.error && items.length === 0) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Zertifikate" message="Es wurden noch keine Zertifikate ausgestellt." />
        ) : (
          <CertificatesListTable items={items} onItemPress={handlePress} />
        )}
        <Text style={styles.footer}>{items.length} Zertifikate · {roleLabel ?? 'Demo'}</Text>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState title="Keine Zertifikate" message="Es wurden noch keine Zertifikate ausgestellt." />
      }
      renderItem={({ item }) => <CertificateCard item={item} onPress={() => handlePress(item.id)} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  title: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  footer: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
