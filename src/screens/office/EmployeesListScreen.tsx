import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmployeeCreateModal } from '@/components/office/employeecreatemodal';
import { EmployeeDetailModal } from '@/components/office/employeedetailmodal';
import { EmployeesListView } from '@/components/office/EmployeesListView';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { usePermissions } from '@/hooks/usePermissions';

const EMPLOYEE_CREATE_ROUTE = '/office/employees/create';

export function EmployeesListScreen({
  onEmployeePress,
  selectedId,
  embedded = false,
  refreshToken = 0,
  useModals = true,
}: {
  onEmployeePress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
  /** When false, list actions navigate to full-page routes (master-detail embed). */
  useModals?: boolean;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string; employee?: string }>();
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.employees.create');
  const list = useEmployeeList();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const modalMode = useModals && !onEmployeePress;

  useEffect(() => {
    if (params.create === '1' && canCreate && modalMode) {
      setCreateOpen(true);
      router.setParams({ create: undefined } as never);
    }
  }, [params.create, canCreate, modalMode, router]);

  useEffect(() => {
    const employeeParam = params.employee;
    if (typeof employeeParam === 'string' && employeeParam.trim() && modalMode) {
      setDetailEmployeeId(employeeParam);
      setDetailOpen(true);
    }
  }, [params.employee, modalMode]);

  const openCreate = () => {
    if (modalMode) {
      setCreateOpen(true);
      return;
    }
    router.push(EMPLOYEE_CREATE_ROUTE as never);
  };

  const openDetail = (id: string) => {
    if (modalMode) {
      setDetailEmployeeId(id);
      setDetailOpen(true);
      return;
    }
    if (onEmployeePress) {
      onEmployeePress(id);
    }
  };

  const handleEmployeePress = onEmployeePress ?? (modalMode ? openDetail : undefined);

  const listView = (
    <EmployeesListView
      onEmployeePress={handleEmployeePress}
      onOpenDetail={modalMode ? openDetail : undefined}
      onCreatePress={canCreate ? openCreate : undefined}
      selectedId={selectedId ?? detailEmployeeId}
      embedded={embedded}
      refreshToken={refreshToken}
    />
  );

  const modals = modalMode ? (
    <>
      <EmployeeDetailModal
        visible={detailOpen}
        employeeId={detailEmployeeId}
        onClose={() => {
          setDetailOpen(false);
          setDetailEmployeeId(null);
        }}
        onDeleted={() => {
          setDetailOpen(false);
          setDetailEmployeeId(null);
          void list.refresh();
        }}
      />
      {canCreate ? (
        <EmployeeCreateModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            void list.refresh();
            setDetailEmployeeId(id);
            setDetailOpen(true);
          }}
        />
      ) : null}
    </>
  ) : null;

  if (embedded) {
    return (
      <>
        {listView}
        {modals}
      </>
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title="Mitarbeitende" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Daten werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title="Mitarbeitende" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title="Mitarbeitende"
        subtitle={`Office Teamverwaltung${isReadOnly ? ' · Lesemodus' : ''}`}
        rightSlot={
          canCreate ? (
            <PremiumButton title="+ Neu" onPress={openCreate} />
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
              onAction={canCreate ? openCreate : undefined}
            />
          ) : (
            listView
          )}
        </View>
      </ScreenShell>
      {modals}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
