import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OcrJobsListHero } from './OcrJobsListHero';
import { OcrJobsListTable } from './OcrJobsListTable';
import { EmptyState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { RoleKey } from '@/types';
import type { OcrJobListItem } from '@/types/modules/platform';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type OcrJobsListViewProps = {
  items: OcrJobListItem[];
  roleKey: RoleKey;
  loading: boolean;
  onRefresh: () => void;
};

export function OcrJobsListView({ items, roleKey, loading, onRefresh }: OcrJobsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('platform.ocr');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/business/platform/ocr/${id}` as never);
  };

  const header = (
    <OcrJobsListHero
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
          <EmptyState title="Keine Jobs" message="Noch keine OCR-Verarbeitungen." />
        ) : (
          <OcrJobsListTable items={items} onItemPress={handlePress} />
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
        <EmptyState title="Keine Jobs" message="Noch keine OCR-Verarbeitungen." />
      ) : (
        items.map((job) => (
          <PremiumCard
            key={job.id}
            accentColor={job.status === 'fehlerhaft' ? colors.danger : colors.cyan}
            onPress={() => handlePress(job.id)}
          >
            <View style={styles.row}>
              <Text style={styles.title}>{job.sourceDocumentTitle}</Text>
              <PremiumBadge label={WORKFLOW_STATUS_LABELS[job.status]} variant="muted" />
            </View>
            {job.confidence != null ? (
              <Text style={styles.meta}>Konfidenz: {Math.round(job.confidence * 100)}%</Text>
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
});
