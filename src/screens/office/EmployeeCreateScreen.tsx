import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { EmployeeCreateForm } from '@/components/office/employeecreateform';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { spacing } from '@/theme';

export function EmployeeCreateScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const isProduction = getServiceMode() === 'supabase';

  if (!can('office.employees.create')) {
    return (
      <ScreenShell title="Mitarbeitende anlegen" subtitle={roleLabel ?? 'Office'}>
        <LockedActionBanner
          message={check('office.employees.create').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Mitarbeitende anlegen" subtitle="Office · HR">
      <FormScreenHero
        eyebrow="OFFICE · MITARBEITENDE"
        title="Mitarbeitende anlegen"
        meta={
          isProduction
            ? 'Stammdaten, Rolle und Abteilung im Mandanten erfassen'
            : 'Stammdaten und Rolle erfassen'
        }
        icon="🧑‍⚕️"
        formMode="create"
        wpNumber={186}
        preparedMessage={
          isProduction
            ? 'Mitarbeitende werden mandantenbezogen angelegt.'
            : 'Mitarbeitende werden im Demo-Mandanten angelegt.'
        }
      />
      <View style={styles.formHost}>
        <EmployeeCreateForm
          onCancel={() => router.back()}
          onCreated={() => router.replace('/business/office/employees' as never)}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  formHost: {
    flex: 1,
    marginTop: spacing.sm,
  },
});
