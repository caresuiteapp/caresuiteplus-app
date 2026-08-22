import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { CatalogValueSelect } from '@/components/templates';
import { EmployeeProfilePhotoPicker } from '@/components/office/EmployeeProfilePhotoPicker';
import {
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
  const { width } = useWindowDimensions();
  const useTwoColumns = width >= 680;
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <PremiumCard style={styles.card}>
        <View style={styles.intro}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
          <View style={styles.introCopy}>
            <Text style={styles.title}>Persönliche Angaben</Text>
            <Text style={styles.subtitle}>Pflichtfelder sind mit einem Sternchen gekennzeichnet.</Text>
          </View>
        </View>

        <View style={[styles.primaryGrid, useTwoColumns ? styles.primaryGridWide : null]}>
          <View style={styles.profileSection}>
            <EmployeeProfilePhotoPicker
              firstName={form.firstName}
              lastName={form.lastName}
              value={form.profilePhoto ?? { displayUri: null, pending: null, removed: false }}
              onChange={(profilePhoto) => updateField('profilePhoto', profilePhoto)}
              disabled={submitting}
            />
          </View>
          <View style={styles.fieldsColumn}>
            <View style={[styles.inputRow, useTwoColumns ? styles.inputRowWide : null]}>
              <View style={styles.inputCell}>
                <PremiumInput
                  label="Vorname *"
                  value={form.firstName}
                  onChangeText={(value) => updateField('firstName', value)}
                  error={errors.firstName}
                />
              </View>
              <View style={styles.inputCell}>
                <PremiumInput
                  label="Nachname *"
                  value={form.lastName}
                  onChangeText={(value) => updateField('lastName', value)}
                  error={errors.lastName}
                />
              </View>
            </View>
            <PremiumInput
              label="E-Mail *"
              value={form.email}
              onChangeText={(value) => updateField('email', value)}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <PremiumInput
              label="Telefon"
              value={form.phone}
              onChangeText={(value) => updateField('phone', value)}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.divider} />
        <View style={styles.intro}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
          <View style={styles.introCopy}>
            <Text style={styles.title}>Organisation</Text>
            <Text style={styles.subtitle}>Rolle, Abteilung und aktuellen Beschäftigungsstatus zuordnen.</Text>
          </View>
        </View>
        <CatalogValueSelect catalogType="employee_role" label="Rolle / Titel" required value={roleKey}
          onChange={handleRoleChange} error={errors.jobTitle} wrap />
        <CatalogValueSelect catalogType="employee_department" label="Abteilung" value={departmentKey}
          onChange={handleDepartmentChange} wrap />
        <CatalogValueSelect catalogType="employee_status" label="Status" value={form.status ?? ''}
          onChange={(value) => updateField('status', value)} wrap />
        {submitError ? <ErrorState title="Speichern" message={submitError} /> : null}
        <View style={styles.actions}>
          <PremiumButton title="Abbrechen" variant="secondary" onPress={handleCancel} style={styles.actionButton} />
          <PremiumButton title="Mitarbeitende anlegen" onPress={submit} style={styles.actionButton} />
        </View>
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
  card: { gap: spacing.md },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  introCopy: { flex: 1, minWidth: 0, gap: 2 },
  stepBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0872D9', alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  title: { color: '#08213D', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  subtitle: { color: '#60758B', fontSize: 13, lineHeight: 18 },
  primaryGrid: { gap: spacing.md },
  primaryGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minWidth: 180,
  },
  fieldsColumn: { flex: 1, minWidth: 0, gap: spacing.sm },
  inputRow: { gap: spacing.sm },
  inputRowWide: { flexDirection: 'row' },
  inputCell: { flex: 1, minWidth: 0 },
  divider: { height: 1, backgroundColor: '#D6E5F2', marginVertical: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flexGrow: 1, minWidth: 190 },
});
