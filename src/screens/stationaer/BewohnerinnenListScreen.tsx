import { StyleSheet, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { ResidentsListView } from '@/components/stationaer/ResidentsListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useResidentList } from '@/hooks/useResidentList';
import { fetchResidentList } from '@/lib/stationaer/residentListService';

/** Arbeitsplan 079 — /stationaer/bewohner */
export function BewohnerinnenListScreen() {
  const { isReadOnly, roleLabel } = usePermissions();
  const list = useResidentList();

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Bewohner:innen" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Bewohner:innen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Bewohner:innen" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Bewohner:innen"
      subtitle={`Bewohnerliste aus Office-Zuordnung · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`}
      scroll={false}
      showBack={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Bewohner:innen" message="Es sind noch keine aktiven Bewohner:innen erfasst." />
        ) : (
          <ResidentsListView />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchResidentList;

const styles = StyleSheet.create({ content: { flex: 1 } });
