import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { importEmployeePlan, type PlanImportResult } from '@/lib/calendar/employeePlanImport';
import {
  datesInMonth, dayPlanability, validatePlanningSlots,
  type EmployeeMonthPlan, type PlanningDraft, type PlanningKind, type PlanningSlot,
} from '@/lib/calendar/employeeMonthPlanning';
import { saveEmployeeMonth } from '@/lib/calendar/employeeMonthPlanningService';
import type { CalendarEvent } from '@/types/modules/calendarEvent';

type Props = {
  tenantId: string; employeeId: string; employeeName: string; month: string;
  initial?: EmployeeMonthPlan; events: CalendarEvent[]; onClose: () => void; onSaved: () => void;
};
let nextSlot = 0;
function newId() { return `manual-${Date.now()}-${nextSlot++}`; }
const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
function cleanSlots(rows: PlanningDraft[]): PlanningSlot[] {
  return rows.map(({ id, date, kind, startTime, endTime, label }) => ({ id, date, kind, startTime, endTime, label: label.trim() }));
}

export function EmployeeMonthPlanningModal({ tenantId, employeeId, employeeName, month, initial, events, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<PlanningDraft[]>(() => (initial?.slots ?? []).map((row) => ({ ...row })));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<PlanningKind>('available');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:00');
  const [label, setLabel] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [employer, setEmployer] = useState('');
  const [interpretation, setInterpretation] = useState<'availability' | 'external' | 'mixed'>('availability');
  const [importResult, setImportResult] = useState<PlanImportResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [conflictsReviewed, setConflictsReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dates = useMemo(() => datesInMonth(month), [month]);
  const validation = useMemo(() => [...validatePlanningSlots(rows, month), ...rows.flatMap((r, i) => r.requiresClassification ? [`Zeile ${i + 1}: bitte Verfügbar oder Gesperrt ausdrücklich zuordnen.`] : [])], [rows, month]);
  const dirty = JSON.stringify(cleanSlots(rows)) !== JSON.stringify(initial?.slots ?? []);
  const conflicts = useMemo(() => validation.length ? [] : dates.filter((d) => dayPlanability(d, rows, events).conflict), [dates, rows, events, validation]);
  const busy = importBusy || saving;
  const update = (id: string, patch: Partial<PlanningDraft>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    setConflictsReviewed(false); setReviewed(false);
  };
  const addSelected = () => {
    const additions: PlanningSlot[] = [...selected].sort().map((date) => ({ id: newId(), date, kind, startTime: allDay ? '00:00' : start, endTime: allDay ? '24:00' : end, label }));
    const errors = validatePlanningSlots(additions, month);
    if (errors.length) { setError(errors[0]); return; }
    setRows((current) => [...current, ...additions.filter((s) => !current.some((c) => c.date === s.date && c.kind === s.kind && c.startTime === s.startTime && c.endTime === s.endTime && c.label === s.label))].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
    setConflictsReviewed(false); setError(null);
  };
  const analyze = async () => {
    setImportBusy(true); setError(null);
    try {
      const result = await importEmployeePlan({ tenantId, employeeId, month, employer, interpretation });
      if (result) {
        setImportResult(result); setReviewed(false); setConflictsReviewed(false);
        setRows((current) => [...current, ...result.rows].sort((a, b) => a.date.localeCompare(b.date)));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Import fehlgeschlagen.'); }
    finally { setImportBusy(false); }
  };
  const save = async () => {
    if (busy || validation.length || (importResult && !reviewed) || (conflicts.length && !conflictsReviewed)) return;
    setSaving(true); setError(null);
    try {
      await saveEmployeeMonth(tenantId, employeeId, month, initial?.revision ?? 0, cleanSlots(rows));
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  };
  return (
    <PlatformModal visible title="Verfügbarkeiten & Abwesenheiten" subtitle={`${employeeName} · ${month} · Europe/Berlin`}
      onClose={() => { if (!busy) onClose(); }} isDirty={dirty} maxWidth={1080} dismissOnBackdrop={!busy}
      footerActions={[
        { title: saving ? 'Wird gespeichert…' : 'Monatsplan speichern', onPress: save, disabled: busy || !!validation.length || !!(importResult && !reviewed) || (!!conflicts.length && !conflictsReviewed), loading: saving },
      ]}>
      <View style={styles.body}>
        <Text style={styles.hint}>Verfügbare Zeiten und Planungssperren gelten nur für diese Person und diesen Monat. Nicht gemeldete Tage bleiben offen. Bestehende Urlaubs- und Krankmeldungen werden zusätzlich berücksichtigt.</Text>
        <View style={styles.card}>
          <Text style={styles.heading}>1 · Tage schnell auswählen</Text>
          <View style={styles.line}>
            <PremiumButton size="sm" variant="secondary" title="Alle Tage" disabled={busy} onPress={() => setSelected(new Set(dates))} />
            <PremiumButton size="sm" variant="secondary" title="Mo–Fr" disabled={busy} onPress={() => setSelected(new Set(dates.filter((d) => weekday(d) >= 1 && weekday(d) <= 5)))} />
            <PremiumButton size="sm" variant="ghost" title="Auswahl leeren" disabled={busy} onPress={() => setSelected(new Set())} />
          </View>
          <View style={styles.line}>{[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <PremiumButton key={day} size="sm" variant="ghost" title={`Alle ${weekdays[day]}`} disabled={busy}
              onPress={() => setSelected(new Set(dates.filter((d) => weekday(d) === day)))} />
          ))}</View>
          <View style={styles.days}>{dates.map((date) => (
            <Pressable key={date} disabled={busy} accessibilityRole="checkbox" aria-checked={selected.has(date)} accessibilityState={{ checked: selected.has(date) }} accessibilityLabel={`Tag ${date}`}
              onPress={() => setSelected((previous) => { const next = new Set(previous); if (next.has(date)) next.delete(date); else next.add(date); return next; })}
              style={[styles.day, selected.has(date) && styles.selectedDay]}>
              <Text style={[styles.dayText, selected.has(date) && styles.selectedText]}>{weekdays[weekday(date)]} {date.slice(8)}</Text>
            </Pressable>
          ))}</View>
          <View style={styles.line}>
            <PremiumButton title="Verfügbar" variant={kind === 'available' ? 'primary' : 'secondary'} disabled={busy} onPress={() => setKind('available')} />
            <PremiumButton title="Abwesend / Fremdjob" variant={kind === 'blocked' ? 'primary' : 'secondary'} disabled={busy} onPress={() => setKind('blocked')} />
            <Text style={styles.text}>Ganztägig</Text><Switch accessibilityLabel="Ganztägig für ausgewählte Tage" value={allDay} onValueChange={setAllDay} disabled={busy} />
          </View>
          <View style={styles.line}>
            <TextInput style={styles.time} accessibilityLabel="Beginn für ausgewählte Tage" value={start} onChangeText={setStart} placeholder="08:00" placeholderTextColor="#64748B" editable={!busy && !allDay} maxLength={5} />
            <Text style={styles.text}>bis</Text>
            <TextInput style={styles.time} accessibilityLabel="Ende für ausgewählte Tage" value={end} onChangeText={setEnd} placeholder="17:00" placeholderTextColor="#64748B" editable={!busy && !allDay} maxLength={5} />
            <TextInput style={styles.note} accessibilityLabel="Bezeichnung für ausgewählte Tage" value={label} onChangeText={setLabel} placeholder={kind === 'blocked' ? 'z. B. Fremdjob, Wunschfrei, Abwesend' : 'z. B. Nachmittags verfügbar'} placeholderTextColor="#64748B" editable={!busy} maxLength={160} />
          </View>
          <View style={styles.line}>
            <PremiumButton title={`${selected.size} Tage hinzufügen`} disabled={busy || !selected.size} onPress={addSelected} />
            <PremiumButton title="Einträge dieser Tage entfernen" variant="ghost" disabled={busy || !selected.size} onPress={() => { setRows((current) => current.filter((r) => !selected.has(r.date))); setConflictsReviewed(false); }} />
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>2 · Dienstplan aus PDF oder Foto übernehmen</Text>
          <Text style={styles.hint}>Die Datei wird zur Analyse über den CareSuite-Server an OpenAI übertragen. Das Ergebnis bleibt ein Entwurf. Fehlende Zeiten werden nicht ergänzt.</Text>
          <View style={styles.line}>{([
            ['availability', 'Meine Verfügbarkeiten'], ['external', 'Fremder Dienstplan'], ['mixed', 'Gemischter Plan'],
          ] as const).map(([value, title]) => <PremiumButton key={value} size="sm" title={title} disabled={busy} variant={interpretation === value ? 'primary' : 'secondary'} onPress={() => setInterpretation(value)} />)}</View>
          <TextInput style={styles.note} value={employer} onChangeText={setEmployer} editable={!busy} maxLength={160} accessibilityLabel="Unser Arbeitgebername für die Zuordnung" placeholder="Unser Arbeitgebername bei gemischten Plänen, z. B. AVENTA" placeholderTextColor="#64748B" />
          <PremiumButton title={importBusy ? 'Dienstplan wird analysiert…' : 'PDF / Foto auswählen & analysieren'} loading={importBusy} disabled={busy || (interpretation === 'mixed' && !employer.trim())} onPress={analyze} />
          {importResult ? <View style={styles.importInfo}>
            <Text style={styles.text}>{importResult.filename} · {importResult.rows.length} erkannte Zeitfenster</Text>
            <Text style={styles.text}>Erkannte Person: {importResult.personName || 'nicht angegeben'} · erkannter Monat: {importResult.documentMonth || 'nicht angegeben'}</Text>
            <Text style={styles.hint}>Zielperson: {employeeName}. Bitte Zuordnung und alle Zeilen prüfen. Unklare Zuordnungen müssen vor dem Speichern ausdrücklich festgelegt werden.</Text>
            {importResult.documentMonth && importResult.documentMonth !== month ? <Text style={styles.error}>Der erkannte Monat stimmt nicht mit dem Zielmonat {month} überein.</Text> : null}
            {importResult.warnings.map((warning, i) => <Text key={i} style={styles.warning}>{warning}</Text>)}
            {!importResult.rows.length ? <Text style={styles.warning}>Keine Zeitfenster erkannt. Bitte Angaben manuell erfassen oder ein deutlicheres Bild verwenden.</Text> : null}
          </View> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>3 · Monatsplan prüfen und bearbeiten · {rows.length} Einträge</Text>
          <Text style={styles.hint}>Zeiten in HH:MM. 24:00 bedeutet Tagesende. Nachtdienste auf zwei Tage aufteilen. Mehrere Zeitfenster pro Tag sind möglich. Einträge aus wiederholten Uploads bitte auf Doppelungen prüfen.</Text>
          {rows.length === 0 ? <Text style={styles.text}>Noch keine Angaben für diesen Monat.</Text> : null}
          {rows.map((row, index) => (
            <View key={row.id} style={[styles.row, row.uncertain && styles.uncertain]}>
              <View style={styles.line}>
                <Text style={styles.rowIndex}>{index + 1}</Text>
                <TextInput style={styles.dateInput} accessibilityLabel={`Zeile ${index + 1} Datum`} value={row.date} editable={!busy} onChangeText={(date) => update(row.id, { date })} maxLength={10} />
                {row.requiresClassification ? <>
                  <Text style={styles.warning}>Zuordnung offen:</Text>
                  <PremiumButton size="sm" title="Verfügbar" disabled={busy} onPress={() => update(row.id, { kind: 'available', requiresClassification: false })} />
                  <PremiumButton size="sm" title="Gesperrt" variant="secondary" disabled={busy} onPress={() => update(row.id, { kind: 'blocked', requiresClassification: false })} />
                </> : <PremiumButton size="sm" title={row.kind === 'available' ? 'Verfügbar' : 'Gesperrt'} disabled={busy} variant={row.kind === 'available' ? 'primary' : 'secondary'} onPress={() => update(row.id, { kind: row.kind === 'available' ? 'blocked' : 'available' })} />}
                <TextInput style={styles.time} accessibilityLabel={`Zeile ${index + 1} Beginn`} value={row.startTime} editable={!busy} placeholder="Beginn" placeholderTextColor="#64748B" onChangeText={(startTime) => update(row.id, { startTime })} maxLength={5} />
                <TextInput style={styles.time} accessibilityLabel={`Zeile ${index + 1} Ende`} value={row.endTime} editable={!busy} placeholder="Ende" placeholderTextColor="#64748B" onChangeText={(endTime) => update(row.id, { endTime })} maxLength={5} />
                <PremiumButton size="sm" title="Ganztägig" variant="ghost" disabled={busy} onPress={() => update(row.id, { startTime: '00:00', endTime: '24:00' })} />
                <PremiumButton size="sm" title="Entfernen" variant="ghost" disabled={busy} onPress={() => { setRows((current) => current.filter((r) => r.id !== row.id)); setConflictsReviewed(false); }} />
              </View>
              <TextInput style={styles.note} accessibilityLabel={`Zeile ${index + 1} Bezeichnung`} value={row.label} editable={!busy} onChangeText={(nextLabel) => update(row.id, { label: nextLabel })} maxLength={160} />
              {row.sourceText ? <Text style={styles.hint}>Fundstelle: {row.sourceText}</Text> : null}
              {row.uncertain ? <Text style={styles.warning}>Erkennung unsicher – Datum, Zuordnung und Zeiten ausdrücklich prüfen.</Text> : null}
            </View>
          ))}
          {validation.slice(0, 6).map((message) => <Text key={message} style={styles.error}>{message}</Text>)}
          {validation.length > 6 ? <Text style={styles.error}>Weitere {validation.length - 6} Angaben sind unvollständig.</Text> : null}
          {importResult ? <View style={styles.line}>
            <Switch accessibilityLabel="Import und Personenzuordnung vollständig geprüft" value={reviewed} onValueChange={setReviewed} disabled={busy} />
            <Text style={styles.checkText}>Ich habe Person, Monat, alle erkannten Zeilen und fehlende Angaben geprüft.</Text>
          </View> : null}
          {conflicts.length ? <>
            <Text style={styles.warning}>Planungskonflikte mit bestehenden Terminen: {conflicts.map((d) => d.slice(8)).join(', ')}. {month}. Bestehende Einsätze bleiben bestehen und müssen umgeplant werden.</Text>
            <View style={styles.line}><Switch accessibilityLabel="Planungskonflikte geprüft" value={conflictsReviewed} onValueChange={setConflictsReviewed} disabled={busy} /><Text style={styles.checkText}>Konflikte geprüft; Monatsplan trotzdem speichern.</Text></View>
          </> : null}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </PlatformModal>
  );
}
const styles = StyleSheet.create({
  body: { gap: 16, padding: 12, borderRadius: 18, backgroundColor: '#F8FBFF' }, card: { backgroundColor: '#F3F8FE', padding: 16, borderRadius: 18, gap: 12, borderWidth: 1, borderColor: '#C8DAEE' },
  heading: { color: '#0B2547', fontSize: 18, fontWeight: '800' }, text: { color: '#173859', fontSize: 14 },
  hint: { color: '#4A617B', fontSize: 13, lineHeight: 19 }, line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, day: { padding: 10, minWidth: 66, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#9DB9D8', backgroundColor: '#FFF' },
  selectedDay: { backgroundColor: '#086FDF', borderColor: '#086FDF' }, dayText: { color: '#19395B', textAlign: 'center' }, selectedText: { color: '#FFF', fontWeight: '700' },
  time: { width: 86, minHeight: 42, padding: 10, borderWidth: 1, borderColor: '#99B3D2', borderRadius: 10, backgroundColor: '#FFF', color: '#112D50' },
  dateInput: { width: 126, minHeight: 42, padding: 10, borderWidth: 1, borderColor: '#99B3D2', borderRadius: 10, backgroundColor: '#FFF', color: '#112D50' },
  note: { minWidth: 180, flexGrow: 1, minHeight: 42, padding: 10, borderWidth: 1, borderColor: '#99B3D2', borderRadius: 10, backgroundColor: '#FFF', color: '#112D50' },
  row: { padding: 12, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D0DCEC', gap: 8 },
  rowIndex: { color: '#526C89', minWidth: 18 }, uncertain: { borderColor: '#D5961A', backgroundColor: '#FFFAE9' },
  error: { color: '#AC1635', fontSize: 14 }, warning: { color: '#845209', fontSize: 13, lineHeight: 19 },
  checkText: { color: '#173859', flex: 1, minWidth: 170, fontSize: 14 }, importInfo: { gap: 6 },
});
