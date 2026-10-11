import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CareSuiteImage as Image } from '@/components/images/CareSuiteImage';
import * as DocumentPicker from 'expo-document-picker';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { CareEntitySelect } from '@/components/inputs/CareEntitySelect';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumCard, PremiumInput, SectionPanel } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { PortalTabScreen } from './PortalTabScreen';
import { portalPremium } from '@/design/tokens/portalPremium';
import { careSpacing } from '@/design/tokens/spacing';
import { typography } from '@/theme';
import { TRAVEL_ROUTE_TYPE_LABELS, type TravelRouteType } from '@/types/modules/travelCompensation';
import type { LogbookPoint, LogbookTrip } from '@/types/modules/employeeLogbook';
import { acquireEmployeeLogbookForegroundTracking, addLogbookStop, appendLogbookPoints, berlinDateKey, berlinToday, confirmLogbookDay, createLogbookReceipt, createLogbookTrip, finishEmployeeLogbookRecording, confirmEmployeeLogbookTrip, getCurrentLogbookPoint, loadEmployeeLogbook, requestLogbookLocationPermission, resolveEmployeeLogbookEligibility, saveLogbookProfile, startNativeBackgroundTracking, uploadLogbookFile, type EmployeeGpsWatchHandle } from '@/lib/employeeLogbook';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';
import { fetchEmployeePortalClientRecords } from '@/lib/portal/employeePortalClientRecordsService';
import { parseTripKilometres } from '@/lib/employeeLogbook/visitLogbookState';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getLogbookReceiptValidationError } from '@/lib/employeeLogbook/employeeLogbookRepository.supabase';
import { createEmployeeLogbookTrackingGuard } from '@/lib/employeeLogbook/employeeLogbookAutomation';

type Tab = 'overview' | 'record' | 'trips' | 'receipts' | 'profile';
const routes = Object.keys(TRAVEL_ROUTE_TYPE_LABELS).filter((key) => key !== 'private_non_business') as TravelRouteType[];
const today = berlinToday;

