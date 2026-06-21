import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { CatalogValueSelect } from '@/components/templates';
import { CareAddressSearch, CareDateInput } from '@/components/inputs';
import { DetailInfoRow } from '@/components/detail';
import { EmployeeProfilePhotoPicker } from '@/components/office/EmployeeProfilePhotoPicker';
import {
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
import { EMPLOYMENT_TYPE_OPTIONS } from '@/lib/office/employeeCatalogLabels';
import { formatEmployeeEditSummary } from '@/lib/office/employeeEditFormMappers';
import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';
import { EMPLOYEE_EDIT_SECTION_INDEX } from '@/lib/office/employeeSectionEditLabels';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { spacing } from '@/theme';

export type EmployeeEditFormProps = {
  employeeId: string;
  onCancel: () => void;
  onUpdated?: () => void;
  onOpenPersonnelRecord?: () => void;
  /** When set, renders a single section without the multi-step wizard. */
  sectionOnly?: EmployeeEditSectionKey;
};

export function EmployeeEditForm({
  employeeId,
  onCancel,
  onUpdated,
  onOpenPersonnelRecord,
  sectionOnly,
}: EmployeeEditFormProps) {
  const content = useAdaptiveContentStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
        profileSection: {
          alignItems: 'center',
          paddingVertical: spacing.sm,
        },
        fieldLabel: { ...content.caption, marginBottom: spacing.xs },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        toggleLabel: { ...content.body, flex: 1, color: content.primary.color },
        actions: {
          flexDirection: 'row',
          gap: spacing.sm,
          flexWrap: 'wrap',
        },
      }),
    [content],
  );

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
  } = useEmployeeEditWizard(employeeId);

  const handleSubmit = async () => {
    const ok = await submit();
    if (ok) {
      onUpdated?.();
    }
  };

  if (loading) {
    return <LoadingState message="Mitarbeitende:r wird geladen…" />;
  }

  if (notFound || loadError) {
    return (
      <View style={styles.scroll}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={loadError ?? 'Der Datensatz existiert nicht.'}
        />
        <PremiumButton title="Schließen" variant="secondary" onPress={onCancel} />
      </View>
    );
  }

  if (isSuccess && saved) {
    return (
      <View style={styles.scroll}>
        <SuccessState message="Die Stammdaten wurden erfolgreich aktualisiert." />
        <PremiumButton title="Schließen" fullWidth onPress={onUpdated ?? onCancel} />
      </View>
    );
  }

  const summaryRows = formatEmployeeEditSummary(form);
  const employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
  }));
  const activeStep = sectionOnly ? EMPLOYEE_EDIT_SECTION_INDEX[sectionOnly] : step;
  const showWizard = !sectionOnly;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {showWizard ? <FormStepper steps={steps} currentStep={step} /> : null}
      {submitError ? <ErrorState title="Speichern" message={submitError} /> : null}

      {activeStep === 0 ? (
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

      {activeStep === 1 ? (
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

      {activeStep === 2 ? (
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
          {onOpenPersonnelRecord ? (
            <PremiumButton
              title="Vollständige Personalakte öffnen"
              variant="secondary"
              onPress={onOpenPersonnelRecord}
            />
          ) : null}
        </SectionPanel>
      ) : null}

      {showWizard && activeStep === 3 ? (
        <SectionPanel title="Zusammenfassung" subtitle="Bitte prüfen und speichern">
          {summaryRows.map((row) => (
            <DetailInfoRow key={row.label} label={row.label} value={row.value} />
          ))}
          {onOpenPersonnelRecord ? (
            <PremiumButton
              title="Personalakte öffnen"
              variant="secondary"
              onPress={onOpenPersonnelRecord}
            />
          ) : null}
        </SectionPanel>
      ) : null}

      <View style={styles.actions}>
        <PremiumButton title="Abbrechen" variant="ghost" onPress={onCancel} disabled={submitting} />
        {showWizard && !isFirstStep ? (
          <PremiumButton title="Zurück" variant="secondary" onPress={prevStep} disabled={submitting} />
        ) : null}
        {showWizard && !isLastStep ? (
          <PremiumButton title="Weiter" onPress={nextStep} disabled={submitting} />
        ) : (
          <PremiumButton title="Speichern" onPress={handleSubmit} loading={submitting} />
        )}
      </View>
    </ScrollView>
  );
}
