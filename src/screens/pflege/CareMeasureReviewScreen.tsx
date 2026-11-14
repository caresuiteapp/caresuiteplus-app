import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCarePlanDailyScope } from '@/hooks/pflege/useCarePlanDailyScope';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { canReviewMeasure, storedCalendarDay, storedDateLabel } from '@/lib/pflege/carePlanDailyWorklist';
import { fetchLiveCareMeasures, reviewLiveCareMeasure } from '@/lib/pflege/careQualityR2LiveService';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import type { CareMeasureLiveItem } from '@/types/modules/pflege';

const title = 'Maßnahme evaluieren';
const denied = 'Für diese Evaluation ist die aktuelle Leseberechtigung und die Freigabe zur Fortschreibung erforderlich.';
const decisions = [
  { key: 'continue', label: 'Fortführen' }, { key: 'change', label: 'Ändern' },
  { key: 'pause', label: 'Pausieren' }, { key: 'complete', label: 'Abschließen' },
] as const;
type Decision = typeof decisions[number]['key'];

export function CareMeasureReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const itemId = woundUuid(id) ? id : null;
  const scope = useCarePlanDailyScope(`review:${itemId ?? ''}`);
  if (scope.access.loading) return <ScreenShell title={title}><LoadingState message="Pflegeberechtigungen werden geprüft…" /></ScreenShell>;
  if (scope.access.error || !scope.can('pflege.measures.review')) return <ScreenShell title={title}>
    <ErrorState message={scope.access.error ?? denied} onRetry={scope.access.error ? scope.access.refreshPermissions : undefined} />
  </ScreenShell>;
  if (!itemId) return <ScreenShell title={title}><ErrorState message="Die Maßnahme im Link ist ungültig." /></ScreenShell>;
  return <MeasureReviewWorkspace key={scope.revision} scope={scope} itemId={itemId} />;
}

function MeasureReviewWorkspace({ scope, itemId }: { scope: ReturnType<typeof useCarePlanDailyScope>; itemId: string }) {
  const router = useFlowRouter();
  const current = () => scope.can('pflege.measures.review');
  const query = useAsyncQuery(async () => {
    if (!scope.tenantId || !current()) return { ok: false as const, error: denied };
    const result = await fetchLiveCareMeasures(scope.tenantId, scope.access.roleKey, { itemId, permissions: scope.access.permissions, isCurrent: current });
    if (!current()) return { ok: false as const, error: denied };
    if (!result.ok) return result;
    if (result.data.length !== 1 || !canReviewMeasure(result.data[0])) return { ok: false as const, error: 'Die Maßnahme wurde nicht gefunden oder kann in ihrem aktuellen Zustand nicht fortgeschrieben werden.' };
    return { ok: true as const, data: result.data[0] };
  }, [itemId, scope.revision], { queryKey: `measure-review:${scope.revision}:${itemId}`, retryCount: 0 });
  const latest = useRef(query);
  latest.current = query;
  const selected = current() && !query.loading && !query.refreshing && !query.error && !query.refreshError && !query.previewData && !query.tableMissing ? query.data : null;
  if (query.loading || query.refreshing) return <ScreenShell title={title}><LoadingState message="Aktueller Maßnahmenstand wird geprüft…" /></ScreenShell>;
  if (!selected) return <ScreenShell title={title}><ErrorState message={query.refreshError ?? query.error ?? denied} onRetry={query.refresh} /></ScreenShell>;
  const currentRow = () => {
    const latestQuery = latest.current;
    return current() && latestQuery.data === selected && !latestQuery.loading && !latestQuery.refreshing && !latestQuery.error && !latestQuery.refreshError;
  };
  const toList = () => { if (currentRow()) router.replace({ pathname: '/pflege/massnahmen', params: { planId: selected.carePlanId } }); };
  return <MeasureReviewForm key={selected.updatedAt} scope={scope} item={selected} currentRow={currentRow} toList={toList} />;
}

