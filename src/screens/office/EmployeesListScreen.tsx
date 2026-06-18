import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { EmployeesListView } from '@/components/office/EmployeesListView';
import { CareLightButton, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchEmployeeList } from '@/lib/office/employeeListService';

export function EmployeesListScreen({
  onEmployeePress,
  selectedId,
  embedded = false,
  refreshToken = 0,
}: {
  onEmployeePress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
} = {}) {
  const router = useRouter();
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.employees.create');
  const officeAccent = moduleColor('office');
  const list = useEmployeeList();

  if (embedded) {
    return (
      <EmployeesListView
        onEmployeePress={onEmployeePress}
        selectedId={selectedId}
        embedded
        refreshToken={refreshToken}
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Mitarbeitende" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Mitarbeitende werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Mitarbeitende" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Mitarbeitende"
      subtitle={`Office Teamverwaltung${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canCreate ? (
          <CareLightButton
            title="+ Neu"
            onPress={() => router.push('/office/employees/create' as never)}
            accentColor={officeAccent}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState
            title="Noch keine Mitarbeitenden"
            message="Legen Sie die erste Person im Team an."
            actionLabel={canCreate ? 'Mitarbeitende anlegen' : undefined}
            onAction={canCreate ? () => router.push('/office/employees/create' as never) : undefined}
          />
        ) : (
          <EmployeesListView
            onEmployeePress={onEmployeePress}
            selectedId={selectedId}
            routePrefix="/office/employees"
          />
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
