import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { CatalogValueSelect } from '@/components/templates';
import { FormScreenHero } from '@/components/forms';
import { EmployeeProfilePhotoPicker } from '@/components/office/EmployeeProfilePhotoPicker';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useDropdownOptions } from '@/hooks/templates/useDropdownOptions';
import { useEmployeeWizard } from '@/hooks/useEmployeeWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { spacing } from '@/theme';

export function EmployeeCreateScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { form, errors, submitting, submitError, createdId, updateField, submit, cancel, isSuccess } =
    useEmployeeWizard();
  const isProduction = getServiceMode() === 'supabase';
  const { options: roleOptions } = useDropdownOptions('employee_role');
  const [roleKey, setRoleKey] = useState('');
  const [departmentKey, setDepartmentKey] = useState('');

  const handleRoleChange = useCallback(
    (key: string) => {
      setRoleKey(key);
      updateField('jobTitle', key);
    },
    [updateField],
  );

  const handleDepartmentChange = useCallback(
    (key: string) => {
      setDepartmentKey(key);
      updateField('department', key);
    },
    [updateField],
  );

  useEffect(() => {
    if (!roleKey && roleOptions.length > 0) {
      handleRoleChange(roleOptions[0].value);
    }
  }, [roleKey, roleOptions, handleRoleChange]);

  useEffect(() => {
    if (isSuccess && createdId) {
      const timer = setTimeout(() => router.replace('/business/office/employees' as never), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSuccess, createdId, router]);

  if (!can('office.employees.create')) {
    return (
      <CareLightPageShell title="Mitarbeitende anlegen" subtitle={roleLabel ?? 'Office'}>
        <LockedActionBanner
          message={check('office.employees.create').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (submitting) {
    return (
      <CareLightPageShell title="Mitarbeitende anlegen" subtitle="Speichern…">
        <LoadingState message="Mitarbeitende:r wird angelegt…" />
      </CareLightPageShell>
    );
  }

  if (isSuccess && createdId) {
    return (
      <CareLightPageShell title="Angelegt" subtitle="Mitarbeitende">
        <SuccessState message="Mitarbeitende:r wurde angelegt. Weiterleitung zur Liste…" />
        <PremiumButton
          title="Zur Mitarbeitendenliste"
          fullWidth
          onPress={() => router.replace('/business/office/employees' as never)}
        />
      </CareLightPageShell>
    );
  }

  const isFormEmpty =
    !form.firstName.trim() &&
    !form.lastName.trim() &&
    !form.email.trim() &&
    !roleKey &&
    !departmentKey;

  return (
    <CareLightPageShell title="Mitarbeitende anlegen" subtitle="Office · HR">
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
      {isFormEmpty ? (
        <EmptyState title="Neues Profil" message="Profilbild wählen und Pflichtfelder ausfüllen." />
      ) : null}
      <PremiumCard style={styles.card}>
        <View style={styles.profileSection}>
          <EmployeeProfilePhotoPicker
            firstName={form.firstName}
            lastName={form.lastName}
            value={form.profilePhoto}
            onChange={(profilePhoto) => updateField('profilePhoto', profilePhoto)}
            disabled={submitting}
          />
        </View>
        <PremiumInput
          label="Vorname"
          value={form.firstName}
          onChangeText={(value) => updateField('firstName', value)}
          error={errors.firstName}
        />
        <PremiumInput
          label="Nachname"
          value={form.lastName}
          onChangeText={(value) => updateField('lastName', value)}
          error={errors.lastName}
        />
        <PremiumInput
          label="E-Mail"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          error={errors.email}
        />
        <PremiumInput
          label="Telefon"
          value={form.phone}
          onChangeText={(value) => updateField('phone', value)}
        />
        <CatalogValueSelect
          catalogType="employee_role"
          label="Rolle / Titel"
          required
          value={roleKey}
          onChange={handleRoleChange}
          error={errors.jobTitle}
        />
        <CatalogValueSelect
          catalogType="employee_department"
          label="Abteilung"
          value={departmentKey}
          onChange={handleDepartmentChange}
        />
        <CatalogValueSelect
          catalogType="employee_status"
          label="Status"
          value={form.status}
          onChange={(value) => updateField('status', value)}
        />
        {submitError ? <ErrorState title="Speichern" message={submitError} /> : null}
        <PremiumButton title="Anlegen" fullWidth onPress={submit} />
        <PremiumButton
          title="Abbrechen"
          variant="secondary"
          fullWidth
          onPress={() => {
            cancel();
            router.back();
          }}
        />
      </PremiumCard>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
});
