import type { CalendarEvent, CalendarModuleScope } from '@/types/modules/calendarEvent';

import type { CalendarViewConfig } from '@/types/calendar';

import {

  buildModuleCalendarConfig,

  buildOfficeCalendarConfig,

} from '@/lib/calendar/calendarEventService';

import { CalendarMobileView } from '@/components/calendar/CalendarMobileView';



export type ModuleCalendarViewProps = {

  config?: CalendarViewConfig;

  /** @deprecated Use config.moduleKey */

  scope?: CalendarModuleScope;

  onEventPress?: (event: CalendarEvent) => void;

};



function resolveViewConfig(

  config?: CalendarViewConfig,

  scope?: CalendarModuleScope,

): CalendarViewConfig {

  if (config) return config;

  if (!scope || scope === 'office') return buildOfficeCalendarConfig();

  return buildModuleCalendarConfig(scope);

}



/** @deprecated Prefer CalendarPageShell or CalendarMobileView directly */

export function ModuleCalendarView({ config, scope = 'office', onEventPress }: ModuleCalendarViewProps) {

  const resolvedConfig = resolveViewConfig(config, scope);

  return <CalendarMobileView config={resolvedConfig} onEventPress={onEventPress} />;

}



/** @deprecated Use CalendarShell with moduleKey="all" */

export function OfficeCalendarView() {

  return <ModuleCalendarView scope="office" />;

}



/** @deprecated Use CalendarShell with moduleKey="assist" */

export function AssistCalendarView({

  onEventPress,

}: Pick<ModuleCalendarViewProps, 'onEventPress'>) {

  return <ModuleCalendarView scope="assist" onEventPress={onEventPress} />;

}

