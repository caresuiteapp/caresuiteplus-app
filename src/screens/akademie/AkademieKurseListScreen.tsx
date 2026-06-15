import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { CoursesListView } from '@/components/akademie/CoursesListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCourseList } from '@/hooks/useCourseList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchCourseList } from '@/lib/akademie/courseListService';

/** Arbeitsplan 088 — /akademie/kurse */
export function AkademieKurseListScreen() {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const list = useCourseList();

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Kurse" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Kurse werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Kurse" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Kurse"
      subtitle={`Kursliste · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton title="+ Neu" size="sm" onPress={() => router.push('/akademie/kurse/new' as never)} />
        ) : null
      }
      scroll={false}
      showBack={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Kurse" message="Es sind noch keine Kurse im Katalog hinterlegt." />
        ) : (
          <CoursesListView />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchCourseList;

const styles = StyleSheet.create({ content: { flex: 1 } });
