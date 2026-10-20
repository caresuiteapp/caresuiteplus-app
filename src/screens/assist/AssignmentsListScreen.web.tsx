import { useEffect, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { usePageFlag } from '@/hooks/usePageFlag';
import { usePageRecord } from '@/hooks/usePageRecord';
import { usePageTab } from '@/hooks/usePageTab';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView.web';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal.web';
import { validAssistDate } from '@/lib/assist/assistClientsWorkspaceModel.web';

export function AssignmentsListScreen({ onAssignmentPress, selectedId, embedded = false, externalRefreshKey = 0 }: {
  onAssignmentPress?: (id: string) => void; selectedId?: string | null; embedded?: boolean; externalRefreshKey?: number;
} = {}) {
  const router = useRouter();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ create?: string | string[]; clientId?: string | string[]; assignmentDate?: string | string[]; employeeId?: string | string[] }>();
  const { can, roleKey } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [createOpen, setCreateOpen] = usePageFlag('AssignmentsListScreen.createOpen', false);
  const [initialClientId, setInitialClientId] = usePageTab<string | null>('AssignmentsListScreen.createClient', null);
  const [initialAssignmentDate, setInitialAssignmentDate] = usePageTab<string | null>('AssignmentsListScreen.createDate', null);
  const [initialEmployeeId, setInitialEmployeeId] = usePageTab<string | null>('AssignmentsListScreen.createEmployee', null);
  const [activeId, setActiveId] = usePageRecord<string | null>('AssignmentsAdaptiveScreen.record', null);
  const [refreshKey, setRefreshKey] = useState(0);
  const canView = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view'));
  const canManage = canView && can('assist.assignments.manage');
  const create = Array.isArray(params.create) ? params.create[0] : params.create;
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const assignmentDate = Array.isArray(params.assignmentDate) ? params.assignmentDate[0] : params.assignmentDate;
  const employeeId = Array.isArray(params.employeeId) ? params.employeeId[0] : params.employeeId;
  useEffect(() => {
    if (!focused || create !== '1' || !canManage) return;
    setInitialClientId(clientId ?? null);
    setInitialAssignmentDate(validAssistDate(assignmentDate) ? assignmentDate : null);
    setInitialEmployeeId(employeeId?.trim() || null);
    setCreateOpen(true);
    router.setParams({ create: undefined, clientId: undefined, assignmentDate: undefined, employeeId: undefined } as never);
  }, [focused, create, clientId, assignmentDate, employeeId, canManage, router, setInitialClientId, setInitialAssignmentDate, setInitialEmployeeId, setCreateOpen]);
  return <>
    <AssignmentsListView onAssignmentPress={onAssignmentPress ?? setActiveId} selectedId={selectedId ?? activeId} embedded={embedded}
      externalRefreshKey={externalRefreshKey + refreshKey} createOpen={createOpen} initialCreateClientId={initialClientId} initialCreateAssignmentDate={initialAssignmentDate} initialCreateEmployeeId={initialEmployeeId} onCreateOpenChange={open => { if (open) { setInitialClientId(null); setInitialAssignmentDate(null); setInitialEmployeeId(null); } setCreateOpen(open); }} />
    {!onAssignmentPress && canView ? <AssignmentDetailGlassModal key={JSON.stringify([tenantId, profile?.id, profile?.employeeId, profile?.roleKey, activeId])} visible={!!activeId} assignmentId={activeId} onChanged={() => setRefreshKey(value => value + 1)} onClose={() => { setActiveId(null); setRefreshKey(value => value + 1); }} /> : null}
  </>;
}
