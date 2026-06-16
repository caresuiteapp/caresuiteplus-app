import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { CatalogValueSelect } from '@/components/templates';
import { FormScreenHero } from '@/components/forms';
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
import { useEmployeeWizard } from '@/hooks/useEmployeeWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { createEmployee } from '@/lib/office/employeeCreateService';
import { spacing } from '@/theme';

export function EmployeeCreateScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { form, errors, submitting, submitError, createdId, updateField, submit, cancel, isSuccess } =
    useEmployeeWizard();
  const [employeeStatus, setEmployeeStatus] = useState('aktiv');

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
      <CareLightPageShell title="Angelegt" subtitle="WP 186">
        <SuccessState message="Mitarbeitende:r wurde im Demo-Mandanten angelegt." />
        <PremiumButton
          title="Zum Profil"
          fullWidth
          onPress={() => router.replace(`/business/office/employees/${createdId}` as never)}
        />
      </CareLightPageShell>
    );
  }

  const isFormEmpty =
    !form.firstName.trim() &&
    !form.lastName.trim() &&
    !form.email.trim() &&
    !form.jobTitle.trim();

  return (
    <CareLightPageShell title="Mitarbeitende anlegen" subtitle="WP 186">
      <FormScreenHero
        eyebrow="OFFICE · MITARBEITENDE"
        title="Mitarbeitende anlegen"
        meta="Stammdaten und Rolle im Demo-Mandanten erfassen"
        icon="🧑‍⚕️"
        formMode="create"
        wpNumber={186}
        preparedMessage="HR-Vollprofil folgt in Kürze — derzeit Demo-Persistenz."
      />
      {isFormEmpty ? (
        <EmptyState title="Neues Profil" message="Pflichtfelder unten ausfüllen und anlegen." />
      ) : null}
      <PremiumCard style={styles.card}>
        <PremiumInput
          label="Vorname"
          value={form.firstName}
          onChangeText={(v) => updateField('firstName', v)}
          error={errors.firstName}
        />
        <PremiumInput
          label="Nachname"
          value={form.lastName}
          onChangeText={(v) => updateField('lastName', v)}
          error={errors.lastName}
        />
        <PremiumInput
          label="E-Mail"
          value={form.email}
          onChangeText={(v) => updateField('email', v)}
          error={errors.email}
        />
        <PremiumInput label="Telefon" value={form.phone} onChangeText={(v) => updateField('phone', v)} />
        <PremiumInput
          label="Rolle / Titel"
          value={form.jobTitle}
          onChangeText={(v) => updateField('jobTitle', v)}
          error={errors.jobTitle}
        />
        <PremiumInput
          label="Abteilung"
          value={form.department}
          onChangeText={(v) => updateField('department', v)}
        />
        <CatalogValueSelect
          catalogType="employee_status"
          label="Status (Katalog)"
          value={employeeStatus}
          onChange={setEmployeeStatus}
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
});
