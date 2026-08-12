import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { createClinicalHandover, fetchTreatmentExecutions, recordTreatmentExecution } from '@/lib/pflege/clinicalWorkflowService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing, typography } from '@/theme';

function useCareClientOptions() {
  const tenantId = useServiceTenantId(); const { profile } = useAuth();
  const query = useAsyncQuery(() => tenantId ? fetchEligibleCareClients(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) });
  const options = useMemo(() => (query.data ?? []).map((client) => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` })), [query.data]);
  return { tenantId, role: profile?.roleKey, options };
}

export function ClinicalHandoverCreateScreen() {
  const router = useRouter(); const { tenantId, role, options } = useCareClientOptions();
  const [clientId, setClientId] = useState(''); const [priority, setPriority] = useState('normal');
  const [title, setTitle] = useState(''); const [situation, setSituation] = useState('');
  const [background, setBackground] = useState(''); const [assessment, setAssessment] = useState('');
  const [recommendation, setRecommendation] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  async function save() {
    if (!tenantId) return; setBusy(true); setError(null);
    const result = await createClinicalHandover(tenantId, clientId, { priority, title, situation, background, assessment, recommendation }, role);
    setBusy(false); if (!result.ok) return setError(result.error); setSaved(true); setTimeout(() => router.replace('/pflege/uebergaben' as never), 700);
  }
  return <ScreenShell title="Übergabe erstellen" subtitle="SBAR-strukturiert · Live · quittierbar"><ScrollView contentContainerStyle={styles.content}>
    <SectionPanel title="Fallübergabe" subtitle="Situation · Background · Assessment · Recommendation">
      <Text style={styles.label}>Aktiver Pflegefall *</Text><FilterChipGroup wrap options={options} value={clientId} onChange={setClientId} />
      <Text style={styles.label}>Priorität</Text><FilterChipGroup wrap options={[{ key: 'normal', label: 'Normal' }, { key: 'important', label: 'Wichtig' }, { key: 'urgent', label: 'Dringend' }, { key: 'critical', label: 'Kritisch' }]} value={priority} onChange={setPriority} />
      <PremiumInput label="Titel *" value={title} onChangeText={setTitle} /><PremiumInput label="Situation *" value={situation} onChangeText={setSituation} multiline />
      <PremiumInput label="Hintergrund" value={background} onChangeText={setBackground} multiline /><PremiumInput label="Einschätzung" value={assessment} onChangeText={setAssessment} multiline />
      <PremiumInput label="Empfehlung / nächste Handlung *" value={recommendation} onChangeText={setRecommendation} multiline />
      {error ? <ErrorState message={error} /> : null}{saved ? <SuccessState message="Übergabe wurde live gespeichert." /> : null}
      <PremiumButton title="Übergabe verbindlich speichern" fullWidth loading={busy} disabled={busy || !clientId || !title.trim() || !situation.trim() || !recommendation.trim()} onPress={save} />
    </SectionPanel></ScrollView></ScreenShell>;
}

export function TreatmentExecutionListScreen() {
  return <DedicatedListScreen title="Behandlungspflege" eyebrow="PFLEGE · ÄRZTLICHE VERORDNUNG" subtitle="Durchführungen, Abweichungen und Eskalationen" createRoute="/pflege/behandlungspflege/new" queryFn={fetchTreatmentExecutions}
    searchKeys={['clientName', 'title', 'treatmentType', 'employeeName']} getItemId={(item) => item.id} onOpen={() => undefined}
    renderMeta={(item) => ({ primary: item.title, secondary: `${item.clientName} · ${item.employeeName} · ${formatDate(item.performedAt)}`, badge: item.outcome })} />;
}

export function TreatmentExecutionCreateScreen() {
  const router = useRouter(); const { tenantId, role, options } = useCareClientOptions();
  const [clientId, setClientId] = useState(''); const [type, setType] = useState('injection');
  const [title, setTitle] = useState(''); const [outcome, setOutcome] = useState('performed');
  const [details, setDetails] = useState(''); const [deviation, setDeviation] = useState(''); const [escalation, setEscalation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  async function save() {
    if (!tenantId) return; setBusy(true); setError(null);
    const result = await recordTreatmentExecution(tenantId, clientId, { treatmentType: type, title, outcome, details, deviationReason: deviation, escalation, qualificationSnapshot: 'Angemeldete Fachkraft · Berechtigung serverseitig geprüft' }, role);
    setBusy(false); if (!result.ok) return setError(result.error); setSaved(true); setTimeout(() => router.replace('/pflege/behandlungspflege' as never), 700);
  }
  return <ScreenShell title="Behandlungspflege dokumentieren" subtitle="Durchführung · Abweichung · Eskalation"><ScrollView contentContainerStyle={styles.content}><SectionPanel title="Durchführungsnachweis" subtitle="Auf Grundlage einer gültigen ärztlichen Anordnung">
    <Text style={styles.label}>Aktiver Pflegefall *</Text><FilterChipGroup wrap options={options} value={clientId} onChange={setClientId} />
    <Text style={styles.label}>Leistungsart</Text><FilterChipGroup wrap options={[{ key: 'injection', label: 'Injektion' }, { key: 'compression', label: 'Kompression' }, { key: 'catheter', label: 'Katheter' }, { key: 'tracheostomy', label: 'Tracheostoma' }, { key: 'ventilation', label: 'Beatmung' }, { key: 'other', label: 'Sonstige' }]} value={type} onChange={setType} />
    <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} /><Text style={styles.label}>Ergebnis *</Text>
    <FilterChipGroup wrap options={[{ key: 'performed', label: 'Durchgeführt' }, { key: 'partial', label: 'Teilweise' }, { key: 'omitted', label: 'Ausgelassen' }, { key: 'refused', label: 'Abgelehnt' }, { key: 'failed', label: 'Nicht möglich' }]} value={outcome} onChange={setOutcome} />
    <PremiumInput label="Durchführung / Beobachtung *" value={details} onChangeText={setDetails} multiline /><PremiumInput label="Abweichungsgrund" value={deviation} onChangeText={setDeviation} multiline /><PremiumInput label="Eskalation / Rücksprache" value={escalation} onChangeText={setEscalation} multiline />
    {error ? <ErrorState message={error} /> : null}{saved ? <SuccessState message="Durchführung wurde unveränderbar dokumentiert." /> : null}
    <PremiumButton title="Durchführung live dokumentieren" fullWidth loading={busy} disabled={busy || !clientId || !title.trim() || !details.trim()} onPress={save} />
  </SectionPanel></ScrollView></ScreenShell>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl }, label: { ...typography.label, color: colors.textMuted } });
