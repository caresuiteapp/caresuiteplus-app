import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useAssignmentList } from '@/hooks/useAssignmentList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import { ASSIGNMENT_CREATE_ROUTE } from '@/lib/assist/assignmentListUi';

/** Arbeitsplan 037 — /assist/einsaetze */
export function EinsaetzeListScreen() {
  const router = useRouter();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const list = useAssignmentList();
  const canCreate = can('assist.assignments.manage') && !isReadOnly;

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Einsätze" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Einsätze werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Einsätze" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Einsätze"
      subtitle={`Einsatzliste mit Suche und Filter${isReadOnly ? ' · Lesemodus' : ''} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        canCreate ? (
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
        <AssignmentsListView />
      </View>
    </CareLightPageShell>
  );
}

void fetchAssignmentList;

const styles = StyleSheet.create({ content: { flex: 1 } });
