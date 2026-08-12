import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createCareTour, fetchCareTours, updateCareTourStatus } from '@/lib/pflege/careTourPlanningService';

const STATUS: Record<string, string> = {
  draft: 'Entwurf', published: 'Veröffentlicht', in_progress: 'Unterwegs',
  completed: 'Abgeschlossen', cancelled: 'Abgesagt',
};

function parseStops(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [times = '', clientName = '', address = '', serviceSummary = ''] = line.split('|').map((part) => part.trim());
    const [plannedStart = '', plannedEnd = ''] = times.split('-').map((part) => part.trim());
    return { clientName, address, plannedStart, plannedEnd, serviceSummary };
  });
}

export function CareTourPlanningScreen() {
  const { c } = useCareLightPalette();
  const styles = useMemo(() => createStyles(c), [c]);
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [editorOpen, setEditorOpen] = useState(false);
  const [tourDate, setTourDate] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('Frühtour');
  const [employeeName, setEmployeeName] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [stopLines, setStopLines] = useState('07:00-07:30 | Klient:in | Adresse | Grundpflege');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const query = useAsyncQuery(
    () => tenantId ? fetchCareTours(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  async function save() {
    if (!tenantId) return;
    setSaving(true); setFeedback(null);
    const result = await createCareTour(tenantId, profile?.roleKey, {
      tourDate, name, employeeName, vehicleLabel, notes, stops: parseStops(stopLines),
    });
    setSaving(false);
    if (!result.ok) { setFeedback(result.error); return; }
    setEditorOpen(false); setFeedback('Tour wurde als Entwurf angelegt.'); query.refresh();
  }

  async function setStatus(tourId: string, status: 'published' | 'in_progress' | 'completed') {
    if (!tenantId) return;
    const result = await updateCareTourStatus(tenantId, tourId, status, profile?.roleKey);
    setFeedback(result.ok ? 'Tourstatus aktualisiert.' : result.error);
    if (result.ok) query.refresh();
  }

  if (query.loading && !query.data) return <ScreenShell title="Tourenplanung" subtitle="Pflege"><LoadingState message="Pflegetouren werden geladen…" /></ScreenShell>;
  if (query.error && !query.data) return <ScreenShell title="Tourenplanung" subtitle="Pflege"><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;
  const tours = query.data ?? [];

  return (
    <ScreenShell title="Tourenplanung" subtitle="Pflege · Touren, Personal, Fahrzeuge und Stopps" showBack={false}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarCopy}><Text style={styles.eyebrow}>PFLEGE · DISPOSITION</Text><Text style={styles.lead}>Pflegetouren eigenständig planen, veröffentlichen und abschließen.</Text></View>
        <Pressable onPress={query.refresh} style={styles.secondaryButton}><Text style={styles.secondaryText}>↻ Aktualisieren</Text></Pressable>
        <Pressable onPress={() => setEditorOpen((value) => !value)} style={styles.primaryButton}><Text style={styles.primaryText}>{editorOpen ? 'Editor schließen' : '+ Tour anlegen'}</Text></Pressable>
      </View>
      {feedback ? <View style={styles.feedback}><Text style={styles.feedbackText}>{feedback}</Text></View> : null}
      {editorOpen ? <View style={styles.editor}>
        <Text style={styles.sectionTitle}>Neue Pflegetour</Text>
        <View style={styles.fieldGrid}>
          <Field label="Datum" value={tourDate} onChangeText={setTourDate} styles={styles} />
          <Field label="Tourname" value={name} onChangeText={setName} styles={styles} />
          <Field label="Pflegekraft" value={employeeName} onChangeText={setEmployeeName} styles={styles} />
          <Field label="Fahrzeug / Kennzeichen" value={vehicleLabel} onChangeText={setVehicleLabel} styles={styles} />
        </View>
        <Field label="Hinweise" value={notes} onChangeText={setNotes} styles={styles} />
        <Text style={styles.label}>Stopps · eine Zeile je Stopp</Text>
        <Text style={styles.help}>Format: 07:00-07:30 | Klient:in | Adresse | Leistung</Text>
        <TextInput multiline value={stopLines} onChangeText={setStopLines} style={[styles.input, styles.stopInput]} placeholderTextColor={c.muted} />
        <Pressable disabled={saving} onPress={() => void save()} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryText}>{saving ? 'Speichern…' : 'Tour speichern'}</Text></Pressable>
      </View> : null}
      <ScrollView contentContainerStyle={styles.list}>
        {tours.map((tour) => <View key={tour.id} style={styles.tourCard}>
          <View style={styles.tourHeader}><View style={styles.toolbarCopy}><Text style={styles.tourTitle}>{tour.name}</Text><Text style={styles.meta}>{new Date(`${tour.tourDate}T00:00:00`).toLocaleDateString('de-DE')} · {tour.employeeName || 'Pflegekraft offen'} · {tour.vehicleLabel || 'Fahrzeug offen'}</Text></View><Text style={styles.status}>{STATUS[tour.status] ?? tour.status}</Text></View>
          <View style={styles.timeline}>{tour.stops.map((stop) => <View key={stop.id} style={styles.stopRow}><Text style={styles.sequence}>{stop.sequenceNo}</Text><Text style={styles.time}>{stop.plannedStart}–{stop.plannedEnd}</Text><View style={styles.toolbarCopy}><Text style={styles.stopTitle}>{stop.clientName}</Text><Text style={styles.meta}>{stop.address || 'Adresse offen'} · {stop.serviceSummary || 'Leistung offen'}</Text></View></View>)}</View>
          <View style={styles.actions}>{tour.status === 'draft' ? <Action label="Veröffentlichen" onPress={() => void setStatus(tour.id, 'published')} styles={styles} /> : null}{tour.status === 'published' ? <Action label="Tour starten" onPress={() => void setStatus(tour.id, 'in_progress')} styles={styles} /> : null}{tour.status === 'in_progress' ? <Action label="Tour abschließen" onPress={() => void setStatus(tour.id, 'completed')} styles={styles} /> : null}</View>
        </View>)}
        {tours.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Noch keine Pflegetouren</Text><Text style={styles.meta}>Legen Sie die erste Tour mit Pflegekraft, Fahrzeug und Stopps an.</Text></View> : null}
      </ScrollView>
    </ScreenShell>
  );
}

