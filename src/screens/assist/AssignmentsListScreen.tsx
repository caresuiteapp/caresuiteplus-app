import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';

export function AssignmentsListScreen({
  onAssignmentPress,
  selectedId,
  embedded = false,
  externalRefreshKey,
}: {
  onAssignmentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  externalRefreshKey?: number;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string; clientId?: string }>();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const canManage = can('assist.assignments.manage') && !isReadOnly;
  const pageTitle = 'Einsatzplanung';
  const roleSubtitle = getServiceMode() === 'supabase' ? roleLabel ?? 'Assist' : roleLabel ?? 'Demo';
  const assistAccent = moduleColor('assist');
  const [createOpen, setCreateOpen] = useState(false);
  const [initialCreateClientId, setInitialCreateClientId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (params.create === '1' && canManage) {
      setInitialCreateClientId(params.clientId ?? null);
      setCreateOpen(true);
      router.setParams({ create: undefined, clientId: undefined } as never);
    }
  }, [params.clientId, params.create, canManage, router]);

  if (embedded) {
    return (
      <AssignmentsListView
        onAssignmentPress={onAssignmentPress}
        selectedId={selectedId}
        embedded
        externalRefreshKey={(externalRefreshKey ?? 0) + refreshKey}
      />
    );
  }

  return (
    <C14vSubpageShell
      title={pageTitle}
      eyebrow="ASSIST · DISPOSITION"
      subtitle={`Einsatzplanung & Zuordnung${isReadOnly ? ' · Lesemodus' : ''} · ${roleSubtitle}`}
      moduleLabel="Assist"
      showBack={false}
      scroll={false}
      accentColor={assistAccent}
      actions={[
        ...(canManage
          ? [
              {
                key: 'create',
                label: 'Neuer Einsatz',
                onPress: () => setCreateOpen(true),
                variant: 'primary' as const,
              },
            ]
          : []),
        {
          key: 'refresh',
          label: 'Aktualisieren',
          onPress: () => setRefreshKey((value) => value + 1),
          variant: 'ghost' as const,
        },
      ]}
    >
      <View style={styles.content}>
        <AssignmentsListView
          onAssignmentPress={onAssignmentPress}
          selectedId={selectedId}
          externalRefreshKey={(externalRefreshKey ?? 0) + refreshKey}
          createOpen={createOpen}
          initialCreateClientId={initialCreateClientId}
          onCreateOpenChange={setCreateOpen}
        />
      </View>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minWidth: 0, minHeight: 0 },
});
