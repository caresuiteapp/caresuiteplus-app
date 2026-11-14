import { useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import {
  createCarePlanEvaluation,
  createCareQualityVisit,
} from '@/lib/pflege/careQualityLiveService';
import { colors, spacing } from '@/theme';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { isCalendarDate } from '@/lib/pflege/ambulatoryOperationsDomain';
import { qualityWorklistId, qualityWorklistMatch } from '@/lib/pflege/pflegeQualityWorklist';

const today = () => berlinCalendarDate();
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
  const { carePlanId: routePlan } = useLocalSearchParams<{ carePlanId?: string }>();
  const planId = qualityWorklistId(routePlan);
  const runtime = useCareRuntimePermissions();
  const { profile } = useAuth();
  const tenant = runtime.tenantId;
  if (runtime.loading) return <ScreenShell title="Evaluation dokumentieren"><LoadingState presentation="inline" message="Berechtigungen werden geprüft …" /></ScreenShell>;
  if (runtime.error) return <ScreenShell title="Evaluation dokumentieren"><ErrorState presentation="inline" message={runtime.error} onRetry={runtime.refreshPermissions} /></ScreenShell>;
  if (!tenant || profile?.tenantId !== tenant || !runtime.hasModuleGate('pflege') || !runtime.canAll(['pflege.access', 'pflege.evaluations.view', 'pflege.evaluations.manage', 'pflege.plans.view'])) return <ScreenShell title="Evaluation dokumentieren"><ErrorState presentation="inline" message="Für dieses Konto ist das Dokumentieren von Evaluationen nicht freigegeben." /></ScreenShell>;
  if (planId === null) return <ScreenShell title="Evaluation dokumentieren"><ErrorState presentation="inline" message="Der verlinkte Pflegeplan ist ungültig." /></ScreenShell>;
  return <CarePlanEvaluationForm key={`${tenant}:${profile?.id}:${planId ?? ''}`} planId={planId} runtime={runtime} />;
}

