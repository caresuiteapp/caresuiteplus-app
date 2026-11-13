import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { CarePlansListView } from '@/components/pflege/CarePlansListView.web';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCarePlanList } from '@/hooks/useCarePlanList.web';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { CarePermissionStatus } from './CarePermissionStatus.web';

/** Arbeitsplan 053 — /pflege/planung */
export function PflegeplanungListScreen() {
  const router = useRouter();
  const permissions = usePermissions();
  const { can, roleLabel } = permissions;
  const isReadOnly = !can('pflege.plans.manage');
  const canCreate = can('pflege.plans.manage');
  const list = useCarePlanList();

  if (permissions.loading || permissions.error) {
    return (
      <ScreenShell title="Pflegeplanung" scroll={false}>
        <CarePermissionStatus state={permissions} />
      </ScreenShell>
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title="Pflegeplanung" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Pflegepläne werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title="Pflegeplanung" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Pflegeplanung"
      subtitle={`Pflegepläne und Maßnahmen · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canCreate ? (
          <PremiumButton
            title="+ Neu"
            size="sm"
            onPress={() => { if (list.isCurrent() && can('pflege.plans.manage')) router.push('/pflege/planung/new' as never); }}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState title="Keine Pflegepläne" message="Es sind noch keine Pflegepläne angelegt." />
        ) : (
          <CarePlansListView list={list} />
        )}
      </View>
    </ScreenShell>
  );
}

void fetchCarePlanList;

const styles = StyleSheet.create({ content: { flex: 1 } });
