import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareDateInput } from '@/components/inputs';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { readClientServiceContinuity } from '@/lib/office/continuity/clientCareContinuityRepository.supabase.web';
import { endInterruptionDurably, recoverInterruptionJournal, startInterruptionDurably } from '@/lib/office/continuity/clientCareContinuityWorkflow.web';
import { ClientOffboardingScreen } from './ClientOffboardingScreen';
import { CLIENT_SERVICE_INTERRUPTION_LABELS, type ClientServiceContinuitySummary, type ClientServiceInterruptionKind } from '@/types/modules/clientCareContinuity';
import { radius, spacing, typography } from '@/theme';

const kinds = Object.entries(CLIENT_SERVICE_INTERRUPTION_LABELS) as [ClientServiceInterruptionKind, string][];
const instant = () => new Date().toISOString();
const dayStart = (value: string) => value ? `${value}T00:00:00.000Z` : '';
const dayEnd = (value: string) => value ? `${value}T23:59:59.999Z` : null;

export function ClientCareContinuityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter(); const tenantId = useServiceTenantId(); const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const [mode, setMode] = useState<'continuity' | 'exit'>('continuity');
  const [summary, setSummary] = useState<ClientServiceContinuitySummary | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<ClientServiceInterruptionKind>('hospital'); const [reason, setReason] = useState('');
  const [plannedStart, setPlannedStart] = useState(''); const [plannedEnd, setPlannedEnd] = useState('');
  const [actualStart, setActualStart] = useState(instant()); const [actualEnd, setActualEnd] = useState(instant()); const [endReason, setEndReason] = useState('');
  const scope = useMemo(() => tenantId && id && profile?.id ? { tenantId, clientId: id, actorId: profile.id } : null, [tenantId, id, profile?.id]);
  const allowed = can('office.clients.status_change') && can('office.clients.edit');

  const reload = async () => {
    if (!scope) return; setLoading(true); setError(null);
    const recovered = await recoverInterruptionJournal(scope.tenantId, scope.clientId, scope.actorId);
    if (recovered && !recovered.ok) setError(`${recovered.error} Keine automatische Wiederholung.`);
    const result = await readClientServiceContinuity(scope.tenantId, scope.clientId, scope.actorId);
    if (result.ok) setSummary(result.data); else setError(result.error);
    setLoading(false);
  };
  useEffect(() => { if (scope && allowed) void reload(); else setLoading(false); }, [scope, allowed]);

  if (mode === 'exit') return <ClientOffboardingScreen clientId={id} />;
  if (!allowed) return <ScreenShell title="Versorgungsunterbrechung / Austritt" showBack onBack={() => router.back()}><LockedActionBanner message={check('office.clients.status_change').reason ?? 'Keine aktuelle Berechtigung.'} roleLabel={roleLabel} /></ScreenShell>;
  if (loading && !summary) return <ScreenShell title="Versorgungsunterbrechung / Austritt" showBack><LoadingState message="Versorgungsverlauf wird sicher geladen…" /></ScreenShell>;
  if (!summary) return <ScreenShell title="Versorgungsunterbrechung / Austritt" showBack><ErrorState message={error ?? 'Die native Übersicht ist nicht verfügbar.'} onRetry={reload} /></ScreenShell>;
  const active = summary.active;

  const begin = async () => {
    if (!scope || !plannedStart) return; setBusy(true); setError(null);
    const result = await startInterruptionDurably({ ...scope, requestId: crypto.randomUUID(), expectedClientUpdatedAt: summary.clientUpdatedAt,
      kind, reason, plannedStartAt: dayStart(plannedStart), plannedEndAt: dayEnd(plannedEnd), actualStartAt: actualStart });
    if (!result.ok) setError(`${result.error} Bei unklarem Ausgang wird nicht automatisch erneut gesendet.`);
    await reload(); setBusy(false);
  };
  const end = async () => {
    if (!scope || !active) return; setBusy(true); setError(null);
    const result = await endInterruptionDurably({ ...scope, interruptionId: active.id, requestId: active.requestId, endRequestId: crypto.randomUUID(),
      expectedUpdatedAt: active.updatedAt, actualEndAt: actualEnd, endReason });
    if (!result.ok) setError(`${result.error} Einsätze werden nicht automatisch neu erzeugt.`);
    await reload(); setBusy(false);
  };

  return <ScreenShell title="Versorgungsunterbrechung / Austritt" subtitle={summary.clientName} showBack onBack={() => router.back()} scroll>
    <SectionPanel title="Vorgang eindeutig wählen" subtitle="Vorübergehende Unterbrechung ist kein Austritt">
      <View style={styles.choices}><Choice label="Unterbrechung und Rückkehr" selected onPress={() => undefined} /><Choice label="Endgültiger Austritt / Kündigung" selected={false} onPress={() => setMode('exit')} /></View>
      <InfoBanner title="Historie bleibt unverändert" message="Nur noch nicht begonnene Einsätze im bestätigten Zeitraum werden serverseitig gestoppt. Tatsächliche Zeiten, erledigte Aufgaben, Dokumentation und Originalbelege bleiben erhalten. Rückkehr erzeugt keine Einsätze automatisch neu." variant="info" presentation="inline" />
    </SectionPanel>
    {error ? <InfoBanner title="Vorgang gesperrt" message={error} variant="danger" presentation="inline" /> : null}
    {active ? <SectionPanel title="Aktive Versorgungsunterbrechung" subtitle={CLIENT_SERVICE_INTERRUPTION_LABELS[active.kind]}>
      <Text style={styles.value}>Tatsächlicher Beginn: {active.actualStartAt}</Text><Text style={styles.value}>Planzeitraum: {active.plannedStartAt} – {active.plannedEndAt ?? 'offen'}</Text>
      <Text style={styles.value}>Grund: {active.reason}</Text><Text style={styles.value}>Gestoppt: {active.affectedVisitCount} Einsätze · {active.affectedTourStopCount} Tourstopps</Text>
      {active.blockedStartedVisitCount ? <InfoBanner title="Begonnene Einsätze nicht verändert" message={`${active.blockedStartedVisitCount} bereits begonnene Einsätze verlangen eine gesonderte fachliche Klärung.`} variant="warning" presentation="inline" /> : null}
      <PremiumInput label="Tatsächliches Rückkehrende (ISO mit Zeitzone)" value={actualEnd} onChangeText={setActualEnd} onLightSurface viewContext="form" />
      <PremiumInput label="Tatsächlicher Rückkehr-/Wiederaufnahmegrund" value={endReason} onChangeText={setEndReason} multiline onLightSurface viewContext="form" />
      <PremiumButton title="Rückkehr mit Originalquittung bestätigen" loading={busy} disabled={endReason.trim().length < 10 || !actualEnd} onPress={end} />
      <InfoBanner title="Keine stillschweigende Neuplanung" message="Nach der Rückkehr müssen neue Einsätze ausdrücklich fachlich geplant und freigegeben werden. Der frühere Plan wird nicht als tatsächlich durchgeführt oder weiterhin gültig behandelt." variant="warning" presentation="inline" />
    </SectionPanel> : <SectionPanel title="Vorübergehende Unterbrechung erfassen" subtitle="Krankenhaus, Reha, Urlaub oder anderer bestätigter Grund">
      <Text style={styles.label}>Unterbrechungsart</Text><View style={styles.choices}>{kinds.map(([key, label]) => <Choice key={key} label={label} selected={kind === key} onPress={() => setKind(key)} />)}</View>
      <CareDateInput label="Geplanter Beginn" value={plannedStart} onChange={setPlannedStart} viewContext="form" />
      <CareDateInput label="Geplantes Ende (optional)" value={plannedEnd} onChange={setPlannedEnd} viewContext="form" />
      <PremiumInput label="Tatsächlicher Beginn (ISO mit Zeitzone)" value={actualStart} onChangeText={setActualStart} onLightSurface viewContext="form" />
      <PremiumInput label="Vollständiger bestätigter Grund" value={reason} onChangeText={setReason} multiline onLightSurface viewContext="form" />
      <PremiumButton title="Unterbrechung prüfen und zukünftige Einsätze stoppen" loading={busy} disabled={!plannedStart || reason.trim().length < 10 || !actualStart} onPress={begin} />
      <InfoBanner title="Tod wird niemals abgeleitet" message="Ein Krankenhausaufenthalt, ausbleibender Einsatz oder offenes Enddatum wird nicht als Tod, Kündigung oder endgültiger Austritt gewertet." variant="info" presentation="inline" />
    </SectionPanel>}
    {summary.history.length ? <SectionPanel title="Unveränderliche Verlaufssicht" subtitle="Tatsächliche Ereignisse bleiben von Planterminen getrennt">
      {summary.history.map((entry) => <View key={entry.id} style={styles.history}><Text style={styles.historyTitle}>{CLIENT_SERVICE_INTERRUPTION_LABELS[entry.kind]} · {entry.status === 'active' ? 'aktiv' : 'beendet'}</Text><Text style={styles.value}>Plan: {entry.plannedStartAt} – {entry.plannedEndAt ?? 'offen'} · Tatsächlich: {entry.actualStartAt} – {entry.actualEndAt ?? 'offen'}</Text><Text style={styles.value}>{entry.reason}{entry.endReason ? ` · Rückkehr: ${entry.endReason}` : ''}</Text></View>)}
    </SectionPanel> : null}
  </ScreenShell>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{selected ? '✓ ' : ''}{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  choice: { borderWidth: 1, borderColor: '#9CC8F7', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#F5FAFF' },
  choiceSelected: { borderColor: '#056CE8', backgroundColor: '#DCEEFF' }, choiceText: { ...typography.caption, color: '#395571', fontWeight: '700' }, choiceTextSelected: { color: '#045BBF' },
  label: { ...typography.label, color: '#09213F', marginBottom: spacing.xs }, value: { ...typography.body, color: '#274967', marginBottom: spacing.xs },
  history: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#BBD5EE', paddingVertical: spacing.sm }, historyTitle: { ...typography.body, color: '#09213F', fontWeight: '700' },
});

