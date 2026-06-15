import { StyleSheet, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { CommunicationCenterListView } from '@/components/communication/CommunicationCenterListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useOfficeMessages } from '@/hooks/useOfficeMessages';
import { fetchOfficeMessages } from '@/lib/portal/messageService';

export function CommunicationCenterScreen({
  onThreadPress,
  selectedId,
  embedded = false,
}: {
  onThreadPress?: (threadId: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const list = useOfficeMessages();

  if (embedded) {
    return (
      <CommunicationCenterListView
        onThreadPress={onThreadPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title="Nachrichten" subtitle="Wird geladen…" showBack={false} scroll={false}>
        <LoadingState message="Nachrichten werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title="Nachrichten" subtitle="Fehler" showBack={false} scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Nachrichten" subtitle="Kommunikationszentrum" showBack={false} scroll={false}>
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Nachrichten" message="Es sind noch keine Konversationen vorhanden." />
        ) : (
          <CommunicationCenterListView onThreadPress={onThreadPress} selectedId={selectedId} />
        )}
      </View>
    </ScreenShell>
  );
}

void fetchOfficeMessages;

const styles = StyleSheet.create({ content: { flex: 1 } });
