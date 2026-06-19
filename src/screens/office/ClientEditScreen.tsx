import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ClientModuleAssignmentPanel } from '@/components/office/ClientModuleAssignmentPanel';
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
import { useClientEditWizard } from '@/hooks/useClientEditWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchClientDetail } from '@/lib/office/clientDetailService';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing, typography } from '@/theme';

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
      {!form.firstName.trim() && !form.lastName.trim() && step === 0 ? (
        <EmptyState title="Stammdaten" message="Bitte Vor- und Nachname erfassen." />
      ) : null}
      {submitError ? <ErrorState message={submitError} /> : null}

      {step === 0 ? (
        <SectionPanel title="Stammdaten" subtitle="Pflichtangaben zur Person">
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
          <PremiumInput
            label="Geburtsdatum"
            value={form.dateOfBirth}
            onChangeText={(v) => updateField('dateOfBirth', v)}
            error={errors.dateOfBirth}
            placeholder="JJJJ-MM-TT"
          />
        </SectionPanel>
      ) : null}

      {step === 1 ? (
        <SectionPanel title="Adresse & Kontakt">
          <PremiumInput
            label="Straße *"
            value={form.street}
            onChangeText={(v) => updateField('street', v)}
            error={errors.street}
          />
          <PremiumInput
            label="PLZ *"
            value={form.zip}
            onChangeText={(v) => updateField('zip', v)}
            error={errors.zip}
            keyboardType="numeric"
          />
          <PremiumInput
            label="Ort *"
            value={form.city}
            onChangeText={(v) => updateField('city', v)}
            error={errors.city}
          />
          <PremiumInput
            label="Telefon"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
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
        </SectionPanel>
      ) : null}

      {step === 2 ? (
        <SectionPanel title="Pflege">
          <PremiumInput
            label="Pflegegrad *"
            value={form.careLevel}
            onChangeText={(v) => updateField('careLevel', v)}
            error={errors.careLevel}
            placeholder="z. B. PG 2"
          />
          <PremiumInput
            label="Notizen"
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            multiline
          />
          <ClientModuleAssignmentPanel
            selected={form.portalModules}
            onChange={(modules) => updateField('portalModules', modules)}
          />
          <Text style={styles.statusHint}>
            Aktueller Status: {WORKFLOW_STATUS_LABELS[form.status]} (Statusänderung über Detailansicht)
          </Text>
        </SectionPanel>
      ) : null}

      {step === 3 ? (
        <SectionPanel title="Zusammenfassung" subtitle="Bitte prüfen Sie alle Angaben">
          <PremiumCard accentColor="#FF9500">
            <SummaryRow label="Name" value={`${form.firstName} ${form.lastName}`} />
            <SummaryRow label="Geburtsdatum" value={form.dateOfBirth || '—'} />
            <SummaryRow label="Adresse" value={`${form.street}, ${form.zip} ${form.city}`} />
            <SummaryRow label="Telefon" value={form.phone || '—'} />
            <SummaryRow label="Pflegegrad" value={formatCareLevel(form.careLevel) || '—'} />
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
