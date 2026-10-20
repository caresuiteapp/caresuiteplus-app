import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ExecutionsListView } from '@/components/assist/ExecutionsListView';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';

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
  const assistAccent = moduleColor('assist');
  const [refreshKey, setRefreshKey] = useState(0);

  if (embedded) {
    return (
      <ExecutionsListView
        onExecutionPress={onExecutionPress}
        selectedId={selectedId}
        embedded
        externalRefreshKey={refreshKey}
      />
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
        {
          key: 'refresh',
          label: 'Aktualisieren',
          onPress: () => setRefreshKey((value) => value + 1),
          variant: 'ghost' as const,
        },
      ]}
    >
      <View style={styles.content}>
        <ExecutionsListView
          onExecutionPress={onExecutionPress}
          selectedId={selectedId}
          externalRefreshKey={refreshKey}
        />
      </View>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({ content: { flex: 1, minHeight: 0, minWidth: 0 } });
