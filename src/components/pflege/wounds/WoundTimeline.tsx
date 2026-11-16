import { WoundSection } from './WoundWorkspaceLayout';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { ErrorState, FilterChipGroup, PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { ENTRY_LABELS, formatWoundDate, formatWoundNumber, materialCost, type WoundEntry, type WoundMedia } from '@/lib/pflege/woundRecordDomain';
import { describeWoundEntry, downloadWoundReport, euro, woundFactorCounts, woundRecordSeries, type WoundReportMode, type WoundSeries } from '@/lib/pflege/woundRecordReport';
import { fetchWoundCareWithTreatmentCorrections } from '@/lib/pflege/treatmentCorrectionService';
import type { WoundRecordScope } from '@/lib/pflege/woundRecordService';
import type { AmbulatoryWound } from '@/lib/pflege/ambulatoryWoundService';
import { useWoundRecordStyles } from './woundRecordStyles';

export function WoundEntries({ entries }: { entries: WoundEntry[] }) {
  const styles = useWoundRecordStyles();
  const [limit, setLimit] = useState(12);
  if (!entries.length) return <Text style={styles.muted}>Hier sind noch keine Einträge gespeichert.</Text>;
  return <View style={styles.stack}>
    {entries.slice(0, limit).map(entry => <View key={entry.id} style={styles.panel}>
      <Text style={styles.title}>{ENTRY_LABELS[entry.kind]}</Text>
      <Text style={styles.muted}>{formatWoundDate(entry.observed_at)} · {entry.recorded_by_name}</Text>
      {describeWoundEntry(entry).map(([label, value]) => <Text key={label} style={styles.text}>
        <Text style={{ fontWeight: '700' }}>{label}</Text>{' · ' + value}
      </Text>)}
    </View>)}
    {entries.length > limit && <PremiumButton title="Weitere Einträge anzeigen" variant="secondary" onPress={() => setLimit(n => n + 20)} />}
  </View>;
}

function WoundChart({ series, bars }: { series: WoundSeries; bars: boolean }) {
  const styles = useWoundRecordStyles(), { c } = useCareLightPalette();
  const points = series.points.slice(-80);
  const dates = points.map(point => Date.parse(point.at));
  const lower = dates[0], upper = dates.at(-1) ?? lower;
  const ceiling = Math.max(1, ...points.map(point => point.value));
  const barWidth = Math.min(18, 422 / points.length);
  const coords = points.map((point, index) => ({
    x: 26 + (upper === lower ? (points.length > 1 ? index / (points.length - 1) : .5) : (dates[index] - lower) / (upper - lower)) * 462,
    y: 119 - point.value / ceiling * 94,
  }));
  return <View style={styles.tight}>
    <View style={styles.row}>
      <Text style={styles.title}>{series.title}</Text>
      <Text style={styles.muted}>{formatWoundNumber(ceiling)} {series.unit}</Text>
    </View>
    <Svg viewBox="0 0 512 144" style={styles.chart} accessibilityLabel={'Verlauf ' + series.title}>
      {[25, 72, 119].map(y => <Line key={y} x1={26} y1={y} x2={488} y2={y} stroke={c.border} strokeWidth={1.5} />)}
      {bars ? coords.map((point, index) => <Rect key={points[index].id + ':' + index}
        x={26 + (index + .5) * 462 / points.length - barWidth / 2} y={point.y}
        width={barWidth} height={Math.max(1, 119 - point.y)} rx={2} fill={c.cyan} />) : <>
        <Polyline points={coords.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke={c.cyan} strokeWidth={4} />
        {coords.map((p, i) => <Circle key={points[i].id + ':' + i} cx={p.x} cy={p.y} r={4.5} fill={c.cyan} />)}
      </>}
    </Svg>
    <View style={styles.row}>
      <Text style={styles.muted}>{formatWoundDate(points[0].at)}</Text>
      {points.length > 1 && <Text style={styles.muted}>{formatWoundDate(points.at(-1)!.at)}</Text>}
    </View>
    {series.points.length > points.length && <Text style={styles.muted}>Neueste {points.length} von {series.points.length} Messwerten im Diagramm.</Text>}
    {points.slice(-5).reverse().map((p, i) => <Text key={p.id + ':' + i} style={styles.text}>
      {formatWoundDate(p.at)} · {formatWoundNumber(p.value)} {series.unit}
    </Text>)}
  </View>;
}

export function WoundTrends({ series }: { series: WoundSeries[] }) {
  const styles = useWoundRecordStyles();
  const [metric, setMetric] = useState(''), [diagram, setDiagram] = useState('line');
  const current = series.find(item => item.key === metric) ?? series[0];
  return <WoundSection title="Verlaufsdiagramme">
    <View style={styles.stack}>
      {current ? <>
        <FilterChipGroup wrap value={current.key} options={series.map(item => ({ key: item.key, label: item.title }))} onChange={setMetric} />
        <FilterChipGroup wrap value={diagram} options={[{ key: 'line', label: 'Kurve' }, { key: 'bars', label: 'Balken' }]} onChange={setDiagram} />
        <WoundChart series={current} bars={diagram === 'bars'} />
      </> : <Text style={styles.muted}>Sobald datierte Messwerte vorliegen, erscheinen sie hier im Verlauf.</Text>}
    </View>
  </WoundSection>;
}

export function WoundInfluenceSummary({ entries }: { entries: WoundEntry[] }) {
  const styles = useWoundRecordStyles();
  const factors = woundFactorCounts(entries);
  if (!factors.length) return null;
  const max = Math.max(...factors.map(factor => factor.count));
  return <WoundSection title="Dokumentierte Einflussfaktoren">
    {factors.map(({ key, label, count }) => <View key={key} style={styles.tight}>
      <Text style={styles.text}>{label} · {count} {count === 1 ? 'Nennung' : 'Nennungen'}</Text>
      <View style={styles.barTrack}><View style={[styles.bar, { width: `${100 * count / max}%` }]} /></View>
    </View>)}
  </WoundSection>;
}

export function WoundCostSummary({ entries }: { entries: WoundEntry[] }) {
  const styles = useWoundRecordStyles();
  const consumption = entries.filter(entry => entry.kind === 'material' && entry.payload.mode === 'used');
  const prices = consumption.map(e => materialCost(e.payload)).filter((value): value is number => value !== null);
  return <View style={styles.panel}>
    <Text style={styles.title}>Dokumentierte Materialkosten</Text>
    <Text style={styles.value}>{prices.length ? euro(prices.reduce((a,b) => a + b, 0)) : '—'}</Text>
    <Text style={styles.muted}>{consumption.length} Verbrauchseinträge · {consumption.length - prices.length} ohne Preis</Text>
  </View>;
}

type WoundWithCorrections = AmbulatoryWound & { corrections: Record<string, unknown>[] };
export function WoundExportPanel({ wound, entries, media, scope, canReadPlans, canReadTreatment, locked }: {
  wound: WoundWithCorrections; entries: WoundEntry[]; media: WoundMedia[]; scope: WoundRecordScope;
  canReadPlans: boolean; canReadTreatment: boolean; locked: boolean;
}) {
  const styles = useWoundRecordStyles();
  const [mode, setMode] = useState<WoundReportMode>('timeline'), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const types = [
    { key: 'timeline', label: 'Gesamtverlauf' }, { key: 'assessment', label: 'Einzelner Wundbefund' },
    { key: 'entry', label: 'Einzeleintrag' }, { key: 'charts', label: 'Verlaufsdiagramme' },
    { key: 'diabetic_foot', label: 'Diabetischer Fuß' }, { key: 'tracheostomy', label: 'Tracheostomie' },
    { key: 'delivery', label: 'Lieferschein' }, { key: 'prescription', label: 'Rezeptvorschlag' },
  ];
  const needsSelection = mode === 'assessment' || mode === 'entry' || mode === 'delivery' || mode === 'prescription';
  const emptyCollection = ((mode === 'diabetic_foot' || mode === 'tracheostomy') && !entries.some(e => e.kind === mode))
    || (mode === 'charts' && !woundRecordSeries(entries, wound.assessments).length && !woundFactorCounts(entries).length);
  const label = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? formatWoundDate(value) : 'Zeitpunkt offen';
  const options = mode === 'assessment' ? wound.assessments.map(a => ({ key: String(a.id), label: label(a.observed_at ?? a.created_at) })) :
    entries.filter(e => mode === 'entry' || (e.kind === 'material' && e.payload.mode === (mode === 'delivery' ? 'delivered' : 'proposed')))
      .map(e => ({ key: e.id, label: (e.kind === 'material' ? String(e.payload.name) : ENTRY_LABELS[e.kind]) + ' · ' + label(e.observed_at) }));
  async function save() {
    if (busy || locked || emptyCollection || (needsSelection && !options.some(o => o.key === selected))) return;
    setError(''); setBusy(true);
    try {
      const care = mode === 'timeline' && canReadPlans ?
        await fetchWoundCareWithTreatmentCorrections(scope.tenantId, scope.woundId, scope.role, canReadTreatment) : null;
      if (care && !care.ok) throw Error(care.error);
      if (!alive.current) return;
      await downloadWoundReport({ wound, entries, media, mode, selected, care: care?.data,
        treatmentCorrections: care?.data.corrections }, () => alive.current);
    } catch (e) { setError(e instanceof Error ? e.message : 'Die PDF-Ausgabe konnte nicht erstellt werden.'); }
    finally { setBusy(false); }
  }
  return <WoundSection title="Dokumentation ausgeben">
    <View style={styles.stack}>
      <FilterChipGroup wrap options={types} value={mode} onChange={busy || locked ? undefined : key => { setMode(key as WoundReportMode); setSelected(''); }} />
      {needsSelection && (options.length ? <FilterChipGroup wrap options={options} value={selected} onChange={busy ? undefined : setSelected} /> :
        <Text style={styles.muted}>Für diese Ausgabe liegt noch kein passender Eintrag vor.</Text>)}
      {emptyCollection && <Text style={styles.muted}>Für diese Ausgabe liegen noch keine Daten vor.</Text>}
      {!!error && <ErrorState message={error} />}
      <View style={styles.row}><PremiumButton title={busy ? 'PDF wird erstellt …' : 'PDF ausgeben'} size="sm" onPress={save}
        disabled={locked || busy || emptyCollection || (needsSelection && !options.some(o => o.key === selected))} /></View>
    </View>
  </WoundSection>;
}
