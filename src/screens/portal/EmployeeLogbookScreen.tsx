import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { acquireEmployeeLogbookForegroundTracking, addLogbookStop, appendLogbookPoints, berlinToday, confirmLogbookDay, createLogbookReceipt, createLogbookTrip, finishLogbookTrip, flushLogbookPointQueue, getCurrentLogbookPoint, loadEmployeeLogbook, requestLogbookLocationPermission, resolveEmployeeLogbookEligibility, saveLogbookProfile, startNativeBackgroundTracking, stopAutomaticLogbookTracking, uploadLogbookFile, type EmployeeGpsWatchHandle } from '@/lib/employeeLogbook';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';
import { fetchEmployeePortalClientRecords } from '@/lib/portal/employeePortalClientRecordsService';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';

type Tab = 'record' | 'trips' | 'receipts' | 'profile';
const routes = Object.keys(TRAVEL_ROUTE_TYPE_LABELS).filter((key) => key !== 'private_non_business') as TravelRouteType[];
const today = berlinToday;

export function EmployeeLogbookScreen() {
  const actor = usePortalActor(); const [tab, setTab] = useState<Tab>('record');
  const [feedback, setFeedback] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const query = useAsyncQuery(useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) throw new Error('Mitarbeitendenkonto ist nicht vollständig verknüpft.');
    try {
      return { ok: true as const, data: await loadEmployeeLogbook(actor.tenantId, actor.employeeId) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'Fahrtenbuch konnte nicht geladen werden.' };
    }
  }, [actor.tenantId, actor.employeeId]), [actor.tenantId, actor.employeeId], { enabled: !!actor.tenantId && !!actor.employeeId });
  const linkOptionsQuery = useAsyncQuery(useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) return { ok: false as const, error: 'Mitarbeitendenkonto ist nicht vollständig verknüpft.' };
    const [assignments, clients] = await Promise.all([
      fetchLivePortalAppointmentsForEmployee(actor.tenantId, actor.employeeId),
      fetchEmployeePortalClientRecords(actor.tenantId, actor.employeeId),
    ]);
    if (!assignments.ok) return assignments;
    if (!clients.ok) return clients;
    return { ok: true as const, data: { assignments: assignments.data, clients: clients.data } };
  }, [actor.tenantId, actor.employeeId]), [actor.tenantId, actor.employeeId], { enabled: !!actor.tenantId && !!actor.employeeId });
  const eligibilityQuery = useAsyncQuery(useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) throw new Error('Mitarbeitendenkonto ist nicht vollständig verknüpft.');
    return { ok: true as const, data: await resolveEmployeeLogbookEligibility(actor.tenantId, actor.employeeId) };
  }, [actor.tenantId, actor.employeeId]), [actor.tenantId, actor.employeeId], { enabled: !!actor.tenantId && !!actor.employeeId });

  const active = query.data?.trips.find((trip) => trip.status === 'recording') ?? null;
  const [routeType, setRouteType] = useState<TravelRouteType>('home_to_client'); const [purpose, setPurpose] = useState('Anfahrt zum Einsatz');
  const [linkMode, setLinkMode] = useState<'assignment' | 'client' | 'none'>('assignment');
  const [assignmentId, setAssignmentId] = useState(''); const [clientId, setClientId] = useState(''); const [manualReason, setManualReason] = useState(''); const [startAddress, setStartAddress] = useState(''); const [endAddress, setEndAddress] = useState(''); const [notes, setNotes] = useState('');
  const [points, setPoints] = useState<LogbookPoint[]>([]); const [watcher, setWatcher] = useState<EmployeeGpsWatchHandle | null>(null);
  const finishingTripIdRef = useRef<string | null>(null);
  const selectedVehicle = query.data?.vehicles.find(
    (vehicle) => vehicle.id === query.data?.profile.defaultVehicleId && vehicle.active,
  )?.id ?? query.data?.vehicles.find((vehicle) => vehicle.active)?.id ?? null;

  useEffect(() => () => watcher?.remove(), [watcher]);
  useEffect(() => {
    if (!active || watcher || finishingTripIdRef.current === active.id || !actor.tenantId || !actor.employeeId) return;
    let cancelled = false;
    void (async () => {
      await startNativeBackgroundTracking({ tripId: active.id, tenantId: actor.tenantId!, employeeId: actor.employeeId! });
      const subscription = acquireEmployeeLogbookForegroundTracking({ tripId: active.id, tenantId: actor.tenantId!, employeeId: actor.employeeId!, onPoint: (point) => {
        setPoints((current) => [...current.slice(-20), point]);
      }});
      if (cancelled) subscription.remove();
      else setWatcher(subscription);
    })().catch((error) => setFeedback(error instanceof Error ? error.message : 'Die laufende GPS-Fahrt konnte nicht wieder aufgenommen werden.'));
    return () => { cancelled = true; };
  }, [active, watcher, actor.tenantId, actor.employeeId]);
  async function begin() {
    if (!actor.tenantId || !actor.employeeId) return;
    if (linkMode === 'assignment' && !assignmentId) { setFeedback('Bitte einen Einsatz auswählen.'); return; }
    if (linkMode === 'client' && !clientId) { setFeedback('Bitte eine Klientin oder einen Klienten auswählen.'); return; }
    if (linkMode === 'none' && manualReason.trim().length < 3) { setFeedback('Ohne Einsatz oder Klient:in ist eine Begründung erforderlich.'); return; }
    setBusy(true); setFeedback(null);
    try {
      await requestLogbookLocationPermission(); const first = await getCurrentLogbookPoint();
      const trip = await createLogbookTrip({ tenantId: actor.tenantId, employeeId: actor.employeeId, vehicleId: selectedVehicle, routeType, purpose, assignmentId: linkMode === 'assignment' ? resolveVisitMasterId(assignmentId) : null, clientId: linkMode === 'none' ? null : clientId || null, manualReason: linkMode === 'none' ? manualReason.trim() : null, startAddress });
      setPoints([first]); await appendLogbookPoints(trip.id, actor.tenantId, actor.employeeId, [first]);
      await startNativeBackgroundTracking({ tripId: trip.id, tenantId: actor.tenantId, employeeId: actor.employeeId });
      const subscription = acquireEmployeeLogbookForegroundTracking({ tripId: trip.id, tenantId: actor.tenantId, employeeId: actor.employeeId, onPoint: (point) => {
        setPoints((current) => [...current.slice(-20), point]);
      }});
      setWatcher(subscription); await query.refresh(); setFeedback('Fahrt läuft. GPS-Aufzeichnung und Android-Hintergrunddienst sind aktiv.');
    } catch (error) {
      await query.refresh();
      setFeedback(error instanceof Error ? error.message : 'Fahrt konnte nicht gestartet werden.');
    } finally { setBusy(false); }
  }
  async function finish() {
    if (!active || !actor.tenantId || !actor.employeeId) return;
    finishingTripIdRef.current = active.id;
    setBusy(true); setFeedback(null);
    try {
      watcher?.remove(); setWatcher(null); await stopAutomaticLogbookTracking(active.id);
      await flushLogbookPointQueue();
      const last = await getCurrentLogbookPoint();
      await finishLogbookTrip(active.id, { tenantId: actor.tenantId, employeeId: actor.employeeId, endAddress, notes, points: [last] });
      setPoints([]); setEndAddress(''); setNotes(''); await query.refresh(); setFeedback('Fahrt abgeschlossen. Kilometer, Vergütung und Fahrzeitabzug wurden berechnet.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Fahrt konnte nicht abgeschlossen werden.'); } finally { finishingTripIdRef.current = null; setBusy(false); }
  }
  async function openMaps() {
    const origin = encodeURIComponent(startAddress || `${points[0]?.latitude ?? ''},${points[0]?.longitude ?? ''}`); const destination = encodeURIComponent(endAddress);
    if (!endAddress.trim()) { setFeedback('Bitte zuerst eine Zieladresse eintragen.'); return; }
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`);
  }

  if (!actor.isReady || query.loading && !query.data || eligibilityQuery.loading && !eligibilityQuery.data) return <PortalTabScreen title="Fahrtenbuch"><LoadingState message="Fahrtenbuch wird sicher geladen…" /></PortalTabScreen>;
  if (query.error && !query.data) return <PortalTabScreen title="Fahrtenbuch"><ErrorState title="Fahrtenbuch nicht verfügbar" message={query.error} onRetry={() => void query.refresh()} /></PortalTabScreen>;
  if (eligibilityQuery.data && !eligibilityQuery.data.eligible) {
    return <PortalTabScreen title="Arbeitszeit" subtitle="Mobilität und Fahrten">
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
        <View style={styles.heroCopy}><Text style={styles.eyebrow}>DIGITALES FAHRTENBUCH</Text><Text style={styles.heroTitle}>{active ? 'Fahrt wird aufgezeichnet' : 'Bereit für die nächste Fahrt'}</Text><Text style={styles.heroText}>{active ? `${TRAVEL_ROUTE_TYPE_LABELS[active.routeType]} · gestartet ${new Date(active.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Automatische GPS-Kilometer, klare Fahrzeittrennung und direkte Gehaltsstatistik.'}</Text></View>
        <PremiumBadge label={active ? 'GPS AKTIV' : 'BEREIT'} variant={active ? 'green' : 'cyan'} />
      </PremiumCard>
      <InfoBanner variant="warning" message="Während der Fahrt: Gerät eingeschaltet lassen. Im Browser/PWA CareSuite nicht schließen und den Bildschirm nicht sperren. Standort und mobile Daten müssen aktiv sein. In der Android-App läuft die Aufzeichnung mit sichtbarer Dauerbenachrichtigung im Hintergrund weiter." />
      {feedback ? <InfoBanner variant={feedback.includes('nicht') || feedback.includes('Bitte') ? 'warning' : 'info'} message={feedback} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {([['record','Aufzeichnen'],['trips','Meine Fahrten'],['receipts','Belege'],['profile','Führerschein']] as [Tab,string][]).map(([key,label]) => <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>
      {tab === 'record' ? <RecordPanel active={active} tenantId={actor.tenantId} employeeId={actor.employeeId} routeType={routeType} setRouteType={setRouteType} purpose={purpose} setPurpose={setPurpose} linkMode={linkMode} setLinkMode={setLinkMode} assignmentId={assignmentId} setAssignmentId={setAssignmentId} clientId={clientId} setClientId={setClientId} linkOptions={linkOptionsQuery.data} linkOptionsLoading={linkOptionsQuery.loading} linkOptionsError={linkOptionsQuery.error} manualReason={manualReason} setManualReason={setManualReason} startAddress={startAddress} setStartAddress={setStartAddress} endAddress={endAddress} setEndAddress={setEndAddress} notes={notes} setNotes={setNotes} busy={busy} begin={begin} finish={finish} openMaps={openMaps} setFeedback={setFeedback} /> : null}
      {tab === 'trips' ? <TripsPanel employeeName={actor.displayName} trips={bundle.trips} confirmations={bundle.confirmations.map((c) => c.workDate)} tenantId={actor.tenantId!} employeeId={actor.employeeId!} refresh={query.refresh} setFeedback={setFeedback} /> : null}
      {tab === 'receipts' ? <ReceiptsPanel tenantId={actor.tenantId!} employeeId={actor.employeeId!} trips={bundle.trips} setFeedback={setFeedback} /> : null}
      {tab === 'profile' ? <ProfilePanel tenantId={actor.tenantId!} employeeId={actor.employeeId!} profile={bundle.profile} refresh={query.refresh} setFeedback={setFeedback} /> : null}
    </View>
  </PortalTabScreen>;
}

function RecordPanel(p: any) {
  const [stopKind, setStopKind] = useState<'client' | 'doctor' | 'pharmacy' | 'shopping' | 'other'>('client');
  const [stopLabel, setStopLabel] = useState('');
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
    try {
      await addLogbookStop({ tenantId: p.tenantId, employeeId: p.employeeId, tripId: p.active.id, assignmentId: p.active.assignmentId, clientId: p.active.clientId, stopKind, label: stopLabel, address: p.endAddress });
      setStopLabel('');
      p.setFeedback('Zwischenstopp mit genauer Uhrzeit gespeichert.');
    } catch (error) {
      p.setFeedback(error instanceof Error ? error.message : 'Stopp konnte nicht gespeichert werden.');
    }
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
      <PremiumButton title="GPS-Fahrt verbindlich starten" size="lg" loading={p.busy} onPress={() => void p.begin()} />
    </View> : <View style={styles.form}>
      <Text style={styles.label}>Zwischenstopp erfassen</Text>
      <View style={styles.chips}>{([['client', 'Klient:in'], ['doctor', 'Arzt'], ['pharmacy', 'Apotheke'], ['shopping', 'Einkauf'], ['other', 'Sonstiges']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setStopKind(key)} style={[styles.chip, stopKind === key && styles.chipActive]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
      <View style={styles.cols}><PremiumInput label="Name / Zweck des Stopps" value={stopLabel} onChangeText={setStopLabel} style={styles.grow} /><PremiumButton title="Stopp jetzt speichern" variant="secondary" onPress={() => void addStop()} /></View>
      <PremiumInput label="Zieladresse" value={p.endAddress} onChangeText={p.setEndAddress} />
      <PremiumInput label="Notiz" value={p.notes} onChangeText={p.setNotes} multiline />
      <View style={styles.actions}><PremiumButton title="Navigation in Google Maps öffnen" variant="secondary" onPress={() => void p.openMaps()} /><PremiumButton title="Fahrt abschließen" size="lg" loading={p.busy} onPress={() => void p.finish()} /></View>
      <Text style={styles.privacy}>Google Maps erhält die von Ihnen gewählte Start-/Zielangabe nur beim Öffnen. CareSuite führt parallel die eigene Fahrtenaufzeichnung.</Text>
    </View>}
  </SectionPanel>;
}

function TripsPanel({ employeeName, trips, confirmations, tenantId, employeeId, refresh, setFeedback }: { employeeName:string; trips:LogbookTrip[]; confirmations:string[]; tenantId:string; employeeId:string; refresh:()=>Promise<unknown>; setFeedback:(v:string|null)=>void }) {
  const [signDate,setSignDate]=useState(today()); const [signer,setSigner]=useState(employeeName); const [signature,setSignature]=useState(''); const [signatureOpen,setSignatureOpen]=useState(false);
  async function confirm(){ try { await confirmLogbookDay({tenantId,employeeId,workDate:signDate,signerName:signer,signatureData:signature,trips}); await refresh(); setFeedback('Tagesfahrten wurden verbindlich unterschrieben.'); } catch(e){setFeedback(e instanceof Error?e.message:'Bestätigung fehlgeschlagen.');} }
  return <View style={styles.stack}><SectionPanel title="Meine Fahrten" subtitle="Fahrten werden durch Mitarbeitende gestartet und beendet; nachträgliche Änderungen erfolgen revisionssicher durch die Verwaltung"><InfoBanner message="Stimmt eine abgeschlossene Fahrt nicht, melden Sie Datum und Grund an die Verwaltung. Die Originalwerte bleiben dabei erhalten." variant="info" />{!trips.length?<EmptyState title="Noch keine Fahrten" message="Starten Sie die erste Fahrt im Reiter Aufzeichnen."/>:trips.map(t=><PremiumCard key={t.id} style={styles.trip}><View style={styles.tripHead}><View style={styles.grow}><Text style={styles.tripTitle}>{TRAVEL_ROUTE_TYPE_LABELS[t.routeType]}</Text><Text style={styles.muted}>{new Date(t.startedAt).toLocaleString('de-DE')} · {t.purpose}</Text><Text style={styles.muted}>{t.distanceSource==='google_fallback'?'Google-Sollroute wegen GPS-Unterbrechung':t.distanceSource==='manual'?'Manuell erfasst':t.distanceSource==='office_corrected'?'Durch Verwaltung korrigiert':'Per GPS gemessen'}</Text></View><PremiumBadge label={t.status==='recording'?'LÄUFT':t.correctedAt?'KORRIGIERT':t.distanceSource==='google_fallback'?'GESCHÄTZT':'ERFASST'} variant={t.status==='recording'?'green':'cyan'}/></View><View style={styles.metrics}><Text style={styles.metric}>{t.distanceFinalKm.toFixed(2)} km</Text><Text style={styles.metric}>{(t.mileageAmountCents/100).toFixed(2)} EUR</Text><Text style={styles.metric}>{t.countsAsWorkTime?'Arbeitszeit':'Fahrzeitabzug '+t.worktimeDeductionMinutes+' Min.'}</Text></View></PremiumCard>)}</SectionPanel>
  <SectionPanel title="Tagesabschluss unterschreiben" subtitle="Alle abgeschlossenen Fahrten des Tages verbindlich bestätigen"><PremiumInput label="Datum" value={signDate} onChangeText={setSignDate}/><PremiumInput label="Name" value={signer} onChangeText={setSigner}/>{confirmations.includes(signDate)?<InfoBanner message="Dieser Tag wurde bereits unterschrieben."/>:<>{signature?<Image source={{uri:signature}} style={styles.signaturePreview} resizeMode="contain"/>:null}<PremiumButton title={signature?'Unterschrift neu erfassen':'Unterschrift im Vollbild erfassen'} variant="secondary" disabled={!signer.trim()} onPress={()=>setSignatureOpen(true)}/><PremiumButton title="Tagesfahrten verbindlich bestätigen" disabled={!signature||!signer.trim()} onPress={()=>void confirm()}/><CareSignatureModal visible={signatureOpen} label="Fahrtenbuch-Tagesabschluss" forceFullscreen dismissScope={`logbook-${signDate}`} onClose={()=>setSignatureOpen(false)} onConfirm={(dataUrl)=>{setSignature(dataUrl);setSignatureOpen(false);}}/></>}</SectionPanel></View>;
}

function ReceiptsPanel({tenantId,employeeId,trips,setFeedback}:{tenantId:string;employeeId:string;trips:LogbookTrip[];setFeedback:(v:string|null)=>void}){const [amount,setAmount]=useState('');const [date,setDate]=useState(today());const [category,setCategory]=useState('parking');const [tripId,setTripId]=useState<string|null>(null);const [file,setFile]=useState<DocumentPicker.DocumentPickerAsset|null>(null);async function choose(){const r=await DocumentPicker.getDocumentAsync({type:['image/*','application/pdf'],copyToCacheDirectory:true});if(!r.canceled)setFile(r.assets[0]);}async function save(){if(!file){setFeedback('Bitte zuerst einen Beleg auswählen.');return;}try{const path=await uploadLogbookFile({tenantId,employeeId,area:'receipts',uri:file.uri,fileName:file.name,mimeType:file.mimeType});await createLogbookReceipt({tenantId,employeeId,tripId,category,amountCents:Math.round(Number(amount.replace(',','.'))*100),expenseDate:date,storagePath:path,fileName:file.name,mimeType:file.mimeType});setFile(null);setAmount('');setFeedback('Beleg sicher gespeichert und der Fahrt zugeordnet.');}catch(e){setFeedback(e instanceof Error?e.message:'Beleg konnte nicht gespeichert werden.');}}return <SectionPanel title="Fahrtbeleg hochladen" subtitle="Parken, Maut, Kraftstoff oder sonstige dienstliche Auslagen"><View style={styles.chips}>{['parking','toll','fuel','other'].map(k=><Pressable key={k} onPress={()=>setCategory(k)} style={[styles.chip,category===k&&styles.chipActive]}><Text style={[styles.chipText,category===k&&styles.chipTextActive]}>{({parking:'Parken',toll:'Maut',fuel:'Kraftstoff',other:'Sonstiges'} as any)[k]}</Text></Pressable>)}</View><PremiumInput label="Datum" value={date} onChangeText={setDate}/><PremiumInput label="Betrag (EUR)" value={amount} onChangeText={setAmount}/><Text style={styles.label}>Fahrt zuordnen (optional)</Text><ScrollView horizontal contentContainerStyle={styles.chips}><Pressable onPress={()=>setTripId(null)} style={[styles.chip,!tripId&&styles.chipActive]}><Text style={styles.chipText}>Keine</Text></Pressable>{trips.slice(0,12).map(t=><Pressable key={t.id} onPress={()=>setTripId(t.id)} style={[styles.chip,tripId===t.id&&styles.chipActive]}><Text style={styles.chipText}>{new Date(t.startedAt).toLocaleDateString('de-DE')} · {t.purpose}</Text></Pressable>)}</ScrollView><View style={styles.actions}><PremiumButton title={file?file.name:'Beleg auswählen'} variant="secondary" onPress={()=>void choose()}/><PremiumButton title="Beleg speichern" onPress={()=>void save()}/></View></SectionPanel>}

function ProfilePanel({tenantId,employeeId,profile,refresh,setFeedback}:{tenantId:string;employeeId:string;profile:any;refresh:()=>Promise<unknown>;setFeedback:(v:string|null)=>void}){async function license(side:'front'|'back'){const r=await DocumentPicker.getDocumentAsync({type:['image/*','application/pdf'],copyToCacheDirectory:true});if(r.canceled)return;try{const a=r.assets[0];const path=await uploadLogbookFile({tenantId,employeeId,area:'license',uri:a.uri,fileName:a.name,mimeType:a.mimeType});await saveLogbookProfile({...profile,[side==='front'?'licenseFrontPath':'licenseBackPath']:path});await refresh();setFeedback(`Führerschein-${side==='front'?'Vorderseite':'Rückseite'} sicher gespeichert.`);}catch(e){setFeedback(e instanceof Error?e.message:'Upload fehlgeschlagen.');}}return <SectionPanel title="Führerschein" subtitle="Vorder- und Rückseite geschützt in der Personalakte hinterlegen"><View style={styles.actions}><PremiumButton title={profile.licenseFrontPath?'Vorderseite ersetzen':'Vorderseite hochladen'} variant="secondary" onPress={()=>void license('front')}/><PremiumButton title={profile.licenseBackPath?'Rückseite ersetzen':'Rückseite hochladen'} variant="secondary" onPress={()=>void license('back')}/></View></SectionPanel>}

const styles=StyleSheet.create({page:{width:'100%',gap:careSpacing.md},stack:{gap:careSpacing.md},hero:{minHeight:150,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:careSpacing.lg},heroCopy:{flex:1,gap:6},eyebrow:{...typography.caption,color:portalPremium.accent.blue,fontWeight:'800',letterSpacing:1.4},heroTitle:{...typography.h1,color:portalPremium.text.primary},heroText:{...typography.body,color:portalPremium.text.secondary,maxWidth:760},tabs:{gap:8,paddingVertical:4},tab:{minHeight:44,justifyContent:'center',paddingHorizontal:18,borderRadius:14,borderWidth:1,borderColor:portalPremium.borderSoft,backgroundColor:portalPremium.surfaceRaised},tabActive:{borderColor:portalPremium.accent.blue,backgroundColor:portalPremium.surfaceMuted},tabText:{...typography.body,color:portalPremium.text.secondary,fontWeight:'700'},tabTextActive:{color:portalPremium.accent.blueDark},form:{gap:careSpacing.md},label:{...typography.label,color:portalPremium.text.primary},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{minHeight:38,justifyContent:'center',paddingHorizontal:13,borderRadius:999,borderWidth:1,borderColor:portalPremium.borderSoft,backgroundColor:portalPremium.surfaceRaised},chipActive:{borderColor:portalPremium.accent.blue,backgroundColor:portalPremium.surfaceMuted},chipText:{...typography.caption,color:portalPremium.text.secondary,fontWeight:'700'},chipTextActive:{color:portalPremium.accent.blueDark},cols:{flexDirection:'row',flexWrap:'wrap',gap:careSpacing.sm},grow:{flex:1,minWidth:220},actions:{flexDirection:'row',flexWrap:'wrap',gap:careSpacing.sm,alignItems:'center'},privacy:{...typography.caption,color:portalPremium.text.muted},trip:{marginBottom:careSpacing.sm},tripHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:careSpacing.sm},tripTitle:{...typography.h3,color:portalPremium.text.primary},muted:{...typography.caption,color:portalPremium.text.muted},metrics:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},metric:{...typography.caption,color:portalPremium.text.primary,backgroundColor:portalPremium.surfaceSoft,borderRadius:999,paddingHorizontal:10,paddingVertical:6},signaturePreview:{width:'100%',height:140,borderRadius:12,backgroundColor:'#FFFFFF'}});
