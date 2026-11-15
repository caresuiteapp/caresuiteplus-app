import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ErrorState, InfoBanner, LoadingState, PremiumButton } from '@/components/ui';
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
import { WoundSection, WoundTabs } from './WoundWorkspaceLayout';
import { WoundTextInput } from './WoundTextInput';

const TABS = [
  { key: 'overview', label: 'Verlauf', icon: 'activity' },
  { key: 'findings', label: 'Befunde und Versorgung', icon: 'clipboard' },
  { key: 'measurement', label: 'Vermessung und Fotos', icon: 'camera' },
  { key: 'bodymap', label: 'Körperkarte', icon: 'crosshair' },
  { key: 'risk', label: 'Dekubitusprophylaxe', icon: 'shield' },
  { key: 'anamnesis', label: 'Stammdaten', icon: 'user' },
  { key: 'diabetic_foot', label: 'Diabetischer Fuß', icon: 'heart' },
  { key: 'tracheostomy', label: 'Tracheostomie', icon: 'list' },
  { key: 'coordination', label: 'Abstimmung', icon: 'message-square' },
  { key: 'material', label: 'Material', icon: 'package' },
  { key: 'export', label: 'Ausgabe', icon: 'download' },
] as const;
export type WoundRecordTab = typeof TABS[number]['key'];
type Props = {
  scope: WoundRecordScope;
  wound: AmbulatoryWound & { corrections: Record<string, unknown>[] };
  canWrite: boolean; canReadPlans: boolean; canReadTreatment: boolean; canEgk: boolean;
  tab: WoundRecordTab; onChangeTab: (tab: WoundRecordTab) => void;
  actions: (locked: boolean) => ReactNode;
  caseDetails: ReactNode; findings: ReactNode; coordination: ReactNode; photoEvidence: ReactNode;
};

