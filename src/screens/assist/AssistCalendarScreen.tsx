import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal';
import { AssistCalendarView } from '@/components/office/calendar';
import { CareLightPageShell } from '@/components/layout';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';

export function AssistCalendarScreen() {
  const { isReadOnly, roleLabel } = usePermissions();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState('Einsatz');
  const roleSubtitle = getServiceMode() === 'supabase' ? roleLabel ?? 'Assist' : roleLabel ?? 'Demo';

  const handleEventPress = useCallback((event: CalendarEvent) => {
    if (event.type === 'einsatz' && event.sourceId) {
      setSelectedAssignmentId(event.sourceId);
      setSelectedAssignmentTitle(event.title);
    }
  }, []);

  return (
    <>
      <CareLightPageShell
        title="Kalender"
        subtitle={`Assist Mehransicht${isReadOnly ? ' · Lesemodus' : ''} · ${roleSubtitle}`}
        showBack={false}
        scroll={false}
      >
        <View style={styles.content}>
          <AssistCalendarView onEventPress={handleEventPress} />
        </View>
      </CareLightPageShell>
      <AssignmentDetailGlassModal
        visible={!!selectedAssignmentId}
        assignmentId={selectedAssignmentId}
        title={selectedAssignmentTitle}
        onClose={() => setSelectedAssignmentId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%' },
});
