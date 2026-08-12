import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import {
  advanceQualityDeviation,
  createQualityDeviation,
  fetchLiveCareMeasures,
  fetchLiveCareRisks,
  fetchMdReadiness,
  fetchQualityDeviations,
  reviewLiveCareMeasure,
  reviewLiveCareRisk,
} from '@/lib/pflege/careQualityR2LiveService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing } from '@/theme';
import type { CareMeasureLiveItem, CareQualityDeviationItem, CareRiskLiveItem } from '@/types/modules/pflege';

const today = () => new Date().toISOString().slice(0, 10);
const yesNo = [{ key: 'no', label: 'Nein' }, { key: 'yes', label: 'Ja' }];

export function QualityDeviationsListScreen() {
  const router = useRouter();
  return <DedicatedListScreen title="Qualitätsabweichungen" eyebrow="PFLEGE · QUALITÄTSREGELKREIS" subtitle="Feststellen · bewerten · handeln · Wirksamkeit prüfen" createRoute="/pflege/abweichung-new" queryFn={fetchQualityDeviations} searchKeys={['title', 'clientName', 'category', 'responsibleName']} getItemId={(item) => item.id} onOpen={(item) => router.push(`/pflege/abweichung-workflow?id=${item.id}` as never)} renderMeta={(item) => ({ primary: item.title, secondary: `${item.clientName} · ${item.category}${item.dueAt ? ` · Frist ${formatDate(item.dueAt)}` : ''}`, badge: item.recurringProblem ? `Wiederkehrend · ${item.severity}` : `${item.status} · ${item.severity}` })} />;
}

export function MdReadinessListScreen() {
  const router = useRouter();
  return <DedicatedListScreen title="MD-Prüfbereitschaft" eyebrow="PFLEGE · NACHWEISCHECK" subtitle="Live-Prüfstatus je aktivem Pflegefall" queryFn={fetchMdReadiness} searchKeys={['clientName', 'planTitle']} getItemId={(item) => item.carePlanId} onOpen={(item) => router.push(`/pflege/plans/${item.carePlanId}` as never)} renderMeta={(item) => {
    const missing = Object.entries(item.checks).filter(([, value]) => !value).length;
    return { primary: item.clientName, secondary: `${item.planTitle} · ${missing ? `${missing} Nachweise offen` : 'alle 7 Nachweise erfüllt'}`, badge: `${item.readinessPercent}%${item.ready ? ' · bereit' : ''}` };
  }} />;
}

function useQualityContext<T>(loader: (tenantId: string, role?: Parameters<typeof fetchLiveCareRisks>[1]) => Promise<{ ok: boolean; data?: T[]; error?: string }>) {
  const tenantId = useServiceTenantId(); const { profile } = useAuth();
  const query = useAsyncQuery(() => tenantId ? loader(tenantId, profile?.roleKey) as never : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) });
  return { tenantId, profile, query };
}

