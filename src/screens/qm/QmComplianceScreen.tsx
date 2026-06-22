import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
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
      <ScreenShell title="Compliance" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !compliance.length) {
    return (
      <ScreenShell title="Compliance" showBack>
        <LoadingState message="Compliance wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !compliance.length) {
    return (
      <ScreenShell title="Compliance" showBack>
        <ErrorState title="Compliance" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const openCount = compliance.filter((c) => ['open', 'in_progress', 'overdue'].includes(c.status)).length;

  return (
    <ScreenShell title="Compliance" subtitle={`${openCount} offen · ${compliance.length} gesamt`} showBack>
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ scroll: { gap: spacing.md, paddingBottom: spacing.xxl } });
