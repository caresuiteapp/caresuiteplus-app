import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { QmExportJobCard } from '@/components/qm';
import { useQmExports } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function QmExportCenterScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { data, loading, error, refresh } = useQmExports();

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="Export" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !data) {
    return (
      <CareLightPageShell title="Export" showBack>
        <LoadingState message="Export-Jobs werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !data) {
    return (
      <CareLightPageShell title="Export" showBack>
        <ErrorState title="Export" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const items = data ?? [];

  return (
    <CareLightPageShell title="QM-Exportzentrum" subtitle={`${items.length} Jobs`} showBack>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {items.length === 0 ? (
          <EmptyState title="Keine Export-Jobs" message="Exporte werden über MD-Mappen erstellt." />
        ) : (
          items.map((job) => <QmExportJobCard key={job.id} job={job} />)
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({ scroll: { gap: spacing.md, paddingBottom: spacing.xxl } });
