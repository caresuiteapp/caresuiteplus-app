import { useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchWoundClients } from '@/lib/pflege/ambulatoryWoundService';
import { COMPLICATING_FACTORS, formatWoundNumber } from '@/lib/pflege/woundRecordDomain';
import { readWoundStatistics, type WoundRecordUserScope } from '@/lib/pflege/woundRecordService';
import { WoundClientPicker } from './WoundClientPicker';
import { WoundSection } from './WoundWorkspaceLayout';
import { useWoundRecordStyles } from './woundRecordStyles';

function validCalendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function WoundStatisticsPanel({ scope, initialClientId }: { scope: WoundRecordUserScope; initialClientId?: string }) {
  const styles = useWoundRecordStyles();
  const { tenantId, actorId, role } = scope;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [from, setFrom] = useState(today.slice(0, 4) + '-01-01'), [to, setTo] = useState(today);
  const [range, setRange] = useState({ from, to });
  const [clientId, setClientId] = useState(initialClientId);
  const [warning, setWarning] = useState('');
  const people = useAsyncQuery(() => fetchWoundClients(tenantId, role), [tenantId, actorId, role], {
    queryKey: [tenantId, actorId, role, 'wound-statistics-clients'].join(':'),
  });
  const patient = people.data?.find(person => person.id === clientId);
  const filterKey = [tenantId, actorId, role, range.from, range.to, clientId ?? 'all', 'wound-statistics'];
  const query = useAsyncQuery(() => readWoundStatistics(scope, range.from, range.to, clientId), filterKey,
    { queryKey: filterKey.join(':') });
  const summary = !query.loading && !query.error && !query.refreshError ? query.data : null;
  const bars = (title: string, rows: Record<string, number>) => {
    const counts = Object.entries(rows).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
    const max = Math.max(1, ...counts.map(row => row[1]));
    return <View style={[styles.field, styles.panel]}>
      <Text style={styles.title}>{title}</Text>
      {counts.length ? counts.map(([label, number]) => <View key={label} style={styles.tight}>
        <Text style={styles.text}>{label} · {number}</Text>
        <View style={styles.barTrack}><View style={[styles.bar, { width: `${100 * number / max}%` }]} /></View>
      </View>) : <Text style={styles.muted}>Keine Werte vorhanden.</Text>}
    </View>;
  };
  return <>
    <WoundSection title="Wundstatistik" subtitle="Filter nach Pflegeakte und Anlagezeitraum">
      <View style={styles.row}>
        <View style={styles.field}>
          <WoundClientPicker people={people.data ?? []} selected={clientId}
            onSelect={id => {
              if (!people.error && !people.refreshError && people.data?.some(person => person.id === id)) setClientId(id);
            }} onReset={() => setClientId(undefined)} disabled={people.loading || !!people.error || !!people.refreshError} />
          {people.loading && <LoadingState message="Pflegeakten werden geladen …" />}
          {(people.error || people.refreshError) && <ErrorState message={people.error || people.refreshError || ''} onRetry={people.refresh} />}
        </View>
        <View style={[styles.field, styles.row]}>
          <View style={styles.field}><CareDateInput label="Von" value={from} onChange={setFrom} showFormatHint={false} /></View>
          <View style={styles.field}><CareDateInput label="Bis" value={to} onChange={setTo} showFormatHint={false} /></View>
        </View>
      </View>
      <View style={styles.row}>
        <PremiumButton title="Zeitraum auswerten" size="sm" disabled={query.loading} onPress={() => {
          if (!validCalendarDate(from) || !validCalendarDate(to) || from > to || to > today) {
            setWarning('Gültiges Datum und Zeitraum prüfen.');
            return;
          }
          setWarning('');
          if (range.from === from && range.to === to) void query.refresh();
          else setRange({ from, to });
        }} />
      </View>
      {!!warning && <ErrorState message={warning} />}
    </WoundSection>
    <WoundSection title="Auswertung"
      subtitle={`${patient?.name ?? (clientId ? 'Gewählte Pflegeakte' : 'Alle zugänglichen Pflegeakten')} · ${range.from} bis ${range.to}`}>
      {query.loading && <LoadingState message="Wundstatistik wird berechnet …" />}
      {(query.error || query.refreshError) && <ErrorState message={query.error || query.refreshError || ''} onRetry={query.refresh} />}
      {summary && <>
        <View style={styles.row}>
          {[[String(summary.total), 'Wundfälle'], [String(summary.people), 'Personen'], [
            summary.medianDays == null ? '—' : formatWoundNumber(summary.medianDays, 1) + ' Tage',
            'Median vom ersten datierten Befund bis zum Abschluss · ' + summary.dated + ' Fälle',
          ]].map(([value, label]) => <View key={label} style={styles.tile}><Text style={styles.value}>{value}</Text><Text style={styles.muted}>{label}</Text></View>)}
        </View>
        {summary.total ? <View style={styles.row}>
          {bars('Wundarten', summary.types)}{bars('Altersgruppen', summary.ageGroups)}
          {bars('Geschlechtsangaben', summary.gender)}
          {bars('Dokumentierte Einflussfaktoren', Object.fromEntries(Object.entries(summary.factors).map(([key, value]) =>
            [COMPLICATING_FACTORS[key as keyof typeof COMPLICATING_FACTORS] ?? key, value])))}
        </View> : <Text style={styles.muted}>Für diese Auswahl wurden im Zeitraum keine Wundfälle angelegt.</Text>}
      </>}
    </WoundSection>
  </>;
}
