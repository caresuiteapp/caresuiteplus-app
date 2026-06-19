import { StyleSheet, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAssignmentList } from '@/hooks/useAssignmentList';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';

export function AssignmentsListScreen({
  onAssignmentPress,
  selectedId,
  embedded = false,
}: {
  onAssignmentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly, roleLabel } = usePermissions();
  const pageTitle = 'Einsatzplanung';
  const list = useAssignmentList();
  const roleSubtitle = getServiceMode() === 'supabase' ? roleLabel ?? 'Assist' : roleLabel ?? 'Demo';

  if (embedded) {
    return (
      <AssignmentsListView
        onAssignmentPress={onAssignmentPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Einsätze werden geladen…" />
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
      subtitle={`Assist Disposition${isReadOnly ? ' · Lesemodus' : ''} · ${roleSubtitle}`}
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState
            title="Keine Einsätze"
            message="Für diesen Mandanten sind noch keine Einsätze geplant."
          />
        ) : (
          <AssignmentsListView onAssignmentPress={onAssignmentPress} selectedId={selectedId} />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchAssignmentList;

const styles = StyleSheet.create({
  content: { flex: 1 },
});
