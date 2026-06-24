import { StyleSheet, View } from 'react-native';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
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
  const assistAccent = moduleColor('assist');

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
      <ScreenShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Einsätze werden geladen…" />
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
    <C14vSubpageShell
      title={pageTitle}
      eyebrow="ASSIST · DISPOSITION"
      subtitle={`Einsatzplanung & Zuordnung${isReadOnly ? ' · Lesemodus' : ''} · ${roleSubtitle}`}
      moduleLabel="Assist"
      showBack={false}
      scroll={false}
      accentColor={assistAccent}
      actions={[
        { key: 'refresh', label: 'Aktualisieren', onPress: () => list.refresh(), variant: 'ghost' as const },
      ]}
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
    </C14vSubpageShell>
  );
}

void fetchAssignmentList;

const styles = StyleSheet.create({
  content: { flex: 1 },
});
