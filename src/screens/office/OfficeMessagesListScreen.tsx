import { StyleSheet, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { OfficeMessagesListView } from '@/components/office/OfficeMessagesListView';
import { usePermissions } from '@/hooks/usePermissions';

export function OfficeMessagesListScreen({
  onMessagePress,
  selectedId,
  embedded = false,
}: {
  onMessagePress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly } = usePermissions();

  if (embedded) {
    return (
      <OfficeMessagesListView
        onMessagePress={onMessagePress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  return (
    <CareLightPageShell
      title="Nachrichten"
      subtitle={`Office Kommunikation${isReadOnly ? ' · Lesemodus' : ''}`}
      scroll={false}
    >
      <View style={styles.content}>
        <OfficeMessagesListView onMessagePress={onMessagePress} selectedId={selectedId} />
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
