import { StyleSheet, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { DocumentsListView } from '@/components/office/DocumentsListView';
import { usePermissions } from '@/hooks/usePermissions';

export function OfficeDocumentsListScreen({
  onDocumentPress,
  selectedId,
  embedded = false,
}: {
  onDocumentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly } = usePermissions();

  if (embedded) {
    return (
      <DocumentsListView
        onDocumentPress={onDocumentPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  return (
    <CareLightPageShell
      title="Dokumente"
      subtitle={`Office Ablage${isReadOnly ? ' · Lesemodus' : ''}`}
      scroll={false}
    >
      <View style={styles.content}>
        <DocumentsListView onDocumentPress={onDocumentPress} selectedId={selectedId} />
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
