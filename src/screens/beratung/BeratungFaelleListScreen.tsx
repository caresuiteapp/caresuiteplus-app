import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { CasesListView } from '@/components/beratung/CasesListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCounselingCaseList } from '@/hooks/useCounselingCaseList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchCounselingCaseList } from '@/lib/beratung/caseListService';

/** Arbeitsplan 071 — /beratung/faelle */
export function BeratungFaelleListScreen() {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const list = useCounselingCaseList();

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Fälle" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Beratungsfälle werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Fälle" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Fälle"
      subtitle={`Beratungsfallliste · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton title="+ Neu" size="sm" onPress={() => router.push('/beratung/faelle/new' as never)} />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Fälle" message="Es sind noch keine Beratungsfälle angelegt." />
        ) : (
          <CasesListView />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchCounselingCaseList;

const styles = StyleSheet.create({ content: { flex: 1 } });
