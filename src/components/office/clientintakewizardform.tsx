import { AssistCatalogMultiSelect } from '@/components/office/assistCatalog/AssistCatalogMultiSelect';
import { ClientFundingSourceSelector } from '@/components/office/ClientFundingSourceSelector';
import { DocumentModuleTemplatesPanel } from '@/components/documents/DocumentModuleTemplatesPanel';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CareCatalogSelect,
  CareAddressSearch,
  CareCostBearerTypeFields,
  CareDateInput,
  CareDocumentUpload,
  CareIntakeDocumentsStepPanel,
  CareMultiCatalogSelect,
  CarePhotoCapturePrepared,
} from '@/components/inputs';
import {
  ErrorState,
  FilterChipGroup,
  FormStepper,
  InfoBanner,
  LoadingState,
  EmptyState,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import {
  AuroraGradientButton,
  AuroraSecondaryButton,
} from '@/components/aurora';
import {
  ClientWorkspaceLiveBadge,
  ClientWorkspacePanel,
} from '@/components/office/ClientWorkspacePrimitives';
import { useClientIntakeWizard, type ClientIntakeWizardMode } from '@/hooks/useClientIntakeWizard';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import {
  COST_BEARER_FIELD_ERRORS,
  hasGkvCostBearerSelected,
  isCostBearerTypeKey,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { spacing } from '@/theme';

function ClientIntakeJourneyHeader({
  stepIndex,
  stepLabels,
  stepStatuses,
  isEditMode,
}: {
  stepIndex: number;
  stepLabels: string[];
  stepStatuses: ('pending' | 'active' | 'completed' | 'error')[];
  isEditMode: boolean;
}) {
  const completedSteps = stepStatuses.filter((status) => status === 'completed').length;
  const progress = Math.max(4, Math.round(((stepIndex + 1) / Math.max(stepLabels.length, 1)) * 100));
  const hasErrors = stepStatuses.some((status) => status === 'error');

  return (
    <ClientWorkspacePanel
      eyebrow={isEditMode ? 'Digitale Aktenpflege' : 'Geführte Neuaufnahme'}
      title={stepLabels[stepIndex] ?? 'Klient:in aufnehmen'}
      subtitle={`Schritt ${stepIndex + 1} von ${stepLabels.length} · ${completedSteps} Abschnitte vollständig`}
      compact
      accessory={
        <ClientWorkspaceLiveBadge
          label={hasErrors ? 'Angaben prüfen' : 'Automatisch gesichert'}
          connected={!hasErrors}
        />
      }
    >
      <View style={stylesStatic.progressTrack}>
        <View style={[stylesStatic.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={stylesStatic.journeyMeta}>
        <Text style={stylesStatic.journeyHint}>
          Sie können abgeschlossene Abschnitte direkt auswählen und später weiterbearbeiten.
        </Text>
        <Text style={stylesStatic.journeyProgress}>{progress}%</Text>
      </View>
    </ClientWorkspacePanel>
  );
}

export function ClientIntakeSectionContent({
  section,
  wizard,
  contentStyles,
  panelViewContext,
  clientId,
  showIntakeOnlyFields = true,
}: {
  section: IntakeSectionKey;
  wizard: ReturnType<typeof useClientIntakeWizard>;
  contentStyles: ReturnType<typeof useAdaptiveContentStyles>;
  /** Use `form` when rendered inside AppGlassModal section edits. */
  panelViewContext?: LlganViewContext;
  clientId?: string;
  /** Hides intake-only questions that are not part of the persisted client profile. */
  showIntakeOnlyFields?: boolean;
}) {
  const { form, errors, updateField, updateFundingSources, updateCostBearerTypes, contextHint, tenantId, replaceForm, createdId } = wizard;
  const resolvedClientId = clientId ?? createdId ?? undefined;
  const panelCtx = panelViewContext
    ? { viewContext: panelViewContext, onDarkSurface: true }
    : { onDarkSurface: true };

  if (section === 'leistungsart') {
    return (
      <SectionPanel {...panelCtx} title="Leistungsart / Klient:innenart" subtitle="Mehrfachauswahl">
        <CareMultiCatalogSelect
          catalogKey="leistungsart"
          label="Für welche Art von Unterstützung wird diese Person aufgenommen?"
          values={form.careContexts}
          onChange={(vals) => updateField('careContexts', vals as typeof form.careContexts)}
          error={errors.careContexts}
        />
        {contextHint ? <Text style={contentStyles.caption}>{contextHint}</Text> : null}
      </SectionPanel>
    );
  }

  if (section === 'stammdaten') {
    return (
      <SectionPanel {...panelCtx} title="Stammdaten">
        <CareCatalogSelect catalogKey="client_status" label="Status" value={form.status} onChange={(v) => updateField('status', v)} />
        <CareCatalogSelect catalogKey="salutation" label="Anrede" value={form.salutation} onChange={(v) => updateField('salutation', v)} />
        <PremiumInput label="Vorname *" value={form.firstName} onChangeText={(v) => updateField('firstName', v)} error={errors.firstName} />
        <PremiumInput label="Nachname *" value={form.lastName} onChangeText={(v) => updateField('lastName', v)} error={errors.lastName} />
        <CareDateInput label="Geburtsdatum *" value={form.dateOfBirth} onChange={(v) => updateField('dateOfBirth', v)} error={errors.dateOfBirth} />
        <CareCatalogSelect catalogKey="gender" label="Geschlecht" value={form.gender} onChange={(v) => updateField('gender', v)} />
        <CareCatalogSelect catalogKey="housing_form" label="Wohnform" value={form.housingForm} onChange={(v) => updateField('housingForm', v)} />
        <CareDateInput label="Aufnahmedatum" value={form.admissionDate} onChange={(v) => updateField('admissionDate', v)} />
        <CareDateInput label="Leistungsbeginn *" value={form.serviceStart} onChange={(v) => updateField('serviceStart', v)} error={errors.serviceStart} />
        <PremiumInput label="Interne Hinweise" value={form.specialNotes} onChangeText={(v) => updateField('specialNotes', v)} multiline hint="Nur für Office sichtbar" />
      </SectionPanel>
    );
  }

  if (section === 'adresse_kontakt') {
    return (
      <SectionPanel {...panelCtx} title="Adresse & Kontakt">
        <CareAddressSearch
          values={{ street: form.street, houseNumber: form.houseNumber, zip: form.zip, city: form.city }}
          onChange={(address) => {
            updateField('street', address.street);
            updateField('houseNumber', address.houseNumber);
            updateField('zip', address.zip);
            updateField('city', address.city);
          }}
          errors={{ street: errors.street, zip: errors.zip, city: errors.city }}
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
      <SectionPanel {...panelCtx} title="Versorgung / Pflege / Betreuung">
        {!showIntakeOnlyFields ? (
          <>
            <CareCatalogSelect catalogKey="care_level" label="Pflegegrad" value={form.careLevel} onChange={(v) => updateField('careLevel', v)} error={errors.careLevel} />
            <CareCatalogSelect catalogKey="care_level_status" label="Pflegegrad-Status" value={form.careLevelStatus} onChange={(v) => updateField('careLevelStatus', v)} />
            <CareDateInput label="Pflegegrad gültig ab" value={form.careLevelValidFrom} onChange={(v) => updateField('careLevelValidFrom', v)} />
          </>
        ) : null}
        <PremiumInput label="Hausarzt" value={form.familyDoctor} onChangeText={(v) => updateField('familyDoctor', v)} error={errors.familyDoctor} />
        {showIntakeOnlyFields ? (
          <>
            <CareCatalogSelect catalogKey="consulting_types" label="Beratungsart" value={form.consultingType} onChange={(v) => updateField('consultingType', v)} error={errors.consultingType} />
            <PremiumInput label="Beratungsanlass" value={form.consultingReason} onChangeText={(v) => updateField('consultingReason', v)} error={errors.consultingReason} />
          </>
        ) : null}
        <CareMultiCatalogSelect catalogKey="support_tasks" label="Gewünschte Unterstützung (System)" values={form.supportWishes} onChange={(v) => updateField('supportWishes', v)} error={errors.supportWishes} />
        <AssistCatalogMultiSelect catalogKey="assist.intake.service_wish" label="Leistungswunsch (Office-Katalog)" values={form.supportWishes} onChange={(v) => updateField('supportWishes', v)} />
        <PremiumInput label="Bevorzugte Zeiten" value={form.preferredTimes.join('\n')} onChangeText={(v) => updateField('preferredTimes', v.split('\n').map((entry) => entry.trim()).filter(Boolean))} multiline />
        <PremiumInput label="Ausgeschlossene Zeiten" value={form.excludedTimes.join('\n')} onChangeText={(v) => updateField('excludedTimes', v.split('\n').map((entry) => entry.trim()).filter(Boolean))} multiline />
        <PremiumInput label="Mobilität" value={form.mobility} onChangeText={(v) => updateField('mobility', v)} multiline />
        <PremiumInput label="Orientierung" value={form.orientation} onChangeText={(v) => updateField('orientation', v)} multiline />
        <PremiumInput label="Kommunikation" value={form.communication} onChangeText={(v) => updateField('communication', v)} multiline />
      </SectionPanel>
    );
  }

  if (section === 'kostentraeger') {
    const selectedCostBearerTypes = form.costBearerTypes.filter(isCostBearerTypeKey);

    return (
      <SectionPanel {...panelCtx} title="Kostenträger / Abrechnung">
        {showIntakeOnlyFields ? (
          <>
            <CareCatalogSelect catalogKey="care_level" label="Pflegegrad *" value={form.careLevel} onChange={(v) => updateField('careLevel', v)} error={errors.careLevel} />
            <CareCatalogSelect catalogKey="care_level_status" label="Pflegegrad-Status" value={form.careLevelStatus} onChange={(v) => updateField('careLevelStatus', v)} />
            <CareDateInput label="Pflegegrad gültig ab" value={form.careLevelValidFrom} onChange={(v) => updateField('careLevelValidFrom', v)} />
          </>
        ) : null}
        <ClientFundingSourceSelector
          values={form.fundingSources}
          onChange={updateFundingSources}
          error={errors.fundingSources}
        />
        <CareMultiCatalogSelect
          catalogKey="cost_bearer_type"
          label="Kostenträgertyp"
          values={form.costBearerTypes}
          onChange={updateCostBearerTypes}
          error={errors.costBearerTypes}
        />
        {selectedCostBearerTypes.map((type) => (
          <CareCostBearerTypeFields
            key={type}
            type={type}
            form={form}
            onChange={replaceForm}
            tenantId={tenantId ?? undefined}
            error={errors[COST_BEARER_FIELD_ERRORS[type]]}
          />
        ))}
        {hasGkvCostBearerSelected(form.costBearerTypes) ? (
          <PremiumInput
            label="Versichertennummer / KVNR"
            value={form.insuranceNumber}
            onChangeText={(value) => updateField('insuranceNumber', value)}
            error={errors.insuranceNumber}
          />
        ) : null}
      </SectionPanel>
    );
  }

  if (section === 'angehoerige') {
    return (
      <SectionPanel {...panelCtx} title="Angehörige / Bevollmächtigte">
        <PremiumInput label="Notfallkontakt Name" value={form.emergencyContactName} onChangeText={(v) => updateField('emergencyContactName', v)} error={errors.emergencyContactName} />
        <PremiumInput label="Notfallkontakt Telefon" value={form.emergencyContactPhone} onChangeText={(v) => updateField('emergencyContactPhone', v)} error={errors.emergencyContactPhone} />
      </SectionPanel>
    );
  }

  if (section === 'notfall_zugang') {
    return (
      <SectionPanel {...panelCtx} title="Notfall / Zugang / Wohnsituation">
        <CareMultiCatalogSelect
          catalogKey="home_access"
          label="Wohnungszugang *"
          values={form.homeAccess}
          onChange={(values) => updateField('homeAccess', values)}
          error={errors.homeAccess}
        />
        <CareCatalogSelect catalogKey="key_status" label="Schlüsselstatus" value={form.keyStatus} onChange={(v) => updateField('keyStatus', v)} />
        <PremiumInput
          label="Schlüsselnummer"
          nativeID="client-intake-key-number"
          value={form.keyNumber}
          onChangeText={(v) => updateField('keyNumber', v)}
          sensitiveBusinessValue
        />
        <PremiumInput
          label="Schlüsseltresor-Code"
          nativeID="client-intake-key-safe-code"
          value={form.keySafeCode}
          onChangeText={(v) => updateField('keySafeCode', v)}
          secureTextEntry={Platform.OS !== 'web'}
          sensitiveBusinessValue
        />
        <PremiumInput label="Türcode" value={form.doorCode} onChangeText={(v) => updateField('doorCode', v)} />
        <PremiumInput label="Klingelname" value={form.bellName} onChangeText={(v) => updateField('bellName', v)} />
        <PremiumInput label="Etage" value={form.floor} onChangeText={(v) => updateField('floor', v)} />
        <FilterChipGroup
          options={[{ key: 'nein', label: 'Kein Aufzug' }, { key: 'ja', label: 'Aufzug vorhanden' }]}
          value={form.elevatorAvailable ? 'ja' : 'nein'}
          onChange={(v) => updateField('elevatorAvailable', v === 'ja')}
        />
        <PremiumInput label="Parkhinweise" value={form.parkingNotes} onChangeText={(v) => updateField('parkingNotes', v)} multiline />
        <PremiumInput label="Zugangshinweise" value={form.accessNotes} onChangeText={(v) => updateField('accessNotes', v)} multiline />
        <PremiumInput label="Gefahren / Sturzgefahr" value={form.hazardNotes} onChangeText={(v) => updateField('hazardNotes', v)} multiline />
        <PremiumInput label="Einrichtung" value={form.facilityName} onChangeText={(v) => updateField('facilityName', v)} error={errors.facilityName} />
        <CareCatalogSelect catalogKey="stationary_areas" label="Wohnbereich" value={form.careArea} onChange={(v) => updateField('careArea', v)} />
        <PremiumInput label="Zimmernummer" value={form.roomNumber} onChangeText={(v) => updateField('roomNumber', v)} error={errors.roomNumber} />
        <CareCatalogSelect catalogKey="pets" label="Haustiere" value={form.pets} onChange={(v) => updateField('pets', v)} />
        <FilterChipGroup
          options={[{ key: 'nein', label: 'Nichtraucherhaushalt' }, { key: 'ja', label: 'Raucherhaushalt' }]}
          value={form.smokerHousehold ? 'ja' : 'nein'}
          onChange={(v) => updateField('smokerHousehold', v === 'ja')}
        />
        <PremiumInput label="Hilfsmittel vor Ort" value={form.aidsOnSite} onChangeText={(v) => updateField('aidsOnSite', v)} multiline />
        <PremiumInput label="Hygienehinweise" value={form.hygieneNotes} onChangeText={(v) => updateField('hygieneNotes', v)} multiline />
        <PremiumInput label="Infektionshinweise" value={form.infectionNotes} onChangeText={(v) => updateField('infectionNotes', v)} multiline />
      </SectionPanel>
    );
  }

  if (section === 'vertraege_einwilligungen') {
    return (
      <CareIntakeDocumentsStepPanel
        form={form}
        errors={errors}
        tenantId={tenantId}
        onChange={replaceForm}
        panelViewContext={panelViewContext}
      />
    );
  }

  if (section === 'dokumente') {
    return (
      <>
        <SectionPanel {...panelCtx} title="Dokumente">
          <CareDocumentUpload label="Dokument hochladen" onPicked={(f) => updateField('documentCategories', [...form.documentCategories, f.name])} />
          <CarePhotoCapturePrepared />
        </SectionPanel>
        <DocumentModuleTemplatesPanel
          tenantId={tenantId}
          targetModule="assist"
          targetArea="intake"
          clientId={resolvedClientId}
        />
      </>
    );
  }

  if (section === 'module') {
    return (
      <SectionPanel {...panelCtx} title="Module & Zuständigkeiten">
        <CareMultiCatalogSelect catalogKey="module_assignment" label="Module" values={form.assignedModules} onChange={(v) => updateField('assignedModules', v)} />
      </SectionPanel>
    );
  }

  return (
    <SectionPanel {...panelCtx} title="Prüfung & Abschluss">
      <Text style={contentStyles.body}>{form.firstName} {form.lastName}</Text>
      <Text style={contentStyles.body}>Leistungsarten: {form.careContexts.join(', ')}</Text>
      <Text style={contentStyles.body}>{form.street}, {form.zip} {form.city}</Text>
    </SectionPanel>
  );
}

export type ClientIntakeWizardFormProps = {
  mode?: ClientIntakeWizardMode;
  clientId?: string;
  onCancel?: () => void;
  onCreated?: (clientId: string) => void;
  onUpdated?: (clientId: string) => void;
  showHero?: boolean;
};

export function ClientIntakeWizardForm({
  mode = 'create',
  clientId,
  onCancel,
  onCreated,
  onUpdated,
  showHero = true,
}: ClientIntakeWizardFormProps) {
  const wizard = useClientIntakeWizard({ mode, clientId });
  const contentStyles = useAdaptiveContentStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        scroll: { flex: 1 },
        scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
        journey: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
        stepperScroll: { flexGrow: 0 },
        stepperContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
        footer: {
          borderTopWidth: 1,
          borderTopColor: careSuiteAuroraTheme.glass.borderStrong,
          padding: spacing.md,
          gap: spacing.sm,
          backgroundColor: careSuiteAuroraTheme.glass.backgroundStrong,
        },
        footerRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
        actionBtn: { flex: 1, minWidth: 120 },
        draftRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
        successWrap: { padding: spacing.md },
      }),
    [],
  );
  const {
    steps,
    stepLabels,
    stepIndex,
    currentSection,
    submitting,
    submitError,
    createdId,
    loading,
    loadError,
    notFound,
    isEditMode,
    nextStep,
    prevStep,
    goToStep,
    stepStatuses,
    submit,
    saveDraft,
    discardDraft,
    draftRestored,
    draftSaveFeedback,
    isFirstStep,
    isLastStep,
    isSuccess,
  } = wizard;

  const handleSubmit = async () => {
    const id = await submit();
    if (id) {
      if (isEditMode) {
        onUpdated?.(id);
      } else {
        onCreated?.(id);
      }
    }
  };

  if (loading) {
    return <LoadingState message="Klient:in wird geladen…" />;
  }

  if (notFound || loadError) {
    return <ErrorState title={notFound ? 'Nicht gefunden' : 'Fehler'} message={loadError ?? 'Der Datensatz existiert nicht.'} />;
  }

  if (isSuccess && createdId) {
    return (
      <View style={styles.successWrap}>
        <SuccessState
          message={isEditMode ? 'Stammdaten wurden aktualisiert.' : 'Klient:in wurde aufgenommen.'}
        />
      </View>
    );
  }

  if (submitting) {
    return <LoadingState message={isEditMode ? 'Änderungen werden gespeichert…' : 'Aufnahme wird gespeichert…'} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.journey}>
        <ClientIntakeJourneyHeader
          stepIndex={stepIndex}
          stepLabels={stepLabels}
          stepStatuses={stepStatuses}
          isEditMode={isEditMode}
        />
      </View>
      <ScrollView
        horizontal
        style={styles.stepperScroll}
        contentContainerStyle={styles.stepperContent}
        showsHorizontalScrollIndicator={false}
      >
        <View style={{ width: Math.max(720, stepLabels.length * 118) }}>
          <FormStepper
            steps={stepLabels}
            currentStep={stepIndex}
            onStepPress={goToStep}
            stepStatuses={stepStatuses}
          />
        </View>
      </ScrollView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {draftRestored ? (
          <InfoBanner message="Entwurf geladen" />
        ) : null}
        {draftSaveFeedback ? (
          <InfoBanner
            message={draftSaveFeedback.variant === 'warning' ? draftSaveFeedback.message : 'Entwurf gespeichert'}
          />
        ) : null}
        {showHero && stepIndex === 0 ? (
          <Text style={contentStyles.caption}>
            Schritt {stepIndex + 1} von {steps.length} · {isEditMode ? 'Stammdaten bearbeiten' : 'Klient:in aufnehmen'}
          </Text>
        ) : null}
        {currentSection === 'leistungsart' && wizard.form.careContexts.length === 0 ? (
          <EmptyState
            title="Leistungsart wählen"
            message="Wählen Sie mindestens eine Leistungsart, um die Aufnahme zu starten."
          />
        ) : null}
        <ClientIntakeSectionContent section={currentSection} wizard={wizard} contentStyles={contentStyles} clientId={clientId} />
        {submitError ? <ErrorState message={submitError} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        {!isEditMode ? (
          <View style={styles.draftRow}>
            <AuroraSecondaryButton label="Als Entwurf speichern" variant="ghost" onPress={() => void saveDraft()} style={styles.actionBtn} />
            <AuroraSecondaryButton label="Neu beginnen" variant="ghost" onPress={() => void discardDraft()} style={styles.actionBtn} />
          </View>
        ) : null}
        <View style={styles.footerRow}>
          {!isFirstStep ? (
            <AuroraSecondaryButton label="← Zurück" onPress={prevStep} style={styles.actionBtn} />
          ) : onCancel ? (
            <AuroraSecondaryButton label="Abbrechen" variant="ghost" onPress={onCancel} style={styles.actionBtn} />
          ) : null}
          {isLastStep ? (
            <AuroraGradientButton
              label={isEditMode ? 'Änderungen speichern' : 'Klient:in aktivieren'}
              loading={submitting}
              onPress={handleSubmit}
              style={styles.actionBtn}
            />
          ) : (
            <AuroraGradientButton label="Weiter →" onPress={nextStep} style={styles.actionBtn} />
          )}
        </View>
      </View>
    </View>
  );
}

const stylesStatic = StyleSheet.create({
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: careRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: careSuiteAuroraTheme.glass.border,
  },
  progressFill: {
    height: '100%',
    borderRadius: careRadius.full,
    backgroundColor: careSuiteAuroraTheme.accent.cyan,
  },
  journeyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
  },
  journeyHint: {
    flex: 1,
    color: careSuiteAuroraTheme.text.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  journeyProgress: {
    color: careSuiteAuroraTheme.accent.cyan,
    fontSize: 13,
    fontWeight: '900',
  },
});
