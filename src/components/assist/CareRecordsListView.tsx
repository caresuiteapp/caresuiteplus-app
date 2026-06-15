import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareRecordsListHero } from './CareRecordsListHero';
import { CareRecordsListTable } from './CareRecordsListTable';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, PremiumBadge, PremiumCard, PremiumInput } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { CareRecordListItem } from '@/types/modules/assist';
import type { RoleKey } from '@/types';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type CareRecordsListViewProps = {
  items: CareRecordListItem[];
  totalCount: number;
  roleKey: RoleKey;
  search: string;
  onSearchChange: (value: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CareRecordsListView({
  items,
  totalCount,
  roleKey,
  search,
  onSearchChange,
  refreshing,
  onRefresh,
}: CareRecordsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('assist.careRecords');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/assist/nachweise/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <CareRecordsListHero
        items={items}
        totalCount={totalCount}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <ModuleExtensionNavStrip productKey="assist" currentPath="/assist/nachweise" />
      <PremiumInput
        label="Suche"
        placeholder="Einsatz, Klient:in, Inhalt…"
        value={search}
        onChangeText={onSearchChange}
        style={styles.search}
      />
    </View>
  );

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Nachweise" message="Noch keine Leistungsnachweise vorhanden." />
        ) : (
          <CareRecordsListTable items={items} onItemPress={handlePress} />
        )}
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState title="Keine Nachweise" message="Noch keine Leistungsnachweise vorhanden." />
      }
      renderItem={({ item }) => (
        <PremiumCard
          accentColor={item.hasSignature ? colors.success : colors.amber}
          onPress={() => handlePress(item.id)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.title}>{item.assignmentTitle}</Text>
            <PremiumBadge
              label={WORKFLOW_STATUS_LABELS[item.status]}
              variant={item.hasSignature ? 'green' : 'orange'}
              dot
            />
          </View>
          <Text style={styles.meta}>{item.clientName} · {item.employeeName}</Text>
          <Text style={styles.content} numberOfLines={2}>{item.content}</Text>
          <Text style={styles.date}>{formatDate(item.recordedAt)}</Text>
          {item.pdfReady ? <Text style={styles.pdf}>PDF verfügbar</Text> : null}
        </PremiumCard>
      )}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  search: { marginBottom: spacing.md },
  list: { paddingBottom: spacing.xxl, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4 },
  content: { ...typography.body, marginTop: spacing.xs },
  date: { ...typography.caption, color: colors.cyan, marginTop: spacing.xs },
  pdf: { ...typography.caption, color: colors.success, marginTop: 4 },
});
