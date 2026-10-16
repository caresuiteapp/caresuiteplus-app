import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePageFlag } from '@/hooks/usePageFlag';
import { usePageRecord } from '@/hooks/usePageRecord';
import { usePageTab } from '@/hooks/usePageTab';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { AssignmentsListView } from '@/components/assist/AssignmentsListView.web';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal.web';

export function AssignmentsListScreen({ onAssignmentPress, selectedId, embedded = false, externalRefreshKey = 0 }: {
  onAssignmentPress?: (id: string) => void; selectedId?: string | null; embedded?: boolean; externalRefreshKey?: number;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string | string[]; clientId?: string | string[] }>();
  const { can, isReadOnly } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [createOpen, setCreateOpen] = usePageFlag('AssignmentsListScreen.createOpen', false);
  const [initialClientId, setInitialClientId] = usePageTab<string | null>('AssignmentsListScreen.createClient', null);
  const [activeId, setActiveId] = usePageRecord<string | null>('AssignmentsAdaptiveScreen.record', null);
  const [refreshKey, setRefreshKey] = useState(0);
  const canManage = can('assist.assignments.manage') && !isReadOnly;
  const create = Array.isArray(params.create) ? params.create[0] : params.create;
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const canView = can('assist.assignments.view');
  useEffect(() => {
    if (create !== '1' || !canManage) return;
    setInitialClientId(clientId ?? null); setCreateOpen(true);
    router.setParams({ create: undefined, clientId: undefined } as never);
  }, [create, clientId, canManage, router, setInitialClientId, setCreateOpen]);
  return <>
    <AssignmentsListView onAssignmentPress={onAssignmentPress ?? setActiveId} selectedId={selectedId ?? activeId} embedded={embedded}
      externalRefreshKey={externalRefreshKey + refreshKey} createOpen={createOpen} initialCreateClientId={initialClientId} onCreateOpenChange={open => { if (open) setInitialClientId(null); setCreateOpen(open); }} />
    {!onAssignmentPress && canView ? <AssignmentDetailGlassModal key={JSON.stringify([tenantId, profile?.id, profile?.employeeId, profile?.roleKey, activeId])} visible={!!activeId} assignmentId={activeId} onChanged={() => setRefreshKey(value => value + 1)} onClose={() => { setActiveId(null); setRefreshKey(value => value + 1); }} /> : null}
  </>;
}
