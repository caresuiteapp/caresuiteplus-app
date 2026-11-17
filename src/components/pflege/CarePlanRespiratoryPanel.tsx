import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { addRespiratoryAssessment, fetchRespiratoryAssessments, parseRespiratoryAssessment, type RespiratoryScope } from '@/lib/pflege/carePlanRespiratoryAssessment';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { spacing, typography } from '@/theme';

const blank = () => ({ observedOn: berlinCalendarDate(), instrument: '', instrumentVersion: '', score: '', maximum: '', findings: '' });
const formatScore = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const instrumentKey = (item: { instrument: string; instrumentVersion: string; maximum: number }) =>
  JSON.stringify([item.instrument, item.instrumentVersion, item.maximum]);

export function CarePlanRespiratoryPanel({ scope, actorId, canWrite, isCurrent }: {
  scope: RespiratoryScope;
  actorId: string | undefined;
  canWrite: boolean;
  isCurrent: () => boolean;
}) {
  const { c } = useCareLightPalette();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(12);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const request = useRef<{ id: string; inFlight: boolean } | null>(null);
  const query = useAsyncQuery(() => fetchRespiratoryAssessments(scope), [scope.tenantId, scope.planId, actorId],
    { queryKey: `atemskala:${scope.tenantId}:${scope.planId}:${actorId}`, enabled: Boolean(actorId && isCurrent()), retryCount: 0 });
  const rows = query.error || query.refreshError ? [] : query.data ?? [];
  const instruments = [...new Map(rows.map(item => [instrumentKey(item), `${item.instrument} · ${item.instrumentVersion} · bis ${formatScore.format(item.maximum)} Punkte`]))]
    .map(([key, label]) => ({ key, label }));
  const visible = rows.filter(item => filter === 'all' || instrumentKey(item) === filter);

  async function submit() {
    if (!canWrite || !isCurrent() || request.current?.inFlight) return;
    const value = parseRespiratoryAssessment(draft, berlinCalendarDate());
    if (!value) return setError('Datum, Instrument und Fassung, erhobenen Punktwert, Höchstwert und Beobachtung ergänzen.');
    request.current ??= { id: randomUUID(), inFlight: false };
    request.current.inFlight = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await addRespiratoryAssessment(scope, request.current.id, value);
      if (!isCurrent()) return;
      if (!result.ok) return setError(result.error);
      request.current = null;
      setOpen(false);
      setFilter('all');
      setDraft(blank());
      setNotice('Der erhobene Wert wurde in der Pflegeplanung dokumentiert.');
      await query.refresh();
    } catch {
      if (isCurrent()) setError('Die Speicherung konnte noch nicht bestätigt werden. Denselben Eintrag erneut speichern.');
    } finally {
      if (request.current) request.current.inFlight = false;
      setBusy(false);
    }
  }

  return (
    <SectionPanel title="Atemskala" subtitle="Erhobene Werte und pflegefachliche Beobachtungen">
      {canWrite && !open ? <PremiumButton title="Atemskala dokumentieren" onPress={() => { setOpen(true); setNotice(''); }} /> : null}
      {open && canWrite ? <View style={[styles.box, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
        <CareDateInput label="Erhebungsdatum" value={draft.observedOn} onChange={observedOn => { if (!busy) setDraft(value => ({ ...value, observedOn })); }} />
        <View style={styles.row}>
          <View style={styles.field}><PremiumInput label="Verwendetes Instrument *" value={draft.instrument} maxLength={120}
            editable={!busy} onChangeText={instrument => setDraft(value => ({ ...value, instrument }))} /></View>
          <View style={styles.field}><PremiumInput label="Fassung laut Erhebung *" value={draft.instrumentVersion} maxLength={80}
            editable={!busy} onChangeText={instrumentVersion => setDraft(value => ({ ...value, instrumentVersion }))} /></View>
        </View>
        {!draft.instrumentVersion ? <PremiumButton title="Fassung unbekannt" size="sm" variant="ghost" disabled={busy}
          onPress={() => setDraft(value => ({ ...value, instrumentVersion: 'Unbekannt' }))} /> : null}
        <View style={styles.row}>
          <View style={styles.field}><PremiumInput label="Erhobener Punktwert *" value={draft.score} keyboardType="decimal-pad" maxLength={6} editable={!busy}
            onChangeText={score => setDraft(value => ({ ...value, score }))} /></View>
          <View style={styles.field}><PremiumInput label="Höchstwert der Skala *" value={draft.maximum} keyboardType="decimal-pad" maxLength={6} editable={!busy}
            onChangeText={maximum => setDraft(value => ({ ...value, maximum }))} /></View>
        </View>
        <PremiumInput label="Beobachtung und pflegefachliche Einschätzung *" multiline value={draft.findings} maxLength={4000} editable={!busy}
          onChangeText={findings => setDraft(value => ({ ...value, findings }))} />
        {error ? <ErrorState presentation="inline" message={error} /> : null}
        <View style={styles.row}>
          <PremiumButton title="Erhebung speichern" loading={busy} disabled={busy} onPress={submit} />
          <PremiumButton title="Abbrechen" size="sm" variant="secondary" disabled={busy} onPress={() => { setOpen(false); setError(''); }} />
        </View>
      </View> : null}
      {notice ? <InfoBanner variant="success" presentation="inline" message={notice} /> : null}
      {query.loading ? <LoadingState presentation="inline" message="Atemskala wird geladen…" /> : null}
      {query.error || query.refreshError ? <ErrorState presentation="inline" message={query.error ?? query.refreshError ?? ''} onRetry={query.refresh} /> : null}
      {!query.loading && !query.error && !query.refreshError && !rows.length ? <Text style={[typography.body, { color: c.muted }]}>Für diese Pflegeplanung liegt noch keine dokumentierte Erhebung vor.</Text> : null}
      {instruments.length ? <FilterChipGroup wrap options={[{ key: 'all', label: 'Alle Erhebungen' }, ...instruments]}
        value={filter} onChange={key => { setFilter(key); setLimit(12); }} /> : null}
      {visible.slice(0, limit).map(item => <View key={item.id} style={[styles.box, { borderColor: c.border }]}>
        <View style={styles.row}>
          <Text style={[typography.bodyStrong, { flex: 1, color: c.text }]}>{item.instrument} · {item.instrumentVersion}</Text>
          <Text style={[typography.bodyStrong, { color: c.text }]}>{formatScore.format(item.score)} / {formatScore.format(item.maximum)} Punkte</Text>
        </View>
        <Text style={[typography.caption, { color: c.muted }]}>{item.observedOn.split('-').reverse().join('.')}</Text>
        <Text style={[typography.body, { color: c.text }]}>{item.findings}</Text>
      </View>)}
      {visible.length > limit ? <PremiumButton title="Weitere Erhebungen anzeigen" variant="secondary" onPress={() => setLimit(count => count + 12)} /> : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 15, padding: spacing.md, gap: spacing.sm, borderWidth: 1, minWidth: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 },
  field: { flexGrow: 1, flexBasis: 205, flexShrink: 1, minWidth: 0 },
});
