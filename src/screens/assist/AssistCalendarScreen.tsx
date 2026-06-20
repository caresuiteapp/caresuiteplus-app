import { useCallback, useState } from 'react';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { CalendarEventDrawer } from '@/components/calendar/CalendarEventDrawer';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { buildModuleCalendarConfig } from '@/lib/calendar/calendarEventService';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';

export function AssistCalendarScreen() {
  const { isReadOnly, roleLabel } = usePermissions();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState('Einsatz');
  const [drawerEvent, setDrawerEvent] = useState<CalendarEvent | null>(null);
  const roleSubtitle = getServiceMode() === 'supabase' ? roleLabel ?? 'Assist' : roleLabel ?? 'Demo';
  const config = buildModuleCalendarConfig('assist');

  const handleEventPress = useCallback((event: CalendarEvent) => {
    if (event.type === 'einsatz' && event.sourceId) {
      setSelectedAssignmentId(event.sourceId);
      setSelectedAssignmentTitle(event.title);
      return;
    }
    setDrawerEvent(event);
  }, []);

  return (
    <>
      <CalendarShell
        moduleKey="assist"
        subtitle={`${config.subtitle} · ${roleSubtitle}${isReadOnly ? ' · Lesemodus' : ''}`}
        config={config}
        showAppointmentsLink={false}
        onEventPress={handleEventPress}
      />
      <AssignmentDetailGlassModal
        visible={!!selectedAssignmentId}
        assignmentId={selectedAssignmentId}
        title={selectedAssignmentTitle}
        onClose={() => setSelectedAssignmentId(null)}
      />
      <CalendarEventDrawer
        visible={!!drawerEvent}
        event={drawerEvent}
        onClose={() => setDrawerEvent(null)}
      />
    </>
  );
}

