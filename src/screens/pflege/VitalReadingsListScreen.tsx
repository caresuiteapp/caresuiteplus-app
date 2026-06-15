import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { VitalReadingsListView } from '@/components/pflege/VitalReadingsListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useVitalReadingList } from '@/hooks/useVitalReadingList';
import { fetchVitalReadings } from '@/lib/pflege/vitalService';

export function VitalReadingsListScreen({
  onReadingPress,
  selectedId,
  embedded = false,
}: {
  onReadingPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const router = useRouter();
  const { isReadOnly } = usePermissions();
  const list = useVitalReadingList();

  if (embedded) {
    return (
      <VitalReadingsListView
        onReadingPress={onReadingPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Vitalwerte" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Vitalwerte werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Vitalwerte" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Vitalwerte"
      subtitle={`Pflege-Dokumentation${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton
            title="+ Erfassen"
            size="sm"
            onPress={() => router.push('/pflege/vitalwerte/create' as never)}
          />
        ) : undefined
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Vitalwerte" message="Es sind noch keine Messungen dokumentiert." />
        ) : (
          <VitalReadingsListView onReadingPress={onReadingPress} selectedId={selectedId} />
        )}
      </View>
    </CareLightPageShell>
  );
}

void fetchVitalReadings;

const styles = StyleSheet.create({ content: { flex: 1 } });
