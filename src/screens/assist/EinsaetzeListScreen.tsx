import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useAssignmentList } from '@/hooks/useAssignmentList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';

/** Arbeitsplan 037 — /assist/einsaetze */
export function EinsaetzeListScreen() {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const list = useAssignmentList();

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title="Einsätze" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Einsätze werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title="Einsätze" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Einsätze"
      subtitle={`Einsatzliste mit Suche und Filter${isReadOnly ? ' · Lesemodus' : ''} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton title="Neuer Einsatz" size="sm" onPress={() => router.push('/assist/assignments' as never)} />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState
            title="Noch keine Einsätze geplant"
            message="Planen Sie den ersten Einsatz für Ihr Team."
            actionLabel={!isReadOnly ? 'Neuer Einsatz' : undefined}
            onAction={!isReadOnly ? () => router.push('/assist/assignments' as never) : undefined}
          />
        ) : (
          <AssignmentsListView />
        )}
      </View>
    </ScreenShell>
  );
}

void fetchAssignmentList;

const styles = StyleSheet.create({ content: { flex: 1, flexGrow: 1, minHeight: 0 } });
