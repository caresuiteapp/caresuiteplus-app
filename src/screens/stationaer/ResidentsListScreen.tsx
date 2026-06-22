import { StyleSheet, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ResidentsListView } from '@/components/stationaer/ResidentsListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useResidentList } from '@/hooks/useResidentList';
import { fetchResidentList } from '@/lib/stationaer/residentListService';

export function ResidentsListScreen({
  onResidentPress,
  selectedId,
  embedded = false,
}: {
  onResidentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly, roleLabel } = usePermissions();
  const pageTitle = 'Bewohner:innen';
  const list = useResidentList();

  if (embedded) {
    return (
      <ResidentsListView
        onResidentPress={onResidentPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Bewohner:innen werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={pageTitle}
      subtitle={`${isReadOnly ? 'Lesemodus · ' : ''}${roleLabel ?? 'Demo'}`}
      scroll={false}
      showBack={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Bewohner:innen" message="Es sind noch keine aktiven Bewohner:innen erfasst." />
        ) : (
          <ResidentsListView onResidentPress={onResidentPress} selectedId={selectedId} />
        )}
      </View>
    </ScreenShell>
  );
}

void fetchResidentList;

const styles = StyleSheet.create({ content: { flex: 1 } });
