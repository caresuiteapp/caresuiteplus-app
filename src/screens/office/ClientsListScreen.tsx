import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { ClientsListView } from '@/components/office/ClientsListView';
import { CareLightButton, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useClientList } from '@/hooks/useClientList';
import { usePermissions } from '@/hooks/usePermissions';
import { clientCreateRoute } from '@/lib/navigation/clientRoutes';
import { fetchClientList } from '@/lib/office/clientListService';

export function ClientsListScreen({
  onClientPress,
  selectedId,
  embedded = false,
  refreshToken = 0,
}: {
  onClientPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
} = {}) {
  const router = useRouter();
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.clients.create');
  const officeAccent = moduleColor('office');
  const list = useClientList();

  if (embedded) {
    return (
      <ClientsListView
        onClientPress={onClientPress}
        selectedId={selectedId}
        embedded
        refreshToken={refreshToken}
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Klient:innen" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Klient:innen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Klient:innen" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Klient:innen"
      subtitle={`Office Stammdaten${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canCreate ? (
          <CareLightButton
            title="+ Neu"
            onPress={() => router.push(clientCreateRoute() as never)}
            accentColor={officeAccent}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState
            title="Keine Klient:innen"
            message="Legen Sie die erste Klient:in an, um mit der Verwaltung zu beginnen."
            actionLabel={canCreate ? 'Klient:in anlegen' : undefined}
            onAction={canCreate ? () => router.push(clientCreateRoute() as never) : undefined}
          />
        ) : (
          <ClientsListView onClientPress={onClientPress} selectedId={selectedId} />
        )}
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
