import { usePageFlag } from '@/hooks/usePageFlag';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { CalendarEventCreateModal } from '@/components/calendar/CalendarEventCreateModal';
import { AppointmentsListView } from '@/components/office/AppointmentsListView';
import { PremiumButton } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';

export function AppointmentsListScreen({
  onAppointmentPress,
  selectedId,
  embedded = false,
}: {
  onAppointmentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string }>();
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.appointments.edit') && !isReadOnly;
  const officeAccent = moduleColor('office');
  const [createOpen, setCreateOpen] = usePageFlag('AppointmentsListScreen.createOpen', false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (params.create === '1' && canCreate) {
      setCreateOpen(true);
      router.setParams({ create: undefined } as never);
    }
  }, [params.create, canCreate, router]);

  const openCreate = () => setCreateOpen(true);

  if (embedded) {
    return (
      <>
        <AppointmentsListView
          externalRefreshKey={refreshKey}
          onAppointmentPress={onAppointmentPress}
          selectedId={selectedId}
          embedded
          onCreatePress={canCreate ? openCreate : undefined}
        />
        <CalendarEventCreateModal
          visible={createOpen}
          sourceContext="appointment_management"
          calendarScope="office"
          moduleKey="office"
          accentColor={officeAccent}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); setRefreshKey(key => key + 1); }}
        />
      </>
    );
  }

  return (
    <>
      <ScreenShell
        title="Termine"
        subtitle={`Office Terminplanung${isReadOnly ? ' · Lesemodus' : ''}`}
        rightSlot={
          canCreate ? (
            <PremiumButton title="+ Neu" onPress={openCreate} />
          ) : null
        }
        scroll={false}
      >
        <View style={styles.content}>
          <AppointmentsListView
            externalRefreshKey={refreshKey}
          onAppointmentPress={onAppointmentPress}
            selectedId={selectedId}
            onCreatePress={canCreate ? openCreate : undefined}
          />
        </View>
      </ScreenShell>
      <CalendarEventCreateModal
        visible={createOpen}
        sourceContext="appointment_management"
        calendarScope="office"
        moduleKey="office"
        accentColor={officeAccent}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); setRefreshKey(key => key + 1); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