export function EmployeeLogbookScreen() {
  const actor = usePortalActor(); const [tab, setTab] = useState<Tab>('overview');
  const [feedback, setFeedback] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const query = useAsyncQuery(useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) throw new Error('Mitarbeitendenkonto ist nicht vollständig verknüpft.');
    try {
      return { ok: true as const, data: await loadEmployeeLogbook(actor.tenantId, actor.employeeId) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'Fahrtenbuch konnte nicht geladen werden.' };
    }
  }, [actor.tenantId, actor.employeeId]), [actor.tenantId, actor.employeeId], { enabled: !!actor.tenantId && !!actor.employeeId, queryKey: `logbook:${actor.tenantId}:${actor.employeeId}` });
  const linkOptionsQuery = useAsyncQuery(useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) return { ok: false as const, error: 'Mitarbeitendenkonto ist nicht vollständig verknüpft.' };
    const [assignments, clients] = await Promise.all([
      fetchLivePortalAppointmentsForEmployee(actor.tenantId, actor.employeeId),
      fetchEmployeePortalClientRecords(actor.tenantId, actor.employeeId),
    ]);
    if (!assignments.ok) return assignments;
    if (!clients.ok) return clients;
    return { ok: true as const, data: { assignments: assignments.data, clients: clients.data } };
  }, [actor.tenantId, actor.employeeId]), [actor.tenantId, actor.employeeId], { enabled: !!actor.tenantId && !!actor.employeeId, queryKey: `logbook-links:${actor.tenantId}:${actor.employeeId}` });
  const eligibilityQuery = useAsyncQuery(useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) throw new Error('Mitarbeitendenkonto ist nicht vollständig verknüpft.');
    return { ok: true as const, data: await resolveEmployeeLogbookEligibility(actor.tenantId, actor.employeeId) };
  }, [actor.tenantId, actor.employeeId]), [actor.tenantId, actor.employeeId], { enabled: !!actor.tenantId && !!actor.employeeId, queryKey: `logbook-eligibility:${actor.tenantId}:${actor.employeeId}` });

  const active = query.data?.trips.find((trip) => trip.status === 'recording') ?? null;
  const staleActive = active && berlinDateKey(active.startedAt) < berlinToday();
  const [routeType, setRouteType] = useState<TravelRouteType>('home_to_client'); const [purpose, setPurpose] = useState('Anfahrt zum Einsatz');
  const [linkMode, setLinkMode] = useState<'assignment' | 'client' | 'none'>('assignment');
  const [assignmentId, setAssignmentId] = useState(''); const [clientId, setClientId] = useState(''); const [manualReason, setManualReason] = useState(''); const [startAddress, setStartAddress] = useState(''); const [endAddress, setEndAddress] = useState(''); const [notes, setNotes] = useState('');
  const [points, setPoints] = useState<LogbookPoint[]>([]); const [watcher, setWatcher] = useState<EmployeeGpsWatchHandle | null>(null);
  const finishingTripIdRef = useRef<string | null>(null);
  const startLock = useRef(false);
  const screenMounted = useRef(true);
  const screenScope = `${actor.tenantId ?? ''}:${actor.employeeId ?? ''}:${actor.isReady}`;
  const screenScopeRef = useRef(screenScope); screenScopeRef.current = screenScope;
  useEffect(() => { screenMounted.current = true; return () => { screenMounted.current = false; }; }, []);
  const selectedVehicle = query.data?.vehicles.find(
    (vehicle) => vehicle.id === query.data?.profile.defaultVehicleId && vehicle.active,
  )?.id ?? query.data?.vehicles.find((vehicle) => vehicle.active)?.id ?? null;

  useEffect(() => () => watcher?.remove(), [watcher]);
  useEffect(() => {
    if (!active || berlinDateKey(active.startedAt) < berlinToday() || watcher || finishingTripIdRef.current === active.id || !actor.tenantId || !actor.employeeId) return;
    let cancelled = false;
    const scopeIsActive = createEmployeeLogbookTrackingGuard(actor.tenantId, actor.employeeId, { shouldContinue: () => screenMounted.current && screenScopeRef.current === screenScope });
    const shouldContinue = () => !cancelled && scopeIsActive();
    void (async () => {
      if (!shouldContinue()) return;
      const started = await startNativeBackgroundTracking({ tripId: active.id, tenantId: actor.tenantId!, employeeId: actor.employeeId! }, { shouldContinue });
      if (started === false || !shouldContinue()) return;
      const subscription = acquireEmployeeLogbookForegroundTracking({ tripId: active.id, tenantId: actor.tenantId!, employeeId: actor.employeeId!, shouldContinue: scopeIsActive, onError: error => setFeedback(`GPS-Punkt konnte nicht sicher gespeichert werden: ${error.message}`), onPoint: (point) => {
        setPoints((current) => [...current.slice(-20), point]);
      }});
      if (cancelled) subscription.remove();
      else setWatcher(subscription);
    })().catch((error) => setFeedback(error instanceof Error ? error.message : 'Die laufende GPS-Fahrt konnte nicht wieder aufgenommen werden.'));
    return () => { cancelled = true; };
  }, [active, watcher, actor.tenantId, actor.employeeId]);
  async function begin() {
    if (!actor.tenantId || !actor.employeeId || startLock.current || finishingTripIdRef.current) return;
    if (linkMode === 'assignment' && !assignmentId) { setFeedback('Bitte einen Einsatz auswählen.'); return; }
    if (linkMode === 'client' && !clientId) { setFeedback('Bitte eine Klientin oder einen Klienten auswählen.'); return; }
    if (linkMode === 'none' && manualReason.trim().length < 3) { setFeedback('Ohne Einsatz oder Klient:in ist eine Begründung erforderlich.'); return; }
    startLock.current = true; setBusy(true); setFeedback(null);
    const shouldContinue = createEmployeeLogbookTrackingGuard(actor.tenantId, actor.employeeId, { shouldContinue: () => screenMounted.current && screenScopeRef.current === screenScope });
    try {
      await requestLogbookLocationPermission(shouldContinue); if (!shouldContinue()) return;
      const first = await getCurrentLogbookPoint(); if (!shouldContinue()) return;
      const trip = await createLogbookTrip({ tenantId: actor.tenantId, employeeId: actor.employeeId, vehicleId: selectedVehicle, routeType, purpose, assignmentId: linkMode === 'assignment' ? resolveVisitMasterId(assignmentId) : null, clientId: linkMode === 'none' ? null : clientId || null, manualReason: linkMode === 'none' ? manualReason.trim() : null, startAddress });
      if (!shouldContinue()) return;
      setPoints([first]); await appendLogbookPoints(trip.id, actor.tenantId, actor.employeeId, [first]);
      if (!shouldContinue()) return;
      const started = await startNativeBackgroundTracking({ tripId: trip.id, tenantId: actor.tenantId, employeeId: actor.employeeId }, { shouldContinue });
      if (started === false || !shouldContinue()) return;
      const subscription = acquireEmployeeLogbookForegroundTracking({ tripId: trip.id, tenantId: actor.tenantId, employeeId: actor.employeeId, shouldContinue, onError: error => setFeedback(`GPS-Punkt konnte nicht sicher gespeichert werden: ${error.message}`), onPoint: (point) => {
        setPoints((current) => [...current.slice(-20), point]);
      }});
      setWatcher(subscription); await query.refresh(); setFeedback(Platform.OS === 'web'
        ? 'Fahrt gestartet. Für GPS-Punkte den Browser geöffnet lassen und Standort freigeben.'
        : 'Fahrt gestartet. GPS-Hintergrunddienst wurde angefordert; Standortberechtigung und Gerät prüfen.');
    } catch (error) {
      if (!shouldContinue()) return;
      await query.refresh();
      setFeedback(error instanceof Error ? error.message : 'Fahrt konnte nicht gestartet werden.');
    } finally { startLock.current = false; setBusy(false); }
  }
  async function finish() {
    if (!active || !actor.tenantId || !actor.employeeId || finishingTripIdRef.current) return;
    finishingTripIdRef.current = active.id;
    setBusy(true); setFeedback(null);
    try {
      watcher?.remove(); setWatcher(null);
      const saved = await finishEmployeeLogbookRecording({ trip: active, tenantId: actor.tenantId, employeeId: actor.employeeId, endAddress, notes });
      setPoints([]); setEndAddress(''); setNotes(''); await query.refresh();
      setFeedback(saved.status === 'review_required' ? 'Alte Fahrt zur Verwaltungsprüfung beendet. Zeiten und Kilometer bleiben bis zur Prüfung gesperrt.' : 'Fahrt gestoppt. Bitte jetzt die Kilometer prüfen und bestätigen.');
    } catch (error) { await query.refresh(); setFeedback(error instanceof Error ? error.message : 'Fahrt konnte nicht abgeschlossen werden.'); } finally { finishingTripIdRef.current = null; setBusy(false); }
  }
  async function openMaps() {
    const origin = encodeURIComponent(startAddress || `${points[0]?.latitude ?? ''},${points[0]?.longitude ?? ''}`); const destination = encodeURIComponent(endAddress);
    if (!endAddress.trim()) { setFeedback('Bitte zuerst eine Zieladresse eintragen.'); return; }
    try {
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`);
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Die Navigation konnte nicht geöffnet werden. Bitte erneut versuchen.'); }
  }

  if (!actor.isReady || query.loading && !query.data || eligibilityQuery.loading && !eligibilityQuery.data) return <PortalTabScreen title="Fahrtenbuch"><LoadingState message="Fahrtenbuch wird sicher geladen…" /></PortalTabScreen>;
  if (query.error && !query.data) return <PortalTabScreen title="Fahrtenbuch"><ErrorState title="Fahrtenbuch nicht verfügbar" message={query.error} onRetry={() => void query.refresh()} /></PortalTabScreen>;
  if (eligibilityQuery.error && !eligibilityQuery.data) return <PortalTabScreen title="Fahrtenbuch"><ErrorState title="Fahrtenbuchfreigabe nicht verfügbar" message={eligibilityQuery.error} onRetry={() => void eligibilityQuery.refresh()} /></PortalTabScreen>;
  if (eligibilityQuery.data && !eligibilityQuery.data.eligible && !active && !query.data?.trips.some((trip) => trip.status === 'confirmation_required')) {
    return <PortalTabScreen title="Fahrtenbuch" subtitle="Eigenständiges Mobilitätsmodul">
      <InfoBanner
        variant="info"
        message={eligibilityQuery.data.reason === 'no_car_mode'
          ? 'Für dieses Mitarbeitendenkonto ist kein PKW als Verkehrsmittel hinterlegt. Das digitale PKW-Fahrtenbuch wird daher nicht angezeigt.'
          : 'Für dieses Mitarbeitendenkonto ist kein aktiver PKW zugeordnet. Das digitale PKW-Fahrtenbuch wird daher nicht angezeigt.'}
      />
    </PortalTabScreen>;
  }
  const bundle = query.data!;
  return <PortalTabScreen title="Fahrtenbuch" subtitle="GPS-Fahrten, Kilometervergütung, Belege und Tagesbestätigung" scroll>
    <View style={styles.page} testID="employee-logbook-screen">
      <PremiumCard variant="elevated" contentStyle={styles.hero}>
        <View style={styles.heroCopy}><Text style={styles.eyebrow}>DIGITALES FAHRTENBUCH</Text><Text style={styles.heroTitle}>{staleActive ? 'Alte Fahrt benötigt Prüfung' : active ? 'Fahrt wird aufgezeichnet' : 'Bereit für die nächste Fahrt'}</Text><Text style={styles.heroText}>{active ? `${TRAVEL_ROUTE_TYPE_LABELS[active.routeType]} · gestartet ${new Date(active.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Automatische GPS-Kilometer, klare Fahrzeittrennung und direkte Gehaltsstatistik.'}</Text></View>
        <PremiumBadge label={staleActive ? 'PRÜFUNG OFFEN' : active ? 'FAHRT OFFEN' : 'BEREIT'} variant={active ? 'green' : 'cyan'} />
      </PremiumCard>
      <InfoBanner variant="warning" message="Während der Fahrt: Gerät eingeschaltet lassen. Im Browser/PWA CareSuite nicht schließen und den Bildschirm nicht sperren. Standort und mobile Daten müssen aktiv sein. In der Android-App läuft die Aufzeichnung mit sichtbarer Dauerbenachrichtigung im Hintergrund weiter." />
      {query.refreshError || eligibilityQuery.refreshError ? <InfoBanner variant="warning" message={query.refreshError ?? eligibilityQuery.refreshError!} /> : null}
      {feedback ? <InfoBanner variant={feedback.includes('nicht') || feedback.includes('Bitte') ? 'warning' : 'info'} message={feedback} /> : null}
      {active && berlinDateKey(active.startedAt) < berlinToday() ? <SectionPanel title="Alte Fahrt noch offen" subtitle={`Beginn ${new Date(active.startedAt).toLocaleString('de-DE')}`}><InfoBanner presentation="inline" variant="warning" message="Diese Aufzeichnung wird nicht weitergeführt. Beende sie zur Verwaltungsprüfung, damit der aktuelle Einsatz fortgesetzt werden kann. Die ursprünglichen GPS-Punkte bleiben erhalten." /><PremiumButton title="Alte Fahrt zur Prüfung abschließen" fullWidth loading={busy} disabled={busy} onPress={() => void finish()} /></SectionPanel> : null}
      {bundle.trips.filter((trip) => trip.status === 'confirmation_required').map((trip) => <TripConfirmationPanel key={trip.id} trip={trip} refresh={query.refresh} setFeedback={setFeedback} />)}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {([['overview','Übersicht'],['record','Aufzeichnen'],['trips','Meine Fahrten'],['receipts','Belege'],['profile','Führerschein']] as [Tab,string][]).map(([key,label]) => <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>
      {tab === 'overview' ? <LogbookOverviewPanel bundle={bundle} active={active} setTab={setTab} /> : null}
      {tab === 'record' ? <RecordPanel active={active} tenantId={actor.tenantId} employeeId={actor.employeeId} routeType={routeType} setRouteType={setRouteType} purpose={purpose} setPurpose={setPurpose} linkMode={linkMode} setLinkMode={setLinkMode} assignmentId={assignmentId} setAssignmentId={setAssignmentId} clientId={clientId} setClientId={setClientId} linkOptions={linkOptionsQuery.data} linkOptionsLoading={linkOptionsQuery.loading} linkOptionsError={linkOptionsQuery.error} manualReason={manualReason} setManualReason={setManualReason} startAddress={startAddress} setStartAddress={setStartAddress} endAddress={endAddress} setEndAddress={setEndAddress} notes={notes} setNotes={setNotes} busy={busy} begin={begin} finish={finish} openMaps={openMaps} setFeedback={setFeedback} /> : null}
      {tab === 'trips' ? <TripsPanel employeeName={actor.displayName} trips={bundle.trips} confirmations={bundle.confirmations.map((c) => c.workDate)} tenantId={actor.tenantId!} employeeId={actor.employeeId!} refresh={query.refresh} setFeedback={setFeedback} /> : null}
      {tab === 'receipts' ? <ReceiptsPanel tenantId={actor.tenantId!} employeeId={actor.employeeId!} trips={bundle.trips} setFeedback={setFeedback} /> : null}
      {tab === 'profile' ? <ProfilePanel tenantId={actor.tenantId!} employeeId={actor.employeeId!} profile={bundle.profile} refresh={query.refreshWithResult} setFeedback={setFeedback} /> : null}
    </View>
  </PortalTabScreen>;
}

function LogbookOverviewPanel({ bundle, active, setTab }: { bundle: import('@/types/modules/employeeLogbook').EmployeeLogbookBundle; active: LogbookTrip | null; setTab: (tab: Tab) => void }) {
  const currentMonth = today().slice(0, 7);
  const monthTrips = bundle.trips.filter((trip) => trip.status !== 'cancelled' && berlinDateKey(trip.startedAt).startsWith(currentMonth));
  const distanceKm = monthTrips.reduce((sum, trip) => sum + trip.distanceFinalKm, 0);
  const mileageCents = monthTrips.reduce((sum, trip) => sum + trip.mileageAmountCents, 0);
  const completedDates = new Set(monthTrips.filter((trip) => trip.status !== 'recording').map((trip) => berlinDateKey(trip.startedAt)));
  const confirmedDates = new Set(bundle.confirmations.map((item) => item.workDate));
  const unsignedDays = [...completedDates].filter((date) => !confirmedDates.has(date)).length;

  return <View style={styles.stack} testID="employee-logbook-overview">
    <SectionPanel title="Monatsübersicht" subtitle="Fahrten, Kilometer, Vergütung und offene Tagesabschlüsse auf einen Blick">
      <View style={styles.summaryGrid}>
        <PremiumCard contentStyle={styles.summaryCard}><Text style={styles.summaryValue}>{monthTrips.length}</Text><Text style={styles.muted}>Fahrten im Monat</Text></PremiumCard>
        <PremiumCard contentStyle={styles.summaryCard}><Text style={styles.summaryValue}>{distanceKm.toFixed(1).replace('.', ',')} km</Text><Text style={styles.muted}>dienstliche Kilometer</Text></PremiumCard>
        <PremiumCard contentStyle={styles.summaryCard}><Text style={styles.summaryValue}>{(mileageCents / 100).toFixed(2).replace('.', ',')} €</Text><Text style={styles.muted}>Kilometervergütung</Text></PremiumCard>
        <PremiumCard contentStyle={styles.summaryCard}><Text style={styles.summaryValue}>{unsignedDays}</Text><Text style={styles.muted}>Tagesabschlüsse offen</Text></PremiumCard>
      </View>
    </SectionPanel>
    <SectionPanel title={active ? 'Laufende Aufzeichnung' : 'Schnellzugriff'} subtitle={active ? `${TRAVEL_ROUTE_TYPE_LABELS[active.routeType]} · ${active.purpose}` : 'Alle Fahrtenbuchfunktionen zentral an einem Ort'}>
      <View style={styles.actions}>
        <PremiumButton title={active ? 'Laufende Fahrt öffnen' : 'Neue Fahrt aufzeichnen'} onPress={() => setTab('record')} />
        <PremiumButton title="Fahrten und Tagesabschluss" variant="secondary" onPress={() => setTab('trips')} />
        <PremiumButton title="Beleg hochladen" variant="secondary" onPress={() => setTab('receipts')} />
        <PremiumButton title="Führerschein verwalten" variant="secondary" onPress={() => setTab('profile')} />
      </View>
    </SectionPanel>
    <InfoBanner variant="info" message="Das Fahrtenbuch ist ein eigenständiges Modul. Einsatzbezogene Automatiken verknüpfen Fahrten hierher; Verwaltung, Belege und Bestätigung erfolgen zentral auf dieser Seite." />
  </View>;
}

function RecordPanel(p: any) {
  const [stopKind, setStopKind] = useState<'client' | 'doctor' | 'pharmacy' | 'shopping' | 'other'>('client');
  const [stopLabel, setStopLabel] = useState('');
  const [savingStop, setSavingStop] = useState(false);
  const stopLock = useRef(false);
  const assignmentOptions = [
    ...(p.linkOptions?.assignments ?? []).map((item: any) => ({
      value: item.id,
      label: `${new Date(item.startsAt).toLocaleDateString('de-DE')} · ${item.clientName || item.title}`,
      description: `${new Date(item.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · ${item.title}${item.location ? ` · ${item.location}` : ''}`,
    })),
  ];
  const clientOptions = (p.linkOptions?.clients ?? []).map((item: any) => ({
    value: item.clientId,
    label: item.displayName,
    description: [item.street, item.zip, item.city].filter(Boolean).join(', ') || 'Klient:innenakte',
  }));

  function selectAssignment(value: string) {
    p.setAssignmentId(value);
    const assignment = (p.linkOptions?.assignments ?? []).find((item: any) => item.id === value);
    p.setClientId(assignment?.clientId ?? '');
    if (assignment?.clientName) p.setPurpose(`Fahrt zu ${assignment.clientName}`);
  }

  function selectClient(value: string) {
    p.setClientId(value);
    p.setAssignmentId('');
    const client = (p.linkOptions?.clients ?? []).find((item: any) => item.clientId === value);
    if (client?.displayName) p.setPurpose(`Fahrt zu ${client.displayName}`);
  }

  async function addStop() {
    if (!p.active || p.busy || stopLock.current) return;
    stopLock.current = true; setSavingStop(true);
    try {
      await addLogbookStop({ tenantId: p.tenantId, employeeId: p.employeeId, tripId: p.active.id, assignmentId: p.active.assignmentId, clientId: p.active.clientId, stopKind, label: stopLabel, address: p.endAddress });
      setStopLabel('');
      p.setFeedback('Zwischenstopp mit genauer Uhrzeit gespeichert.');
    } catch (error) {
      p.setFeedback(error instanceof Error ? error.message : 'Stopp konnte nicht gespeichert werden.');
    } finally { stopLock.current = false; setSavingStop(false); }
  }

  return <SectionPanel title={p.active ? 'Laufende Fahrt' : 'Fahrt starten'} subtitle="Einsatz oder Klient:in auswählen – nur ohne Zuordnung ist eine Begründung erforderlich">
    {!p.active ? <View style={styles.form}>
      <Text style={styles.label}>Fahrtart</Text>
      <ScrollView horizontal contentContainerStyle={styles.chips}>{routes.map((key) => <Pressable key={key} onPress={() => p.setRouteType(key)} style={[styles.chip, p.routeType === key && styles.chipActive]}><Text style={[styles.chipText, p.routeType === key && styles.chipTextActive]}>{TRAVEL_ROUTE_TYPE_LABELS[key]}</Text></Pressable>)}</ScrollView>
      <PremiumInput label="Zweck" value={p.purpose} onChangeText={p.setPurpose} />
      <Text style={styles.label}>Zuordnung</Text>
      <View style={styles.chips}>
        {([['assignment', 'Geplanter Einsatz'], ['client', 'Klient:in'], ['none', 'Ohne Zuordnung']] as const).map(([key, label]) => <Pressable key={key} onPress={() => { p.setLinkMode(key); if (key === 'none') { p.setAssignmentId(''); p.setClientId(''); } }} style={[styles.chip, p.linkMode === key && styles.chipActive]}><Text style={[styles.chipText, p.linkMode === key && styles.chipTextActive]}>{label}</Text></Pressable>)}
      </View>
      {p.linkOptionsError ? <InfoBanner variant="warning" message={p.linkOptionsError} /> : null}
      {p.linkMode === 'assignment' ? <CareEntitySelect label="Einsatz auswählen" value={p.assignmentId} options={assignmentOptions} onChange={selectAssignment} required loading={p.linkOptionsLoading} searchPlaceholder="Datum, Klient:in oder Einsatz suchen…" emptyMessage="Keine zugeordneten Einsätze vorhanden." /> : null}
      {p.linkMode === 'client' ? <CareEntitySelect label="Klient:in auswählen" value={p.clientId} options={clientOptions} onChange={selectClient} required loading={p.linkOptionsLoading} searchPlaceholder="Klient:in suchen…" emptyMessage="Keine auswählbaren Klient:innen vorhanden." /> : null}
      {p.linkMode === 'none' ? <PremiumInput label="Begründung ohne Einsatz oder Klient:in *" value={p.manualReason} onChangeText={p.setManualReason} /> : null}
      <PremiumInput label="Startadresse (optional, GPS wird erfasst)" value={p.startAddress} onChangeText={p.setStartAddress} />
      <PremiumButton title="GPS-Fahrt verbindlich starten" size="lg" loading={p.busy} disabled={p.busy} onPress={() => void p.begin()} />
    </View> : <View style={styles.form}>
      <Text style={styles.label}>Zwischenstopp erfassen</Text>
      <View style={styles.chips}>{([['client', 'Klient:in'], ['doctor', 'Arzt'], ['pharmacy', 'Apotheke'], ['shopping', 'Einkauf'], ['other', 'Sonstiges']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setStopKind(key)} style={[styles.chip, stopKind === key && styles.chipActive]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
      <View style={styles.cols}><PremiumInput label="Name / Zweck des Stopps" value={stopLabel} onChangeText={setStopLabel} style={styles.grow} /><PremiumButton title="Stopp jetzt speichern" variant="secondary" loading={savingStop} disabled={savingStop || p.busy} onPress={() => void addStop()} /></View>
      <PremiumInput label="Zieladresse" value={p.endAddress} onChangeText={p.setEndAddress} />
      <PremiumInput label="Notiz" value={p.notes} onChangeText={p.setNotes} multiline />
      <View style={styles.actions}><PremiumButton title="Navigation in Google Maps öffnen" variant="secondary" onPress={() => void p.openMaps()} /><PremiumButton title="Fahrt abschließen" size="lg" loading={p.busy} disabled={p.busy || savingStop} onPress={() => void p.finish()} /></View>
      <Text style={styles.privacy}>Google Maps erhält die von Ihnen gewählte Start-/Zielangabe nur beim Öffnen. CareSuite führt parallel die eigene Fahrtenaufzeichnung.</Text>
    </View>}
  </SectionPanel>;
}

function TripConfirmationPanel({ trip, refresh, setFeedback }: { trip: LogbookTrip; refresh: () => Promise<unknown>; setFeedback: (message: string | null) => void }) {
  const [kilometres, setKilometres] = useState(() => trip.distanceFinalKm.toFixed(2).replace('.', ','));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const km = parseTripKilometres(kilometres);
  const corrected = km !== null && Math.abs(km - trip.distanceFinalKm) >= 0.005;
  const confirm = async () => {
    if (locked.current || km === null || (corrected && reason.trim().length < 3)) return;
    locked.current = true; setSaving(true); setError(null);
    try {
      await confirmEmployeeLogbookTrip({ trip, distanceKm: km, reason });
      await refresh(); setFeedback('Kilometer bestätigt. Die Fahrt ist abgeschlossen.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bestätigung fehlgeschlagen.'); }
    finally { locked.current = false; setSaving(false); }
  };
  return <SectionPanel title="Fahrt gestoppt · Kilometer bestätigen" subtitle={`${new Date(trip.startedAt).toLocaleString('de-DE')} · ${trip.purpose}`}>
    {trip.notes ? <Text style={styles.muted}>{trip.notes}</Text> : null}
    <PremiumInput label="Gefahrene Kilometer" value={kilometres} onChangeText={setKilometres} keyboardType="decimal-pad" />
    {corrected ? <PremiumInput label="Korrektur begründen (mindestens 3 Zeichen)" value={reason} onChangeText={setReason} /> : null}
    {error ? <InfoBanner variant="warning" message={error} /> : null}
    <PremiumButton title="Kilometer bestätigen" fullWidth loading={saving} disabled={saving || km === null || (corrected && reason.trim().length < 3)} onPress={() => void confirm()} />
  </SectionPanel>;
}

function TripsPanel({ employeeName, trips, confirmations, tenantId, employeeId, refresh, setFeedback }: { employeeName:string; trips:LogbookTrip[]; confirmations:string[]; tenantId:string; employeeId:string; refresh:()=>Promise<unknown>; setFeedback:(v:string|null)=>void }) {
  const [signDate,setSignDate]=useState(today()); const [signer,setSigner]=useState(employeeName); const [signature,setSignature]=useState(''); const [signatureOpen,setSignatureOpen]=useState(false); const [signing,setSigning]=useState(false); const signingLock=useRef(false);
  async function confirm(){ if(signingLock.current)return; signingLock.current=true; setSigning(true); try { await confirmLogbookDay({tenantId,employeeId,workDate:signDate,signerName:signer,signatureData:signature,trips}); await refresh(); setFeedback('Tagesfahrten wurden verbindlich unterschrieben.'); } catch(e){setFeedback(e instanceof Error?e.message:'Bestätigung fehlgeschlagen.');} finally {signingLock.current=false;setSigning(false);} }
  return <View style={styles.stack}><SectionPanel title="Meine Fahrten" subtitle="Fahrten werden durch Mitarbeitende gestartet und beendet; nachträgliche Änderungen erfolgen revisionssicher durch die Verwaltung"><InfoBanner message="Stimmt eine abgeschlossene Fahrt nicht, melden Sie Datum und Grund an die Verwaltung. Die Originalwerte bleiben dabei erhalten." variant="info" />{!trips.length?<EmptyState title="Noch keine Fahrten" message="Starten Sie die erste Fahrt im Reiter Aufzeichnen."/>:trips.map(t=><PremiumCard key={t.id} style={styles.trip}><View style={styles.tripHead}><View style={styles.grow}><Text style={styles.tripTitle}>{TRAVEL_ROUTE_TYPE_LABELS[t.routeType]}</Text><Text style={styles.muted}>{new Date(t.startedAt).toLocaleString('de-DE')} · {t.purpose}</Text><Text style={styles.muted}>{t.distanceSource==='osm_fallback'?'OSM-Sollroute wegen GPS-Unterbrechung':t.distanceSource==='google_fallback'?'Google-Sollroute wegen GPS-Unterbrechung':t.distanceSource==='manual'?'Manuell erfasst':t.distanceSource==='office_corrected'?'Durch Verwaltung korrigiert':'Per GPS gemessen'}</Text></View><PremiumBadge label={t.status==='recording'?'LÄUFT':t.correctedAt?'KORRIGIERT':(t.distanceSource==='google_fallback'||t.distanceSource==='osm_fallback')?'GESCHÄTZT':'ERFASST'} variant={t.status==='recording'?'green':'cyan'}/></View><View style={styles.metrics}><Text style={styles.metric}>{t.distanceFinalKm.toFixed(2)} km</Text><Text style={styles.metric}>{(t.mileageAmountCents/100).toFixed(2)} EUR</Text><Text style={styles.metric}>{t.countsAsWorkTime?'Arbeitszeit':'Fahrzeitabzug '+t.worktimeDeductionMinutes+' Min.'}</Text></View></PremiumCard>)}</SectionPanel>
  <SectionPanel title="Tagesabschluss unterschreiben" subtitle="Alle abgeschlossenen Fahrten des Tages verbindlich bestätigen"><PremiumInput label="Datum" value={signDate} onChangeText={setSignDate}/><PremiumInput label="Name" value={signer} onChangeText={setSigner}/>{confirmations.includes(signDate)?<InfoBanner message="Dieser Tag wurde bereits unterschrieben."/>:<>{signature?<Image source={{uri:signature}} style={styles.signaturePreview} resizeMode="contain"/>:null}<PremiumButton title={signature?'Unterschrift neu erfassen':'Unterschrift im Vollbild erfassen'} variant="secondary" disabled={!signer.trim()} onPress={()=>setSignatureOpen(true)}/><PremiumButton title="Tagesfahrten verbindlich bestätigen" loading={signing} disabled={signing||!signature||signer.trim().length<2} onPress={()=>void confirm()}/><CareSignatureModal visible={signatureOpen} label="Fahrtenbuch-Tagesabschluss" forceFullscreen dismissScope={`logbook-${signDate}`} onClose={()=>setSignatureOpen(false)} onConfirm={(dataUrl)=>{setSignature(dataUrl);setSignatureOpen(false);}}/></>}</SectionPanel></View>;
}

function ReceiptsPanel({ tenantId, employeeId, trips, setFeedback }: { tenantId: string; employeeId: string; trips: LogbookTrip[]; setFeedback: (v: string | null) => void }) {
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(today()); const [category, setCategory] = useState('parking');
  const [tripId, setTripId] = useState<string | null>(null); const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [saving, setSaving] = useState(false); const [choosing, setChoosing] = useState(false); const locked = useRef(false);
  async function choose() {
    if (locked.current) return; locked.current = true; setChoosing(true);
    try { const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true }); if (!result.canceled && result.assets[0]) setFile(result.assets[0]); }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Beleg konnte nicht ausgewählt werden.'); }
    finally { locked.current = false; setChoosing(false); }
  }
  async function save() {
    if (locked.current) return;
    if (!file) { setFeedback('Bitte zuerst einen Beleg auswählen.'); return; }
    const amountCents = amount.trim() ? Math.round(Number(amount.replace(',', '.')) * 100) : Number.NaN;
    const invalid = getLogbookReceiptValidationError({ amountCents, expenseDate: date });
    if (invalid) { setFeedback(invalid); return; }
    locked.current = true; setSaving(true);
    try {
      const path = await uploadLogbookFile({ tenantId, employeeId, area: 'receipts', uri: file.uri, fileName: file.name, mimeType: file.mimeType });
      await createLogbookReceipt({ tenantId, employeeId, tripId, category, amountCents, expenseDate: date, storagePath: path, fileName: file.name, mimeType: file.mimeType });
      setFile(null); setAmount(''); setFeedback(tripId ? 'Beleg sicher gespeichert und der Fahrt zugeordnet.' : 'Beleg sicher gespeichert.');
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Beleg konnte nicht gespeichert werden.'); }
    finally { locked.current = false; setSaving(false); }
  }
  return <SectionPanel title="Fahrtbeleg hochladen" subtitle="Parken, Maut, Kraftstoff oder sonstige dienstliche Auslagen">
    <View style={styles.chips}>{['parking', 'toll', 'fuel', 'other'].map(key => <Pressable key={key} disabled={saving || choosing} onPress={() => setCategory(key)} style={[styles.chip, category === key && styles.chipActive]}><Text style={[styles.chipText, category === key && styles.chipTextActive]}>{({ parking: 'Parken', toll: 'Maut', fuel: 'Kraftstoff', other: 'Sonstiges' } as Record<string, string>)[key]}</Text></Pressable>)}</View>
    <PremiumInput label="Datum (JJJJ-MM-TT)" value={date} onChangeText={setDate} editable={!saving} />
    <PremiumInput label="Betrag (EUR)" value={amount} onChangeText={setAmount} editable={!saving} keyboardType="decimal-pad" />
    <Text style={styles.label}>Fahrt zuordnen (optional)</Text>
    <ScrollView horizontal contentContainerStyle={styles.chips}><Pressable disabled={saving} onPress={() => setTripId(null)} style={[styles.chip, !tripId && styles.chipActive]}><Text style={styles.chipText}>Keine</Text></Pressable>{trips.map(trip => <Pressable key={trip.id} disabled={saving} onPress={() => setTripId(trip.id)} style={[styles.chip, tripId === trip.id && styles.chipActive]}><Text style={styles.chipText}>{new Date(trip.startedAt).toLocaleDateString('de-DE')} · {trip.purpose}</Text></Pressable>)}</ScrollView>
    <View style={styles.actions}><PremiumButton title={file ? file.name : 'Beleg auswählen'} variant="secondary" loading={choosing} disabled={saving || choosing} onPress={() => void choose()} /><PremiumButton title="Beleg speichern" loading={saving} disabled={saving || choosing} onPress={() => void save()} /></View>
  </SectionPanel>;
}

function ProfilePanel({ tenantId, employeeId, profile, refresh, setFeedback }: { tenantId: string; employeeId: string; profile: any; refresh: () => Promise<unknown>; setFeedback: (v: string | null) => void }) {
  const locked = useRef(false); const [saving, setSaving] = useState(false);
  const latestProfile = useRef(profile);
  useEffect(() => { latestProfile.current = profile; }, [profile]);
  async function license(side: 'front' | 'back') {
    if (locked.current) return; locked.current = true; setSaving(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const path = await uploadLogbookFile({ tenantId, employeeId, area: 'license', uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType });
      const nextProfile = { ...latestProfile.current, [side === 'front' ? 'licenseFrontPath' : 'licenseBackPath']: path };
      await saveLogbookProfile(nextProfile);
      latestProfile.current = nextProfile;
      const refreshed = await refresh();
      setFeedback(refreshed === false ? 'Führerschein wurde gespeichert. Die aktuelle Ansicht konnte noch nicht geladen werden.' : 'Führerschein-' + (side === 'front' ? 'Vorderseite' : 'Rückseite') + ' sicher gespeichert.');
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Upload fehlgeschlagen.'); }
    finally { locked.current = false; setSaving(false); }
  }
  return <SectionPanel title="Führerschein" subtitle="Vorder- und Rückseite geschützt in der Personalakte hinterlegen"><View style={styles.actions}><PremiumButton title={profile.licenseFrontPath ? 'Vorderseite ersetzen' : 'Vorderseite hochladen'} variant="secondary" loading={saving} disabled={saving} onPress={() => void license('front')} /><PremiumButton title={profile.licenseBackPath ? 'Rückseite ersetzen' : 'Rückseite hochladen'} variant="secondary" disabled={saving} onPress={() => void license('back')} /></View></SectionPanel>;
}

const styles=StyleSheet.create({page:{width:'100%',gap:careSpacing.md},stack:{gap:careSpacing.md},hero:{minHeight:150,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:careSpacing.lg},heroCopy:{flex:1,gap:6},eyebrow:{...typography.caption,color:portalPremium.accent.blue,fontWeight:'800',letterSpacing:1.4},heroTitle:{...typography.h1,color:portalPremium.text.primary},heroText:{...typography.body,color:portalPremium.text.secondary,maxWidth:760},tabs:{gap:8,paddingVertical:4},tab:{minHeight:44,justifyContent:'center',paddingHorizontal:18,borderRadius:14,borderWidth:1,borderColor:portalPremium.borderSoft,backgroundColor:portalPremium.surfaceRaised},tabActive:{borderColor:portalPremium.accent.blue,backgroundColor:portalPremium.surfaceMuted},tabText:{...typography.body,color:portalPremium.text.secondary,fontWeight:'700'},tabTextActive:{color:portalPremium.accent.blueDark},form:{gap:careSpacing.md},label:{...typography.label,color:portalPremium.text.primary},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{minHeight:38,justifyContent:'center',paddingHorizontal:13,borderRadius:999,borderWidth:1,borderColor:portalPremium.borderSoft,backgroundColor:portalPremium.surfaceRaised},chipActive:{borderColor:portalPremium.accent.blue,backgroundColor:portalPremium.surfaceMuted},chipText:{...typography.caption,color:portalPremium.text.secondary,fontWeight:'700'},chipTextActive:{color:portalPremium.accent.blueDark},cols:{flexDirection:'row',flexWrap:'wrap',gap:careSpacing.sm},grow:{flex:1,minWidth:220},actions:{flexDirection:'row',flexWrap:'wrap',gap:careSpacing.sm,alignItems:'center'},privacy:{...typography.caption,color:portalPremium.text.muted},trip:{marginBottom:careSpacing.sm},tripHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:careSpacing.sm},tripTitle:{...typography.h3,color:portalPremium.text.primary},muted:{...typography.caption,color:portalPremium.text.muted},metrics:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},metric:{...typography.caption,color:portalPremium.text.primary,backgroundColor:portalPremium.surfaceSoft,borderRadius:999,paddingHorizontal:10,paddingVertical:6},summaryGrid:{flexDirection:'row',flexWrap:'wrap',gap:careSpacing.sm},summaryCard:{minWidth:150,flex:1,gap:4},summaryValue:{...typography.h2,color:portalPremium.text.primary},signaturePreview:{width:'100%',height:140,borderRadius:12,backgroundColor:'#FFFFFF'}});
