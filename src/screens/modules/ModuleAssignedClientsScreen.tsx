import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, ErrorState, LoadingState, PremiumBadge } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientModuleAssignments } from '@/lib/officeModules/moduleAssignmentService';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { PRODUCT_LABELS } from '@/data/demo/products';
import type { ProductKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type ModuleAssignedClientsScreenProps = {
  moduleKey: ProductKey;
  currentPath: string;
  title?: string;
};

export function ModuleAssignedClientsScreen({
  moduleKey,
  currentPath,
  title = 'Zugeordnete Klient:innen',
}: ModuleAssignedClientsScreenProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientModuleAssignments(tenantId, profile?.roleKey, moduleKey);
    },
    [tenantId, profile?.roleKey, moduleKey],
    { enabled: !!tenantId },
  );

  const assignments = query.data ?? [];

  if (query.loading && assignments.length === 0) {
    return (
      <ScreenShell title={title} subtitle="Wird geladen…">
        <LoadingState message="Zuordnungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && assignments.length === 0) {
    return (
      <ScreenShell title={title} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={title}
      subtitle={`${PRODUCT_LABELS[moduleKey]} · Office · ${roleLabel ?? 'Demo'}`}
      scroll={false}
    >
      <View style={styles.nav}>
        <ModuleExtensionNavStrip productKey={moduleKey} currentPath={currentPath} />
      </View>
      <Text style={styles.hint}>
        Stammdaten werden in CareSuite+ Office gepflegt. Hier sehen Sie nur die Modulzuordnung.
      </Text>
      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(clientRecordRoute(item.clientId) as never)}
          >
            <View style={styles.main}>
              <Text style={styles.name}>{item.clientName}</Text>
              <Text style={styles.meta}>
                Zugeordnet {new Date(item.assignedAt).toLocaleDateString('de-DE')}
                {item.primaryEmployeeName ? ` · ${item.primaryEmployeeName}` : ''}
              </Text>
            </View>
            <PremiumBadge label={item.status} variant="muted" />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Keine Zuordnungen"
            message="Diesem Modul sind noch keine Klient:innen aus Office zugeordnet."
          />
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  nav: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  main: { flex: 1, marginRight: spacing.sm },
  name: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
