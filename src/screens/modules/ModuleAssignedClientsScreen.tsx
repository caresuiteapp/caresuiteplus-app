import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { ModuleAssignmentListCard } from '@/components/office/ModuleAssignmentListCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientModuleAssignments } from '@/lib/officeModules/moduleAssignmentService';
import { useOpenClientRecordModal } from '@/hooks/useRecordModalNavigation';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
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
  const openClientRecord = useOpenClientRecordModal();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        nav: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
        hint: {
          ...typography.caption,
          color: text.muted,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
        },
        list: { padding: spacing.md },
      }),
    [text.muted],
  );

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
          <ModuleAssignmentListCard
            title={item.clientName}
            subtitle={`Zugeordnet ${new Date(item.assignedAt).toLocaleDateString('de-DE')}${
              item.primaryEmployeeName ? ` · ${item.primaryEmployeeName}` : ''
            }`}
            status={item.status}
            onPress={() => openClientRecord(item.clientId)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Keine Zuordnungen"
            message="Diesem Modul sind noch keine Klient:innen aus Office zugeordnet. Zuordnungen werden in CareSuite+ Office gepflegt."
            actionLabel="Office Klient:innen"
            onAction={() => router.push('/business/office/clients' as never)}
          />
        }
      />
    </ScreenShell>
  );
}
