import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { WoundBodyMapFrame } from '@/components/clinicalMedia/WoundBodyMapFrame';
import { readBodyMark, type WoundBodyMark, type WoundFigure } from '@/components/clinicalMedia/WoundBodyMapFrame.types';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from '@/hooks/useMedicationSubmission';
import { ageAt, ENTRY_LABELS, formatWoundDate, formatWoundNumber, object } from '@/lib/pflege/woundRecordDomain';
import { readWoundRecord, writeWoundRecord, type WoundRecordScope, type WoundRecordWrite } from '@/lib/pflege/woundRecordService';
import { woundRecordSeries } from '@/lib/pflege/woundRecordReport';
import type { AmbulatoryWound } from '@/lib/pflege/ambulatoryWoundService';
import { WoundCatalogEditor } from './WoundCatalogPanel';
import { WoundEntryForm, type FormKind } from './WoundEntryForm';
import { WoundMediaPanel } from './WoundMediaPanel';
import { WoundCostSummary, WoundEntries, WoundExportPanel, WoundTrends } from './WoundTimeline';
import { useWoundRecordStyles } from './woundRecordStyles';

const TABS = [
  { key: 'overview', label: 'Verlauf' }, { key: 'measurement', label: 'Vermessung und Fotos' },
  { key: 'bodymap', label: 'Körperkarte' }, { key: 'risk', label: 'Dekubitusprophylaxe' },
  { key: 'anamnesis', label: 'Stammdaten' }, { key: 'diabetic_foot', label: 'Diabetischer Fuß' },
  { key: 'tracheostomy', label: 'Tracheostomie' }, { key: 'material', label: 'Material' }, { key: 'export', label: 'Ausgabe' },
] as const;
type Tab = typeof TABS[number]['key'];
type Props = {
  scope: WoundRecordScope;
  wound: AmbulatoryWound & { corrections: Record<string, unknown>[] };
  canWrite: boolean; canReadPlans: boolean; canReadTreatment: boolean; canEgk: boolean;
};

