import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { EmployeeCreateModal } from '@/components/office/employeecreatemodal';
import { EmployeeDetailModal } from '@/components/office/employeedetailmodal';
import { EmployeesListView } from '@/components/office/EmployeesListView';
import { moduleColor } from '@/design/tokens/modules';
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
  const officeAccent = moduleColor('office');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [localRefreshToken, setLocalRefreshToken] = useState(0);
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

  const triggerRefresh = () => setLocalRefreshToken((value) => value + 1);

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
    onEmployeePress?.(id);
  };

  const handleEmployeePress = onEmployeePress ?? (modalMode ? openDetail : undefined);
  const effectiveRefreshToken = refreshToken + localRefreshToken;
  const listView = (
    <EmployeesListView
      onEmployeePress={handleEmployeePress}
      onOpenDetail={modalMode ? openDetail : undefined}
      onCreatePress={canCreate ? openCreate : undefined}
      selectedId={selectedId ?? detailEmployeeId}
      embedded={embedded}
      refreshToken={effectiveRefreshToken}
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
          triggerRefresh();
        }}
      />
      {canCreate ? (
        <EmployeeCreateModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            triggerRefresh();
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

  return (
    <>
      <C14vSubpageShell
        title="Mitarbeitende"
        eyebrow="OFFICE · TEAM"
        subtitle={`Teamverwaltung${isReadOnly ? ' · Lesemodus' : ''}`}
        moduleLabel="Office"
        showBack={false}
        scroll={false}
        accentColor={officeAccent}
        actions={[
          ...(canCreate
            ? [
                {
                  key: 'create',
                  label: '+ Neue:r Mitarbeiter:in',
                  onPress: openCreate,
                  variant: 'primary' as const,
                },
              ]
            : []),
          {
            key: 'refresh',
            label: 'Aktualisieren',
            onPress: triggerRefresh,
            variant: 'ghost' as const,
          },
        ]}
      >
        <View style={styles.content}>{listView}</View>
      </C14vSubpageShell>
      {modals}
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minWidth: 0, minHeight: 0 },
});
