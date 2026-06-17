import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useAssignmentList } from '@/hooks/useAssignmentList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import { ASSIGNMENT_CREATE_ROUTE } from '@/lib/assist/assignmentListUi';

export function AssignmentsListScreen({
  onAssignmentPress,
  selectedId,
  embedded = false,
}: {
  onAssignmentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const router = useRouter();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const pageTitle = 'Einsatzplanung';
  const list = useAssignmentList();
  const canCreate = can('assist.assignments.manage') && !isReadOnly;

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
      subtitle={`Assist Disposition${isReadOnly ? ' · Lesemodus' : ''} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        !embedded && canCreate ? (
          <PremiumButton
            title="Einsatz planen"
            size="sm"
            onPress={() => router.push(ASSIGNMENT_CREATE_ROUTE as never)}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        <AssignmentsListView onAssignmentPress={onAssignmentPress} selectedId={selectedId} embedded={embedded} />
      </View>
    </CareLightPageShell>
  );
}

void fetchAssignmentList;

const styles = StyleSheet.create({
  content: { flex: 1 },
});
