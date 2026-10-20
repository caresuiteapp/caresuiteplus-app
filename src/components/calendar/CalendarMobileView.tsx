import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import type { CalendarViewConfig } from '@/types/calendar';
import { CalendarPageShell } from './CalendarPageShell';
import { CalendarCreateAction } from './CalendarCreateAction';
import { CalendarCreateModal } from './CalendarCreateModal';

type CalendarMobileViewProps = {
  config: CalendarViewConfig;
  onEventPress?: (event: CalendarEvent) => void;
};

const MOBILE_BREAKPOINT = 768;

export function CalendarMobileView({ config, onEventPress }: CalendarMobileViewProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const accent = config.moduleColor ?? '#62F3FF';
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <CalendarPageShell
        config={config}
        onEventPress={onEventPress}
        showCreateAction={!isMobile}
      />
      {isMobile ? (
        <>
          <CalendarCreateAction
            onPress={() => setCreateOpen(true)}
            accentColor={accent}
            floating
          />
          <CalendarCreateModal
            visible={createOpen}
            sourceContext="calendar"
            calendarScope={config.calendarScope}
            moduleKey={config.moduleKey}
            accentColor={accent}
            onClose={() => setCreateOpen(false)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, position: 'relative' },
});