export function CareRiskReviewScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>(); const router = useRouter();
  const { tenantId, profile, query } = useQualityContext(fetchLiveCareRisks);
  const selected = ((query.data ?? []) as CareRiskLiveItem[]).find((item) => item.id === id);
  const [state, setState] = useState('controlled'); const [urgency, setUrgency] = useState('routine');
  const [evidence, setEvidence] = useState(''); const [protective, setProtective] = useState(''); const [rationale, setRationale] = useState('');
  const [counseling, setCounseling] = useState(''); const [decision, setDecision] = useState(''); const [refusal, setRefusal] = useState('no');
  const [nextReview, setNextReview] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  useEffect(() => { if (!selected) return; setState(selected.state); setUrgency(selected.urgency); setEvidence(selected.evidence); setRationale(selected.professionalRationale); setNextReview(selected.nextReviewAt?.slice(0, 10) ?? ''); }, [selected]);
  const save = async () => { if (!tenantId) return; setBusy(true); setError(null); const result = await reviewLiveCareRisk(tenantId, profile?.roleKey, id, { state, urgency, evidence, protectiveFactors: protective, professionalRationale: rationale, counselingProvided: counseling, personDecision: decision, refusalDocumented: refusal === 'yes', nextReviewAt: nextReview || null }); setBusy(false); if (!result.ok) return setError(result.error); setDone(true); };
  if (query.loading) return <ScreenShell title="Risikoreview"><LoadingState message="Risiko wird geladen…" /></ScreenShell>;
  if (!selected) return <ScreenShell title="Risikoreview"><ErrorState message={query.error ?? 'Risiko nicht gefunden.'} /></ScreenShell>;
  if (done) return <ScreenShell title="Risikoreview gespeichert"><SuccessState message="Das Risiko wurde live fortgeschrieben und im Pflege-Audit protokolliert." /><PremiumButton title="Zur Risikomatrix" fullWidth onPress={() => router.replace('/pflege/risiken' as never)} /></ScreenShell>;
  return <ScreenShell title="Risiko fachlich überprüfen" subtitle={`${selected.clientName} · ${selected.riskKey}`} onBack={() => router.back()}><ScrollView contentContainerStyle={styles.scroll}><FormScreenHero eyebrow="PFLEGE · RISIKOMANAGEMENT LIVE" title="Risikolage neu bewerten" meta="Nachweis, Schutzfaktoren, Beteiligung und verbindlicher Reviewtermin" icon="⚠" formMode="edit" accentColor={colors.orange} /><SectionPanel title="Bewertung"><FilterChipGroup wrap options={[{ key: 'none', label: 'Kein Risiko' }, { key: 'unclear', label: 'Unklar' }, { key: 'present', label: 'Vorhanden' }, { key: 'controlled', label: 'Kontrolliert' }]} value={state} onChange={setState} /><FilterChipGroup wrap options={[{ key: 'routine', label: 'Routine' }, { key: 'timely', label: 'Zeitnah' }, { key: 'urgent', label: 'Dringend' }, { key: 'immediate', label: 'Sofort' }]} value={urgency} onChange={setUrgency} /><PremiumInput label="Belege / Beobachtungen" value={evidence} onChangeText={setEvidence} multiline /><PremiumInput label="Schutzfaktoren" value={protective} onChangeText={setProtective} multiline /><PremiumInput label="Fachliche Begründung *" value={rationale} onChangeText={setRationale} multiline /><PremiumInput label="Beratung / Aufklärung" value={counseling} onChangeText={setCounseling} multiline /><PremiumInput label="Entscheidung der versorgten Person" value={decision} onChangeText={setDecision} multiline /><FilterChipGroup options={yesNo} value={refusal} onChange={setRefusal} /><PremiumInput label="Nächster Review (JJJJ-MM-TT)" value={nextReview} onChangeText={setNextReview} /></SectionPanel>{error ? <ErrorState message={error} /> : null}<PremiumButton title="Risikoreview live speichern" fullWidth loading={busy} onPress={save} /></ScrollView></ScreenShell>;
}

