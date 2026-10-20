import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

type CalendarShellProps = {
  moduleKey: CalendarModuleScope | 'all'; title?: string; subtitle?: string;
  showAppointmentsLink?: boolean; config?: CalendarViewConfig;
  onEventPress?: (event: CalendarEvent) => void;
};
export function CalendarShell(props: CalendarShellProps) {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const { can, roleKey, isReadOnly, permissions } = usePermissions();
  const { moduleKey, config } = props;
  const resolvedConfig = useMemo(() => config ?? (moduleKey === 'all' || moduleKey === 'office' ? buildOfficeCalendarConfig() : buildModuleCalendarConfig(moduleKey)), [config, moduleKey]);
  const canView = can(moduleKey === 'all' || moduleKey === 'office' ? 'office.appointments.view' : resolveCalendarPermission(resolvedConfig));
  // Clear selection in the same render as an identity or permission change.
  // Old child callbacks also lose access to the new workspace immediately.
  const scopeKey = JSON.stringify([tenantId, user?.id, profile?.id, profile?.employeeId, roleKey, isReadOnly, [...permissions].sort(), moduleKey, resolvedConfig.moduleKey, resolvedConfig.calendarScope, canView]);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const isCurrentScope = useCallback(() => currentScope.current === scopeKey, [scopeKey]);
  return <CalendarScopedShell key={scopeKey} {...props} config={resolvedConfig} canView={canView} canAppointments={can('office.appointments.view')} isCurrentScope={isCurrentScope} />;
}

type ScopedShellProps = CalendarShellProps & {
  config: CalendarViewConfig; canView: boolean; canAppointments: boolean; isCurrentScope: () => boolean;
};

function CalendarScopedShell({ moduleKey, title = 'Kalender',
  showAppointmentsLink = moduleKey === 'office' || moduleKey === 'all', config,
  onEventPress: onEventPressOverride, canView, canAppointments, isCurrentScope }: ScopedShellProps) {
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const active = useCallback(() => mounted.current && isCurrentScope() && canView, [isCurrentScope, canView]);
  const handleEventPress = useCallback((event: CalendarEvent) => {
    if (!active()) return;
    if (onEventPressOverride) onEventPressOverride(event);
    else setSelectedEvent(event);
  }, [active, onEventPressOverride]);
  return <>
    <ScreenShell title={title} contentOwnsHeader showBack={false} showBreadcrumbs={false}>
      <CalendarWorkspaceStyles />
      <div className="cw-shell" data-cs-calendar-workspace="20261017">
        <header className="cw-heading">
          <button type="button" className="cw-button cw-button--icon" aria-label="Zurück" onClick={() => router.back()}><CalendarWorkspaceIcon name="back" /></button>
          <div className="cw-heading-copy"><span className="cw-eyebrow">Planung</span><h1>{title}</h1></div>
          <p>Termine, Einsätze und Verfügbarkeiten im Blick.</p>
          {canView && showAppointmentsLink && canAppointments ? <div className="cw-heading-links"><button type="button" className="cw-button" onClick={() => router.push('/office/appointments' as never)}>Terminverwaltung</button></div> : null}
        </header>
        {canView ? <CalendarPageShell config={config} onEventPress={handleEventPress} /> : <div className="cw-notice" role="alert"><p>Für diesen Kalender fehlt die Leseberechtigung.</p></div>}
      </div>
    </ScreenShell>
    <CalendarEventDrawer visible={!!selectedEvent && !onEventPressOverride && canView} event={canView ? selectedEvent : null} onClose={() => { if (active()) setSelectedEvent(null); }} />
  </>;
}
