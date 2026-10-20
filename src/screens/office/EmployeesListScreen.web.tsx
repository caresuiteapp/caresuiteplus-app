import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { useWebBackNavigation } from '@/hooks/useWebBackNavigation.web';
import { webPageHref } from '@/lib/navigation/webPageHref';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { EmployeeCreateModal } from '@/components/office/employeecreatemodal.web';
import { EmployeeDetailModal } from '@/components/office/employeedetailmodal.web';
import { EmployeesListExperience as EmployeesListView } from '@/components/office/EmployeesListExperience.web';
import { PersonalWorkspaceSurface } from '@/components/office/PersonalWorkspaceSurface';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';

const EMPLOYEE_CREATE_ROUTE = '/business/office/employees/new';

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
  const pathname = usePathname();
  const focused = useIsFocused();
  const listHref = webPageHref(pathname, params, { employee: undefined, tab: undefined, create: undefined, edit: undefined, csPage_EmployeePersonnelFilePanel_activeTab: undefined });
  const closeDetail = useWebBackNavigation(listHref);
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.employees.create');
  const accent = moduleColor(moduleLabel === 'Pflege' ? 'pflege' : 'office');
  const createOpen = focused && params.create === '1';
  const detailEmployeeId = typeof params.employee === 'string' && params.employee.trim() ? params.employee : null;
  const detailOpen = focused && Boolean(detailEmployeeId);
  const [localRefreshToken, setLocalRefreshToken] = useState(0);
  const modalMode = useModals && !onEmployeePress;

  const triggerRefresh = () => setLocalRefreshToken((value) => value + 1);

  const openCreate = () => {
    if (modalMode) {
      router.push(webPageHref(pathname, params, { create: '1', employee: undefined, tab: undefined, edit: undefined, csPage_EmployeePersonnelFilePanel_activeTab: undefined }) as never);
      return;
    }
    router.push(EMPLOYEE_CREATE_ROUTE as never);
  };

  const openDetail = (id: string) => {
    if (modalMode) {
      router.push(webPageHref(pathname, params, { employee: id, tab: undefined, create: undefined, edit: undefined, csPage_EmployeePersonnelFilePanel_activeTab: undefined }) as never);
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
        onClose={() => { triggerRefresh(); closeDetail(); }}
        onDeleted={() => {
          router.setParams({ employee: undefined, tab: undefined, edit: undefined, csPage_EmployeePersonnelFilePanel_activeTab: undefined });
          triggerRefresh();
        }}
      />
      {canCreate ? (
        <EmployeeCreateModal
          visible={createOpen}
          onClose={closeDetail}
          onCreated={(id) => {
            triggerRefresh();
            router.setParams({ create: undefined, employee: id, tab: undefined, edit: undefined, csPage_EmployeePersonnelFilePanel_activeTab: undefined });
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
        title="Personal"
        eyebrow={`${moduleLabel.toUpperCase()} · TEAM`}
        subtitle={`${contextLabel}${isReadOnly ? ' · Lesemodus' : ''}`}
        moduleLabel={moduleLabel}
        showBack={false}
        scroll={false}
        accentColor={accent}

      >
        <PersonalWorkspaceSurface style={styles.content}>{listView}</PersonalWorkspaceSurface>
      </C14vSubpageShell>
      {modals}
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minWidth: 0, minHeight: 0 },
});
