import { CalendarShell } from '@/components/calendar/CalendarShell';

import type { CalendarModuleScope } from '@/types/modules/calendarEvent';

import { buildModuleCalendarConfig } from '@/lib/calendar/calendarEventService';



type ModuleCalendarScreenProps = {

  moduleKey: CalendarModuleScope;

  title?: string;

  subtitle?: string;

};



export function ModuleCalendarScreen({ moduleKey, title, subtitle }: ModuleCalendarScreenProps) {

  const config = buildModuleCalendarConfig(moduleKey);

  return (

    <CalendarShell

      moduleKey={moduleKey}

      title={title}

      subtitle={subtitle ?? config.subtitle}

      config={config}

      showAppointmentsLink={false}

    />

  );

}
