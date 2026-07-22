import { StyleSheet, View } from 'react-native';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import { ExecutionsListView } from '@/components/assist/ExecutionsListView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useExecutionList } from '@/hooks/useExecutionList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchExecutionList } from '@/lib/assist/executionListService';

export function ExecutionsListScreen({
  onExecutionPress,
  selectedId,
  embedded = false,
}: {
  onExecutionPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly, roleLabel } = usePermissions();
  const list = useExecutionList();
  const assistAccent = moduleColor('assist');

  if (embedded) {
    return (
      <ExecutionsListView
        onExecutionPress={onExecutionPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title="Durchführung" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Durchführungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title="Durchführung" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  return (
    <C14vSubpageShell
      title="Durchführung"
      eyebrow="ASSIST · CHECK-IN"
      subtitle={`Check-in & Zeiterfassung${isReadOnly ? ' · Lesemodus' : ''} · ${roleLabel ?? 'Demo'}`}
      moduleLabel="Assist"
      showBack={false}
      scroll={false}
      accentColor={assistAccent}
      actions={[
        { key: 'refresh', label: 'Aktualisieren', onPress: () => list.refresh(), variant: 'ghost' as const },
      ]}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Durchführungen" message="Es sind keine aktiven Einsätze zur Durchführung offen." />
        ) : (
          <ExecutionsListView onExecutionPress={onExecutionPress} selectedId={selectedId} />
        )}
      </View>
    </C14vSubpageShell>
  );
}

void fetchExecutionList;

const styles = StyleSheet.create({ content: { flex: 1, minHeight: 0, minWidth: 0 } });
