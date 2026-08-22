import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { EmployeeCreateModal } from '@/components/office/employeecreatemodal';
import { EmployeeDetailModal } from '@/components/office/employeedetailmodal';
import { EmployeesListView } from '@/components/office/EmployeesListView';
import { PersonalWorkspaceSurface } from '@/components/office/PersonalWorkspaceSurface';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';

const EMPLOYEE_CREATE_ROUTE = '/office/employees/create';

export function EmployeesListScreen({
  onEmployeePress,
  selectedId,
  embedded = false,
  refreshToken = 0,
  useModals = true,
  moduleLabel = 'Office',
  contextLabel = 'Teamverwaltung',
}: {
  onEmployeePress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
  /** When false, list actions navigate to full-page routes (master-detail embed). */
  useModals?: boolean;
  moduleLabel?: string;
  contextLabel?: string;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string; employee?: string }>();
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.employees.create');
  const accent = moduleColor(moduleLabel === 'Pflege' ? 'pflege' : 'office');
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
      <PersonalWorkspaceSurface>
        {listView}
        {modals}
      </PersonalWorkspaceSurface>
    );
  }

  return (
    <>
      <C14vSubpageShell
        title="Mitarbeitende"
        eyebrow={`${moduleLabel.toUpperCase()} · TEAM`}
        subtitle={`${contextLabel}${isReadOnly ? ' · Lesemodus' : ''}`}
        moduleLabel={moduleLabel}
        showBack={false}
        scroll={false}
        accentColor={accent}
        actions={[
          ...(canCreate
            ? [
                {
                  key: 'create',
                  label: '+ Mitarbeitende anlegen',
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
        <PersonalWorkspaceSurface style={styles.content}>{listView}</PersonalWorkspaceSurface>
      </C14vSubpageShell>
      <PersonalWorkspaceSurface style={styles.modalHost}>{modals}</PersonalWorkspaceSurface>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  modalHost: { position: 'absolute', width: 0, height: 0, overflow: 'visible' },
});
