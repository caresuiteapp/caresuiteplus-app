import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useQmCompliance } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function QmLegalReferencesScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { legalReferences, loading, error, refresh } = useQmCompliance();

  if (!can('qm.view')) {
    return (
      <ScreenShell title="Rechtsgrundlagen" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !legalReferences.length) {
    return (
      <ScreenShell title="Rechtsgrundlagen" showBack>
        <LoadingState message="Rechtsgrundlagen werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !legalReferences.length) {
    return (
      <ScreenShell title="Rechtsgrundlagen" showBack>
        <ErrorState title="Rechtsgrundlagen" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Rechtsgrundlagen" subtitle={`${legalReferences.length} Einträge`} showBack>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {legalReferences.length === 0 ? (
          <EmptyState title="Keine Rechtsgrundlagen" message="" />
        ) : (
          legalReferences.map((ref) => (
            <PremiumCard key={ref.id} accentColor={colors.cyan}>
              <Text style={styles.code}>{ref.referenceCode}</Text>
              <Text style={styles.title}>{ref.title}</Text>
              <Text style={styles.summary}>{ref.summary}</Text>
              <Text style={styles.source}>{ref.source}</Text>
            </PremiumCard>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  code: { ...typography.caption, color: colors.cyan },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  summary: { ...typography.body, marginBottom: spacing.xs },
  source: { ...typography.caption, color: colors.textMuted },
});
