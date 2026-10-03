import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import { createCareTour, fetchCareTourResources, fetchCareTours, updateCareTourStatus, updateCareTourStopStatus } from '@/lib/pflege/careTourPlanningService';
import { berlinCalendarDate, careTourCanComplete, CARE_STOP_STATUS_LABELS, CARE_TOUR_STATUS_LABELS, nextCareStopStatus, nextCareTourStatus, newCareTourRequestId, type CareTourInput, type CareStopStatus } from '@/lib/pflege/careTourWorkflow';
import { formatDate, formatTime } from '@/lib/formatters/dateTimeFormatters';

type StopInput = CareTourInput['stops'][number] & { key: number };
const emptyStop = (key: number): StopInput => ({ key, clientId: '', plannedStart: '', plannedEnd: '', serviceSummary: '' });
const TOUR_ACTION: Record<string, string> = { published: 'Tour freigeben', in_progress: 'Tour starten', completed: 'Tour abschließen' };
const STOP_ACTION: Record<string, string> = { arrived: 'Ankunft bestätigen', in_progress: 'Versorgung starten', completed: 'Dokumentiert abschließen' };

export function CareTourPlanningScreen() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  return <CareTourPlanningWorkspace key={`${tenantId}:${profile?.id}`} />;
}
function CareTourPlanningWorkspace() {
  const { c } = useCareLightPalette();
  const styles = useMemo(() => createStyles(c), [c]);
  const { profile } = useAuth();
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const canManage = hasPermission(profile?.roleKey, 'pflege.plans.manage');
  const [editorOpen, setEditorOpen] = useState(false);
  const [tourDate, setTourDate] = useState(berlinCalendarDate);
  const [filterDate, setFilterDate] = useState(berlinCalendarDate);
  const [search, setSearch] = useState('');
  const [requestId, setRequestId] = useState(newCareTourRequestId);
  const [name, setName] = useState('Frühtour');
  const [employeeId, setEmployeeId] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [notes, setNotes] = useState('');
  const counter = useRef(1);
  const [stops, setStops] = useState<StopInput[]>([emptyStop(0)]);
  const [stopNotes, setStopNotes] = useState<Record<string, string>>({});
  const [historyTour, setHistoryTour] = useState<string | null>(null);
  const [cancelTour, setCancelTour] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const query = useAsyncQuery(
    () => tenantId ? fetchCareTours(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: !!tenantId, queryKey: `${tenantId}:${profile?.id}:tours` },
  );
  const resources = useAsyncQuery(
    () => tenantId ? fetchCareTourResources(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: !!tenantId && canManage && editorOpen, queryKey: `${tenantId}:${profile?.id}:tour-resources` },
  );

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFeedback(null);
    try {
      const result = await action();
      if (!result.ok) { setFeedback({ error: true, message: result.error ?? 'Speichern fehlgeschlagen.' }); return; }
      setFeedback({ error: false, message: success }); after?.(); await query.refresh();
    } catch { setFeedback({ error: true, message: 'Verbindung unterbrochen. Bitte aktualisieren und den Speicherstand prüfen.' }); }
    finally { lock.current = false; setBusy(false); }
  }
  function save() {
    if (!tenantId) return;
    void run(() => createCareTour(tenantId, profile?.roleKey, { requestId, tourDate, name, employeeId, vehicleLabel, notes, stops }),
      'Tour mit verknüpften Pflegefällen als Entwurf gespeichert.', () => { setEditorOpen(false); setFilterDate(tourDate); setStops([emptyStop(counter.current++)]); setNotes(''); setRequestId(newCareTourRequestId()); });
  }
  function changeStop(id: string, status: CareStopStatus, expected: string) {
    if (!tenantId) return;
    void run(() => updateCareTourStopStatus(tenantId, id, status, expected, stopNotes[id] ?? '', profile?.roleKey),
      'Einsatzstatus und Verlauf gespeichert.', () => setStopNotes((value) => { const next = { ...value }; delete next[id]; return next; }));
  }
  function editStop(key: number, patch: Partial<StopInput>) { setStops((value) => value.map((s) => s.key === key ? { ...s, ...patch } : s)); }
  function moveStop(index: number, offset: number) { setStops((value) => { const next = [...value]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; }); }
  if (query.loading && !query.data) return <ScreenShell title="Pflegedienst Ambulant"><LoadingState message="Touren werden geladen…" /></ScreenShell>;
  if (query.error && !query.data) return <ScreenShell title="Pflegedienst Ambulant"><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;
  const tours = query.data ?? [];
  const visible = tours.filter((tour) => (!filterDate || tour.tourDate === filterDate) && `${tour.name} ${tour.employeeName} ${tour.stops.map((s) => s.clientName).join(' ')}`.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
  const todayTours = tours.filter((t) => t.tourDate === berlinCalendarDate() && t.status !== 'cancelled');
  const todayStops = todayTours.flatMap((t) => t.stops);
  return <ScreenShell title="Ambulante Touren" subtitle="Disposition · Versorgung · Durchführungsnachweis" showBack={false}>
    <View style={styles.toolbar}>
      <View style={styles.copy}><Text style={styles.eyebrow}>PFLEGEDIENST AMBULANT</Text><Text style={styles.lead}>Der Pflegetag. Vom ersten Einsatz bis zum Abschluss.</Text></View>
      <Button label="Aktualisieren" onPress={() => void query.refresh()} disabled={busy} styles={styles} />
      {canManage ? <Button primary label={editorOpen ? 'Editor schließen' : '+ Tour planen'} onPress={() => setEditorOpen(!editorOpen)} disabled={busy} styles={styles} /> : null}
    </View>
    <View style={styles.metrics}>
      {[['Touren heute', todayTours.length], ['Einsätze heute', todayStops.length], ['In Versorgung', todayStops.filter((s) => s.status === 'in_progress').length], ['Dokumentiert', todayStops.filter((s) => s.status === 'completed').length]].map(([label, value]) => <View style={styles.metric} key={label}><Text style={styles.metricValue}>{value}</Text><Text style={styles.meta}>{label}</Text></View>)}
    </View>
    {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh} /> : null}
    {feedback ? <View accessibilityRole="alert" style={[styles.feedback, feedback.error && styles.errorFeedback]}><Text style={styles.text}>{feedback.message}</Text></View> : null}
    {editorOpen && canManage ? <View style={styles.card}>
      <Text style={styles.sectionTitle}>Neue Tour</Text>
      {resources.loading ? <LoadingState message="Pflegekräfte und aktive Pflegefälle werden geladen…" /> : resources.error ? <ErrorState message={resources.error} onRetry={resources.refresh} /> : <>
        <View style={styles.fieldGrid}>
          <Field label="Datum (JJJJ-MM-TT)" value={tourDate} onChangeText={setTourDate} disabled={busy} styles={styles} />
          <Field label="Tourname" value={name} onChangeText={setName} disabled={busy} styles={styles} />
          <Field label="Fahrzeug / Kennzeichen" value={vehicleLabel} onChangeText={setVehicleLabel} disabled={busy} styles={styles} />
        </View>
        <Picker label="Pflegekraft" options={(resources.data?.employees ?? []).map((e) => ({ id: e.id, label: e.name, detail: e.qualification }))} value={employeeId} onChange={setEmployeeId} disabled={busy} styles={styles} />
        <Field label="Tourhinweise" value={notes} onChangeText={setNotes} disabled={busy} styles={styles} multiline />
        <Text style={styles.help}>Einsätze in zeitlicher Reihenfolge planen. Fahrzeit und Pausen zwischen den Zeitfenstern berücksichtigen.</Text>
        {stops.map((stop, index) => <View key={stop.key} style={styles.stopEditor}>
          <View style={styles.row}><Text style={styles.stopTitle}>Einsatz {index + 1}</Text><View style={styles.actions}>
            <Button label="Nach oben" disabled={busy || index === 0} onPress={() => moveStop(index, -1)} styles={styles} />
            <Button label="Nach unten" disabled={busy || index === stops.length - 1} onPress={() => moveStop(index, 1)} styles={styles} />
            <Button label="Entfernen" disabled={busy || stops.length === 1} onPress={() => setStops((v) => v.filter((s) => s.key !== stop.key))} styles={styles} />
          </View></View>
          <Picker label="Klient:in" options={(resources.data?.clients ?? []).map((client) => ({ id: client.id, label: client.name, detail: client.address }))} value={stop.clientId} onChange={(clientId) => editStop(stop.key, { clientId })} disabled={busy} styles={styles} />
          <View style={styles.fieldGrid}><Field label="Beginn (HH:MM)" value={stop.plannedStart} onChangeText={(plannedStart) => editStop(stop.key, { plannedStart })} disabled={busy} styles={styles} /><Field label="Ende (HH:MM)" value={stop.plannedEnd} onChangeText={(plannedEnd) => editStop(stop.key, { plannedEnd })} disabled={busy} styles={styles} /></View>
          <Field label="Geplante Leistung" value={stop.serviceSummary} onChangeText={(serviceSummary) => editStop(stop.key, { serviceSummary })} disabled={busy} styles={styles} />
        </View>)}
        <View style={styles.actions}><Button label="+ Einsatz hinzufügen" onPress={() => setStops((v) => [...v, emptyStop(counter.current++)])} disabled={busy} styles={styles} /><Button primary label={busy ? 'Speichern…' : 'Tour als Entwurf speichern'} disabled={busy || !resources.data?.clients.length || !resources.data?.employees.length} onPress={save} styles={styles} /></View>
      </>}
    </View> : null}
    <View style={styles.fieldGrid}><Field label="Tourdatum (leer = alle)" value={filterDate} onChangeText={setFilterDate} styles={styles} /><Field label="Tour, Pflegekraft oder Klient:in suchen" value={search} onChangeText={setSearch} styles={styles} /></View>
    <View style={styles.actions}><Button label="Heute" onPress={() => setFilterDate(berlinCalendarDate())} styles={styles} /><Button label="Alle Tage" onPress={() => setFilterDate('')} styles={styles} /></View>
    {visible.map((tour) => {
      const nextTour = nextCareTourStatus(tour.status);
      const complete = careTourCanComplete(tour.stops);
      return <View key={tour.id} style={styles.card}>
        <View style={styles.row}><View style={styles.copy}><Text style={styles.sectionTitle}>{tour.name}</Text><Text style={styles.meta}>{formatDate(tour.tourDate)} · {tour.employeeName || 'Pflegekraft offen'} · {tour.vehicleLabel || 'Fahrzeug offen'}</Text></View><Text style={styles.status}>{CARE_TOUR_STATUS_LABELS[tour.status as keyof typeof CARE_TOUR_STATUS_LABELS] ?? tour.status}</Text></View>
        {tour.notes ? <Text style={styles.text}>{tour.notes}</Text> : null}
        <Text style={styles.help}>{tour.stops.filter((s) => s.status === 'completed' || s.status === 'cancelled').length} von {tour.stops.length} Einsätzen abgeschlossen</Text>
        {tour.stops.map((stop) => {
          const nextStop = nextCareStopStatus(stop.status);
          const active = canManage && tour.status === 'in_progress' && nextStop;
          return <View key={stop.id} style={styles.stopEditor}>
            <View style={styles.row}><Text style={styles.sequence}>{stop.sequenceNo}</Text><View style={styles.copy}><Text style={styles.stopTitle}>{stop.clientName}</Text><Text style={styles.meta}>{stop.plannedStart}–{stop.plannedEnd} · {stop.address || 'Adresse fehlt'}</Text></View><Text style={styles.status}>{CARE_STOP_STATUS_LABELS[stop.status as keyof typeof CARE_STOP_STATUS_LABELS] ?? stop.status}</Text></View>
            <Text style={styles.text}>{stop.serviceSummary}</Text>
            {stop.actualStartedAt ? <Text style={styles.meta}>Tatsächliche Versorgung: {formatTime(stop.actualStartedAt)}{stop.actualEndedAt ? `–${formatTime(stop.actualEndedAt)}` : ' · läuft'}</Text> : null}
            {stop.notes ? <Text style={styles.text}>{stop.notes}</Text> : null}
            {active ? <>
              <Field label={stop.status === 'in_progress' ? 'Durchführungsnachweis / Besonderheiten' : 'Ausfallgrund (bei Ausfall)'} value={stopNotes[stop.id] ?? ''} onChangeText={(note) => setStopNotes((v) => ({ ...v, [stop.id]: note }))} disabled={busy} styles={styles} multiline />
              <View style={styles.actions}><Button primary label={STOP_ACTION[nextStop]} disabled={busy || (nextStop === 'completed' && !stopNotes[stop.id]?.trim())} onPress={() => changeStop(stop.id, nextStop, stop.status)} styles={styles} /><Button label="Ausfall dokumentieren" disabled={busy || !stopNotes[stop.id]?.trim()} onPress={() => changeStop(stop.id, 'cancelled', stop.status)} styles={styles} /></View>
            </> : null}
            {stop.documentationEntryId && hasPermission(profile?.roleKey, 'pflege.documentation.view') ? <Button label="Pflegedokumentation öffnen" onPress={() => router.push(`/pflege/dokumentation/${stop.documentationEntryId}` as never)} styles={styles} /> : null}
            {stop.status === 'completed' && stop.clientId && hasPermission(profile?.roleKey, 'pflege.proofs.create') ? <Button label={stop.serviceProofId ? "Leistungsnachweis öffnen" : "Leistungsnachweis erfassen"} onPress={() => router.push((stop.serviceProofId ? `/pflege/leistungsnachweis-workflow?id=${stop.serviceProofId}` : `/pflege/leistungsnachweis-new?tourStopId=${stop.id}`) as never)} styles={styles} /> : null}
          </View>;
        })}
        {canManage ? <View style={styles.actions}>
          {nextTour ? <Button primary label={TOUR_ACTION[nextTour]} disabled={busy || (nextTour === 'completed' && !complete)} onPress={() => tenantId && void run(() => updateCareTourStatus(tenantId, tour.id, nextTour, profile?.roleKey, tour.status), 'Tourstatus gespeichert.')} styles={styles} /> : null}
          {['draft', 'published'].includes(tour.status) ? <Button label="Tour absagen" disabled={busy} onPress={() => { setCancelTour(tour.id); setCancelReason(''); }} styles={styles} /> : null}
        </View> : null}
        {tour.status === 'in_progress' && !complete ? <Text style={styles.help}>Tourabschluss erst nach Dokumentation aller Einsätze bzw. begründetem Ausfall.</Text> : null}
        <Button label={historyTour === tour.id ? 'Verlauf schließen' : 'Änderungsverlauf anzeigen'} onPress={() => setHistoryTour(historyTour === tour.id ? null : tour.id)} styles={styles} />
        {historyTour === tour.id ? <View style={styles.stopEditor}>{tour.events.map((event) => <Text key={event.id} style={styles.meta}>{formatDate(event.occurredAt)} · {formatTime(event.occurredAt)}{event.actorName ? ` · ${event.actorName}` : ''} · {event.action === 'created' ? 'Tour angelegt' : event.action === 'proof_created' ? 'Leistungsnachweis erstellt' : event.action.split('→').map((status) => CARE_TOUR_STATUS_LABELS[status as keyof typeof CARE_TOUR_STATUS_LABELS] ?? CARE_STOP_STATUS_LABELS[status as keyof typeof CARE_STOP_STATUS_LABELS] ?? status).join(' → ')}{event.note ? ` · ${event.note}` : ''}</Text>)}{!tour.events.length ? <Text style={styles.meta}>Für diese bestehende Tour ist noch kein neuer Workflow-Verlauf vorhanden.</Text> : null}</View> : null}
        {cancelTour === tour.id ? <View style={styles.stopEditor}><Field label="Absagegrund" value={cancelReason} onChangeText={setCancelReason} disabled={busy} styles={styles} /><View style={styles.actions}><Button label="Zurück" disabled={busy} onPress={() => setCancelTour(null)} styles={styles} /><Button primary label="Absage bestätigen" disabled={busy || !cancelReason.trim()} onPress={() => tenantId && void run(() => updateCareTourStatus(tenantId, tour.id, 'cancelled', profile?.roleKey, tour.status, cancelReason), 'Tour mit Absagegrund gespeichert.', () => setCancelTour(null))} styles={styles} /></View></View> : null}
      </View>;
    })}
    {!visible.length ? <View style={styles.card}><Text style={styles.sectionTitle}>{tours.length ? 'Keine passenden Touren' : 'Die erste Tour wartet auf ihre Planung'}</Text><Text style={styles.meta}>{tours.length ? 'Datum oder Suche ändern.' : 'Aktive Pflegefälle und Pflegekräfte anlegen, anschließend die Einsätze planen.'}</Text></View> : null}
  </ScreenShell>;
}