function CarePlanEvaluationForm({ planId, runtime }: { planId?: string; runtime: ReturnType<typeof useCareRuntimePermissions> }) {
  const router = useRouter();
  const tenantId = runtime.tenantId;
  const { profile } = useAuth();
  const plans = useAsyncQuery(
    () => tenantId ? fetchCarePlanList(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const [carePlanId, setCarePlanId] = useState(planId ?? '');
  const [planSearch, setPlanSearch] = useState('');
  const [planLimit, setPlanLimit] = useState(24);
  const [outcome, setOutcome] = useState('');
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
  const writing = useRef(false);
  const options = useMemo(() => (plans.data ?? []).filter((plan) => plan.status === 'aktiv').map((plan) => ({ key: plan.id, label: `${plan.clientName} · ${plan.title}` })), [plans.data]);
  const selectedPlan = options.find(option => option.key === carePlanId);
  const shownPlans = options.filter(option => qualityWorklistMatch(planSearch, [option.label]));
  const editable = () => runtime.hasModuleGate('pflege') && runtime.canAll(['pflege.access', 'pflege.evaluations.view', 'pflege.evaluations.manage', 'pflege.plans.view']);
  const listTarget = planId ? `/pflege/evaluation?carePlanId=${planId}` : '/pflege/evaluation';

  const save = async () => {
    if (writing.current) return;
    setError(null);
    if (!tenantId || !editable()) return setError('Die aktuelle Schreibberechtigung fehlt.');
    if (!selectedPlan || plans.refreshError) return setError('Wählen Sie einen aktuell geladenen, aktiven Pflegeplan.');
    if (!outcomeOptions.some(option => option.key === outcome)) return setError('Wählen Sie das fachliche Ergebnis.');
    if (!observedEffect.trim() || !conclusion.trim()) return setError('Beobachtete Wirkung und fachliche Schlussfolgerung fehlen.');
    if (!isCalendarDate(evaluatedAt) || (nextEvaluationAt && (!isCalendarDate(nextEvaluationAt) || nextEvaluationAt < evaluatedAt))) return setError('Prüfen Sie das Evaluationsdatum und den Folgetermin im Format JJJJ-MM-TT.');
    writing.current = true;
    setBusy(true);
    try {
      const result = await createCarePlanEvaluation(tenantId, runtime.roleKey, {
        carePlanId, outcome: outcome as Parameters<typeof createCarePlanEvaluation>[2]['outcome'],
        observedEffect, personFeedback, professionalConclusion: conclusion, changesRequired: changes,
        requiresPlanUpdate: requiresUpdate === 'yes', evaluatedAt, nextEvaluationAt: nextEvaluationAt || null,
        actorName: profile?.displayName ?? 'Pflegefachperson',
      }, { effectivePermissions: runtime.permissions });
      if (!editable()) return;
      if (!result.ok) return setError(result.error);
      setSuccess(true);
    } catch {
      if (editable()) setError('Der Speicherausgang konnte nicht bestätigt werden. Prüfen Sie die Evaluationsliste vor einem erneuten Speichern.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };

  if (plans.loading) return <ScreenShell title="Evaluation"><LoadingState message="Pflegepläne werden geladen…" /></ScreenShell>;
  if (plans.error) return <ScreenShell title="Evaluation dokumentieren"><ErrorState presentation="inline" message={plans.error} onRetry={plans.refresh} /></ScreenShell>;
  if (success) return <ScreenShell title="Evaluation gespeichert"><SuccessState message="Die Wirksamkeitsprüfung wurde am gewählten Pflegeplan gespeichert." /><PremiumButton title="Zur Evaluationsliste" fullWidth onPress={() => router.replace(listTarget as never)} /></ScreenShell>;
  return (
    <ScreenShell title="Evaluation dokumentieren" subtitle="Wirkung festhalten und den nächsten Prüftermin vereinbaren" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero eyebrow="PFLEGE · QUALITÄT LIVE" title="Wirksamkeit fachlich bewerten" meta="Beobachtung, Betroffenenperspektive, Schlussfolgerung und Fortschreibung" icon="✓" formMode="create" accentColor={colors.cyan} />
        <SectionPanel title="1. Aktiver Pflegeplan" subtitle={selectedPlan ? `Ausgewählt: ${selectedPlan.label}` : undefined}>
          <PremiumInput label="Pflegeplan oder Person suchen" value={planSearch} onChangeText={value => { setPlanSearch(value); setPlanLimit(24); }} />
          <FilterChipGroup wrap options={shownPlans.slice(0, planLimit)} value={carePlanId} onChange={setCarePlanId} />
          {shownPlans.length > planLimit ? <PremiumButton variant="ghost" title="Weitere Pflegepläne anzeigen" onPress={() => setPlanLimit(value => value + 24)} /> : null}
          {!shownPlans.length ? <ErrorState presentation="inline" message={options.length ? 'Keine aktiven Pflegepläne passen zur Suche.' : 'Es ist kein aktiver Pflegeplan zum Dokumentieren verfügbar.'} /> : null}
        </SectionPanel>
        <SectionPanel title="2. Wirksamkeitsprüfung">
          <FilterChipGroup wrap options={outcomeOptions} value={outcome} onChange={setOutcome} />
          <PremiumInput label="Beobachtete Wirkung *" value={observedEffect} onChangeText={setObservedEffect} multiline />
          <PremiumInput label="Rückmeldung der versorgten Person" value={personFeedback} onChangeText={setPersonFeedback} multiline />
          <PremiumInput label="Pflegefachliche Schlussfolgerung *" value={conclusion} onChangeText={setConclusion} multiline />
          <PremiumInput label="Erforderliche Änderungen" value={changes} onChangeText={setChanges} multiline />
          <FilterChipGroup options={[{ key: 'no', label: 'Plan bleibt bestehen' }, { key: 'yes', label: 'Fortschreibung nötig' }]} value={requiresUpdate} onChange={setRequiresUpdate} />
          <View style={styles.row}><PremiumInput label="Evaluiert am" value={evaluatedAt} onChangeText={setEvaluatedAt} /><PremiumInput label="Nächste Evaluation" value={nextEvaluationAt} onChangeText={setNextEvaluationAt} /></View>
        </SectionPanel>
        {error ? <ErrorState presentation="inline" title="Speichern prüfen" message={error} /> : null}
        <PremiumButton title="Evaluation speichern" fullWidth loading={busy} disabled={busy || !selectedPlan} onPress={save} />
      </ScrollView>
    </ScreenShell>
  );
}

export function CareQualityVisitCreateScreen() {
  const { clientId: routeClient } = useLocalSearchParams<{ clientId?: string }>();
  const clientId = qualityWorklistId(routeClient);
  const runtime = useCareRuntimePermissions();
  const { profile } = useAuth();
  const tenant = runtime.tenantId;
  if (runtime.loading) return <ScreenShell title="Pflegevisite dokumentieren"><LoadingState presentation="inline" message="Berechtigungen werden geprüft …" /></ScreenShell>;
  if (runtime.error) return <ScreenShell title="Pflegevisite dokumentieren"><ErrorState presentation="inline" message={runtime.error} onRetry={runtime.refreshPermissions} /></ScreenShell>;
  if (!tenant || profile?.tenantId !== tenant || !runtime.hasModuleGate('pflege') || !runtime.canAll(['pflege.access', 'pflege.visits.view', 'pflege.visits.manage', 'pflege.plans.view'])) return <ScreenShell title="Pflegevisite dokumentieren"><ErrorState presentation="inline" message="Für dieses Konto ist das Dokumentieren von Visiten nicht freigegeben." /></ScreenShell>;
  if (clientId === null) return <ScreenShell title="Pflegevisite dokumentieren"><ErrorState presentation="inline" message="Der verlinkte Pflegefall ist ungültig." /></ScreenShell>;
  return <CareQualityVisitForm key={`${tenant}:${profile?.id}:${clientId ?? ''}`} initialClient={clientId} runtime={runtime} />;
}

function CareQualityVisitForm({ initialClient, runtime }: { initialClient?: string; runtime: ReturnType<typeof useCareRuntimePermissions> }) {
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
  const [clientId, setClientId] = useState(initialClient ?? '');
  const [clientSearch, setClientSearch] = useState('');
  const [clientLimit, setClientLimit] = useState(24);
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
  const writing = useRef(false);
  const clientOptions = useMemo(() => (clients.data ?? []).map((client) => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` })), [clients.data]);
  const planOptions = useMemo(() => (plans.data ?? []).filter((plan) => plan.clientId === clientId && plan.status === 'aktiv').map((plan) => ({ key: plan.id, label: plan.title })), [plans.data, clientId]);
  const selectedClient = clientOptions.find(option => option.key === clientId);
  const shownClients = clientOptions.filter(option => qualityWorklistMatch(clientSearch, [option.label]));
  const editable = () => runtime.hasModuleGate('pflege') && runtime.canAll(['pflege.access', 'pflege.visits.view', 'pflege.visits.manage', 'pflege.plans.view']);

  const save = async () => {
    if (writing.current) return;
    setError(null);
    if (!tenantId || runtime.tenantId !== tenantId || !editable()) return setError('Die aktuelle Schreibberechtigung fehlt.');
    if (!selectedClient || clients.refreshError || (carePlanId && (plans.refreshError || !planOptions.some(option => option.key === carePlanId)))) return setError('Pflegefall oder gewählter Plan konnte nicht bestätigt werden.');
    if (!scope.trim()) return setError('Der Prüfumfang fehlt.');
    if (!isCalendarDate(conductedAt) || (nextVisitAt && (!isCalendarDate(nextVisitAt) || nextVisitAt < conductedAt))) return setError('Prüfen Sie das Durchführungsdatum und den Folgetermin im Format JJJJ-MM-TT.');
    writing.current = true;
    setBusy(true);
    try {
      const result = await createCareQualityVisit(tenantId, runtime.roleKey, {
        clientId, carePlanId: carePlanId || null,
        visitType: visitType as Parameters<typeof createCareQualityVisit>[2]['visitType'],
        status: 'completed', scheduledAt: null, conductedAt, scope, findings, deviations,
        agreedActions: actions, personFeedback: feedback, nextVisitAt: nextVisitAt || null,
        actorName: profile?.displayName ?? 'Pflegefachperson',
      }, { effectivePermissions: runtime.permissions });
      if (!editable()) return;
      if (!result.ok) return setError(result.error);
      setSuccess(true);
    } catch {
      if (editable()) setError('Der Speicherausgang konnte nicht bestätigt werden. Prüfen Sie die Visitenliste vor einem erneuten Speichern.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };

  if (clients.loading || plans.loading) return <ScreenShell title="Pflegevisite"><LoadingState message="Aktive Pflegefälle werden geladen…" /></ScreenShell>;
  if (clients.error || plans.error) return <ScreenShell title="Pflegevisite dokumentieren"><ErrorState presentation="inline" message={clients.error ?? plans.error ?? 'Laden fehlgeschlagen.'} onRetry={() => { void Promise.all([clients.refresh(), plans.refresh()]); }} /></ScreenShell>;
  if (success) return <ScreenShell title="Pflegevisite gespeichert"><SuccessState message="Die Dokumentation der Pflegevisite wurde gespeichert." /><PremiumButton title="Zu den Visiten" fullWidth onPress={() => router.replace(`/pflege/visiten?clientId=${clientId}` as never)} /></ScreenShell>;
  return (
    <ScreenShell title="Pflegevisite dokumentieren" subtitle="Prüfumfang, Feststellungen und vereinbarte Maßnahmen erfassen" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero eyebrow="PFLEGE · QUALITÄT LIVE" title="Pflegevisite abschließen" meta="PDL-, Fach-, Intensivpflege-, Hygiene- oder Medikationsvisite" icon="🔎" formMode="create" accentColor={colors.cyan} />
        <SectionPanel title="1. Pflegefall und Bezug" subtitle={selectedClient ? `Ausgewählt: ${selectedClient.label}` : undefined}>
          <PremiumInput label="Pflegefall suchen" value={clientSearch} onChangeText={value => { setClientSearch(value); setClientLimit(24); }} />
          <FilterChipGroup wrap options={shownClients.slice(0, clientLimit)} value={clientId} onChange={(value) => { setClientId(value); setCarePlanId(''); }} />
          {shownClients.length > clientLimit ? <PremiumButton variant="ghost" title="Weitere Pflegefälle anzeigen" onPress={() => setClientLimit(value => value + 24)} /> : null}
          {!shownClients.length ? <ErrorState presentation="inline" message={clientOptions.length ? 'Kein Pflegefall passt zur Suche.' : 'Es ist kein aktiver Pflegefall verfügbar.'} /> : null}
          {planOptions.length ? <FilterChipGroup wrap options={[{ key: '', label: 'Ohne Pflegeplanbezug' }, ...planOptions]} value={carePlanId} onChange={setCarePlanId} /> : null}
        </SectionPanel>
        <SectionPanel title="2. Visitenart und Nachweis">
          <FilterChipGroup wrap options={visitTypeOptions} value={visitType} onChange={setVisitType} />
          <PremiumInput label="Prüfumfang *" value={scope} onChangeText={setScope} multiline />
          <PremiumInput label="Feststellungen" value={findings} onChangeText={setFindings} multiline />
          <PremiumInput label="Abweichungen" value={deviations} onChangeText={setDeviations} multiline />
          <PremiumInput label="Vereinbarte Maßnahmen" value={actions} onChangeText={setActions} multiline />
          <PremiumInput label="Rückmeldung der versorgten Person" value={feedback} onChangeText={setFeedback} multiline />
          <View style={styles.row}><PremiumInput label="Durchgeführt am" value={conductedAt} onChangeText={setConductedAt} /><PremiumInput label="Nächste Visite" value={nextVisitAt} onChangeText={setNextVisitAt} /></View>
        </SectionPanel>
        {error ? <ErrorState presentation="inline" title="Speichern prüfen" message={error} /> : null}
        <PremiumButton title="Pflegevisite speichern" fullWidth loading={busy} disabled={busy || !selectedClient} onPress={save} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl, gap: spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md } });
