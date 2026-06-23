import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmployeeDetailScreen } from '@/screens/office/EmployeeDetailScreen';
import { EmptyState, PremiumButton } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import type { ModuleNavModalComponentProps } from '@/lib/navigation/modulenav/modalscreens';

export function EmployeeRecordModalPrepScreen({ payload }: ModuleNavModalComponentProps = {}) {
  const router = useRouter();
  const employeeId = String(payload?.employeeId ?? '');

  if (!employeeId) {
    return (
      <EmptyState
        title="Kein Datensatz"
        message="Mitarbeiter:innen-ID fehlt — öffnen Sie die Akte aus der Liste erneut."
      />
    );
  }

  const officeRoute = `/office/employees/${employeeId}` as const;

  return (
    <View style={styles.root}>
      <EmployeeDetailScreen employeeId={employeeId} embedded embeddedInModal initialTabOverride="uebersicht" />
      <PremiumButton
        title="Vollständige Office-Akte öffnen"
        variant="secondary"
        onPress={() => router.push(officeRoute as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md, flex: 1 },
});