export function WoundRecordWorkspace({ scope, wound, canWrite, canReadPlans, canReadTreatment, canEgk,
  tab, onChangeTab, actions, caseDetails, findings, coordination, photoEvidence }: Props) {
  const router = useRouter(), styles = useWoundRecordStyles();
  const [form, setForm] = useState<FormKind | null>(null);
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
  const defaultFigure: WoundFigure = age !== null && age < 18 ? (woman ? 'girl' : 'boy') :
    age !== null && age >= 65 ? (woman ? 'older-woman' : 'older-man') : woman ? 'adult-woman' : 'adult-man';
  const figure = anchors.at(-1)?.figure ?? defaultFigure;
  const latest = entries.find(entry => entry.kind === 'measurement');
  const latestTrace = object(latest?.payload.trace);
  const mayWrite = active.current && !query.refreshing;
  const locked = write.locked || !mayWrite;
  const navigationLocked = write.locked || form !== null || mark !== null;
  async function save(entry: WoundRecordWrite) {
    if (locked) return;
    setSaved('');
    await write.submit(entry);
  }
  const perKind = (kind: WoundRecordWrite['kind']) => entries.filter(entry => entry.kind === kind);
  const add = (kind: FormKind, label: string) => mayWrite ? <PremiumButton title={label} size="sm" disabled={locked}
    onPress={() => { setForm(kind); setSaved(''); write.setError(null); }} /> : null;

  return <View style={styles.stack}>
      {actions(navigationLocked)}
      <WoundTabs tabs={TABS} value={tab} label="Bereiche der Wundakte" onChange={navigationLocked ? undefined : key => {
        onChangeTab(key); setSaved(''); write.setError(null);
      }} />
      {query.loading && !data && <LoadingState message="Wundakte wird geladen …" />}
      {(query.error || query.refreshError) && <ErrorState message={query.error || query.refreshError || ''} onRetry={query.refresh} />}
      {write.error && <ErrorState message={write.error} />}
      {write.uncertain && <PremiumButton title="Speicherbestätigung erneut prüfen" disabled={write.busy} onPress={write.retry} />}
      {!!saved && <InfoBanner variant="success" message={saved} />}
      {tab === 'overview' && caseDetails}
      <View style={tab === 'findings' ? styles.stack : styles.hidden}>{findings}</View>
      <View style={tab === 'coordination' ? styles.stack : styles.hidden}>{coordination}</View>
      {data && !query.error && !query.refreshError && <>
        {form && <WoundEntryForm key={form} kind={form} scope={scope} birthDate={data.person.date_of_birth} locked={locked}
          onSave={save} onClose={() => setForm(null)} />}
        {tab === 'overview' && <>
          {latestTrace && <View style={styles.row}>
            {([['areaCm2','Fläche', 'cm²'], ['lengthCm','Länge', 'cm'], ['widthCm','Breite','cm']] as const).map(([key,label,unit]) =>
              <View key={key} style={styles.tile}><Text style={styles.muted}>{label}</Text>
                <Text style={styles.value}>{typeof latestTrace[key] === 'number' ? formatWoundNumber(latestTrace[key]) + ' ' + unit : '—'}</Text></View>)}
          </View>}
          <View style={styles.row}>{add('note', 'Wundbeschreibung oder Behandlung ergänzen')}</View>
          <WoundTrends series={series.filter(item => !item.key.includes(':'))} />
          <WoundEntries entries={entries} />
        </>}
        {tab === 'measurement' && <WoundMediaPanel key={mediaEditor} scope={scope} data={data} kind="wound_photo"
          assessments={assessments} canWrite={mayWrite} locked={write.locked} refresh={query.refreshWithResult} onSave={save} />}
        {tab === 'bodymap' && <WoundSection title="3D-Körperkarte">
          {mark && <View style={styles.panel}>
            <Text style={styles.title}>{mark.name}</Text>
            <Text style={styles.text}>{mark.kind}</Text>
            <WoundTextInput scope={scope} label="Beobachtung zur Markierung" value={mark.text} maxLength={1500}
              onChangeText={text => setMark(previous => previous && { ...previous, text })} editable={!locked} multiline />
            <View style={styles.row}>
              <PremiumButton title="Markierung in Wundakte speichern" onPress={() => save({ kind: 'body_mark', observedAt: new Date().toISOString(), payload: mark })} disabled={locked} />
              <PremiumButton title="Verwerfen" variant="secondary" onPress={() => setMark(null)} disabled={write.locked} />
            </View>
          </View>}
          <WoundBodyMapFrame figure={figure} marks={anchors} canWrite={!locked && mark === null} onMark={setMark} />
        </WoundSection>}
        {tab === 'risk' && <WoundSection title="Dekubitusprophylaxe">
          {add('risk', 'Risiko und Prophylaxe erfassen')}
          <WoundTrends series={series.filter(item => /^(braden|norton)(:|$)/.test(item.key))} />
          <WoundEntries entries={perKind('risk')} />
        </WoundSection>}
        {tab === 'anamnesis' && <WoundSection title="Stammdaten und Pflegeanamnese">
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
        </WoundSection>}
        {tab === 'diabetic_foot' && <WoundSection title="Diabetischer Fuß">
          {add('diabetic_foot', 'Fußbefund erfassen')}<WoundEntries entries={perKind('diabetic_foot')} />
        </WoundSection>}
        {tab === 'tracheostomy' && <WoundSection title="Tracheostomie">
          {add('tracheostomy', 'Protokoll erfassen')}<WoundEntries entries={perKind('tracheostomy')} />
        </WoundSection>}
        {tab === 'material' && <WoundSection title="Material und Kosten">
          <WoundCostSummary entries={entries} />
          <View style={styles.row}>
            {add('material', 'Materialvorgang erfassen')}
            <PremiumButton title={catalog ? 'Katalog schließen' : 'Material und Textbausteine verwalten'} size="sm"
              variant="secondary" onPress={() => setCatalog(value => !value)} disabled={write.locked} />
          </View>
          {catalog && <WoundCatalogEditor scope={scope} edit={mayWrite && !write.locked} />}
          <WoundEntries entries={perKind('material')} />
        </WoundSection>}
        {tab === 'export' && <WoundExportPanel wound={wound} entries={entries} media={data.media} scope={scope} canReadPlans={canReadPlans}
          canReadTreatment={canReadTreatment} locked={write.locked || query.refreshing} />}
      </>}
      <View style={tab === 'measurement' ? styles.stack : styles.hidden}>{photoEvidence}</View>
    </View>;
}
