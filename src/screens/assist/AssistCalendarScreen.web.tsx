import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal.web';
import { CalendarShell } from '@/components/calendar/CalendarShell.web';
import { CalendarEventDrawer } from '@/components/calendar/CalendarEventDrawer.web';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { buildModuleCalendarConfig } from '@/lib/calendar/calendarEventService';
import { isAssignmentCalendarEvent, resolveCalendarEventDisplay } from '@/lib/calendar/calendarEventDisplay';
import { notifyCalendarWorkspaceChanged } from '@/lib/calendar/calendarWorkspaceRefresh.web';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getServiceMode } from '@/lib/services/mode';

export function AssistCalendarScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const { can, roleKey, roleLabel, isReadOnly, permissions } = usePermissions();
  // Keying the whole selection owner prevents a previous account's open record
  // appearing for even one render after tenant, user or permission changes.
  const scopeKey = JSON.stringify([tenantId, user?.id, profile?.id, profile?.employeeId, roleKey, isReadOnly, [...permissions].sort()]);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const isCurrentScope = useCallback(() => currentScope.current === scopeKey, [scopeKey]);
  return <AssistCalendarWorkspace key={scopeKey} tenantId={tenantId} roleLabel={roleLabel} isReadOnly={isReadOnly} canView={can('assist.assignments.view')} isCurrentScope={isCurrentScope} />;
}

type WorkspaceProps = {
  tenantId: string | null;
  roleLabel: string | null;
  isReadOnly: boolean;
  canView: boolean;
  isCurrentScope: () => boolean;
};

function AssistCalendarWorkspace({ tenantId, roleLabel, isReadOnly, canView, isCurrentScope }: WorkspaceProps) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState('Einsatz');
  const [drawerEvent, setDrawerEvent] = useState<CalendarEvent | null>(null);
  const mounted = useRef(true);
  const assignmentDeleted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const config = useMemo(() => buildModuleCalendarConfig('assist'), []);
  const roleSubtitle = roleLabel ?? (getServiceMode() === 'supabase' ? 'Assist' : 'Demo');
  const active = useCallback(() => mounted.current && isCurrentScope() && canView, [isCurrentScope, canView]);
  const refreshCalendar = useCallback(() => {
    if (active() && tenantId) notifyCalendarWorkspaceChanged(tenantId);
  }, [active, tenantId]);

  const handleEventPress = useCallback((event: CalendarEvent) => {
    if (!active()) return;
    if (isAssignmentCalendarEvent(event) && event.sourceId) {
      setDrawerEvent(null);
      assignmentDeleted.current = false;
      setSelectedAssignmentId(event.sourceId);
      setSelectedAssignmentTitle(resolveCalendarEventDisplay(event).clientName ?? event.title);
    } else {
      setSelectedAssignmentId(null);
      setDrawerEvent(event);
    }
  }, [active]);

  const closeAssignment = useCallback(() => {
    if (!active()) return;
    setSelectedAssignmentId(null);
    // Status/task actions inside the detail panel do not expose onChanged yet.
    // Closing refreshes those changes as well; deletion already notified once.
    if (!assignmentDeleted.current) refreshCalendar();
  }, [active, refreshCalendar]);

  const assignmentRemoved = useCallback(() => {
    if (!active()) return;
    assignmentDeleted.current = true;
    setSelectedAssignmentId(null);
    refreshCalendar();
  }, [active, refreshCalendar]);

  return <>
    <CalendarShell moduleKey="assist" subtitle={`${config.subtitle} · ${roleSubtitle}${isReadOnly ? ' · Lesemodus' : ''}`} config={config} showAppointmentsLink={false} onEventPress={handleEventPress} />
    {canView && <AssignmentDetailGlassModal visible={!!selectedAssignmentId} assignmentId={selectedAssignmentId} title={selectedAssignmentTitle} onChanged={refreshCalendar} onDeleted={assignmentRemoved} onClose={closeAssignment} />}
    <CalendarEventDrawer visible={canView && !!drawerEvent} event={canView ? drawerEvent : null} onClose={() => { if (active()) setDrawerEvent(null); }} />
  </>;
}