function MeasureReviewForm({ scope, item, currentRow, toList }: {
  scope: ReturnType<typeof useCarePlanDailyScope>; item: CareMeasureLiveItem; currentRow(): boolean; toList(): void;
}) {
  const { c } = useCareLightPalette();
  const [decision, setDecision] = useState<Decision>('continue');
  const [effect, setEffect] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rationale, setRationale] = useState('');
  const [intervention, setIntervention] = useState(item.intervention);
  const [frequency, setFrequency] = useState(item.frequency);
  const [nextEvaluation, setNextEvaluation] = useState(item.nextEvaluationAt ?? '');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const dateValid = !nextEvaluation.trim() || storedCalendarDay(nextEvaluation.trim()) !== null;
  const changed = intervention.trim() !== item.intervention.trim() || frequency.trim() !== item.frequency.trim();
  const changeValid = changed && (intervention.trim() !== '' || item.intervention.trim() === '')
    && (frequency.trim() !== '' || item.frequency.trim() === '');

  async function save() {
    if (!scope.tenantId || !scope.actorId || !currentRow() || inFlight.current || uncertain || saved) return;
    if (!effect.trim() || !rationale.trim() || !dateValid || (decision === 'change' && !changeValid)) return;
    const payload = {
      decision, observedEffect: effect.trim(), personFeedback: feedback.trim(), professionalRationale: rationale.trim(),
      changedIntervention: decision === 'change' ? intervention.trim() : '', changedFrequency: decision === 'change' ? frequency.trim() : '',
      nextEvaluationAt: decision === 'complete' ? null : nextEvaluation.trim() || null,
    };
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await reviewLiveCareMeasure(scope.tenantId, scope.access.roleKey, item.id, payload, {
        actorId: scope.actorId, expected: item, permissions: scope.access.permissions, isCurrent: currentRow,
      });
      if (!currentRow()) return;
      if (result.ok) setSaved(true);
      else { setError(result.error); if ('uncertain' in result && result.uncertain) setUncertain(true); }
    } catch {
      if (currentRow()) {
        setUncertain(true);
        setError('Der Speicherstand ist nicht bestätigt. Öffnen Sie die Maßnahmenliste und prüfen Sie den aktuellen Eintrag.');
      }
    } finally {
      inFlight.current = false;
      if (currentRow()) setBusy(false);
    }
  }

  if (saved) return <ScreenShell title="Evaluation gespeichert">
    <SuccessState message="Wirkung und Entscheidung wurden für diese Maßnahme gespeichert." />
    <PremiumButton title="Maßnahmen des Pflegeplans ansehen" onPress={toList} />
  </ScreenShell>;
  return <ScreenShell title={title} subtitle={`${item.clientName || 'Name nicht erfasst'} · ${item.planTitle || 'Pflegeplan'}`} onBack={toList}>
    <View style={styles.content}>
      <SectionPanel title={item.title || 'Maßnahme'} subtitle="Aktuell gespeicherte Angaben">
        <Text style={[styles.body, { color: c.text }]}>Status: {item.status === 'paused' ? 'Pausiert' : 'Aktiv'}</Text>
        <Text style={[styles.body, { color: c.text }]}>Durchführung: {item.intervention || 'Nicht erfasst'}</Text>
        <Text style={[styles.body, { color: c.text }]}>Häufigkeit: {item.frequency || 'Nicht erfasst'}</Text>
        <Text style={[styles.body, { color: c.text }]}>Zuständige Rolle: {item.responsibleRole || 'Nicht erfasst'}</Text>
        <Text style={[styles.body, { color: c.muted }]}>Bisheriger Evaluationstermin: {storedDateLabel(item.nextEvaluationAt)}</Text>
      </SectionPanel>
      {uncertain ? <><ErrorState message={error ?? 'Der Speicherstand ist nicht bestätigt.'} presentation="inline" />
        <PremiumButton title="Zur Maßnahmenliste" onPress={toList} /></> : <SectionPanel title="Wirkung und Entscheidung">
        <FilterChipGroup options={[...decisions]} value={decision} onChange={value => { if (!inFlight.current && currentRow()) setDecision(value); }} wrap />
        <PremiumInput editable={!busy} label="Beobachtete Wirkung *" value={effect} onChangeText={setEffect} multiline maxLength={5000} />
        <PremiumInput editable={!busy} label="Rückmeldung der versorgten Person" value={feedback} onChangeText={setFeedback} multiline maxLength={5000} />
        <PremiumInput editable={!busy} label="Fachliche Begründung *" value={rationale} onChangeText={setRationale} multiline maxLength={5000} />
        {decision === 'change' ? <>
          <PremiumInput editable={!busy} label="Durchführung" value={intervention} onChangeText={setIntervention} multiline maxLength={5000} />
          <PremiumInput editable={!busy} label="Häufigkeit" value={frequency} onChangeText={setFrequency} maxLength={500} />
          <Text style={[styles.body, { color: c.muted }]}>Beim Ändern muss sich mindestens eine Angabe ändern. Das Löschen vorhandener Angaben ist in diesem Ablauf nicht möglich.</Text>
        </> : null}
        {decision !== 'complete' ? <PremiumInput editable={!busy} label="Nächster Evaluationstermin" placeholder="JJJJ-MM-TT" value={nextEvaluation}
          onChangeText={setNextEvaluation} maxLength={10} error={!dateValid ? 'Bitte ein gültiges Datum eingeben.' : undefined}
          hint="Leer lassen, wenn kein nächster Termin vorgesehen ist." /> : <InfoBanner variant="info" presentation="inline" message="Beim Abschließen endet diese Maßnahme. Ein nächster Evaluationstermin wird nicht gesetzt." />}
        {error ? <ErrorState message={error} presentation="inline" /> : null}
        <PremiumButton title="Evaluation speichern" loading={busy} disabled={!effect.trim() || !rationale.trim() || !dateValid || decision === 'change' && !changeValid} onPress={() => { void save(); }} />
      </SectionPanel>}
    </View>
  </ScreenShell>;
}
const styles = StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl }, body: { ...typography.body } });