export function CareMeasureReviewScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>(); const router = useRouter();
  const { tenantId, profile, query } = useQualityContext(fetchLiveCareMeasures); const selected = ((query.data ?? []) as CareMeasureLiveItem[]).find((item) => item.id === id);
  const [decision, setDecision] = useState('continue'); const [effect, setEffect] = useState(''); const [feedback, setFeedback] = useState('');
  const [rationale, setRationale] = useState(''); const [intervention, setIntervention] = useState(''); const [frequency, setFrequency] = useState('');
  const [nextEvaluation, setNextEvaluation] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  useEffect(() => { if (!selected) return; setIntervention(selected.intervention); setFrequency(selected.frequency); setNextEvaluation(selected.nextEvaluationAt?.slice(0, 10) ?? ''); }, [selected]);
  const save = async () => { if (!tenantId) return; setBusy(true); setError(null); const result = await reviewLiveCareMeasure(tenantId, profile?.roleKey, id, { decision, observedEffect: effect, personFeedback: feedback, professionalRationale: rationale, changedIntervention: intervention, changedFrequency: frequency, nextEvaluationAt: nextEvaluation || null }); setBusy(false); if (!result.ok) return setError(result.error); setDone(true); };
  if (query.loading) return <ScreenShell title="Maßnahmenfortschreibung"><LoadingState message="Maßnahme wird geladen…" /></ScreenShell>;
  if (!selected) return <ScreenShell title="Maßnahmenfortschreibung"><ErrorState message={query.error ?? 'Maßnahme nicht gefunden.'} /></ScreenShell>;
  if (done) return <ScreenShell title="Maßnahme fortgeschrieben"><SuccessState message="Entscheidung und Wirkung wurden append-only dokumentiert; die Maßnahme wurde atomar aktualisiert." /><PremiumButton title="Zu den Maßnahmen" fullWidth onPress={() => router.replace('/pflege/massnahmen' as never)} /></ScreenShell>;
  return <ScreenShell title="Maßnahme fortschreiben" subtitle={`${selected.clientName} · ${selected.title}`} onBack={() => router.back()}><ScrollView contentContainerStyle={styles.scroll}><FormScreenHero eyebrow="PFLEGE · WIRKSAMKEIT LIVE" title="Maßnahme fachlich fortschreiben" meta={selected.intervention} icon="✓" formMode="edit" accentColor={colors.cyan} /><SectionPanel title="Wirksamkeit und Entscheidung"><FilterChipGroup wrap options={[{ key: 'continue', label: 'Fortführen' }, { key: 'change', label: 'Ändern' }, { key: 'pause', label: 'Pausieren' }, { key: 'complete', label: 'Abschließen' }]} value={decision} onChange={setDecision} /><PremiumInput label="Beobachtete Wirkung *" value={effect} onChangeText={setEffect} multiline /><PremiumInput label="Rückmeldung der versorgten Person" value={feedback} onChangeText={setFeedback} multiline /><PremiumInput label="Fachliche Begründung *" value={rationale} onChangeText={setRationale} multiline />{decision === 'change' ? <><PremiumInput label="Neue Durchführung" value={intervention} onChangeText={setIntervention} multiline /><PremiumInput label="Neue Häufigkeit" value={frequency} onChangeText={setFrequency} /></> : null}<PremiumInput label="Nächste Evaluation (JJJJ-MM-TT)" value={nextEvaluation} onChangeText={setNextEvaluation} /></SectionPanel>{error ? <ErrorState message={error} /> : null}<PremiumButton title="Fortschreibung live speichern" fullWidth loading={busy} onPress={save} /></ScrollView></ScreenShell>;
}

