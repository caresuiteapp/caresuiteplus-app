import { StyleSheet, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { CasesListView } from '@/components/beratung/CasesListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useCounselingCaseList } from '@/hooks/useCounselingCaseList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchCounselingCaseList } from '@/lib/beratung/caseListService';

export function CasesListScreen({
  onCasePress,
  selectedId,
  embedded = false,
}: {
  onCasePress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly, roleLabel } = usePermissions();
  const pageTitle = 'Beratungsfälle';
  const list = useCounselingCaseList();

  if (embedded) {
    return <CasesListView onCasePress={onCasePress} selectedId={selectedId} embedded />;
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Fälle werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title={pageTitle} subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title={pageTitle}
      subtitle={`${isReadOnly ? 'Lesemodus · ' : ''}${roleLabel ?? 'Demo'}`}
      scroll={false}
      showBack={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Fälle" message="Es sind noch keine Beratungsfälle angelegt." />
        ) : (
          <CasesListView onCasePress={onCasePress} selectedId={selectedId} />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchCounselingCaseList;

const styles = StyleSheet.create({ content: { flex: 1 } });
