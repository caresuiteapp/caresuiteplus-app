import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { confirmAction } from '@/lib/platform/confirmAction';
import { FormScreenHero } from '@/components/forms';
import {
  CareAddressSearch,
  CareCatalogSelect,
  CareCostBearerTypeFields,
  orderedSelectedCostBearerTypes,
  CareDateInput,
  CareDocumentUpload,
  CareMultiCatalogSelect,
  CarePhotoCapturePrepared,
} from '@/components/inputs';
import { CareLightPageShell } from '@/components/layout';
import {
  ErrorState,
  FormStepper,
  LoadingState,
  EmptyState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { COST_BEARER_FIELD_ERRORS } from '@/lib/clients/clientIntakeCostBearerConfig';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { getServiceMode } from '@/lib/services/mode';
import { spacing, typography } from '@/theme';

function StepContent({
  section,
  wizard,
}: {
  section: IntakeSectionKey;
  wizard: ReturnType<typeof useClientIntakeWizard>;
}) {
  const { form, errors, updateField, updateCostBearerTypes, replaceForm, toggleCareContext, toggleArrayField, contextHint } = wizard;

  if (section === 'leistungsart') {
    return (
      <SectionPanel title="Leistungsart / Klient:innenart" subtitle="Mehrfachauswahl">
        <CareMultiCatalogSelect
          catalogKey="leistungsart"
          label="Für welche Art von Unterstützung wird diese Person aufgenommen?"
          values={form.careContexts}
          onChange={(vals) => updateField('careContexts', vals as typeof form.careContexts)}
          error={errors.careContexts}
        />
        {contextHint ? <Text style={styles.hint}>{contextHint}</Text> : null}
      </SectionPanel>
    );
  }

  if (section === 'stammdaten') {
    return (
      <SectionPanel title="Stammdaten">
        <CareCatalogSelect catalogKey="salutation" label="Anrede" value={form.salutation} onChange={(v) => updateField('salutation', v)} />
        <PremiumInput label="Vorname *" value={form.firstName} onChangeText={(v) => updateField('firstName', v)} error={errors.firstName} />
        <PremiumInput label="Nachname *" value={form.lastName} onChangeText={(v) => updateField('lastName', v)} error={errors.lastName} />
        <CareDateInput label="Geburtsdatum *" value={form.dateOfBirth} onChange={(v) => updateField('dateOfBirth', v)} error={errors.dateOfBirth} />
        <CareCatalogSelect catalogKey="gender" label="Geschlecht" value={form.gender} onChange={(v) => updateField('gender', v)} />
        <CareCatalogSelect catalogKey="housing_form" label="Wohnform" value={form.housingForm} onChange={(v) => updateField('housingForm', v)} />
        <CareDateInput label="Aufnahmedatum" value={form.admissionDate} onChange={(v) => updateField('admissionDate', v)} />
        <CareDateInput label="Leistungsbeginn *" value={form.serviceStart} onChange={(v) => updateField('serviceStart', v)} error={errors.serviceStart} />
        <PremiumInput label="Besonderheiten" value={form.specialNotes} onChangeText={(v) => updateField('specialNotes', v)} multiline />
      </SectionPanel>
    );
  }

  if (section === 'adresse_kontakt') {
    return (
      <SectionPanel title="Adresse & Kontakt">
        <CareAddressSearch
          values={{
            street: form.street,
            houseNumber: form.houseNumber,
            zip: form.zip,
            city: form.city,
          }}
          onChange={(address) => {
            updateField('street', address.street);
            updateField('houseNumber', address.houseNumber);
            updateField('zip', address.zip);
            updateField('city', address.city);
          }}
          errors={{
            street: errors.street,
            zip: errors.zip,
            city: errors.city,
          }}
        />
        <PremiumInput label="Telefon" value={form.phone} onChangeText={(v) => updateField('phone', v)} error={errors.phone} />
        <PremiumInput label="Mobil" value={form.mobile} onChangeText={(v) => updateField('mobile', v)} />
        <PremiumInput label="E-Mail" value={form.email} onChangeText={(v) => updateField('email', v)} />
        <CareCatalogSelect catalogKey="contact_method" label="Bevorzugter Kontaktweg" value={form.preferredContact} onChange={(v) => updateField('preferredContact', v)} />
      </SectionPanel>
    );
  }

  if (section === 'versorgung') {
    return (
      <SectionPanel title="Versorgung / Pflege / Betreuung">
        <CareCatalogSelect catalogKey="care_level" label="Pflegegrad" value={form.careLevel} onChange={(v) => updateField('careLevel', v)} error={errors.careLevel} />
        <PremiumInput label="Hausarzt" value={form.familyDoctor} onChangeText={(v) => updateField('familyDoctor', v)} error={errors.familyDoctor} />
        <CareCatalogSelect catalogKey="consulting_types" label="Beratungsart" value={form.consultingType} onChange={(v) => updateField('consultingType', v)} error={errors.consultingType} />
        <PremiumInput label="Beratungsanlass" value={form.consultingReason} onChangeText={(v) => updateField('consultingReason', v)} error={errors.consultingReason} />
        <CareMultiCatalogSelect catalogKey="support_tasks" label="Gewünschte Unterstützung" values={form.supportWishes} onChange={(v) => updateField('supportWishes', v)} error={errors.supportWishes} />
      </SectionPanel>
    );
  }

  if (section === 'kostentraeger') {
    const selectedCostBearerTypes = orderedSelectedCostBearerTypes(form.costBearerTypes);
    const showInsuranceNumber = form.costBearerTypes.includes('pflegekasse')
      || form.costBearerTypes.includes('krankenkasse');

    return (
      <SectionPanel title="Kostenträger / Abrechnung">
        <CareMultiCatalogSelect
          catalogKey="billing_type"
          label="Abrechnungsart *"
          values={form.billingTypes}
          onChange={(v) => updateField('billingTypes', v)}
          error={errors.billingTypes}
        />
        <CareMultiCatalogSelect
          catalogKey="cost_bearer_type"
          label="Kostenträgertyp"
          values={form.costBearerTypes}
          onChange={(v) => updateCostBearerTypes(v)}
          error={errors.costBearerTypes}
        />
        {selectedCostBearerTypes.map((type) => (
          <CareCostBearerTypeFields
            key={type}
            type={type}
            form={form}
            onChange={replaceForm}
            error={errors[COST_BEARER_FIELD_ERRORS[type]]}
          />
        ))}
        {showInsuranceNumber ? (
          <PremiumInput
            label="Versichertennummer / KVNR"
            value={form.insuranceNumber}
            onChangeText={(v) => updateField('insuranceNumber', v)}
            error={errors.insuranceNumber}
          />
        ) : null}
      </SectionPanel>
    );
  }

  if (section === 'angehoerige') {
    return (
      <SectionPanel title="Angehörige / Bevollmächtigte">
        <PremiumInput label="Notfallkontakt Name" value={form.emergencyContactName} onChangeText={(v) => updateField('emergencyContactName', v)} error={errors.emergencyContactName} />
        <PremiumInput label="Notfallkontakt Telefon" value={form.emergencyContactPhone} onChangeText={(v) => updateField('emergencyContactPhone', v)} error={errors.emergencyContactPhone} />
      </SectionPanel>
    );
  }

  if (section === 'notfall_zugang') {
    return (
      <SectionPanel title="Notfall / Zugang / Wohnsituation">
        <CareCatalogSelect catalogKey="home_access" label="Wohnungszugang" value={form.homeAccess} onChange={(v) => updateField('homeAccess', v)} error={errors.homeAccess} />
        <CareCatalogSelect catalogKey="key_status" label="Schlüsselstatus" value={form.keyStatus} onChange={(v) => updateField('keyStatus', v)} />
        <PremiumInput label="Schlüsselnummer" value={form.keyNumber} onChangeText={(v) => updateField('keyNumber', v)} />
        <PremiumInput label="Türcode" value={form.doorCode} onChangeText={(v) => updateField('doorCode', v)} />
        <PremiumInput label="Einrichtung" value={form.facilityName} onChangeText={(v) => updateField('facilityName', v)} error={errors.facilityName} />
        <CareCatalogSelect catalogKey="stationary_areas" label="Wohnbereich" value={form.careArea} onChange={(v) => updateField('careArea', v)} />
        <PremiumInput label="Zimmernummer" value={form.roomNumber} onChangeText={(v) => updateField('roomNumber', v)} error={errors.roomNumber} />
        <CareCatalogSelect catalogKey="pets" label="Haustiere" value={form.pets} onChange={(v) => updateField('pets', v)} />
      </SectionPanel>
    );
  }

  if (section === 'vertraege_einwilligungen') {
    return (
      <SectionPanel title="Verträge & Einwilligungen">
        <PremiumCard>
          <PremiumButton title={form.consentDatenschutz ? '✓ Datenschutz erteilt' : 'Datenschutz einwilligen'} variant="secondary" onPress={() => updateField('consentDatenschutz', !form.consentDatenschutz)} />
          {errors.consentDatenschutz ? <Text style={styles.error}>{errors.consentDatenschutz}</Text> : null}
          <PremiumButton title={form.consentVertrag ? '✓ Vertrag bestätigt' : 'Kundenvertrag bestätigen'} variant="secondary" onPress={() => updateField('consentVertrag', !form.consentVertrag)} />
          {errors.consentVertrag ? <Text style={styles.error}>{errors.consentVertrag}</Text> : null}
        </PremiumCard>
      </SectionPanel>
    );
  }

  if (section === 'dokumente') {
    return (
      <SectionPanel title="Dokumente">
        <CareDocumentUpload label="Dokument hochladen" onPicked={(f) => updateField('documentCategories', [...form.documentCategories, f.name])} />
        <CarePhotoCapturePrepared />
      </SectionPanel>
    );
  }

  if (section === 'module') {
    return (
      <SectionPanel title="Module & Zuständigkeiten">
        <CareMultiCatalogSelect catalogKey="module_assignment" label="Module" values={form.assignedModules} onChange={(v) => updateField('assignedModules', v)} />
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title="Prüfung & Abschluss">
      <Text style={styles.review}>{form.firstName} {form.lastName}</Text>
      <Text style={styles.review}>Leistungsarten: {form.careContexts.join(', ')}</Text>
      <Text style={styles.review}>{form.street}, {form.zip} {form.city}</Text>
    </SectionPanel>
  );
}

export function ClientIntakeWizardScreen() {
  const router = useRouter();
  const wizard = useClientIntakeWizard();
  const isLive = getServiceMode() === 'supabase';
  const {
    steps,
    stepLabels,
    stepIndex,
    currentSection,
    submitting,
    submitError,
    createdId,
    draftLoaded,
    draftRestored,
    nextStep,
    prevStep,
    submit,
    discardDraft,
    isFirstStep,
    isLastStep,
    isSuccess,
  } = wizard;

  const handleSubmit = async () => {
    const id = await submit();
    if (id) setTimeout(() => router.replace(clientRecordRoute(id) as never), 1200);
  };

  const handleCancel = async () => {
    const confirmed = await confirmAction({
      title: 'Aufnahme abbrechen?',
      message: 'Der Entwurf wird verworfen. Alle eingegebenen Daten gehen verloren.',
      confirmLabel: 'Verwerfen',
      cancelLabel: 'Weiter bearbeiten',
    });
    if (!confirmed) return;
    await discardDraft();
    router.replace('/office/clients' as never);
  };

  const handleStartFresh = async () => {
    const confirmed = await confirmAction({
      title: 'Neu beginnen?',
      message: 'Der gespeicherte Entwurf wird gelöscht und Sie starten bei Schritt 1.',
      confirmLabel: 'Neu beginnen',
      cancelLabel: 'Fortsetzen',
    });
    if (!confirmed) return;
    await discardDraft();
  };

  if (isSuccess && createdId) {
    return (
      <CareLightPageShell title="Aufnahme abgeschlossen" showBack={false}>
        <SuccessState message="Klient:in wurde aufgenommen. Weiterleitung zur Akte…" />
      </CareLightPageShell>
    );
  }

  if (!draftLoaded) {
    return (
      <CareLightPageShell title="Neuaufnahme" subtitle="Entwurf laden…">
        <LoadingState message="Entwurf wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (submitting) {
    return (
      <CareLightPageShell title="Neuaufnahme" subtitle="Speichern…">
        <LoadingState message="Aufnahme wird gespeichert…" />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Neuaufnahme"
      subtitle={`Schritt ${stepIndex + 1} von ${steps.length}`}
      onBack={() => router.back()}
    >
      <FormScreenHero
        eyebrow="OFFICE · KLIENT:INNEN"
        title="Klient:in aufnehmen"
        meta="Leistungsart wählen — danach passen sich die Schritte an"
        icon="👤"
        formMode="create"
        step={{ current: stepIndex + 1, total: steps.length }}
        preparedOnly={!isLive}
        preparedMessage={
          isLive
            ? 'Klient:innen werden mandantenbezogen aufgenommen.'
            : 'Klient:innen werden im Demo-Mandanten aufgenommen — Live-Persistenz nach Remote-Migrationen.'
        }
      />
      <FormStepper steps={stepLabels} currentStep={stepIndex} />
      <ScrollView style={styles.scroll}>
        {draftRestored ? (
          <PremiumCard accentColor="#007AFF">
            <Text style={styles.draftBanner}>
              Entwurf wiederhergestellt — Sie setzen bei Schritt {stepIndex + 1} fort.
            </Text>
            <PremiumButton title="Neu beginnen" variant="ghost" onPress={handleStartFresh} />
          </PremiumCard>
        ) : null}
        {currentSection === 'leistungsart' && wizard.form.careContexts.length === 0 ? (
          <EmptyState
            title="Leistungsart wählen"
            message="Wählen Sie mindestens eine Leistungsart, um die Aufnahme zu starten."
          />
        ) : null}
        <StepContent section={currentSection} wizard={wizard} />
        {submitError ? <ErrorState message={submitError} /> : null}
      </ScrollView>
      <View style={styles.actions}>
        <PremiumButton title="Abbrechen" variant="ghost" onPress={handleCancel} />
        {!isFirstStep ? <PremiumButton title="Zurück" variant="secondary" onPress={prevStep} /> : null}
        {isLastStep ? (
          <PremiumButton title="Aufnahme abschließen" loading={submitting} onPress={handleSubmit} style={styles.primaryAction} />
        ) : (
          <PremiumButton title="Weiter" onPress={nextStep} style={styles.primaryAction} />
        )}
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, alignItems: 'center' },
  primaryAction: { flex: 1 },
  draftBanner: { ...typography.body, marginBottom: spacing.sm },
  hint: { ...typography.caption, marginTop: spacing.sm, color: '#666' },
  error: { color: '#c00', marginTop: spacing.xs },
  review: { ...typography.body, marginBottom: spacing.xs },
});
