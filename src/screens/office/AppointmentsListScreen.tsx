import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { AppointmentsListView } from '@/components/office/AppointmentsListView';
import { CareLightButton } from '@/components/ui';
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
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.appointments.view') && !isReadOnly;
  const officeAccent = moduleColor('office');

  if (embedded) {
    return (
      <AppointmentsListView
        onAppointmentPress={onAppointmentPress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  return (
    <ScreenShell
      title="Termine"
      subtitle={`Office Terminplanung${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canCreate ? (
          <CareLightButton
            title="+ Neu"
            onPress={() => router.push('/office/appointments/create' as never)}
            accentColor={officeAccent}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        <AppointmentsListView
          onAppointmentPress={onAppointmentPress}
          selectedId={selectedId}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
