import { CalendarShell } from '@/components/calendar/CalendarShell';

import type { CalendarModuleScope } from '@/types/modules/calendarEvent';

import { buildModuleCalendarConfig } from '@/lib/calendar/calendarEventService';



type ModuleCalendarScreenProps = {

  moduleKey: CalendarModuleScope;

  subtitle?: string;

};



export function ModuleCalendarScreen({ moduleKey, subtitle }: ModuleCalendarScreenProps) {

  const config = buildModuleCalendarConfig(moduleKey);

  return (

    <CalendarShell

      moduleKey={moduleKey}

      subtitle={subtitle ?? config.subtitle}

      config={config}

      showAppointmentsLink={false}

    />

  );

}