export function QualityDeviationCreateScreen() {
  const router = useRouter(); const tenantId = useServiceTenantId(); const { profile } = useAuth();
  const clients = useAsyncQuery(() => tenantId ? fetchEligibleCareClients(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) });
  const [clientId, setClientId] = useState(''); const [sourceType, setSourceType] = useState('visit'); const [category, setCategory] = useState('Pflegeprozess'); const [severity, setSeverity] = useState('medium');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [immediate, setImmediate] = useState(''); const [recurring, setRecurring] = useState('no');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  const options = useMemo(() => (clients.data ?? []).map((client) => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` })), [clients.data]);
  const save = async () => { if (!tenantId) return; setBusy(true); setError(null); const result = await createQualityDeviation(tenantId, profile?.roleKey, clientId || null, null, { sourceType, category, severity, title, description, immediateAction: immediate, recurringProblem: recurring === 'yes' }); setBusy(false); if (!result.ok) return setError(result.error); setDone(true); };
  if (clients.loading) return <ScreenShell title="Qualitätsabweichung"><LoadingState message="Pflegefälle werden geladen…" /></ScreenShell>;
  if (done) return <ScreenShell title="Abweichung erfasst"><SuccessState message="Die Abweichung wurde live festgestellt und ist im Qualitätsregelkreis sichtbar." /><PremiumButton title="Zur Abweichungsübersicht" fullWidth onPress={() => router.replace('/pflege/abweichungen' as never)} /></ScreenShell>;
  return <ScreenShell title="Qualitätsabweichung feststellen" subtitle="Live · mandantengetrennt · auditierbar" onBack={() => router.back()}><ScrollView contentContainerStyle={styles.scroll}><FormScreenHero eyebrow="PFLEGE · QUALITÄT LIVE" title="Abweichung verbindlich erfassen" meta="Sofortmaßnahme und Kennzeichnung wiederkehrender Prozessprobleme" icon="!" formMode="create" accentColor={colors.orange} /><SectionPanel title="Pflegefall und Ursprung"><FilterChipGroup wrap options={options} value={clientId} onChange={setClientId} /><PremiumInput label="Ursprung" value={sourceType} onChangeText={setSourceType} /><PremiumInput label="Kategorie *" value={category} onChangeText={setCategory} /><FilterChipGroup wrap options={[{ key: 'low', label: 'Niedrig' }, { key: 'medium', label: 'Mittel' }, { key: 'high', label: 'Hoch' }, { key: 'critical', label: 'Kritisch' }]} value={severity} onChange={setSeverity} /></SectionPanel><SectionPanel title="Feststellung"><PremiumInput label="Titel *" value={title} onChangeText={setTitle} /><PremiumInput label="Beschreibung *" value={description} onChangeText={setDescription} multiline /><PremiumInput label="Sofortmaßnahme" value={immediate} onChangeText={setImmediate} multiline /><FilterChipGroup options={yesNo} value={recurring} onChange={setRecurring} /></SectionPanel>{error ? <ErrorState message={error} /> : null}<PremiumButton title="Abweichung live erfassen" fullWidth loading={busy} onPress={save} /></ScrollView></ScreenShell>;
}

export function QualityDeviationWorkflowScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>(); const router = useRouter(); const { tenantId, profile, query } = useQualityContext(fetchQualityDeviations); const selected = ((query.data ?? []) as CareQualityDeviationItem[]).find((item) => item.id === id);
  const [status, setStatus] = useState('in_progress'); const [rootCause, setRootCause] = useState(''); const [action, setAction] = useState(''); const [responsible, setResponsible] = useState(''); const [dueAt, setDueAt] = useState(today()); const [effectiveness, setEffectiveness] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  useEffect(() => { if (!selected) return; setRootCause(selected.rootCause); setAction(selected.correctiveAction); setResponsible(selected.responsibleName); setDueAt(selected.dueAt?.slice(0, 10) ?? today()); setEffectiveness(selected.effectivenessResult); }, [selected]);
  const save = async () => { if (!tenantId) return; setBusy(true); setError(null); const result = await advanceQualityDeviation(tenantId, profile?.roleKey, id, { status, rootCause, correctiveAction: action, responsibleName: responsible, dueAt, effectivenessResult: effectiveness }); setBusy(false); if (!result.ok) return setError(result.error); setDone(true); };
  if (query.loading) return <ScreenShell title="Abweichung"><LoadingState message="Abweichung wird geladen…" /></ScreenShell>;
  if (!selected) return <ScreenShell title="Abweichung"><ErrorState message={query.error ?? 'Abweichung nicht gefunden.'} /></ScreenShell>;
  if (done) return <ScreenShell title="Regelkreis fortgeschrieben"><SuccessState message="Status, Verantwortung, Frist und Wirksamkeitsnachweis wurden auditierbar gespeichert." /><PremiumButton title="Zur Übersicht" fullWidth onPress={() => router.replace('/pflege/abweichungen' as never)} /></ScreenShell>;
  return <ScreenShell title="Qualitätsregelkreis" subtitle={`${selected.clientName} · ${selected.title}`} onBack={() => router.back()}><ScrollView contentContainerStyle={styles.scroll}><FormScreenHero eyebrow="PFLEGE · ABWEICHUNG LIVE" title="Ursache, Maßnahme und Wirksamkeit" meta={selected.description} icon="↻" formMode="edit" accentColor={colors.orange} /><SectionPanel title="Bearbeitungsstand"><FilterChipGroup wrap options={[{ key: 'assessed', label: 'Bewertet' }, { key: 'in_progress', label: 'In Umsetzung' }, { key: 'effectiveness_check', label: 'Wirksamkeitsprüfung' }, { key: 'closed', label: 'Abschließen' }, { key: 'cancelled', label: 'Verwerfen' }]} value={status} onChange={setStatus} /><PremiumInput label="Ursachenanalyse" value={rootCause} onChangeText={setRootCause} multiline /><PremiumInput label="Korrektur-/Vorbeugemaßnahme" value={action} onChangeText={setAction} multiline /><PremiumInput label="Verantwortliche Person/Rolle" value={responsible} onChangeText={setResponsible} /><PremiumInput label="Frist (JJJJ-MM-TT)" value={dueAt} onChangeText={setDueAt} />{status === 'closed' ? <PremiumInput label="Ergebnis der Wirksamkeitskontrolle *" value={effectiveness} onChangeText={setEffectiveness} multiline /> : null}</SectionPanel>{error ? <ErrorState message={error} /> : null}<PremiumButton title="Regelkreis live fortschreiben" fullWidth loading={busy} onPress={save} /></ScrollView></ScreenShell>;
}

const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl, gap: spacing.md } });
