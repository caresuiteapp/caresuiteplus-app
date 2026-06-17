import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  CareAddressSearch,
  CareCatalogSelect,
  CareDateInput,
  CareMultiCatalogSelect,
} from '@/components/inputs';
import {
  ErrorState,
  FormStepper,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useClientEditWizard } from '@/hooks/useClientEditWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import {
  BILLING_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  type BillingType,
  type ServiceType,
} from '@/types/modules/client';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing, typography } from '@/theme';

const BILLING_OPTIONS = Object.entries(BILLING_TYPE_LABELS) as [BillingType, string][];
const SERVICE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][];

export function ClientEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canEdit = can('office.clients.edit');

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
  } = useClientEditWizard(id);

  const handleSubmit = async () => {
    const ok = await submit();
    if (ok) {
      setTimeout(() => router.replace(clientRecordRoute(id) as never), 1500);
    }
  };

  if (!canEdit) {
    return (
      <CareLightPageShell title="Bearbeiten" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.clients.edit').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (loading) {
    return (
      <CareLightPageShell title="Stammdaten bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Klient:in wird geladen…" />
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
          onPress={() => router.replace(clientRecordRoute(id) as never)}
        />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Stammdaten bearbeiten"
      subtitle={`Schritt ${step + 1} von ${steps.length}`}
    >
      <FormStepper steps={steps} currentStep={step} />
      {submitError ? <ErrorState message={submitError} /> : null}

      {step === 0 ? (
        <SectionPanel title="Stammdaten" subtitle="Person, Pflegegrad und Leistungsart">
          <CareCatalogSelect
            catalogKey="salutation"
            label="Anrede"
            value={form.salutation}
            onChange={(v) => updateField('salutation', v)}
          />
          <PremiumInput
            label="Vorname *"
            value={form.firstName}
            onChangeText={(v) => updateField('firstName', v)}
            error={errors.firstName}
            autoCapitalize="words"
          />
          <PremiumInput
            label="Nachname *"
            value={form.lastName}
            onChangeText={(v) => updateField('lastName', v)}
            error={errors.lastName}
            autoCapitalize="words"
          />
          <CareDateInput
            label="Geburtsdatum"
            value={form.dateOfBirth}
            onChange={(v) => updateField('dateOfBirth', v)}
            error={errors.dateOfBirth}
          />
          <CareCatalogSelect
            catalogKey="gender"
            label="Geschlecht"
            value={form.gender}
            onChange={(v) => updateField('gender', v)}
          />
          <CareCatalogSelect
            catalogKey="care_level"
            label="Pflegegrad"
            value={form.careLevel}
            onChange={(v) => updateField('careLevel', v)}
            error={errors.careLevel}
          />
          <CareMultiCatalogSelect
            catalogKey="leistungsart"
            label="Leistungsart / Modul"
            values={form.careContexts}
            onChange={(vals) => updateField('careContexts', vals as typeof form.careContexts)}
            error={errors.careContexts}
          />
          <Text style={styles.statusHint}>
            Aktueller Status: {WORKFLOW_STATUS_LABELS[form.status]} (Statusänderung über die Akte)
          </Text>
          <PremiumInput
            label="Interne Notizen (Mandant)"
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            multiline
            hint="Nur für das Office-Team sichtbar"
          />
          <PremiumInput
            label="Kostenträger"
            value={form.costCarrier}
            onChangeText={(v) => updateField('costCarrier', v)}
            placeholder="z. B. AOK Nordost"
          />
          <PremiumInput
            label="Versichertennummer"
            value={form.insuranceNumber}
            onChangeText={(v) => updateField('insuranceNumber', v)}
          />
          {form.billingProfileId ? (
            <>
              <Text style={styles.fieldLabel}>Abrechnungsart</Text>
              <View style={styles.chipRow}>
                {BILLING_OPTIONS.map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={[styles.chip, form.billingType === key && styles.chipActive]}
                    onPress={() => updateField('billingType', key)}
                  >
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Leistungsart (Abrechnung)</Text>
              <View style={styles.chipRow}>
                {SERVICE_OPTIONS.map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={[styles.chip, form.serviceType === key && styles.chipActive]}
                    onPress={() => updateField('serviceType', key)}
                  >
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </SectionPanel>
      ) : null}

      {step === 1 ? (
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
          <PremiumInput
            label="Zugangshinweise"
            value={form.accessNotes}
            onChangeText={(v) => updateField('accessNotes', v)}
            multiline
          />
          <PremiumInput
            label="Etage"
            value={form.floor}
            onChangeText={(v) => updateField('floor', v)}
          />
          <PremiumInput
            label="Wohnungsnummer"
            value={form.apartmentNumber}
            onChangeText={(v) => updateField('apartmentNumber', v)}
          />
          <PremiumInput
            label="Zugangscode"
            value={form.accessCode}
            onChangeText={(v) => updateField('accessCode', v)}
          />
          <PremiumInput
            label="Klingel"
            value={form.bellName}
            onChangeText={(v) => updateField('bellName', v)}
          />
          <PremiumInput
            label="Telefon"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            keyboardType="phone-pad"
          />
          <PremiumInput
            label="Mobil"
            value={form.mobile}
            onChangeText={(v) => updateField('mobile', v)}
            keyboardType="phone-pad"
          />
          <PremiumInput
            label="E-Mail"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <PremiumInput
            label="Notfallkontakt Name"
            value={form.emergencyContactName}
            onChangeText={(v) => updateField('emergencyContactName', v)}
          />
          <PremiumInput
            label="Notfallkontakt Telefon"
            value={form.emergencyContactPhone}
            onChangeText={(v) => updateField('emergencyContactPhone', v)}
            keyboardType="phone-pad"
          />
          <PremiumInput
            label="Angehörige:r Name"
            value={form.relativeContactName}
            onChangeText={(v) => updateField('relativeContactName', v)}
          />
          <PremiumInput
            label="Angehörige:r Telefon"
            value={form.relativeContactPhone}
            onChangeText={(v) => updateField('relativeContactPhone', v)}
            keyboardType="phone-pad"
          />
        </SectionPanel>
      ) : null}

      {step === 2 ? (
        <SectionPanel title="Pflege & Kontext" subtitle="Hinweise für Einsatz und Betreuung">
          <PremiumInput
            label="Diagnosen-Hinweise"
            value={form.diagnosesNotes}
            onChangeText={(v) => updateField('diagnosesNotes', v)}
            multiline
            hint="Freitext — keine ICD-Codes"
          />
          <PremiumInput
            label="Mobilität"
            value={form.mobilityNotes}
            onChangeText={(v) => updateField('mobilityNotes', v)}
            multiline
          />
          <PremiumInput
            label="Risiken / Notfallhinweise"
            value={form.riskNotes}
            onChangeText={(v) => updateField('riskNotes', v)}
            multiline
          />
          <PremiumInput
            label="Betreuungsvereinbarung / Hinweise für Mitarbeitende"
            value={form.careAgreementNotes}
            onChangeText={(v) => updateField('careAgreementNotes', v)}
            multiline
          />
          <PremiumInput
            label="Kommunikationshinweise"
            value={form.communicationNotes}
            onChangeText={(v) => updateField('communicationNotes', v)}
            multiline
          />
        </SectionPanel>
      ) : null}

      {step === 3 ? (
        <SectionPanel title="Zusammenfassung" subtitle="Bitte prüfen Sie alle Angaben">
          <PremiumCard accentColor="#FF9500">
            <SummaryRow label="Name" value={`${form.firstName} ${form.lastName}`.trim()} />
            <SummaryRow
              label="Anrede / Geschlecht"
              value={[getCatalogLabel('salutation', form.salutation), getCatalogLabel('gender', form.gender)].filter(Boolean).join(' · ') || '—'}
            />
            <SummaryRow label="Geburtsdatum" value={form.dateOfBirth || '—'} />
            <SummaryRow label="Pflegegrad" value={formatCareLevel(form.careLevel) || '—'} />
            <SummaryRow
              label="Leistungsart"
              value={form.careContexts.map((ctx) => getCatalogLabel('leistungsart', ctx)).join(' · ') || '—'}
            />
            <SummaryRow
              label="Adresse"
              value={[form.street, form.houseNumber, form.zip, form.city].filter(Boolean).join(' ') || '—'}
            />
            <SummaryRow label="Telefon / Mobil" value={[form.phone, form.mobile].filter(Boolean).join(' · ') || '—'} />
            <SummaryRow label="E-Mail" value={form.email || '—'} />
            <SummaryRow
              label="Notfallkontakt"
              value={form.emergencyContactName ? `${form.emergencyContactName} (${form.emergencyContactPhone || '—'})` : '—'}
            />
            <SummaryRow label="Status" value={WORKFLOW_STATUS_LABELS[form.status]} />
          </PremiumCard>
        </SectionPanel>
      ) : null}

      <View style={styles.nav}>
        {!isFirstStep ? (
          <PremiumButton title="Zurück" variant="secondary" onPress={prevStep} />
        ) : (
          <PremiumButton title="Abbrechen" variant="ghost" onPress={() => router.back()} />
        )}
        {!isLastStep ? (
          <PremiumButton title="Weiter" onPress={nextStep} style={styles.navBtn} />
        ) : (
          <PremiumButton
            title="Änderungen speichern"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.navBtn}
          />
        )}
      </View>
    </CareLightPageShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  navBtn: { flex: 1 },
  statusHint: { ...typography.caption, marginTop: spacing.sm },
  fieldLabel: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: { borderColor: '#FF9500', backgroundColor: 'rgba(255,149,0,0.12)' },
  chipText: { ...typography.caption },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  summaryLabel: { ...typography.caption },
  summaryValue: { ...typography.bodyStrong, flex: 1, textAlign: 'right' },
});
