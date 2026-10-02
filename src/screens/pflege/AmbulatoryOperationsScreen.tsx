import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { fetchCareOperations, saveCareAdmission, advanceCareAdmission, createCareTariff, saveCareTask } from '@/lib/pflege/ambulatoryOperationsService';
import { admissionBlockers, admissionLabels, basisLabels, isCalendarDate, parseEuroCents, type CareAdmission, type CareTariff, type FundingBasis } from '@/lib/pflege/ambulatoryOperationsDomain';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { fetchCareTourResources } from '@/lib/pflege/careTourPlanningService';

export type OperationsArea = 'admissions' | 'tariffs' | 'tasks';
const titles: Record<OperationsArea, string> = { admissions: 'Aufnahme & Versorgung', tariffs: 'Leistungen & Vergütung', tasks: 'Aufgaben & Wiedervorlagen' };
const blankAdmission = () => ({ clientId: '', clientName: '', startsOn: berlinCalendarDate(), endsOn: '', basis: 'sgb_xi' as FundingBasis, payerName: '', payerIk: '', contractReference: '', costInformationReference: '', consentReference: '', emergencyContact: '', accessNotes: '', notes: '' });
const blankTariff = () => ({ code: '', label: '', basis: 'sgb_xi' as FundingBasis, unit: 'visit' as CareTariff['unit'], validFrom: berlinCalendarDate(), validUntil: '', payerIk: '', agreementReference: '' });
export function AmbulatoryOperationsScreen({ area = 'admissions' }: { area?: OperationsArea }) {
  const tenant = useServiceTenantId(); const { profile } = useAuth(); const router = useRouter(); const { c } = useCareLightPalette();
  const { clientId: focusedClient } = useLocalSearchParams<{ clientId?: string }>();
  const canManage = hasPermission(profile?.roleKey, area === 'tariffs' ? 'pflege.invoices.manage' : 'pflege.plans.manage');
  const query = useAsyncQuery(() => tenant ? fetchCareOperations(tenant, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenant, profile?.roleKey], { enabled: !!tenant, queryKey: `${tenant}:${profile?.id}:operations` });
  const clients = useAsyncQuery(() => tenant ? fetchEligibleCareClients(tenant, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenant, profile?.roleKey], { enabled: !!tenant });
  const [search, setSearch] = useState(''); const [editor, setEditor] = useState(false); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [admission, setAdmission] = useState(() => ({ ...blankAdmission(), clientId: focusedClient ?? '' })); const [previous, setPrevious] = useState<CareAdmission>();
  const [tariff, setTariff] = useState(blankTariff); const [price, setPrice] = useState('');
  const [task, setTask] = useState({ clientId: focusedClient ?? '', title: '', description: '', dueOn: berlinCalendarDate(), priority: 'normal', assignedEmployeeId: '' });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const staff = useAsyncQuery(() => tenant ? fetchCareTourResources(tenant, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenant, profile?.roleKey, editor, area], { enabled: !!tenant && canManage && editor && area === 'tasks' });
  const clientName = (id: string) => { const value = clients.data?.find((v) => v.id === id); return value ? `${value.lastName}, ${value.firstName}` : 'Pflegefall'; };
  async function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string, close = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setFeedback(null);
    try { const result = await action(); if (!result.ok) { setFeedback({ error: true, text: result.error ?? 'Speichern fehlgeschlagen.' }); return; } setFeedback({ error: false, text: message }); if (close) setEditor(false); await query.refresh(); }
    catch { setFeedback({ error: true, text: 'Verbindung unterbrochen. Bitte aktualisieren und den Speicherstand prüfen.' }); }
    finally { lock.current = false; setBusy(false); }
  }
  function save() {
    if (!tenant) return;
    if (area === 'admissions') {
      if (!admission.clientId || !isCalendarDate(admission.startsOn) || (admission.endsOn && (!isCalendarDate(admission.endsOn) || admission.endsOn < admission.startsOn))) { setFeedback({ error: true, text: 'Pflegefall und gültigen Versorgungszeitraum auswählen.' }); return; }
      void run(() => saveCareAdmission(tenant, profile?.roleKey, admission, previous), 'Aufnahmeentwurf gespeichert. Vor Freigabe die offenen Angaben ergänzen.', true);
    } else if (area === 'tariffs') {
      const cents = parseEuroCents(price);
      if (!cents || !tariff.code.trim() || !tariff.label.trim() || !tariff.agreementReference.trim() || !isCalendarDate(tariff.validFrom) || (tariff.validUntil && (!isCalendarDate(tariff.validUntil) || tariff.validUntil < tariff.validFrom))) { setFeedback({ error: true, text: 'Leistungscode, Bezeichnung, Preis, gültigen Zeitraum und Preisgrundlage vollständig angeben.' }); return; }
      void run(() => createCareTariff(tenant, profile?.roleKey, { ...tariff, unitPriceCents: cents }), 'Tarifversion gespeichert. Bestehende Nachweise behalten ihre Preise.', true);
    } else {
      if (!task.title.trim() || !isCalendarDate(task.dueOn)) { setFeedback({ error: true, text: 'Aufgabe und gültige Fälligkeit angeben.' }); return; }
      void run(() => saveCareTask(tenant, profile?.roleKey, task), 'Aufgabe gespeichert.', true);
    }
  }
  if (query.loading && !query.data) return <ScreenShell title={titles[area]}><LoadingState message="Versorgungsdaten werden geladen…" /></ScreenShell>;
  if (query.error && !query.data) return <ScreenShell title={titles[area]}><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;
  const matches = (value: string) => value.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE'));
  const admissions = (query.data?.admissions ?? []).filter((v) => (!focusedClient || v.clientId === focusedClient) && matches(`${clientName(v.clientId)} ${v.payerName} ${admissionLabels[v.status]}`));
  const tariffs = (query.data?.tariffs ?? []).filter((v) => matches(`${v.code} ${v.label} ${v.payerIk}`));
  const tasks = (query.data?.tasks ?? []).filter((v) => (!focusedClient || v.clientId === focusedClient) && matches(`${v.title} ${clientName(v.clientId)} ${v.description}`)).sort((a, b) => a.status.localeCompare(b.status) || a.dueOn.localeCompare(b.dueOn));
  const textStyle = { color: c.text }; const metaStyle = { color: c.muted };
  return <ScreenShell title={titles[area]} subtitle="Pflegedienst Ambulant · verknüpfte Versorgungsabläufe">
    <View style={styles.stack}>
      <View style={styles.actions}>{(['admissions', 'tariffs', 'tasks'] as const).map((key) => <PremiumButton key={key} title={titles[key]} variant={key === area ? 'primary' : 'secondary'} onPress={() => router.push((key === 'admissions' ? '/pflege/aufnahme' : key === 'tariffs' ? '/pflege/leistungskatalog' : '/pflege/aufgaben') as never)} />)}</View>
      <View style={styles.actions}><PremiumButton title="Aktualisieren" variant="secondary" disabled={busy} onPress={() => void query.refresh()} />{focusedClient ? <PremiumButton title="Alle Pflegefälle anzeigen" variant="secondary" onPress={() => router.replace((area === 'admissions' ? '/pflege/aufnahme' : '/pflege/aufgaben') as never)} /> : null}{canManage ? <PremiumButton title={editor ? 'Formular schließen' : '+ Neu anlegen'} disabled={busy} onPress={() => { setPrevious(undefined); setAdmission({ ...blankAdmission(), clientId: focusedClient ?? '' }); setTariff(blankTariff()); setPrice(''); setEditor(!editor); }} /> : null}</View>
      {feedback ? <View accessibilityRole="alert">{feedback.error ? <ErrorState message={feedback.text} /> : <Text style={textStyle}>{feedback.text}</Text>}</View> : null}
      {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh} /> : null}
      {clients.error ? <ErrorState message={clients.error} onRetry={clients.refresh} /> : null}
      {editor && canManage ? <SectionPanel title={previous ? 'Aufnahme ergänzen' : 'Neuer Datensatz'}>
        {area !== 'tariffs' ? <CareClientPicker options={(clients.data ?? []).map((v) => ({ id: v.id, label: `${v.lastName}, ${v.firstName}` }))} value={area === 'admissions' ? admission.clientId : task.clientId} onChange={(value) => area === 'admissions' ? setAdmission({ ...admission, clientId: value }) : setTask({ ...task, clientId: value })} disabled={busy || !!previous} optional={area === 'tasks'} /> : null}
        {area === 'admissions' ? <>
          <View style={styles.fields}><PremiumInput label="Versorgungsbeginn (JJJJ-MM-TT)" value={admission.startsOn} onChangeText={(startsOn) => setAdmission({ ...admission, startsOn })} /><PremiumInput label="Versorgungsende (optional)" value={admission.endsOn} onChangeText={(endsOn) => setAdmission({ ...admission, endsOn })} /></View>
          <BasisPicker value={admission.basis} onChange={(basis) => setAdmission({ ...admission, basis })} />
          {([['payerName', 'Kostenträger'], ['payerIk', 'Kostenträger-IK (9 Ziffern)'], ['contractReference', 'Pflegevertrag / Dokumentreferenz'], ['costInformationReference', 'Kosteninformation / Dokumentreferenz'], ['consentReference', 'Datenschutzinformation / ggf. Einwilligungsnachweis'], ['emergencyContact', 'Notfallkontakt'], ['accessNotes', 'Zugang zur Wohnung / Schlüsselhinweis'], ['notes', 'Aufnahmehinweise']] as const).map(([key, label]) => <PremiumInput key={key} label={label} value={admission[key]} onChangeText={(value) => setAdmission({ ...admission, [key]: value })} multiline={key === 'notes' || key === 'accessNotes'} />)}
          <Text style={metaStyle}>Referenzen müssen auf tatsächlich vorhandene Dokumente verweisen. Ein Eintrag bestätigt keine rechtliche Prüfung oder geleistete Unterschrift.</Text>
        </> : area === 'tariffs' ? <>
          <PremiumInput label="Leistungscode" value={tariff.code} onChangeText={(code) => setTariff({ ...tariff, code })} /><PremiumInput label="Leistungsbezeichnung" value={tariff.label} onChangeText={(label) => setTariff({ ...tariff, label })} />
          <BasisPicker value={tariff.basis} onChange={(basis) => setTariff({ ...tariff, basis })} />
          <View style={styles.actions}>{([['visit', 'Besuch'], ['minute', 'Minute'], ['hour', 'Stunde'], ['unit', 'Einheit']] as const).map(([unit, label]) => <PremiumButton key={unit} title={label} variant={tariff.unit === unit ? 'primary' : 'secondary'} onPress={() => setTariff({ ...tariff, unit })} />)}</View>
          <PremiumInput label="Preis je Einheit in Euro (z. B. 32,75)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <View style={styles.fields}><PremiumInput label="Gültig ab (JJJJ-MM-TT)" value={tariff.validFrom} onChangeText={(validFrom) => setTariff({ ...tariff, validFrom })} /><PremiumInput label="Gültig bis (optional)" value={tariff.validUntil} onChangeText={(validUntil) => setTariff({ ...tariff, validUntil })} /></View>
          <PremiumInput label="Kostenträger-IK (leer = alle)" value={tariff.payerIk} onChangeText={(payerIk) => setTariff({ ...tariff, payerIk })} /><PremiumInput label="Vergütungsvereinbarung / Preisgrundlage" value={tariff.agreementReference} onChangeText={(agreementReference) => setTariff({ ...tariff, agreementReference })} />
          <Text style={metaStyle}>Tarife werden als unveränderliche Versionen angelegt. Vereinbarte Leistungskomplexe und Preise eures Pflegedienstes hinterlegen.</Text>
        </> : <>
          <PremiumInput label="Aufgabe" value={task.title} onChangeText={(title) => setTask({ ...task, title })} /><PremiumInput label="Beschreibung" value={task.description} onChangeText={(description) => setTask({ ...task, description })} multiline />
          <PremiumInput label="Fällig am (JJJJ-MM-TT)" value={task.dueOn} onChangeText={(dueOn) => setTask({ ...task, dueOn })} />
          {staff.error ? <ErrorState message={staff.error} onRetry={staff.refresh} /> : null}
          <CareClientPicker label="Verantwortliche Pflegekraft" options={(staff.data?.employees ?? []).map((v) => ({ id: v.id, label: v.name }))} value={task.assignedEmployeeId} onChange={(assignedEmployeeId) => setTask({ ...task, assignedEmployeeId })} disabled={busy} optional />
          <View style={styles.actions}>{[['normal', 'Normal'], ['urgent', 'Dringend']].map(([priority, title]) => <PremiumButton key={priority} title={title} variant={task.priority === priority ? 'primary' : 'secondary'} onPress={() => setTask({ ...task, priority })} />)}</View>
        </>}
        <PremiumButton title="Speichern" loading={busy} disabled={busy} onPress={save} />
      </SectionPanel> : null}
      <PremiumInput label="Bestand durchsuchen" value={search} onChangeText={setSearch} />
      {area === 'admissions' ? admissions.map((v) => <SectionPanel key={v.id} title={clientName(v.clientId)} subtitle={`${admissionLabels[v.status]} · ${basisLabels[v.basis]} · ${v.startsOn}${v.endsOn ? ` bis ${v.endsOn}` : ''}`}>
        <Text style={textStyle}>{v.payerName || 'Kostenträger noch offen'}{v.payerIk ? ` · IK ${v.payerIk}` : ''}</Text>
        <Text style={metaStyle}>Vertrag: {v.contractReference || 'fehlt'} · Kosteninformation: {v.costInformationReference || 'fehlt'}</Text>
        {v.emergencyContact ? <Text style={textStyle}>Notfallkontakt: {v.emergencyContact}</Text> : null}{v.accessNotes ? <Text style={textStyle}>Zugang: {v.accessNotes}</Text> : null}
        {v.status === 'draft' ? admissionBlockers(v).map((message) => <Text key={message} style={{ color: c.text }}>{message}</Text>) : null}
        <View style={styles.actions}><PremiumButton title="Klient:innenakte öffnen" variant="secondary" onPress={() => router.push(`/office/clients/${v.clientId}` as never)} />
          {canManage && v.status === 'draft' ? <PremiumButton title="Aufnahme ergänzen" disabled={busy} onPress={() => { setAdmission(v); setPrevious(v); setEditor(true); }} /> : null}
          {canManage && ['draft', 'paused'].includes(v.status) ? <PremiumButton title={v.status === 'draft' ? 'Versorgung freigeben' : 'Versorgung fortsetzen'} disabled={busy || admissionBlockers(v).length > 0} onPress={() => tenant && void run(() => advanceCareAdmission(tenant, profile?.roleKey, v, 'active', ''), 'Versorgung freigegeben.')} /> : null}
        </View>
        {canManage && v.status !== 'closed' ? <><PremiumInput label="Grund für Versorgungspause oder Ende" value={reasons[v.id] ?? ''} onChangeText={(reason) => setReasons({ ...reasons, [v.id]: reason })} /><View style={styles.actions}>{v.status === 'active' ? <PremiumButton title="Versorgung pausieren" variant="secondary" disabled={busy || !reasons[v.id]?.trim()} onPress={() => tenant && void run(() => advanceCareAdmission(tenant, profile?.roleKey, v, 'paused', reasons[v.id]), 'Versorgung mit Begründung pausiert.')} /> : null}<PremiumButton title="Versorgung beenden" variant="secondary" disabled={busy || !reasons[v.id]?.trim()} onPress={() => tenant && void run(() => advanceCareAdmission(tenant, profile?.roleKey, v, 'closed', reasons[v.id]), 'Versorgung mit Begründung beendet.')} /></View></> : null}
      </SectionPanel>) : area === 'tariffs' ? tariffs.map((v) => <SectionPanel key={v.id} title={`${v.code} · ${v.label}`} subtitle={`${basisLabels[v.basis]} · ${(v.unitPriceCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} je ${({ visit: 'Besuch', minute: 'Minute', hour: 'Stunde', unit: 'Einheit' })[v.unit]}`}><Text style={metaStyle}>{v.validFrom}{v.validUntil ? ` bis ${v.validUntil}` : ' · ohne Enddatum'} · {v.payerIk ? `IK ${v.payerIk}` : 'Alle Kostenträger'}</Text><Text style={textStyle}>Preisgrundlage: {v.agreementReference}</Text></SectionPanel>) : tasks.map((v) => <SectionPanel key={v.id} title={v.title} subtitle={`${v.status === 'open' ? 'Offen' : v.status === 'done' ? 'Erledigt' : 'Abgesagt'} · ${v.dueOn}${v.dueOn < berlinCalendarDate() && v.status === 'open' ? ' · Überfällig' : ''}${v.priority === 'urgent' ? ' · Dringend' : ''}`}>
        <Text style={metaStyle}>{v.clientId ? clientName(v.clientId) : 'Betriebsorganisation'}</Text><Text style={textStyle}>{v.description}</Text>{v.resolution ? <Text style={textStyle}>Ergebnis: {v.resolution}</Text> : null}
        {canManage && v.status === 'open' ? <><PremiumInput label="Ergebnis / Ausfallgrund" value={reasons[v.id] ?? ''} onChangeText={(reason) => setReasons({ ...reasons, [v.id]: reason })} /><View style={styles.actions}>{[['done', 'Aufgabe erledigen'], ['cancelled', 'Aufgabe absagen']].map(([status, title]) => <PremiumButton key={status} title={title} disabled={busy || !reasons[v.id]?.trim()} variant={status === 'done' ? 'primary' : 'secondary'} onPress={() => tenant && void run(() => saveCareTask(tenant, profile?.roleKey, { status, resolution: reasons[v.id] }, v), 'Aufgabenstatus und Ergebnis gespeichert.')} />)}</View></> : null}
      </SectionPanel>)}
      {(area === 'admissions' ? admissions : area === 'tariffs' ? tariffs : tasks).length === 0 ? <EmptyState title="Keine passenden Einträge" message="Suche anpassen oder einen neuen Datensatz anlegen." /> : null}
    </View>
  </ScreenShell>;
}
export function CareClientPicker({ options, value, onChange, disabled, optional, label = 'Klient:in' }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void; disabled?: boolean; optional?: boolean; label?: string }) {
  const [search, setSearch] = useState(''); const { c } = useCareLightPalette(); const selected = options.find((v) => v.id === value);
  const filtered = options.filter((v) => v.label.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
  return <View style={styles.stack}><Text style={{ color: c.text }}>{selected ? `Ausgewählt: ${selected.label}` : `${label} auswählen`}</Text><PremiumInput label={`${label} suchen`} value={search} onChangeText={setSearch} editable={!disabled} />
    <View style={styles.actions}>{optional ? <PremiumButton title="Ohne Zuordnung" variant={!value ? 'primary' : 'secondary'} disabled={disabled} onPress={() => onChange('')} /> : null}{filtered.slice(0, 12).map((v) => <PremiumButton key={v.id} title={v.label} variant={v.id === value ? 'primary' : 'secondary'} disabled={disabled} onPress={() => onChange(v.id)} />)}</View>
    {filtered.length > 12 ? <Text style={{ color: c.muted }}>Suche eingrenzen, um weitere Personen auszuwählen.</Text> : null}
  </View>;
}
function BasisPicker({ value, onChange }: { value: FundingBasis; onChange: (v: FundingBasis) => void }) { return <View style={styles.actions}>{(Object.keys(basisLabels) as FundingBasis[]).map((key) => <PremiumButton key={key} title={basisLabels[key]} variant={key === value ? 'primary' : 'secondary'} onPress={() => onChange(key)} />)}</View>; }
const styles = StyleSheet.create({ stack: { gap: 16, paddingBottom: 20 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, fields: { gap: 12 } });
