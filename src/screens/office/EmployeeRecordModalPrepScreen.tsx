import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useEmployeeDetail } from '@/hooks/useEmployeeDetail';
import { careSpacing } from '@/design/tokens/spacing';
import type { ModuleNavModalComponentProps } from '@/lib/navigation/modulenav/modalscreens';

export function EmployeeRecordModalPrepScreen({ payload }: ModuleNavModalComponentProps = {}) {
  const router = useRouter();
  const employeeId = String(payload?.employeeId ?? '');
  const { data: employee, loading, error, refresh } = useEmployeeDetail(employeeId || undefined);

  if (!employeeId) {
    return (
      <EmptyState
        title="Kein Datensatz"
        message="Mitarbeiter:innen-ID fehlt — öffnen Sie die Akte aus der Liste erneut."
      />
    );
  }

  if (loading && !employee) {
    return <LoadingState message="Mitarbeiter:in wird geladen…" />;
  }

  if (error && !employee) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (!employee) {
    return <EmptyState title="Nicht gefunden" message="Mitarbeiter:in konnte nicht geladen werden." />;
  }

  const officeRoute = `/office/employees/${employeeId}` as const;
  const displayName = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Mitarbeiter:in';

  return (
    <View style={styles.root}>
      <SectionPanel title={displayName} subtitle={employee.jobTitle ?? 'Mitarbeiter:in'}>
        <PremiumButton
          title="Vollständige Office-Akte öffnen"
          onPress={() => router.push(officeRoute as never)}
        />
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
});
