import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CatalogValueSelect } from '@/components/templates';
import { FormScreenHero } from '@/components/forms';
import { CareAddressSearch, CareDateInput } from '@/components/inputs';
import { EmployeeProfilePhotoPicker } from '@/components/office/EmployeeProfilePhotoPicker';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  DetailInfoRow,
  ErrorState,
  FilterChipGroup,
  FormStepper,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useEmployeeEditWizard } from '@/hooks/useEmployeeEditWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { EMPLOYMENT_TYPE_OPTIONS } from '@/lib/office/employeeCatalogLabels';
import { formatEmployeeEditSummary } from '@/lib/office/employeeEditFormMappers';
import { getServiceMode } from '@/lib/services/mode';
import { spacing, typography } from '@/theme';

export function EmployeeEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canEdit = can('office.employees.edit');

  const {
    steps,
    step,
    form,
    errors,
    loading,
    loadError,
    notFound,
    submitting,
    submitError,
    saved,
    updateField,
    nextStep,
    prevStep,
    submit,
    isFirstStep,
    isLastStep,
    isSuccess,
  } = useEmployeeEditWizard(id);

  const handleSubmit = async () => {
    const ok = await submit();
    if (ok) {
      setTimeout(() => router.replace(`/business/office/employees/${id}` as never), 1500);
    }
  };

  if (!canEdit) {
    return (
      <CareLightPageShell title="Bearbeiten" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.employees.edit').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (loading) {
    return (
      <CareLightPageShell title="Stammdaten bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Mitarbeitende:r wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || loadError) {
    return (
      <CareLightPageShell title="Bearbeiten" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={loadError ?? 'Der Datensatz existiert nicht.'}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (isSuccess && saved) {
    return (
      <CareLightPageShell title="Gespeichert" subtitle="Erfolgreich" showBack={false}>
        <SuccessState message="Die Stammdaten wurden erfolgreich aktualisiert." />
        <PremiumButton
          title="Zur Detailansicht"
          fullWidth
          onPress={() => router.replace(`/business/office/employees/${id}` as never)}
        />
      </CareLightPageShell>
    );
  }

  const summaryRows = formatEmployeeEditSummary(form);
  const employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
  }));

  return (
    <CareLightPageShell
      title="Stammdaten bearbeiten"
      subtitle={`Schritt ${step + 1} von ${steps.length}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="OFFICE · MITARBEITENDE"
          title={`${form.firstName} ${form.lastName}`.trim() || 'Mitarbeitende:r'}
          meta={
            getServiceMode() === 'supabase'
              ? 'Stammdaten, Anstellung und Qualifikationen im Mandanten speichern'
              : 'Stammdaten bearbeiten — Demo-Persistenz'
          }
          icon="✏️"
          formMode="edit"
          wpNumber={187}
        />
        <FormStepper steps={steps} currentStep={step} />
        {submitError ? <ErrorState title="Speichern" message={submitError} /> : null}

        {step === 0 ? (
          <SectionPanel title="Stammdaten" subtitle="Person, Rolle und Kontakt">
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
              label="Vorname *"
              value={form.firstName}
              onChangeText={(value) => updateField('firstName', value)}
              error={errors.firstName}
              autoCapitalize="words"
            />
            <PremiumInput
              label="Nachname *"
              value={form.lastName}
              onChangeText={(value) => updateField('lastName', value)}
              error={errors.lastName}
              autoCapitalize="words"
            />
            <PremiumInput
              label="E-Mail"
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
            <PremiumInput
              label="Mobil"
              value={form.mobile}
              onChangeText={(value) => updateField('mobile', value)}
              keyboardType="phone-pad"
            />
            <CatalogValueSelect
              catalogType="employee_role"
              label="Rolle / Funktion"
              required
              value={form.roleKey}
              onChange={(value) => updateField('roleKey', value)}
              error={errors.roleKey}
            />
            <CatalogValueSelect
              catalogType="employee_department"
              label="Abteilung"
              value={form.departmentKey}
              onChange={(value) => updateField('departmentKey', value)}
            />
            <CatalogValueSelect
              catalogType="employee_status"
              label="Status"
              value={form.status}
              onChange={(value) => updateField('status', value)}
            />
            <PremiumInput
              label="Notizen"
              value={form.notes}
              onChangeText={(value) => updateField('notes', value)}
              multiline
              hint="Interne HR-Notizen"
            />
          </SectionPanel>
        ) : null}

        {step === 1 ? (
          <SectionPanel title="Anstellung & Adresse" subtitle="Vertrag, Einsatz und Wohnadresse">
            <CareDateInput
              label="Eintrittsdatum"
              value={form.entryDate}
              onChange={(value) => updateField('entryDate', value)}
            />
            <Text style={styles.fieldLabel}>Vertragsart</Text>
            <FilterChipGroup
              options={employmentTypeOptions}
              value={form.employmentType || employmentTypeOptions[0]?.key || ''}
              onChange={(value) => updateField('employmentType', value)}
            />
            <PremiumInput
              label="Wochenstunden"
              value={form.weeklyHours}
              onChangeText={(value) => updateField('weeklyHours', value)}
              error={errors.weeklyHours}
              keyboardType="decimal-pad"
              placeholder="z. B. 20"
            />
            <CareAddressSearch
              values={{
                street: form.street,
                houseNumber: form.houseNumber,
                zip: form.postalCode,
                city: form.city,
              }}
              onChange={(address) => {
                updateField('street', address.street);
                updateField('houseNumber', address.houseNumber);
                updateField('postalCode', address.zip);
                updateField('city', address.city);
              }}
            />
          </SectionPanel>
        ) : null}

        {step === 2 ? (
          <SectionPanel title="Qualifikationen & Führungszeugnis" subtitle="Schnellerfassung">
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Erste Hilfe</Text>
              <PremiumButton
                title={form.hasFirstAidCertificate ? 'Erfasst' : 'Erfassen'}
                size="sm"
                variant={form.hasFirstAidCertificate ? 'primary' : 'secondary'}
                onPress={() => updateField('hasFirstAidCertificate', !form.hasFirstAidCertificate)}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Führerschein</Text>
              <PremiumButton
                title={form.hasDriverLicense ? 'Erfasst' : 'Erfassen'}
                size="sm"
                variant={form.hasDriverLicense ? 'primary' : 'secondary'}
                onPress={() => updateField('hasDriverLicense', !form.hasDriverLicense)}
              />
            </View>
            {form.hasDriverLicense ? (
              <PremiumInput
                label="Führerscheinklasse"
                value={form.driverLicenseClass}
                onChangeText={(value) => updateField('driverLicenseClass', value)}
                placeholder="z. B. B"
              />
            ) : null}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Führungszeugnis</Text>
              <PremiumButton
                title={form.hasPoliceClearance ? 'Vorhanden' : 'Nicht erfasst'}
                size="sm"
                variant={form.hasPoliceClearance ? 'primary' : 'secondary'}
                onPress={() => updateField('hasPoliceClearance', !form.hasPoliceClearance)}
              />
            </View>
            {form.hasPoliceClearance ? (
              <CareDateInput
                label="Ausstellungsdatum"
                value={form.policeClearanceDate}
                onChange={(value) => updateField('policeClearanceDate', value)}
              />
            ) : null}
            <PremiumButton
              title="Vollständige Personalakte öffnen"
              variant="secondary"
              onPress={() => router.push(`/business/office/employees/${id}/personnel` as never)}
            />
          </SectionPanel>
        ) : null}

        {step === 3 ? (
          <SectionPanel title="Zusammenfassung" subtitle="Bitte prüfen und speichern">
            {summaryRows.map((row) => (
              <DetailInfoRow key={row.label} label={row.label} value={row.value} />
            ))}
            <PremiumButton
              title="Personalakte öffnen"
              variant="secondary"
              onPress={() => router.push(`/business/office/employees/${id}/personnel` as never)}
            />
          </SectionPanel>
        ) : null}

        <View style={styles.actions}>
          {!isFirstStep ? (
            <PremiumButton title="Zurück" variant="secondary" onPress={prevStep} disabled={submitting} />
          ) : null}
          {!isLastStep ? (
            <PremiumButton title="Weiter" onPress={nextStep} disabled={submitting} />
          ) : (
            <PremiumButton title="Speichern" onPress={handleSubmit} loading={submitting} />
          )}
        </View>
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  fieldLabel: { ...typography.caption, marginBottom: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleLabel: { ...typography.body, flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
