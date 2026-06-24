import { StyleSheet, View } from 'react-native';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { OfficeMessagesListView } from '@/components/office/OfficeMessagesListView';
import { moduleColor } from '@/design/tokens/modules';
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
  const officeAccent = moduleColor('office');

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
    <C14vSubpageShell
      title="Nachrichten"
      eyebrow="OFFICE · KOMMUNIKATION"
      subtitle={`Interne & externe Kommunikation${isReadOnly ? ' · Lesemodus' : ''}`}
      moduleLabel="Office"
      showBack={false}
      scroll={false}
      accentColor={officeAccent}
    >
      <View style={styles.content}>
        <OfficeMessagesListView onMessagePress={onMessagePress} selectedId={selectedId} />
      </View>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