export function WoundRecordWorkspace({ scope, wound, canWrite, canReadPlans, canReadTreatment, canEgk }: Props) {
  const router = useRouter(), styles = useWoundRecordStyles();
  const [tab, setTab] = useState<Tab>('overview'), [form, setForm] = useState<FormKind | null>(null);
  const [saved, setSaved] = useState(''), [mediaEditor, resetMediaEditor] = useState(0);
  const [mark, setMark] = useState<WoundBodyMark | null>(null), [catalog, setCatalog] = useState(false);
  const { tenantId, actorId, role, clientId, woundId } = scope;
  const query = useAsyncQuery(() => readWoundRecord(scope), [tenantId, actorId, role, clientId, woundId],
    { queryKey: [tenantId, actorId, role, clientId, woundId, 'wound-record'].join(':') });
  const active = useRef(false), pendingKind = useRef<WoundRecordWrite['kind'] | null>(null);
  active.current = canWrite && !!query.data && !query.refreshError && !query.error;
  const write = useMedicationSubmission<WoundRecordWrite>(form !== null || mark !== null, async (id, entry) => {
    if (!active.current) return { ok: false, error: 'Der Schreibzugriff für die Wundakte fehlt.' };
    pendingKind.current = entry.kind;
    return writeWoundRecord(scope, id, entry);
  }, async () => {
    if (pendingKind.current === 'measurement') resetMediaEditor(value => value + 1);
    setForm(null); setMark(null); setSaved('Eintrag gespeichert.');
    if (!await query.refreshWithResult()) setSaved('Eintrag gespeichert. Aktualisiere die Wundakte, um ihn zu sehen.');
  });
  const data = query.data;
  const entries = useMemo(() => data?.entries.slice().sort((a,b) => Date.parse(b.observed_at) - Date.parse(a.observed_at)) ?? [], [data?.entries]);
  const series = useMemo(() => woundRecordSeries(entries, wound.assessments), [entries, wound.assessments]);
  const anchors = useMemo(() => entries.flatMap(entry => {
    if (entry.kind !== 'body_mark') return [];
    const point = readBodyMark(entry.payload);
    return point ? [{ ...point, id: entry.id }] : [];
  }), [entries]);
  const assessments = wound.assessments.map(a => ({
    key: String(a.id), label: typeof a.observed_at === 'string' ? formatWoundDate(a.observed_at) :
      typeof a.created_at === 'string' ? 'Erfasst am ' + formatWoundDate(a.created_at) : 'Wundbefund ' + String(a.id).slice(0, 8),
  }));
  const age = ageAt(data?.person.date_of_birth, new Date().toISOString());
  const woman = ['weiblich', 'female'].includes(data?.person.gender ?? '');
  const figure: WoundFigure = age !== null && age < 18 ? (woman ? 'girl' : 'boy') :
    age !== null && age >= 65 ? (woman ? 'older-woman' : 'older-man') : woman ? 'adult-woman' : 'adult-man';
  const latest = entries.find(entry => entry.kind === 'measurement');
  const latestTrace = object(latest?.payload.trace);
  const mayWrite = active.current && !query.refreshing;
  const locked = write.locked || !mayWrite;
  async function save(entry: WoundRecordWrite) {
    if (locked) return;
    setSaved('');
    await write.submit(entry);
  }
  const perKind = (kind: WoundRecordWrite['kind']) => entries.filter(entry => entry.kind === kind);
  const add = (kind: FormKind, label: string) => mayWrite ? <PremiumButton title={label} size="sm" disabled={locked}
    onPress={() => { setForm(kind); setSaved(''); write.setError(null); }} /> : null;

  return <SectionPanel title="Wundakte">
    <View style={styles.stack}>
      <FilterChipGroup wrap options={TABS.map(option => ({ ...option }))} value={tab} onChange={write.locked ? undefined : key => {
        setTab(key as Tab); setSaved(''); write.setError(null);
      }} />
      {query.loading && !data && <LoadingState message="Wundakte wird geladen …" />}
      {(query.error || query.refreshError) && <ErrorState message={query.error || query.refreshError || ''} onRetry={query.refresh} />}
      {write.error && <ErrorState message={write.error} />}
      {write.uncertain && <PremiumButton title="Speicherbestätigung erneut prüfen" disabled={write.busy} onPress={write.retry} />}
      {!!saved && <InfoBanner variant="success" message={saved} />}
      {data && !query.error && !query.refreshError && <>
        {form && <WoundEntryForm key={form} kind={form} scope={scope} birthDate={data.person.date_of_birth} locked={locked}
          onSave={save} onClose={() => setForm(null)} />}
        {tab === 'overview' && <>
          {latestTrace && <View style={styles.row}>
            {([['areaCm2','Fläche', 'cm²'], ['lengthCm','Länge', 'cm'], ['widthCm','Breite','cm']] as const).map(([key,label,unit]) =>
              <View key={key} style={styles.tile}><Text style={styles.muted}>{label}</Text>
                <Text style={styles.value}>{typeof latestTrace[key] === 'number' ? formatWoundNumber(latestTrace[key]) + ' ' + unit : '—'}</Text></View>)}
          </View>}
          {add('note', 'Wundbeschreibung oder Behandlung ergänzen')}
          <WoundTrends series={series.filter(item => !item.key.includes(':'))} />
          <WoundEntries entries={entries} />
        </>}
        {tab === 'measurement' && <WoundMediaPanel key={mediaEditor} scope={scope} data={data} kind="wound_photo"
          assessments={assessments} canWrite={mayWrite} locked={write.locked} refresh={query.refreshWithResult} onSave={save} />}
        {tab === 'bodymap' && <>
          {mark && <View style={styles.panel}>
            <Text style={styles.title}>{mark.name}</Text>
            <Text style={styles.text}>{mark.kind}{mark.text ? ' · ' + mark.text : ''}</Text>
            <View style={styles.row}>
              <PremiumButton title="Markierung in Wundakte speichern" onPress={() => save({ kind: 'body_mark', observedAt: new Date().toISOString(), payload: mark })} disabled={locked} />
              <PremiumButton title="Verwerfen" variant="secondary" onPress={() => setMark(null)} disabled={write.locked} />
            </View>
          </View>}
          <WoundBodyMapFrame figure={figure} marks={anchors} canWrite={!locked && mark === null} onMark={setMark} />
        </>}
        {tab === 'risk' && <>
          {add('risk', 'Risiko und Prophylaxe erfassen')}
          <WoundTrends series={series.filter(item => /^(braden|norton)(:|$)/.test(item.key))} />
          <WoundEntries entries={perKind('risk')} />
        </>}
        {tab === 'anamnesis' && <>
          <View style={styles.row}>
            <View style={styles.tile}><Text style={styles.muted}>Klient:in</Text><Text style={styles.title}>{wound.clientName}</Text></View>
            <View style={styles.tile}><Text style={styles.muted}>Geburtsdatum</Text><Text style={styles.title}>{data.person.date_of_birth?.split('-').reverse().join('.') || '—'}</Text></View>
          </View>
          <View style={styles.row}>
            {add('anamnesis', 'Pflegeanamnese ergänzen')}
            {canEgk && <PremiumButton title="Gesundheitskarte · TI-Einrichtung" size="sm" variant="secondary"
              disabled={write.locked} onPress={() => router.push('/business/ti/egk' as never)} />}
          </View>
          <WoundEntries entries={perKind('anamnesis')} />
          <WoundMediaPanel scope={scope} data={data} kind="patient_photo" assessments={[]} canWrite={mayWrite}
            locked={write.locked} refresh={query.refreshWithResult} onSave={save} />
          <WoundMediaPanel scope={scope} data={data} kind="voice" assessments={[]} canWrite={mayWrite}
            locked={write.locked} refresh={query.refreshWithResult} onSave={save} />
        </>}
        {tab === 'diabetic_foot' && <>{add('diabetic_foot', 'Fußbefund erfassen')}<WoundEntries entries={perKind('diabetic_foot')} /></>}
        {tab === 'tracheostomy' && <>{add('tracheostomy', 'Protokoll erfassen')}<WoundEntries entries={perKind('tracheostomy')} /></>}
        {tab === 'material' && <>
          <WoundCostSummary entries={entries} />
          <View style={styles.row}>
            {add('material', 'Materialvorgang erfassen')}
            <PremiumButton title={catalog ? 'Katalog schließen' : 'Material und Textbausteine verwalten'} size="sm"
              variant="secondary" onPress={() => setCatalog(value => !value)} disabled={write.locked} />
          </View>
          {catalog && <WoundCatalogEditor scope={scope} edit={mayWrite && !write.locked} />}
          <WoundEntries entries={perKind('material')} />
        </>}
        {tab === 'export' && <WoundExportPanel wound={wound} entries={entries} media={data.media} scope={scope} canReadPlans={canReadPlans}
          canReadTreatment={canReadTreatment} locked={write.locked || query.refreshing} />}
      </>}
    </View>
  </SectionPanel>;
}
