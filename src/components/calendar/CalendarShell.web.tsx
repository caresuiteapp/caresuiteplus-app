import { useCallback, useMemo, useState } from 'react';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { CalendarEventDrawer } from './CalendarEventDrawer.web';
import { CalendarPageShell } from './CalendarPageShell.web';
import { CalendarWorkspaceIcon, CalendarWorkspaceStyles } from './CalendarWorkspaceStyles.web';
import type { CalendarViewConfig } from '@/types/calendar';
import type { CalendarEvent, CalendarModuleScope } from '@/types/modules/calendarEvent';
import { buildModuleCalendarConfig, buildOfficeCalendarConfig } from '@/lib/calendar/calendarEventService';
import { resolveCalendarPermission } from '@/lib/calendar/calendarPermissions';
import { usePermissions } from '@/hooks/usePermissions';

type CalendarShellProps = {
  moduleKey: CalendarModuleScope | 'all'; title?: string; subtitle?: string;
  showAppointmentsLink?: boolean; config?: CalendarViewConfig;
  onEventPress?: (event: CalendarEvent) => void;
};
export function CalendarShell({ moduleKey, title = 'Kalender',
  showAppointmentsLink = moduleKey === 'office' || moduleKey === 'all', config,
  onEventPress: onEventPressOverride }: CalendarShellProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const resolvedConfig = useMemo(() => config ?? (moduleKey === 'all' || moduleKey === 'office' ? buildOfficeCalendarConfig() : buildModuleCalendarConfig(moduleKey)), [config, moduleKey]);
  const canView = can(moduleKey === 'all' || moduleKey === 'office' ? 'office.appointments.view' : resolveCalendarPermission(resolvedConfig));
  const handleEventPress = useCallback((event: CalendarEvent) => {
    if (onEventPressOverride) onEventPressOverride(event);
    else setSelectedEvent(event);
  }, [onEventPressOverride]);
  return <>
    <ScreenShell title={title} contentOwnsHeader showBack={false} showBreadcrumbs={false}>
      <CalendarWorkspaceStyles />
      <div className="cw-shell" data-cs-calendar-workspace="20261017">
        <header className="cw-heading">
          <button type="button" className="cw-button cw-button--icon" aria-label="Zurück" onClick={() => router.back()}><CalendarWorkspaceIcon name="back" /></button>
          <div className="cw-heading-copy"><span className="cw-eyebrow">Planung</span><h1>{title}</h1></div>
          <p>Termine, Einsätze und Verfügbarkeiten im Blick.</p>
          {canView && showAppointmentsLink && can('office.appointments.view') ? <div className="cw-heading-links"><button type="button" className="cw-button" onClick={() => router.push('/office/appointments' as never)}>Terminverwaltung</button></div> : null}
        </header>
        {canView ? <CalendarPageShell config={resolvedConfig} onEventPress={handleEventPress} /> : <div className="cw-notice" role="alert"><p>Für diesen Kalender fehlt die Leseberechtigung.</p></div>}
      </div>
    </ScreenShell>
    <CalendarEventDrawer visible={!!selectedEvent && !onEventPressOverride && canView} event={selectedEvent} onClose={() => setSelectedEvent(null)} />
  </>;
}
