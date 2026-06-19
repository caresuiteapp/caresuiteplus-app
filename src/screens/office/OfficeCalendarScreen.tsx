import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { OfficeCalendarView } from '@/components/office/calendar';
import { CareLightButton } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';

export function OfficeCalendarScreen() {
  const router = useRouter();
  const { can, check } = usePermissions();
  const officeAccent = moduleColor('office');
  const canView = can('office.appointments.view');

  if (!canView) {
    return (
      <ScreenShell title="Kalender" subtitle="Office">
        <View style={styles.denied}>
          <CareLightButton
            title="Zurück"
            variant="secondary"
            accentColor={officeAccent}
            onPress={() => router.back()}
          />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Kalender"
      subtitle={`Office Mehransicht${check('office.appointments.view').reason ? '' : ''}`}
      rightSlot={
        <CareLightButton
          title="Termine"
          variant="secondary"
          accentColor={officeAccent}
          onPress={() => router.push('/office/appointments' as never)}
        />
      }
      scroll={false}
    >
      <View style={styles.content}>
        <OfficeCalendarView />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  denied: { padding: 16 },
});