type Styles = ReturnType<typeof createStyles>;
function Field({ label, value, onChangeText, disabled, multiline, styles }: { label: string; value: string; onChangeText: (v: string) => void; disabled?: boolean; multiline?: boolean; styles: Styles }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}
function Button({ label, onPress, disabled, primary, styles }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; styles: Styles }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, disabled && styles.disabled]}><Text style={primary ? styles.primaryText : styles.buttonText}>{label}</Text></Pressable>;
}
function Picker({ label, options, value, onChange, disabled, styles }: { label: string; options: { id: string; label: string; detail: string }[]; value: string; onChange: (v: string) => void; disabled?: boolean; styles: Styles }) {
  const [search, setSearch] = useState('');
  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) => `${o.label} ${o.detail}`.toLowerCase().includes(search.toLowerCase()));
  return <View style={styles.picker}><Field label={`${label} suchen`} value={search} onChangeText={setSearch} disabled={disabled} styles={styles} />
    {selected ? <Text style={styles.text}>Ausgewählt: {selected.label} · {selected.detail}</Text> : null}
    <View style={styles.actions}>{filtered.slice(0, 8).map((option) => <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`${label}: ${option.label}`} accessibilityState={{ selected: value === option.id, disabled: !!disabled }} disabled={disabled} onPress={() => onChange(option.id)} style={[styles.option, option.id === value && styles.selected]}><Text style={styles.stopTitle}>{option.label}</Text>{option.detail ? <Text style={styles.meta}>{option.detail}</Text> : null}</Pressable>)}</View>
    <Text style={styles.help}>{!options.length ? `Keine aktiven ${label === 'Pflegekraft' ? 'Pflegekräfte mit Pflegezuordnung' : 'Pflegefälle'} vorhanden.` : !filtered.length ? 'Keine Treffer.' : filtered.length > 8 ? `${filtered.length} Treffer. Suche eingrenzen, um weitere Einträge auszuwählen.` : `${filtered.length} Treffer`}</Text>
  </View>;
}
function createStyles(c: ReturnType<typeof useCareLightPalette>['c']) { return StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, borderColor: c.border, borderRadius: 24, backgroundColor: c.surface }, copy: { flex: 1, minWidth: 150 }, eyebrow: { color: '#1684F8', fontSize: 12, fontWeight: '800', letterSpacing: 1 }, lead: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: 6 }, text: { color: c.text, fontSize: 14, lineHeight: 22 }, button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, primary: { backgroundColor: '#0764C8', borderColor: '#0764C8' }, primaryText: { color: '#FFF', fontWeight: '800' }, buttonText: { color: c.text, fontWeight: '700' }, disabled: { opacity: 0.45 }, feedback: { marginVertical: 12, padding: 14, borderRadius: 16, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: '#1684F8' }, errorFeedback: { borderColor: '#F87171' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 16 }, metric: { flexGrow: 1, flexBasis: 130, padding: 16, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, metricValue: { color: c.text, fontSize: 26, fontWeight: '900' }, card: { gap: 14, marginVertical: 10, padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 22, backgroundColor: c.surface }, sectionTitle: { color: c.text, fontSize: 20, fontWeight: '900' }, fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }, field: { flexGrow: 1, flexBasis: 200, minWidth: 0, gap: 6 }, label: { color: c.text, fontSize: 13, fontWeight: '700' }, input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.text, backgroundColor: c.surfaceAlt, fontSize: 16 }, multiline: { minHeight: 80, textAlignVertical: 'top' }, help: { color: c.muted, fontSize: 13, lineHeight: 20 }, meta: { color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 3 }, status: { color: c.text, fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: c.surfaceAlt, borderRadius: 14 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }, stopEditor: { gap: 10, borderWidth: 1, borderColor: c.border, padding: 14, borderRadius: 18, backgroundColor: c.surfaceAlt }, stopTitle: { color: c.text, fontWeight: '800', fontSize: 15 }, sequence: { color: '#1684F8', fontWeight: '900', fontSize: 20, width: 28 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, picker: { gap: 10 }, option: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 14, flexBasis: 210, flexGrow: 1 }, selected: { borderColor: '#1684F8', borderWidth: 2 },
}); }
