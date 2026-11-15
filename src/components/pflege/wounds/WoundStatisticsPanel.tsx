import { useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { COMPLICATING_FACTORS, formatWoundNumber } from '@/lib/pflege/woundRecordDomain';
import { readWoundStatistics, type WoundRecordScope } from '@/lib/pflege/woundRecordService';
import { useWoundRecordStyles } from './woundRecordStyles';

export function WoundStatisticsPanel({ scope }: {
  scope: Pick<WoundRecordScope, 'tenantId' | 'actorId' | 'role'>;
}) {
  const styles = useWoundRecordStyles();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [from, setFrom] = useState(today.slice(0,4) + '-01-01'), [to, setTo] = useState(today);
  const [range, setRange] = useState([from, to]);
  const [warning, setWarning] = useState('');
  const query = useAsyncQuery(() => readWoundStatistics(scope, range[0], range[1]), [scope.tenantId, scope.actorId, scope.role, range[0], range[1]],
    { queryKey: [scope.tenantId, scope.actorId, scope.role, ...range, 'wound-statistics'].join(':') });
  const summary = query.data;
  const bars = (title: string, rows: Record<string, number>) => {
    const counts = Object.entries(rows).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
    const max = Math.max(1, ...counts.map(row => row[1]));
    return <View style={[styles.field, styles.panel]}>
      <Text style={styles.title}>{title}</Text>
      {counts.length ? counts.map(([label, number]) => <View key={label} style={styles.tight}>
        <Text style={styles.text}>{label} · {number}</Text>
        <View style={styles.barTrack}><View style={[styles.bar, { width: ((100 * number / max) + '%') as `${number}%` }]} /></View>
      </View>) : <Text style={styles.muted}>Keine Werte vorhanden.</Text>}
    </View>;
  };
  return <SectionPanel title="Wundstatistik">
    <View style={styles.stack}>
      <Text style={styles.text}>Im Zeitraum angelegte Wundfälle der zugänglichen Pflegeakten. Alter und Geschlecht zählen jede Person einmal.</Text>
      <View style={styles.row}>
        <View style={styles.field}><PremiumInput label="Von (JJJJ-MM-TT)" accessibilityLabel="Von (JJJJ-MM-TT)" value={from} onChangeText={setFrom} maxLength={10} /></View>
        <View style={styles.field}><PremiumInput label="Bis (JJJJ-MM-TT)" accessibilityLabel="Bis (JJJJ-MM-TT)" value={to} onChangeText={setTo} maxLength={10} /></View>
      </View>
      <View style={styles.row}>
        <PremiumButton title="Zeitraum auswerten" disabled={query.loading} onPress={() => {
          const calendar = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
          if (!calendar(from) || !calendar(to) || from > to || to > today) { setWarning('Gültiges Datum und Zeitraum prüfen.'); return; }
          setWarning(''); if (range[0] === from && range[1] === to) void query.refresh(); else setRange([from,to]);
        }} />
      </View>
      {!!warning && <ErrorState message={warning} />}
      {query.loading && <LoadingState message="Wundstatistik wird berechnet …" />}
      {(query.error || query.refreshError) && <ErrorState message={query.error || query.refreshError || ''} onRetry={query.refresh} />}
      {summary && !query.refreshError && <>
        <View style={styles.row}>
          {[[String(summary.total), 'Wundfälle'], [String(summary.people), 'Personen'], [
            summary.medianDays == null ? '—' : formatWoundNumber(summary.medianDays,1) + ' Tage',
            'Median vom ersten datierten Befund bis zum Abschluss · ' + summary.dated + ' Fälle',
          ]].map(([value,label]) => <View key={label} style={styles.tile}><Text style={styles.value}>{value}</Text><Text style={styles.muted}>{label}</Text></View>)}
        </View>
        <View style={styles.row}>
          {bars('Wundarten', summary.types)}{bars('Altersgruppen', summary.ageGroups)}
          {bars('Geschlechtsangaben', summary.gender)}
          {bars('Dokumentierte Einflussfaktoren', Object.fromEntries(Object.entries(summary.factors).map(([key, value]) =>
            [COMPLICATING_FACTORS[key as keyof typeof COMPLICATING_FACTORS] ?? key, value])))}
        </View>
      </>}
    </View>
  </SectionPanel>;
}
