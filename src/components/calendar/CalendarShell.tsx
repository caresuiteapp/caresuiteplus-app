import { useCallback, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { useRouter } from 'expo-router';

import { ScreenShell } from '@/components/layout';

import { CalendarEventDrawer } from '@/components/calendar/CalendarEventDrawer';

import { CalendarMobileView } from '@/components/calendar/CalendarMobileView';

import { PremiumButton } from '@/components/ui';

import type { CalendarViewConfig } from '@/types/calendar';

import type { CalendarEvent, CalendarModuleScope } from '@/types/modules/calendarEvent';

import { buildModuleCalendarConfig, buildOfficeCalendarConfig } from '@/lib/calendar/calendarEventService';

import { resolveCalendarPermission } from '@/lib/calendar/calendarPermissions';

import { usePermissions } from '@/hooks/usePermissions';



type CalendarShellProps = {

  moduleKey: CalendarModuleScope | 'all';

  title?: string;

  subtitle?: string;

  showAppointmentsLink?: boolean;

  config?: CalendarViewConfig;

  onEventPress?: (event: CalendarEvent) => void;

};



export function CalendarShell({

  moduleKey,

  title = 'Kalender',

  subtitle,

  showAppointmentsLink = moduleKey === 'office' || moduleKey === 'all',

  config,

  onEventPress: onEventPressOverride,

}: CalendarShellProps) {

  const router = useRouter();

  const { can } = usePermissions();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);



  const resolvedConfig =

    config

    ?? (moduleKey === 'all' || moduleKey === 'office'

      ? buildOfficeCalendarConfig()

      : buildModuleCalendarConfig(moduleKey));



  const resolvedSubtitle = subtitle ?? resolvedConfig.subtitle ?? 'Mehransicht';



  const canView =

    moduleKey === 'all' || moduleKey === 'office'

      ? can('office.appointments.view')

      : can(resolveCalendarPermission(resolvedConfig));



  const handleEventPress = useCallback(

    (event: CalendarEvent) => {

      if (onEventPressOverride) {

        onEventPressOverride(event);

        return;

      }

      setSelectedEvent(event);

    },

    [onEventPressOverride],

  );



  if (!canView) {

    return (

      <ScreenShell title={title} subtitle={resolvedSubtitle}>

        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />

      </ScreenShell>

    );

  }



  return (

    <>

      <ScreenShell

        title={title}

        subtitle={resolvedSubtitle}

        scroll={false}

        rightSlot={

          showAppointmentsLink ? (

            <PremiumButton

              title="Terminverwaltung"

              variant="secondary"

              onPress={() => router.push('/office/appointments' as never)}

            />

          ) : undefined

        }

      >

        <View style={styles.content}>

          <CalendarMobileView config={resolvedConfig} onEventPress={handleEventPress} />

        </View>

      </ScreenShell>

      <CalendarEventDrawer

        visible={!!selectedEvent && !onEventPressOverride}

        event={selectedEvent}

        onClose={() => setSelectedEvent(null)}

      />

    </>

  );

}



const styles = StyleSheet.create({

  content: { flex: 1 },

});

