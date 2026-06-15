import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { CarePlansListView } from '@/components/pflege/CarePlansListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCarePlanList } from '@/hooks/useCarePlanList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';

export function CarePlansListScreen({
  onPlanPress,
  selectedId,
  embedded = false,
}: {
  onPlanPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const router = useRouter();
  const { can, isReadOnly } = usePermissions();
  const pageTitle = 'Pflegepläne';
  const canCreate = can('pflege.plans.create' as never) && !isReadOnly;
  const list = useCarePlanList();

  if (embedded) {
    return (
      <CarePlansListView onPlanPress={onPlanPress} selectedId={selectedId} embedded />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Pflegepläne werden geladen…" />
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
      subtitle={`Ambulante Pflegeplanung${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canCreate ? (
          <PremiumButton
            title="+ Neu"
            size="sm"
            onPress={() => router.push('/pflege/plans/create' as never)}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Pflegepläne" message="Es sind noch keine Pflegepläne angelegt." />
        ) : (
          <CarePlansListView onPlanPress={onPlanPress} selectedId={selectedId} />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchCarePlanList;

const styles = StyleSheet.create({ content: { flex: 1 } });
