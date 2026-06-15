import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { QmComplianceCard } from '@/components/qm';
import { useQmCompliance } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchQmCompliance } from '@/lib/qm/qmComplianceService';
import { colors, spacing } from '@/theme';

export function QmComplianceScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { compliance, loading, error, refresh } = useQmCompliance();

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="Compliance" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !compliance.length) {
    return (
      <CareLightPageShell title="Compliance" showBack>
        <LoadingState message="Compliance wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !compliance.length) {
    return (
      <CareLightPageShell title="Compliance" showBack>
        <ErrorState title="Compliance" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const openCount = compliance.filter((c) => ['open', 'in_progress', 'overdue'].includes(c.status)).length;

  return (
    <CareLightPageShell title="Compliance" subtitle={`${openCount} offen · ${compliance.length} gesamt`} showBack>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {compliance.length === 0 ? (
          <EmptyState title="Keine Anforderungen" message="" />
        ) : (
          compliance.map((item) => <QmComplianceCard key={item.id} item={item} />)
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({ scroll: { gap: spacing.md, paddingBottom: spacing.xxl } });
