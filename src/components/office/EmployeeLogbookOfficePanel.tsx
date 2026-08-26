import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareEntitySelect } from '@/components/inputs/CareEntitySelect';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  buildLogbookPdf,
  berlinToday,
  berlinDateTimeInput,
  correctLogbookTripDetails,
  createManualLogbookTrip,
  loadEmployeeLogbook,
  isLogbookTripInBerlinRange,
  saveLogbookProfile,
  saveLogbookVehicle,
} from '@/lib/employeeLogbook';
import type { LogbookTrip, LogbookVehicleOwnership } from '@/types/modules/employeeLogbook';
import { TRAVEL_ROUTE_TYPE_LABELS, type TravelRouteType } from '@/types/modules/travelCompensation';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium } from '@/design/tokens/portalPremium';
import { typography } from '@/theme';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';
import { fetchEmployeePortalClientRecords } from '@/lib/portal/employeePortalClientRecordsService';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';

type Props = {
  tenantId: string;
  employeeId: string;
  employeeName: string;
  canEdit: boolean;
};

const today = berlinToday;

export function EmployeeLogbookOfficePanel({ tenantId, employeeId, employeeName, canEdit }: Props) {
  const query = useAsyncQuery(
    useCallback(async () => {
      try {
        return { ok: true as const, data: await loadEmployeeLogbook(tenantId, employeeId) };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Fahrtenbuch konnte nicht geladen werden.',
        };
      }
    }, [tenantId, employeeId]),
    [tenantId, employeeId],
  );
  const linkOptionsQuery = useAsyncQuery(useCallback(async () => {
    const [assignments, clients] = await Promise.all([
      fetchLivePortalAppointmentsForEmployee(tenantId, employeeId),
      fetchEmployeePortalClientRecords(tenantId, employeeId),
    ]);
    if (!assignments.ok) return assignments;
    if (!clients.ok) return clients;
    return { ok: true as const, data: { assignments: assignments.data, clients: clients.data } };
  }, [tenantId, employeeId]), [tenantId, employeeId]);
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [ownership, setOwnership] = useState<LogbookVehicleOwnership>('private');
  const [rate, setRate] = useState('0,30');
  const [from, setFrom] = useState(`${today().slice(0, 8)}01`);
  const [to, setTo] = useState(today());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [correctedDistance, setCorrectedDistance] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionRouteType, setCorrectionRouteType] = useState<TravelRouteType>('other_business');
  const [correctionPurpose, setCorrectionPurpose] = useState('');
  const [correctionStartedAt, setCorrectionStartedAt] = useState('');
  const [correctionEndedAt, setCorrectionEndedAt] = useState('');
  const [correctionStartAddress, setCorrectionStartAddress] = useState('');
  const [correctionEndAddress, setCorrectionEndAddress] = useState('');
  const [correctionVehicleId, setCorrectionVehicleId] = useState('');
  const [correctionAssignmentId, setCorrectionAssignmentId] = useState('');
  const [correctionClientId, setCorrectionClientId] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(today());
  const [manualStartTime, setManualStartTime] = useState('08:00');
  const [manualEndTime, setManualEndTime] = useState('08:30');
  const [manualRouteType, setManualRouteType] = useState<TravelRouteType>('other_business');
  const [manualPurpose, setManualPurpose] = useState('');
  const [manualStartAddress, setManualStartAddress] = useState('');
  const [manualEndAddress, setManualEndAddress] = useState('');
  const [manualDistance, setManualDistance] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualVehicleId, setManualVehicleId] = useState<string | null>(null);
  const [manualLinkMode, setManualLinkMode] = useState<'assignment' | 'client' | 'reason'>('assignment');
  const [manualAssignmentId, setManualAssignmentId] = useState('');
  const [manualClientId, setManualClientId] = useState('');

  useEffect(() => {
    if (!query.data) return;
    const vehicle = query.data.vehicles.find((item) => item.active);
    setPlate(vehicle?.plate ?? '');
    setMake(vehicle?.make ?? '');
    setModel(vehicle?.model ?? '');
    setOwnership(vehicle?.ownership ?? 'private');
    setRate((query.data.profile.mileageRateCents / 100).toFixed(2).replace('.', ','));
    setManualVehicleId((current) => current ?? vehicle?.id ?? null);
  }, [query.data]);

  const visibleTrips = useMemo(
    () => (query.data?.trips ?? []).filter((trip) => {
      return isLogbookTripInBerlinRange(trip.startedAt, from, to);
    }),
    [from, query.data?.trips, to],
  );

  const totals = useMemo(() => {
    const completed = visibleTrips.filter((trip) => ['completed', 'corrected', 'confirmed'].includes(trip.status));
    return {
      count: completed.length,
      distance: completed.reduce((sum, trip) => sum + trip.distanceFinalKm, 0),
      amount: completed.reduce((sum, trip) => sum + trip.mileageAmountCents, 0),
    };
  }, [visibleTrips]);

  function beginTripCorrection(trip: LogbookTrip) {
    setSelectedTripId(trip.id);
    setCorrectedDistance(trip.distanceFinalKm.toFixed(2).replace('.', ','));
    setCorrectionReason('');
    setCorrectionRouteType(trip.routeType);
    setCorrectionPurpose(trip.purpose);
    setCorrectionStartedAt(berlinDateTimeInput(trip.startedAt));
    setCorrectionEndedAt(trip.endedAt ? berlinDateTimeInput(trip.endedAt) : '');
    setCorrectionStartAddress(trip.startAddress ?? '');
    setCorrectionEndAddress(trip.endAddress ?? '');
    setCorrectionVehicleId(trip.vehicleId ?? '');
    setCorrectionAssignmentId(trip.assignmentId ?? '');
    setCorrectionClientId(trip.clientId ?? '');
    setFeedback(null);
  }

  async function saveTripCorrection() {
    const trip = query.data?.trips.find((item) => item.id === selectedTripId);
    if (!trip) return;
    const distance = Number(correctedDistance.replace(',', '.'));
    if (!Number.isFinite(distance) || distance < 0) {
      setFeedback('Bitte eine gültige Kilometerzahl eintragen.');
      return;
    }
    if (!correctionReason.trim()) {
      setFeedback('Für eine Fahrtenbuchkorrektur ist eine Begründung erforderlich.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await correctLogbookTripDetails({
        trip,
        vehicleId: correctionVehicleId,
        routeType: correctionRouteType,
        purpose: correctionPurpose,
        assignmentId: correctionAssignmentId || null,
        clientId: correctionClientId || null,
        startedAt: correctionStartedAt,
        endedAt: correctionEndedAt,
        startAddress: correctionStartAddress,
        endAddress: correctionEndAddress,
        distanceKm: distance,
        reason: correctionReason,
      });
      setSelectedTripId(null);
      setCorrectionReason('');
      await query.refresh();
      setFeedback('Die Kilometerkorrektur wurde gespeichert und revisionssicher protokolliert.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Korrektur fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function saveManualTrip() {
    const distance = Number(manualDistance.replace(',', '.'));
    if (!manualVehicleId) {
      setFeedback('Bitte zuerst einen aktiven PKW zuordnen und auswählen.');
      return;
    }
    if (manualLinkMode === 'assignment' && !manualAssignmentId) {
      setFeedback('Bitte den zugehörigen Einsatz auswählen.');
      return;
    }
    if (manualLinkMode === 'client' && !manualClientId) {
      setFeedback('Bitte die zugehörige Klientin oder den zugehörigen Klienten auswählen.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(manualDate) || !/^\d{2}:\d{2}$/.test(manualStartTime) || !/^\d{2}:\d{2}$/.test(manualEndTime)) {
      setFeedback('Bitte Datum und Uhrzeiten vollständig im angegebenen Format eintragen.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await createManualLogbookTrip({
        tenantId,
        employeeId,
        vehicleId: manualVehicleId,
        assignmentId: manualLinkMode === 'assignment' ? resolveVisitMasterId(manualAssignmentId) : null,
        clientId: manualLinkMode === 'reason' ? null : manualClientId || null,
        routeType: manualRouteType,
        purpose: manualPurpose,
        manualReason,
        startedAt: `${manualDate}T${manualStartTime}:00`,
        endedAt: `${manualDate}T${manualEndTime}:00`,
        startAddress: manualStartAddress,
        endAddress: manualEndAddress,
        distanceKm: distance,
      });
      setManualOpen(false);
      setManualPurpose('');
      setManualStartAddress('');
      setManualEndAddress('');
      setManualDistance('');
      setManualReason('');
      setManualAssignmentId('');
      setManualClientId('');
      await query.refresh();
      setFeedback('Die Fahrt wurde manuell erfasst, abgerechnet und im Audit protokolliert.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Manuelle Fahrt konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function saveVehicleSettings() {
    if (!query.data) return;
    if (plate.trim().length < 2) {
      setFeedback('Bitte ein gültiges Kennzeichen eintragen.');
      return;
    }
    const parsedRate = Number(rate.replace(',', '.'));
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setFeedback('Bitte einen gültigen Kilometersatz eintragen.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const vehicle = query.data.vehicles.find((item) => item.active) ?? query.data.vehicles[0];
      await saveLogbookVehicle({
        id: vehicle?.id,
        tenantId,
        employeeId,
        ownership,
        plate,
        make: make.trim() || null,
        model: model.trim() || null,
        active: true,
      });
      await saveLogbookProfile({
        ...query.data.profile,
        mileageRateCents: Math.round(parsedRate * 100),
      });
      await query.refresh();
      setFeedback('Fahrzeug und Kilometersatz wurden durch die Verwaltung gespeichert.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  if (query.loading && !query.data) return <LoadingState message="Fahrtenbuch wird geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;
  if (!query.data) return <ErrorState message="Fahrtenbuchdaten sind nicht verfügbar." />;

  return (
    <View style={styles.stack} testID="employee-logbook-office-panel">
      <InfoBanner
        message="Verwaltungsbereich: Fahrzeugstammdaten, Kilometersatz und vollständige PDF-Nachweise sind im Mitarbeitendenportal nicht sichtbar."
        variant="info"
      />
      {feedback ? <InfoBanner message={feedback} variant={feedback.includes('gültig') || feedback.includes('fehl') ? 'warning' : 'info'} /> : null}

      <View style={styles.metrics}>
        <PremiumCard style={styles.metricCard}><Text style={styles.metricLabel}>Fahrten</Text><Text style={styles.metricValue}>{totals.count}</Text></PremiumCard>
        <PremiumCard style={styles.metricCard}><Text style={styles.metricLabel}>Kilometer</Text><Text style={styles.metricValue}>{totals.distance.toFixed(2).replace('.', ',')} km</Text></PremiumCard>
        <PremiumCard style={styles.metricCard}><Text style={styles.metricLabel}>Kilometererstattung</Text><Text style={styles.metricValue}>{(totals.amount / 100).toFixed(2).replace('.', ',')} EUR</Text></PremiumCard>
      </View>

      <SectionPanel title="Fahrt manuell erfassen" subtitle="Für fehlgeschlagene GPS-Aufzeichnungen oder nachträglich gemeldete Dienstfahrten">
        <View style={styles.manualIntro}>
          <Text style={styles.manualText}>Jede manuelle Fahrt erhält eine Herkunftskennzeichnung und eine Pflichtbegründung. Kilometer, Fahrzeit, Arbeitszeitbezug und Erstattung werden anschließend automatisch berechnet.</Text>
          <PremiumButton title={manualOpen ? 'Eingabe schließen' : 'Neue Fahrt erfassen'} disabled={!canEdit} onPress={() => setManualOpen((value) => !value)} />
        </View>
        {manualOpen ? (
          <View style={styles.manualForm}>
            <Text style={styles.formLabel}>Fahrtart</Text>
            <View style={styles.routeTypes}>
              {(Object.keys(TRAVEL_ROUTE_TYPE_LABELS) as TravelRouteType[]).map((routeType) => (
                <PremiumButton key={routeType} title={TRAVEL_ROUTE_TYPE_LABELS[routeType]} size="sm" variant={manualRouteType === routeType ? 'primary' : 'secondary'} onPress={() => setManualRouteType(routeType)} />
              ))}
            </View>
            <View style={styles.cols}>
              <PremiumInput label="Datum (JJJJ-MM-TT)" value={manualDate} onChangeText={setManualDate} style={styles.manualSmall} />
              <PremiumInput label="Startzeit (HH:MM)" value={manualStartTime} onChangeText={setManualStartTime} style={styles.manualSmall} />
              <PremiumInput label="Endzeit (HH:MM)" value={manualEndTime} onChangeText={setManualEndTime} style={styles.manualSmall} />
              <PremiumInput label="Kilometer" value={manualDistance} onChangeText={setManualDistance} keyboardType="decimal-pad" style={styles.manualSmall} />
            </View>
            <Text style={styles.formLabel}>Verbindliche Zuordnung</Text>
            <View style={styles.routeTypes}>
              <PremiumButton title="Geplanter Einsatz" size="sm" variant={manualLinkMode === 'assignment' ? 'primary' : 'secondary'} onPress={() => setManualLinkMode('assignment')} />
              <PremiumButton title="Klient:in" size="sm" variant={manualLinkMode === 'client' ? 'primary' : 'secondary'} onPress={() => setManualLinkMode('client')} />
              <PremiumButton title="Nur Begründung" size="sm" variant={manualLinkMode === 'reason' ? 'primary' : 'secondary'} onPress={() => setManualLinkMode('reason')} />
            </View>
            {manualLinkMode === 'assignment' ? (
              <CareEntitySelect
                label="Einsatz auswählen"
                value={manualAssignmentId}
                onChange={(value) => {
                  setManualAssignmentId(value);
                  const assignment = linkOptionsQuery.data?.assignments.find((item) => item.id === value);
                  setManualClientId(assignment?.clientId ?? '');
                  if (assignment?.clientName && !manualPurpose.trim()) setManualPurpose(`Dienstfahrt zu ${assignment.clientName}`);
                }}
                required
                loading={linkOptionsQuery.loading}
                options={(linkOptionsQuery.data?.assignments ?? []).map((item) => ({ value: item.id, label: `${new Date(item.startsAt).toLocaleDateString('de-DE')} · ${item.clientName || item.title}`, description: `${new Date(item.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · ${item.title}` }))}
                searchPlaceholder="Einsatz suchen…"
                emptyMessage="Keine zugeordneten Einsätze gefunden."
              />
            ) : null}
            {manualLinkMode === 'client' ? (
              <CareEntitySelect
                label="Klient:in auswählen"
                value={manualClientId}
                onChange={setManualClientId}
                required
                loading={linkOptionsQuery.loading}
                options={(linkOptionsQuery.data?.clients ?? []).map((item) => ({ value: item.clientId, label: item.displayName, description: [item.street, item.zip, item.city].filter(Boolean).join(', ') }))}
                searchPlaceholder="Klient:in suchen…"
                emptyMessage="Keine Klient:innen gefunden."
              />
            ) : null}
            <View style={styles.cols}>
              <PremiumInput label="Fahrtzweck" value={manualPurpose} onChangeText={setManualPurpose} placeholder="z. B. Dienstfahrt zur Klientin" style={styles.grow} />
              <PremiumInput label="Startadresse" value={manualStartAddress} onChangeText={setManualStartAddress} style={styles.grow} />
              <PremiumInput label="Zieladresse" value={manualEndAddress} onChangeText={setManualEndAddress} style={styles.grow} />
            </View>
            {query.data.vehicles.length ? (
              <View style={styles.vehicleSelect}>
                <Text style={styles.formLabel}>Fahrzeug</Text>
                <View style={styles.routeTypes}>
                  {query.data.vehicles.filter((vehicle) => vehicle.active).map((vehicle) => <PremiumButton key={vehicle.id} title={`${vehicle.plate}${vehicle.make ? ` · ${vehicle.make}` : ''}`} size="sm" variant={manualVehicleId === vehicle.id ? 'primary' : 'secondary'} onPress={() => setManualVehicleId(vehicle.id)} />)}
                </View>
              </View>
            ) : <InfoBanner message="Es ist kein aktiver PKW hinterlegt. Eine manuelle Fahrtenbucherfassung ist erst nach der Fahrzeugzuordnung möglich." variant="warning" />}
            <PremiumInput label="Pflichtbegründung für manuelle Erfassung" value={manualReason} onChangeText={setManualReason} placeholder="z. B. GPS-Berechtigung war deaktiviert" />
            <View style={styles.correctionActions}>
              <PremiumButton title="Abbrechen" variant="ghost" onPress={() => setManualOpen(false)} />
              <PremiumButton title="Manuelle Fahrt speichern" loading={saving} disabled={!manualVehicleId} onPress={() => void saveManualTrip()} />
            </View>
          </View>
        ) : null}
      </SectionPanel>

      <SectionPanel title="Fahrten im Zeitraum" subtitle="Route, GPS-Distanz, Arbeitszeitbezug, Erstattung und Prüfstatus vollständig einsehen">
        <View style={styles.tripHeader}>
          <Text style={[styles.tripHeaderText, styles.tripDate]}>DATUM</Text>
          <Text style={[styles.tripHeaderText, styles.tripRoute]}>FAHRT & ROUTE</Text>
          <Text style={[styles.tripHeaderText, styles.tripNumber]}>DAUER</Text>
          <Text style={[styles.tripHeaderText, styles.tripNumber]}>KM</Text>
          <Text style={[styles.tripHeaderText, styles.tripNumber]}>ERSTATTUNG</Text>
          <Text style={[styles.tripHeaderText, styles.tripAction]}>AKTION</Text>
        </View>
        {visibleTrips.length === 0 ? (
          <InfoBanner message="Im gewählten Zeitraum liegen keine Fahrten vor." variant="info" />
        ) : visibleTrips.map((trip) => {
          const selected = selectedTripId === trip.id;
          const durationMinutes = Math.max(0, Math.round(trip.durationSeconds / 60));
          const segments = query.data!.segments.filter((segment) => segment.tripId === trip.id).sort((a, b) => a.sequenceNo - b.sequenceNo);
          const receipts = query.data!.receipts.filter((receipt) => receipt.tripId === trip.id);
          return (
            <View key={trip.id} style={[styles.tripBlock, selected && styles.tripBlockSelected]}>
              <View style={styles.tripRow}>
                <View style={styles.tripDate}>
                  <Text style={styles.tripPrimary}>{new Date(trip.startedAt).toLocaleDateString('de-DE')}</Text>
                  <Text style={styles.tripSecondary}>{new Date(trip.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}{trip.endedAt ? ` – ${new Date(trip.endedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ' · läuft'}</Text>
                </View>
                <View style={styles.tripRoute}>
                  <Text style={styles.tripPrimary}>{TRAVEL_ROUTE_TYPE_LABELS[trip.routeType] ?? trip.routeType}</Text>
                  <Text style={styles.tripSecondary}>{trip.purpose || 'Ohne Zweckangabe'}</Text>
                  <Text style={styles.tripSecondary}>{trip.startAddress ?? 'GPS-Start'} → {trip.endAddress ?? (trip.status === 'recording' ? 'Fahrt läuft' : 'GPS-Ziel')}</Text>
                  {segments.length ? <Text style={styles.tripSecondary}>Stopps: {segments.map((segment) => segment.label).join(' → ')}</Text> : null}
                  <View style={styles.tripBadges}>
                    <PremiumBadge label={trip.status === 'recording' ? 'AUFZEICHNUNG LÄUFT' : trip.status === 'corrected' ? 'KORRIGIERT' : trip.status === 'confirmed' ? 'BESTÄTIGT' : 'ABGESCHLOSSEN'} variant={trip.status === 'recording' ? 'orange' : trip.status === 'corrected' ? 'cyan' : 'green'} />
                    <PremiumBadge label={trip.countsAsWorkTime ? 'ARBEITSZEIT' : `${trip.worktimeDeductionMinutes} MIN. ABZUG`} variant={trip.countsAsWorkTime ? 'green' : 'muted'} />
                    <PremiumBadge
                      label={trip.distanceSource === 'google_fallback' ? 'GOOGLE-ERSATZROUTE' : trip.distanceSource === 'office_corrected' ? 'VERWALTUNGSKORREKTUR' : trip.distanceSource === 'manual' ? 'MANUELL' : 'GPS GEMESSEN'}
                      variant={trip.distanceSource === 'google_fallback' ? 'orange' : trip.distanceSource === 'gps' ? 'cyan' : 'muted'}
                    />
                    {segments.length ? <PremiumBadge label={`${segments.length} STOPPS`} variant="cyan" /> : null}
                    {receipts.length ? <PremiumBadge label={`${receipts.length} BELEGE`} variant="muted" /> : null}
                  </View>
                </View>
                <Text style={[styles.tripPrimary, styles.tripNumber]}>{durationMinutes ? `${Math.floor(durationMinutes / 60)}:${String(durationMinutes % 60).padStart(2, '0')} h` : '—'}</Text>
                <Text style={[styles.tripPrimary, styles.tripNumber]}>{trip.distanceFinalKm.toFixed(2).replace('.', ',')}</Text>
                <Text style={[styles.tripPrimary, styles.tripNumber]}>{(trip.mileageAmountCents / 100).toFixed(2).replace('.', ',')} €</Text>
                <View style={styles.tripAction}>
                  <PremiumButton title={selected ? 'Schließen' : 'Korrigieren'} size="sm" variant="secondary" disabled={!canEdit || trip.status === 'recording'} onPress={() => selected ? setSelectedTripId(null) : beginTripCorrection(trip)} />
                </View>
              </View>
              {selected ? (
                <View style={styles.correctionPanel}>
                  <Text style={styles.formLabel}>Fahrtart und Fahrzeug</Text>
                  <View style={styles.routeTypes}>
                    {(Object.keys(TRAVEL_ROUTE_TYPE_LABELS) as TravelRouteType[]).map((routeType) => <PremiumButton key={routeType} title={TRAVEL_ROUTE_TYPE_LABELS[routeType]} size="sm" variant={correctionRouteType === routeType ? 'primary' : 'secondary'} onPress={() => setCorrectionRouteType(routeType)} />)}
                  </View>
                  <View style={styles.routeTypes}>
                    {query.data!.vehicles.filter((vehicle) => vehicle.active).map((vehicle) => <PremiumButton key={vehicle.id} title={`${vehicle.plate}${vehicle.make ? ` · ${vehicle.make}` : ''}`} size="sm" variant={correctionVehicleId === vehicle.id ? 'primary' : 'secondary'} onPress={() => setCorrectionVehicleId(vehicle.id)} />)}
                  </View>
                  <View style={styles.cols}>
                    <PremiumInput label="Fahrtzweck" value={correctionPurpose} onChangeText={setCorrectionPurpose} style={styles.grow} />
                    <PremiumInput label="Start (JJJJ-MM-TTTHH:MM)" value={correctionStartedAt} onChangeText={setCorrectionStartedAt} style={styles.grow} />
                    <PremiumInput label="Ende (JJJJ-MM-TTTHH:MM)" value={correctionEndedAt} onChangeText={setCorrectionEndedAt} style={styles.grow} />
                  </View>
                  <View style={styles.cols}>
                    <PremiumInput label="Startadresse" value={correctionStartAddress} onChangeText={setCorrectionStartAddress} style={styles.grow} />
                    <PremiumInput label="Zieladresse" value={correctionEndAddress} onChangeText={setCorrectionEndAddress} style={styles.grow} />
                  </View>
                  <View style={styles.cols}>
                    <CareEntitySelect
                      label="Einsatzzuordnung"
                      value={correctionAssignmentId}
                      onChange={(value) => {
                        setCorrectionAssignmentId(value);
                        const assignment = linkOptionsQuery.data?.assignments.find((item) => resolveVisitMasterId(item.id) === value || item.id === value);
                        if (assignment?.clientId) setCorrectionClientId(assignment.clientId);
                      }}
                      options={(linkOptionsQuery.data?.assignments ?? []).map((item) => ({ value: resolveVisitMasterId(item.id), label: `${new Date(item.startsAt).toLocaleDateString('de-DE')} · ${item.clientName || item.title}`, description: item.title }))}
                      searchPlaceholder="Einsatz suchen…"
                      emptyMessage="Keine Einsätze gefunden."
                    />
                    <CareEntitySelect
                      label="Klient:innenzuordnung"
                      value={correctionClientId}
                      onChange={setCorrectionClientId}
                      options={(linkOptionsQuery.data?.clients ?? []).map((item) => ({ value: item.clientId, label: item.displayName, description: [item.street, item.zip, item.city].filter(Boolean).join(', ') }))}
                      searchPlaceholder="Klient:in suchen…"
                      emptyMessage="Keine Klient:innen gefunden."
                    />
                  </View>
                  <View style={styles.cols}>
                    <PremiumInput label="Korrigierte Kilometer" value={correctedDistance} onChangeText={setCorrectedDistance} keyboardType="decimal-pad" style={styles.grow} />
                    <PremiumInput label="Pflichtbegründung" value={correctionReason} onChangeText={setCorrectionReason} placeholder="Warum weicht die Strecke von der GPS-Aufzeichnung ab?" style={styles.correctionReason} />
                  </View>
                  <View style={styles.correctionActions}>
                    <PremiumButton title="Abbrechen" variant="ghost" onPress={() => setSelectedTripId(null)} />
                    <PremiumButton title="Korrektur speichern" loading={saving} onPress={() => void saveTripCorrection()} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </SectionPanel>

      <SectionPanel title="Fahrzeug & Kilometersatz" subtitle="Ausschließlich durch die Verwaltung bearbeitbar">
        <View style={styles.chips}>
          {(['private', 'company'] as const).map((key) => (
            <PremiumButton
              key={key}
              title={key === 'private' ? 'Privatfahrzeug' : 'Firmenfahrzeug'}
              size="sm"
              variant={ownership === key ? 'primary' : 'secondary'}
              disabled={!canEdit}
              onPress={() => setOwnership(key)}
            />
          ))}
          <PremiumBadge label={canEdit ? 'VERWALTUNG' : 'NUR LESEN'} variant="cyan" />
        </View>
        <View style={styles.cols}>
          <PremiumInput label="Kennzeichen" value={plate} onChangeText={setPlate} editable={canEdit} style={styles.grow} />
          <PremiumInput label="Hersteller" value={make} onChangeText={setMake} editable={canEdit} style={styles.grow} />
          <PremiumInput label="Modell" value={model} onChangeText={setModel} editable={canEdit} style={styles.grow} />
          <PremiumInput label="EUR je km" value={rate} onChangeText={setRate} editable={canEdit} style={styles.grow} />
        </View>
        {canEdit ? <PremiumButton title="Fahrzeugdaten speichern" loading={saving} onPress={() => void saveVehicleSettings()} /> : null}
      </SectionPanel>

      <SectionPanel title="Zeitraum & PDF" subtitle="Vollständigen Fahrtenbuchnachweis für die Personal- und Abrechnungsverwaltung erstellen">
        <View style={styles.cols}>
          <PremiumInput label="Von" value={from} onChangeText={setFrom} style={styles.grow} />
          <PremiumInput label="Bis" value={to} onChangeText={setTo} style={styles.grow} />
        </View>
        <PremiumButton
          title="Fahrtenbuch als PDF erstellen"
          onPress={() => buildLogbookPdf({ employeeName, from, to, trips: query.data!.trips, vehicles: query.data!.vehicles, segments: query.data!.segments, receipts: query.data!.receipts, confirmations: query.data!.confirmations })}
        />
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: careSpacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  metricCard: { flex: 1, minWidth: 190 },
  metricLabel: { ...typography.caption, color: portalPremium.text.muted },
  metricValue: { ...typography.h3, color: portalPremium.text.primary, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, alignItems: 'center' },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  grow: { flex: 1, minWidth: 220 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm, paddingHorizontal: careSpacing.sm, paddingVertical: careSpacing.xs, borderRadius: 10, backgroundColor: '#E7F1FB' },
  tripHeaderText: { ...typography.caption, color: '#31597F', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  tripBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C8DBED', backgroundColor: '#FFFFFF' },
  tripBlockSelected: { borderWidth: 1, borderColor: '#68AEF4', borderRadius: 12, overflow: 'hidden' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm, padding: careSpacing.sm },
  tripDate: { width: 132 },
  tripRoute: { flex: 1, minWidth: 260, gap: 2 },
  tripNumber: { width: 92, textAlign: 'right' },
  tripAction: { width: 112, alignItems: 'flex-end' },
  tripPrimary: { ...typography.caption, color: '#0B2342', fontWeight: '800' },
  tripSecondary: { ...typography.caption, color: '#4C6885', fontSize: 11, lineHeight: 15 },
  tripBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  correctionPanel: { gap: careSpacing.sm, padding: careSpacing.md, borderTopWidth: 1, borderTopColor: '#B7D8F7', backgroundColor: '#EEF7FF' },
  correctionReason: { flex: 2, minWidth: 320 },
  correctionActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: careSpacing.sm },
  manualIntro: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.md },
  manualText: { ...typography.body, flex: 1, minWidth: 280, color: '#31597F', fontSize: 12, lineHeight: 18 },
  manualForm: { gap: careSpacing.md, paddingTop: careSpacing.sm, borderTopWidth: 1, borderTopColor: '#C8DBED' },
  formLabel: { ...typography.caption, color: '#0B2342', fontWeight: '900' },
  routeTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  manualSmall: { flex: 1, minWidth: 160 },
  vehicleSelect: { gap: careSpacing.xs },
});