function Field({ label, value, onChangeText, styles }: { label: string; value: string; onChangeText: (value: string) => void; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={styles.input} /></View>;
}
function Action({ label, onPress, styles }: { label: string; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  return <Pressable onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryText}>{label}</Text></Pressable>;
}
function createStyles(c: ReturnType<typeof useCareLightPalette>['c']) { return StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 20, backgroundColor: c.surface }, toolbarCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: '#0878E8', fontSize: 12, fontWeight: '800', letterSpacing: 1 }, lead: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 4 }, primaryButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 13, backgroundColor: '#0878E8', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#FFF', fontWeight: '800' }, secondaryButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: c.text, fontWeight: '800' }, feedback: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#E4F1FF' }, feedbackText: { color: c.text, fontWeight: '700' }, editor: { gap: 12, marginTop: 16, padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 20, backgroundColor: c.surface }, sectionTitle: { color: c.text, fontSize: 20, fontWeight: '900' }, fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, field: { flexGrow: 1, flexBasis: 220, gap: 5 }, label: { color: c.text, fontSize: 13, fontWeight: '800' }, help: { color: c.muted, fontSize: 12 }, input: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: 11, color: c.text, backgroundColor: c.surfaceAlt }, stopInput: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }, disabled: { opacity: 0.55 }, list: { gap: 14, paddingVertical: 18, paddingBottom: 40 }, tourCard: { padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 20, backgroundColor: c.surface }, tourHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' }, tourTitle: { color: c.text, fontSize: 20, fontWeight: '900' }, meta: { color: c.muted, fontSize: 13, marginTop: 3 }, status: { color: '#0878E8', fontSize: 12, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E4F1FF', borderRadius: 999 }, timeline: { marginTop: 14, borderTopWidth: 1, borderTopColor: c.border }, stopRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, sequence: { width: 28, height: 28, lineHeight: 28, textAlign: 'center', borderRadius: 14, overflow: 'hidden', color: '#0878E8', backgroundColor: '#E4F1FF', fontWeight: '900' }, time: { width: 92, color: c.text, fontWeight: '800' }, stopTitle: { color: c.text, fontWeight: '800' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, empty: { padding: 28, borderWidth: 1, borderColor: c.border, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center' }, emptyTitle: { color: c.text, fontSize: 18, fontWeight: '900' },
}); }
