import { StyleSheet, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { ExecutionsListView } from '@/components/assist/ExecutionsListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useExecutionList } from '@/hooks/useExecutionList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchExecutionList } from '@/lib/assist/executionListService';

export function ExecutionsListScreen({
  onExecutionPress,
  selectedId,
  embedded = false,
}: {
  onExecutionPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly, roleLabel } = usePermissions();
  const list = useExecutionList();

  if (embedded) {
    return (
      <ExecutionsListView
        onExecutionPress={onExecutionPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Durchführung" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Durchführungen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Durchführung" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Durchführung"
      subtitle={`Check-in & Zeiterfassung${isReadOnly ? ' · Lesemodus' : ''} · ${roleLabel ?? 'Demo'}`}
      scroll={false}
      showBack={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Durchführungen" message="Es sind keine aktiven Einsätze zur Durchführung offen." />
        ) : (
          <ExecutionsListView onExecutionPress={onExecutionPress} selectedId={selectedId} />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchExecutionList;

const styles = StyleSheet.create({ content: { flex: 1 } });
