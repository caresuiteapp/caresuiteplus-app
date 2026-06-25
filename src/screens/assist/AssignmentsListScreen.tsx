import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView';
import { ErrorState, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useAssignmentList } from '@/hooks/useAssignmentList';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';

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
  const params = useLocalSearchParams<{ create?: string }>();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const canManage = can('assist.assignments.manage') && !isReadOnly;
  const pageTitle = 'Einsatzplanung';
  const list = useAssignmentList();
  const roleSubtitle = getServiceMode() === 'supabase' ? roleLabel ?? 'Assist' : roleLabel ?? 'Demo';
  const assistAccent = moduleColor('assist');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (params.create === '1' && canManage) {
      setCreateOpen(true);
      router.setParams({ create: undefined } as never);
    }
  }, [params.create, canManage, router]);

  if (embedded) {
    return (
      <AssignmentsListView
        onAssignmentPress={onAssignmentPress}
        selectedId={selectedId}
        embedded
        externalRefreshKey={externalRefreshKey}
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Einsätze werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
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
        { key: 'refresh', label: 'Aktualisieren', onPress: () => list.refresh(), variant: 'ghost' as const },
      ]}
    >
      <View style={styles.content}>
        <AssignmentsListView
          onAssignmentPress={onAssignmentPress}
          selectedId={selectedId}
          externalRefreshKey={externalRefreshKey}
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
        />
      </View>
    </C14vSubpageShell>
  );
}

void fetchAssignmentList;

const styles = StyleSheet.create({
  content: { flex: 1 },
});
