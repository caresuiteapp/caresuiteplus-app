import { ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { CatalogValueSelect } from '@/components/templates';
import { EmployeeProfilePhotoPicker } from '@/components/office/EmployeeProfilePhotoPicker';
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
import { spacing } from '@/theme';

export type EmployeeCreateFormProps = {
  onCancel: () => void;
  onCreated?: (employeeId: string) => void;
};

export function EmployeeCreateForm({ onCancel, onCreated }: EmployeeCreateFormProps) {
  const { form, errors, submitting, submitError, createdId, updateField, submit, cancel, isSuccess } =
    useEmployeeWizard();
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
      onCreated?.(createdId);
    }
  }, [isSuccess, createdId, onCreated]);

  const handleCancel = () => {
    cancel();
    onCancel();
  };

  if (submitting) {
    return <LoadingState message="Mitarbeitende:r wird angelegt…" />;
  }

  if (isSuccess && createdId) {
    return <SuccessState message="Mitarbeitende:r wurde angelegt." />;
  }

  const isFormEmpty =
    !form.firstName.trim() &&
    !form.lastName.trim() &&
    !form.email.trim() &&
    !roleKey &&
    !departmentKey;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
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
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={handleCancel} />
      </PremiumCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  card: { gap: spacing.sm },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
});
