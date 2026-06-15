import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AiJobsListHero } from './AiJobsListHero';
import { AiJobsListTable } from './AiJobsListTable';
import { EmptyState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { AI_JOB_TYPE_LABELS, type AiJobListItem } from '@/types/modules/platform';
import type { RoleKey } from '@/types';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type AiJobsListViewProps = {
  items: AiJobListItem[];
  roleKey: RoleKey;
  loading: boolean;
  onRefresh: () => void;
};

export function AiJobsListView({ items, roleKey, loading, onRefresh }: AiJobsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('platform.ai');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/business/platform/ai/${id}` as never);
  };

  const header = (
    <AiJobsListHero
      items={items}
      roleKey={roleKey}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showViewToggle={isDesktop}
    />
  );

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Jobs" message="Noch keine KI-Verarbeitungen." />
        ) : (
          <AiJobsListTable items={items} onItemPress={handlePress} />
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      contentContainerStyle={styles.scroll}
    >
      {header}
      {items.length === 0 ? (
        <EmptyState title="Keine Jobs" message="Noch keine KI-Verarbeitungen." />
      ) : (
        items.map((job) => (
          <PremiumCard
            key={job.id}
            accentColor={colors.primary}
            onPress={() => handlePress(job.id)}
          >
            <View style={styles.row}>
              <Text style={styles.title}>{job.promptSummary}</Text>
              <PremiumBadge label={WORKFLOW_STATUS_LABELS[job.status]} variant="muted" />
            </View>
            <Text style={styles.meta}>{AI_JOB_TYPE_LABELS[job.jobType]}</Text>
            {job.resultSummary ? (
              <Text style={styles.result} numberOfLines={3}>
                {job.resultSummary}
              </Text>
            ) : null}
          </PremiumCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textSecondary },
  result: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
});
