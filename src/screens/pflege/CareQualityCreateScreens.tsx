import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import {
  createCarePlanEvaluation,
  createCareQualityVisit,
} from '@/lib/pflege/careQualityLiveService';
import { colors, spacing } from '@/theme';

const today = () => new Date().toISOString().slice(0, 10);
const outcomeOptions = [
  { key: 'effective', label: 'Wirksam' },
  { key: 'partly_effective', label: 'Teilweise wirksam' },
  { key: 'not_effective', label: 'Nicht wirksam' },
  { key: 'deteriorated', label: 'Verschlechterung' },
  { key: 'not_assessable', label: 'Nicht beurteilbar' },
];
const visitTypeOptions = [
  { key: 'pdl', label: 'PDL-Visite' },
  { key: 'professional', label: 'Fachvisite' },
  { key: 'intensive_care', label: 'Intensivpflege' },
  { key: 'hygiene', label: 'Hygiene' },
  { key: 'medication', label: 'Medikation' },
  { key: 'event_triggered', label: 'Anlassbezogen' },
];

export function CarePlanEvaluationCreateScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const plans = useAsyncQuery(
    () => tenantId ? fetchCarePlanList(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const [carePlanId, setCarePlanId] = useState('');
  const [outcome, setOutcome] = useState('effective');
  const [observedEffect, setObservedEffect] = useState('');
  const [personFeedback, setPersonFeedback] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [changes, setChanges] = useState('');
  const [requiresUpdate, setRequiresUpdate] = useState('no');
  const [evaluatedAt, setEvaluatedAt] = useState(today());
  const [nextEvaluationAt, setNextEvaluationAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const options = useMemo(() => (plans.data ?? []).filter((plan) => plan.status === 'aktiv').map((plan) => ({
    key: plan.id, label: `${plan.clientName} · ${plan.title}`,
  })), [plans.data]);

  const save = async () => {
    setError(null);
    if (!tenantId) return setError('Kein Mandant verfügbar.');
    setBusy(true);
    const result = await createCarePlanEvaluation(tenantId, profile?.roleKey, {
      carePlanId, outcome: outcome as Parameters<typeof createCarePlanEvaluation>[2]['outcome'],
      observedEffect, personFeedback, professionalConclusion: conclusion, changesRequired: changes,
      requiresPlanUpdate: requiresUpdate === 'yes', evaluatedAt, nextEvaluationAt: nextEvaluationAt || null,
      actorName: profile?.displayName ?? 'Pflegefachperson',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSuccess(true);
  };

  if (plans.loading) return <ScreenShell title="Evaluation"><LoadingState message="Pflegepläne werden geladen…" /></ScreenShell>;
  if (success) return <ScreenShell title="Evaluation gespeichert"><SuccessState message="Die Wirksamkeitsprüfung wurde live gespeichert und der nächste Prüftermin am Pflegeplan fortgeschrieben." /><PremiumButton title="Zur Evaluation" fullWidth onPress={() => router.replace('/pflege/evaluation' as never)} /></ScreenShell>;
  return (
    <ScreenShell title="Evaluation dokumentieren" subtitle="Live · append-only · auditierbar" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero eyebrow="PFLEGE · QUALITÄT LIVE" title="Wirksamkeit fachlich bewerten" meta="Beobachtung, Betroffenenperspektive, Schlussfolgerung und Fortschreibung" icon="✓" formMode="create" accentColor={colors.cyan} />
        <SectionPanel title="1. Aktiver Pflegeplan"><FilterChipGroup wrap options={options} value={carePlanId} onChange={setCarePlanId} /></SectionPanel>
        <SectionPanel title="2. Wirksamkeitsprüfung">
          <FilterChipGroup wrap options={outcomeOptions} value={outcome} onChange={setOutcome} />
          <PremiumInput label="Beobachtete Wirkung *" value={observedEffect} onChangeText={setObservedEffect} multiline />
          <PremiumInput label="Rückmeldung der versorgten Person" value={personFeedback} onChangeText={setPersonFeedback} multiline />
          <PremiumInput label="Pflegefachliche Schlussfolgerung *" value={conclusion} onChangeText={setConclusion} multiline />
          <PremiumInput label="Erforderliche Änderungen" value={changes} onChangeText={setChanges} multiline />
          <FilterChipGroup options={[{ key: 'no', label: 'Plan bleibt bestehen' }, { key: 'yes', label: 'Fortschreibung nötig' }]} value={requiresUpdate} onChange={setRequiresUpdate} />
          <View style={styles.row}><PremiumInput label="Evaluiert am" value={evaluatedAt} onChangeText={setEvaluatedAt} /><PremiumInput label="Nächste Evaluation" value={nextEvaluationAt} onChangeText={setNextEvaluationAt} /></View>
        </SectionPanel>
        {error ? <ErrorState title="Nicht gespeichert" message={error} /> : null}
        <PremiumButton title="Evaluation live speichern" fullWidth loading={busy} disabled={busy || !options.length} onPress={save} />
      </ScrollView>
    </ScreenShell>
  );
}

export function CareQualityVisitCreateScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const clients = useAsyncQuery(
    () => tenantId ? fetchEligibleCareClients(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const plans = useAsyncQuery(
    () => tenantId ? fetchCarePlanList(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const [clientId, setClientId] = useState('');
  const [carePlanId, setCarePlanId] = useState('');
  const [visitType, setVisitType] = useState('pdl');
  const [scope, setScope] = useState('');
  const [findings, setFindings] = useState('');
  const [deviations, setDeviations] = useState('');
  const [actions, setActions] = useState('');
  const [feedback, setFeedback] = useState('');
  const [conductedAt, setConductedAt] = useState(today());
  const [nextVisitAt, setNextVisitAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const clientOptions = useMemo(() => (clients.data ?? []).map((client) => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` })), [clients.data]);
  const planOptions = useMemo(() => (plans.data ?? []).filter((plan) => plan.clientId === clientId && plan.status === 'aktiv').map((plan) => ({ key: plan.id, label: plan.title })), [plans.data, clientId]);

  const save = async () => {
    setError(null);
    if (!tenantId) return setError('Kein Mandant verfügbar.');
    setBusy(true);
    const result = await createCareQualityVisit(tenantId, profile?.roleKey, {
      clientId, carePlanId: carePlanId || null,
      visitType: visitType as Parameters<typeof createCareQualityVisit>[2]['visitType'],
      status: 'completed', scheduledAt: null, conductedAt, scope, findings, deviations,
      agreedActions: actions, personFeedback: feedback, nextVisitAt: nextVisitAt || null,
      actorName: profile?.displayName ?? 'Pflegefachperson',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSuccess(true);
  };

  if (clients.loading || plans.loading) return <ScreenShell title="Pflegevisite"><LoadingState message="Aktive Pflegefälle werden geladen…" /></ScreenShell>;
  if (success) return <ScreenShell title="Pflegevisite gespeichert"><SuccessState message="Die Pflegevisite wurde live und auditierbar dokumentiert." /><PremiumButton title="Zu den Visiten" fullWidth onPress={() => router.replace('/pflege/visiten' as never)} /></ScreenShell>;
  return (
    <ScreenShell title="Pflegevisite dokumentieren" subtitle="Ambulant & Intensivpflege · live" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero eyebrow="PFLEGE · QUALITÄT LIVE" title="Pflegevisite abschließen" meta="PDL-, Fach-, Intensivpflege-, Hygiene- oder Medikationsvisite" icon="🔎" formMode="create" accentColor={colors.cyan} />
        <SectionPanel title="1. Pflegefall und Bezug"><FilterChipGroup wrap options={clientOptions} value={clientId} onChange={(value) => { setClientId(value); setCarePlanId(''); }} />{planOptions.length ? <FilterChipGroup wrap options={planOptions} value={carePlanId} onChange={setCarePlanId} /> : null}</SectionPanel>
        <SectionPanel title="2. Visitenart und Nachweis">
          <FilterChipGroup wrap options={visitTypeOptions} value={visitType} onChange={setVisitType} />
          <PremiumInput label="Prüfumfang *" value={scope} onChangeText={setScope} multiline />
          <PremiumInput label="Feststellungen" value={findings} onChangeText={setFindings} multiline />
          <PremiumInput label="Abweichungen" value={deviations} onChangeText={setDeviations} multiline />
          <PremiumInput label="Vereinbarte Maßnahmen" value={actions} onChangeText={setActions} multiline />
          <PremiumInput label="Rückmeldung der versorgten Person" value={feedback} onChangeText={setFeedback} multiline />
          <View style={styles.row}><PremiumInput label="Durchgeführt am" value={conductedAt} onChangeText={setConductedAt} /><PremiumInput label="Nächste Visite" value={nextVisitAt} onChangeText={setNextVisitAt} /></View>
        </SectionPanel>
        {error ? <ErrorState title="Nicht gespeichert" message={error} /> : null}
        <PremiumButton title="Pflegevisite live speichern" fullWidth loading={busy} disabled={busy || !clientOptions.length} onPress={save} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl, gap: spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md } });
