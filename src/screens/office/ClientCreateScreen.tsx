import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { CatalogValueSelect } from '@/components/templates';
import { FormScreenHero } from '@/components/forms';
import { CareLightPageShell } from '@/components/layout';
import {
  ErrorState,
  FormStepper,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useClientWizard } from '@/hooks/useClientWizard';
import {
  BILLING_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  TASK_CATEGORY_LABELS,
  type BillingType,
  type ServiceType,
  type TaskCategory,
} from '@/types/modules/client';
import { useDropdownOptions } from '@/hooks/templates';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { spacing, typography } from '@/theme';

const BILLING_OPTIONS = Object.entries(BILLING_TYPE_LABELS) as [BillingType, string][];
const SERVICE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][];

export function ClientCreateScreen() {
  const router = useRouter();
  const {
    steps,
    step,
    form,
    errors,
    submitting,
    submitError,
    createdId,
    updateField,
    toggleTaskCategory,
    nextStep,
    prevStep,
    cancel,
    submit,
    isFirstStep,
    isLastStep,
    isSuccess,
    isProduction,
  } = useClientWizard();
  const { options: taskCategoryOptions } = useDropdownOptions('task_category');

  const [clientStatusKey, setClientStatusKey] = useState('aktiv');

  const handleCancel = () => {
    cancel();
    router.back();
  };

  const handleSubmit = async () => {
    const id = await submit();
    if (id) {
      setTimeout(() => router.replace(clientRecordRoute(id) as never), 1500);
    }
  };

  if (isSuccess && createdId) {
    return (
      <CareLightPageShell title="Klient:in angelegt" subtitle="Erfolgreich" showBack={false}>
        <SuccessState message="Die Klient:in wurde erfolgreich angelegt. Weiterleitung…" />
        <PremiumButton title="Zur Detailansicht" fullWidth onPress={() => router.replace(clientRecordRoute(createdId) as never)} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Klient:in anlegen" subtitle={`Schritt ${step + 1} von ${steps.length}`} onBack={handleCancel}>
      <FormScreenHero
        eyebrow="OFFICE · KLIENT:INNEN"
        title="Klient:in anlegen"
        meta={isProduction ? 'Stammdaten und Adresse — Live-Persistenz im Mandanten' : 'Mehrstufiger Wizard — Stammdaten, Pflegegrad, Einwilligungen'}
        icon="👤"
        formMode="create"
        wpNumber={184}
        step={{ current: step + 1, total: steps.length }}
        preparedMessage={
          isProduction
            ? 'Klient:innen werden mandantenbezogen angelegt.'
            : 'Klient:innen werden im Demo-Mandanten angelegt — Live-Persistenz nach Remote-Migrationen.'
        }
      />
      <FormStepper steps={steps} currentStep={step} />
      {submitError ? <ErrorState message={submitError} /> : null}

      {step === 0 ? (
        <SectionPanel title="Stammdaten" subtitle="Pflichtangaben zur Person">
          <PremiumInput label="Vorname *" value={form.firstName} onChangeText={(v) => updateField('firstName', v)} error={errors.firstName} autoCapitalize="words" />
          <PremiumInput label="Nachname *" value={form.lastName} onChangeText={(v) => updateField('lastName', v)} error={errors.lastName} autoCapitalize="words" />
          <PremiumInput label="Geburtsdatum" value={form.dateOfBirth} onChangeText={(v) => updateField('dateOfBirth', v)} error={errors.dateOfBirth} placeholder="JJJJ-MM-TT" hint="Format: 1948-03-15 (optional)" />
          {!isProduction ? (
            <CatalogValueSelect
              catalogType="client_status"
              label="Klient:innenstatus"
              required
              value={clientStatusKey}
              onChange={setClientStatusKey}
            />
          ) : null}
        </SectionPanel>
      ) : null}

      {step === 1 ? (
        <SectionPanel title="Adresse & Kontakt" subtitle={isProduction ? 'PLZ und Ort sind Pflichtangaben' : undefined}>
          <PremiumInput label={isProduction ? 'Straße' : 'Straße *'} value={form.street} onChangeText={(v) => updateField('street', v)} error={errors.street} />
          <PremiumInput label="PLZ *" value={form.zip} onChangeText={(v) => updateField('zip', v)} error={errors.zip} keyboardType="numeric" />
          <PremiumInput label="Ort *" value={form.city} onChangeText={(v) => updateField('city', v)} error={errors.city} />
          <PremiumInput label="Telefon" value={form.phone} onChangeText={(v) => updateField('phone', v)} error={errors.phone} keyboardType="phone-pad" />
          <PremiumInput label="E-Mail" value={form.email} onChangeText={(v) => updateField('email', v)} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
          {isProduction ? (
            <>
              <PremiumInput label="Pflegegrad" value={form.careLevel} onChangeText={(v) => updateField('careLevel', v)} error={errors.careLevel} placeholder="z. B. PG 2" />
              <PremiumInput label="Kostenträger" value={form.costCarrier} onChangeText={(v) => updateField('costCarrier', v)} error={errors.costCarrier} placeholder="z. B. AOK Nordost" />
              <PremiumInput label="Versichertennummer" value={form.insuranceNumber} onChangeText={(v) => updateField('insuranceNumber', v)} error={errors.insuranceNumber} />
              <PremiumInput label="Interne Notizen" value={form.notes} onChangeText={(v) => updateField('notes', v)} multiline hint="Nur für das Team sichtbar" />
            </>
          ) : null}
        </SectionPanel>
      ) : null}

      {step === 2 && !isProduction ? (
        <SectionPanel title="Pflegegrad & Abrechnung">
          <PremiumInput label="Pflegegrad *" value={form.careLevel} onChangeText={(v) => updateField('careLevel', v)} error={errors.careLevel} placeholder="z. B. PG 2" />
          <PremiumInput label="Pflegekasse *" value={form.careFundName} onChangeText={(v) => updateField('careFundName', v)} error={errors.careFundName} placeholder="z. B. AOK Nordost" />
          <Text style={styles.fieldLabel}>Abrechnungsart *</Text>
          <View style={styles.chipRow}>
            {BILLING_OPTIONS.map(([key, label]) => (
              <Pressable key={key} style={[styles.chip, form.billingType === key && styles.chipActive]} onPress={() => updateField('billingType', key)}>
                <Text style={styles.chipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {errors.billingType ? <Text style={styles.error}>{errors.billingType}</Text> : null}
          <PremiumInput label="Vertragsbeginn *" value={form.contractStart} onChangeText={(v) => updateField('contractStart', v)} error={errors.contractStart} placeholder="JJJJ-MM-TT" />
          <Text style={styles.fieldLabel}>Leistungsart *</Text>
          <View style={styles.chipRow}>
            {SERVICE_OPTIONS.map(([key, label]) => (
              <Pressable key={key} style={[styles.chip, form.serviceType === key && styles.chipActive]} onPress={() => updateField('serviceType', key)}>
                <Text style={styles.chipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {errors.serviceType ? <Text style={styles.error}>{errors.serviceType}</Text> : null}
          <PremiumInput label="Stundensatz (€) *" value={form.hourlyRate} onChangeText={(v) => updateField('hourlyRate', v)} error={errors.hourlyRate} keyboardType="decimal-pad" placeholder="38.00" />
        </SectionPanel>
      ) : null}

      {step === 3 && !isProduction ? (
        <SectionPanel title="Notfall & Aufgaben">
          <PremiumInput label="Notfallkontakt *" value={form.emergencyContactName} onChangeText={(v) => updateField('emergencyContactName', v)} error={errors.emergencyContactName} placeholder="Name der Angehörigen" />
          <PremiumInput label="Notfall-Telefon *" value={form.emergencyContactPhone} onChangeText={(v) => updateField('emergencyContactPhone', v)} error={errors.emergencyContactPhone} keyboardType="phone-pad" />
          <Text style={styles.fieldLabel}>Aufgabenkategorien *</Text>
          <View style={styles.chipRow}>
            {(taskCategoryOptions.length > 0
              ? taskCategoryOptions.map((o) => [o.value, o.label] as const)
              : Object.entries(TASK_CATEGORY_LABELS)
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.chip, form.taskCategories.includes(key as TaskCategory) && styles.chipActive]}
                onPress={() => toggleTaskCategory(key as TaskCategory)}
              >
                <Text style={styles.chipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {errors.taskCategories ? <Text style={styles.error}>{errors.taskCategories}</Text> : null}
          <PremiumInput label="Interne Notizen" value={form.notes} onChangeText={(v) => updateField('notes', v)} multiline hint="Nur für das Team sichtbar" />
        </SectionPanel>
      ) : null}

      {step === 4 && !isProduction ? (
        <SectionPanel title="Einwilligungen & Zusammenfassung">
          <Pressable style={styles.consentRow} onPress={() => updateField('consentDatenschutz', !form.consentDatenschutz)}>
            <Text style={styles.consentCheck}>{form.consentDatenschutz ? '☑' : '☐'}</Text>
            <Text style={styles.consentLabel}>Datenschutzerklärung akzeptiert *</Text>
          </Pressable>
          {errors.consentDatenschutz ? <Text style={styles.error}>{errors.consentDatenschutz}</Text> : null}
          <Pressable style={styles.consentRow} onPress={() => updateField('consentVertrag', !form.consentVertrag)}>
            <Text style={styles.consentCheck}>{form.consentVertrag ? '☑' : '☐'}</Text>
            <Text style={styles.consentLabel}>Pflegevertrag / Leistungsvereinbarung *</Text>
          </Pressable>
          {errors.consentVertrag ? <Text style={styles.error}>{errors.consentVertrag}</Text> : null}
          <PremiumCard accentColor="#FF9500">
            <SummaryRow label="Name" value={`${form.firstName} ${form.lastName}`} />
            <SummaryRow label="Geburtsdatum" value={form.dateOfBirth || '—'} />
            <SummaryRow label="Adresse" value={`${form.street}, ${form.zip} ${form.city}`} />
            <SummaryRow label="Telefon" value={form.phone || '—'} />
            <SummaryRow label="Pflegegrad" value={formatCareLevel(form.careLevel) || '—'} />
            <SummaryRow label="Pflegekasse" value={form.careFundName} />
            <SummaryRow label="Abrechnungsart" value={form.billingType ? BILLING_TYPE_LABELS[form.billingType] : '—'} />
            <SummaryRow label="Stundensatz" value={form.hourlyRate ? `${form.hourlyRate} €` : '—'} />
            <SummaryRow label="Notfallkontakt" value={form.emergencyContactName || '—'} />
            <SummaryRow label="Status" value={clientStatusKey} />
          </PremiumCard>
        </SectionPanel>
      ) : null}

      <View style={styles.nav}>
        {!isFirstStep ? <PremiumButton title="Zurück" variant="secondary" onPress={prevStep} /> : <PremiumButton title="Abbrechen" variant="ghost" onPress={handleCancel} />}
        {!isLastStep ? <PremiumButton title="Weiter" onPress={nextStep} style={styles.navBtn} /> : <PremiumButton title="Klient:in anlegen" onPress={handleSubmit} loading={submitting} disabled={submitting} style={styles.navBtn} />}
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
  fieldLabel: { ...typography.caption, marginBottom: spacing.xs, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipActive: { backgroundColor: 'rgba(255,149,0,0.25)' },
  chipText: { ...typography.caption },
  error: { ...typography.caption, color: '#FF6B6B', marginTop: 4 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  consentCheck: { fontSize: 18 },
  consentLabel: { ...typography.body, flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  summaryLabel: { ...typography.caption },
  summaryValue: { ...typography.bodyStrong, flex: 1, textAlign: 'right' },
});
