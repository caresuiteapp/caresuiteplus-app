import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareEntitySelect } from '@/components/inputs/CareEntitySelect';
import { InfoBanner, PremiumBadge, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  addLogbookStop,
  finishActiveVisitLogbookTrip,
  loadEmployeeLogbook,
  resolveEmployeeLogbookEligibility,
  startVisitServiceLogbookTrip,
} from '@/lib/employeeLogbook';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { TRAVEL_ROUTE_TYPE_LABELS } from '@/types/modules/travelCompensation';
import type { EmployeeLogbookBundle } from '@/types/modules/employeeLogbook';
import type { EmployeeLogbookEligibility } from '@/lib/employeeLogbook';
import type { EmployeeTransportMode } from '@/types/modules/employeeMobility';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import { portalPremium } from '@/design/tokens/portalPremium';
import { spacing, typography } from '@/theme';

type TripKind = 'with_client' | 'client_errand' | 'next_client';
type StopKind = 'client' | 'doctor' | 'pharmacy' | 'shopping' | 'other';

type Props = {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  clientId: string;
  clientName: string;
  startAddress: string;
  plannedEndAt: string;
  transportMode: EmployeeTransportMode;
};

const KIND_OPTIONS: { key: TripKind; label: string; purpose: string }[] = [
  { key: 'with_client', label: 'Fahrt mit Klient:in', purpose: 'Begleitfahrt mit Klient:in' },
  { key: 'client_errand', label: 'Besorgungsfahrt', purpose: 'Besorgungsfahrt für Klient:in' },
  { key: 'next_client', label: 'Weiter zum nächsten Einsatz', purpose: 'Weiterfahrt zum nächsten Einsatz' },
];

const STOP_OPTIONS: { key: StopKind; label: string }[] = [
  { key: 'client', label: 'Klient:in' },
  { key: 'doctor', label: 'Arzt' },
  { key: 'pharmacy', label: 'Apotheke' },
  { key: 'shopping', label: 'Einkauf' },
  { key: 'other', label: 'Weiteres Ziel' },
];

export function EmployeePortalVisitLogbookCard(props: Props) {
  const [kind, setKind] = useState<TripKind>('with_client');
  const [purpose, setPurpose] = useState(`Begleitfahrt mit ${props.clientName}`);
  const [destination, setDestination] = useState('');
  const [stopKind, setStopKind] = useState<StopKind>('doctor');
  const [stopLabel, setStopLabel] = useState('');
  const [nextAssignmentId, setNextAssignmentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = useAsyncQuery<{ eligibility: EmployeeLogbookEligibility; bundle: EmployeeLogbookBundle | null; appointments: PortalAppointmentItem[] }>(useCallback(async () => {
    const eligibility = await resolveEmployeeLogbookEligibility(
      props.tenantId,
      props.employeeId,
      props.transportMode,
    );
    if (!eligibility.eligible) return { ok: true as const, data: { eligibility, bundle: null, appointments: [] } };
    const [bundle, appointmentsResult] = await Promise.all([
      loadEmployeeLogbook(props.tenantId, props.employeeId),
      fetchLivePortalAppointmentsForEmployee(props.tenantId, props.employeeId),
    ]);
    return {
      ok: true as const,
      data: { eligibility, bundle, appointments: appointmentsResult.ok ? appointmentsResult.data : [] },
    };
  }, [props.tenantId, props.employeeId, props.transportMode]), [props.tenantId, props.employeeId, props.transportMode]);

  const assignmentId = resolveVisitMasterId(props.assignmentId);
  const nextAssignments = useMemo(
    () => (query.data?.appointments ?? [])
      .filter((item) => resolveVisitMasterId(item.id) !== assignmentId)
      .filter((item) => new Date(item.startsAt).getTime() >= new Date(props.plannedEndAt).getTime())
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()),
    [assignmentId, props.plannedEndAt, query.data?.appointments],
  );
  const selectedNextAssignment = nextAssignments.find((item) => item.id === nextAssignmentId) ?? nextAssignments[0] ?? null;
  const active = useMemo(
    () => query.data?.bundle?.trips.find((trip) => trip.status === 'recording') ?? null,
    [query.data?.bundle?.trips],
  );
  const relatedAssignmentIds = useMemo(
    () => new Set([assignmentId, ...nextAssignments.map((item) => resolveVisitMasterId(item.id))]),
    [assignmentId, nextAssignments],
  );
  const activeForVisit = active?.assignmentId && relatedAssignmentIds.has(active.assignmentId) ? active : null;

  if (query.loading && !query.data) return null;
  if (!query.data?.eligibility.eligible) {
    const reason = query.data?.eligibility.reason;
    return (
      <SectionPanel
        title="PKW-Fahrten im Einsatz"
        subtitle="Die Live-GPS-Aufzeichnung bleibt erhalten, auch wenn das formale Fahrtenbuch noch nicht freigeschaltet ist"
      >
        <InfoBanner
          message={reason === 'no_active_vehicle'
            ? 'Kein aktiver PKW zugeordnet. Die Verwaltung muss einmalig Kennzeichen und Fahrzeug hinterlegen; danach werden vollständig prüfbare GPS-Bestandsdaten seit dem 24.08.2026 automatisch übernommen.'
            : 'PKW ist für dieses Mitarbeitendenkonto noch nicht freigeschaltet. Bitte die Mobilitätseinstellungen durch die Verwaltung prüfen lassen.'}
          variant="warning"
        />
      </SectionPanel>
    );
  }

  async function start() {
    if (kind === 'next_client' && !selectedNextAssignment) {
      setFeedback('Es wurde kein geplanter Folgeeinsatz gefunden. Bitte die Fahrt im Fahrtenbuch manuell zuordnen.');
      return;
    }
    const target = kind === 'next_client' && selectedNextAssignment
      ? {
          assignmentId: selectedNextAssignment.id,
          clientId: selectedNextAssignment.clientId,
          clientName: selectedNextAssignment.clientName || selectedNextAssignment.title,
          startAddress: selectedNextAssignment.location || props.startAddress,
        }
      : props;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await startVisitServiceLogbookTrip({
        tenantId: props.tenantId,
        employeeId: props.employeeId,
        assignmentId: target.assignmentId,
        clientId: target.clientId,
        clientName: target.clientName,
        kind,
        purpose,
        startAddress: target.startAddress,
        transportMode: props.transportMode,
      });
      await query.refresh();
      setFeedback(result.resumed ? 'Die laufende Fahrt wurde wieder aufgenommen.' : 'PKW-Fahrt und GPS-Aufzeichnung wurden gestartet.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Die Fahrt konnte nicht gestartet werden.');
    } finally {
      setBusy(false);
    }
  }

  async function addStop() {
    if (!activeForVisit) return;
    setBusy(true);
    setFeedback(null);
    try {
      await addLogbookStop({
        tenantId: props.tenantId,
        employeeId: props.employeeId,
        tripId: activeForVisit.id,
        assignmentId: activeForVisit.assignmentId,
        clientId: activeForVisit.clientId,
        stopKind,
        label: stopLabel,
        address: destination,
      });
      setStopLabel('');
      setDestination('');
      await query.refresh();
      setFeedback('Zwischenziel gespeichert. Die GPS-Aufzeichnung läuft für die nächste Teilstrecke weiter.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Zwischenziel konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setFeedback(null);
    try {
      const trip = await finishActiveVisitLogbookTrip({
        tenantId: props.tenantId,
        employeeId: props.employeeId,
        assignmentId: activeForVisit?.assignmentId ?? props.assignmentId,
        endAddress: destination,
        notes: `Im Einsatzworkflow bei ${props.clientName} abgeschlossen.`,
        allowedRouteTypes: ['with_client', 'other_business', 'client_to_client'],
      });
      await query.refresh();
      setFeedback(
        trip
          ? `Fahrt abgeschlossen: ${trip.distanceFinalKm.toFixed(2).replace('.', ',')} km wurden gespeichert.`
          : 'Es wurde keine passende laufende Fahrt gefunden.',
      );
      setDestination('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Die Fahrt konnte nicht abgeschlossen werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionPanel
      title="PKW-Fahrten im Einsatz"
      subtitle="Begleitfahrt, Besorgung und mehrere Ziele direkt dem Einsatz und der Klientin bzw. dem Klienten zuordnen"
    >
      <View style={styles.header}>
        <Text style={styles.copy}>Nur sichtbar, weil für dieses Mitarbeitendenkonto ein aktiver PKW zugeordnet ist.</Text>
        <PremiumBadge label={activeForVisit ? 'GPS AKTIV' : 'PKW ZUGEORDNET'} variant={activeForVisit ? 'green' : 'cyan'} />
      </View>
      {feedback ? <InfoBanner message={feedback} variant={/nicht|konnte|bereits/i.test(feedback) ? 'warning' : 'info'} /> : null}
      {active && !activeForVisit ? (
        <InfoBanner message="Es läuft eine Fahrt aus einem anderen Einsatz. Diese muss zuerst im Fahrtenbuch abgeschlossen werden." variant="warning" />
      ) : null}

      {!active ? (
        <View style={styles.stack}>
          <Text style={styles.label}>Fahrt auswählen</Text>
          <View style={styles.actions}>
            {KIND_OPTIONS.map((option) => (
              <PremiumButton
                key={option.key}
                title={option.label}
                size="sm"
                variant={kind === option.key ? 'primary' : 'secondary'}
                onPress={() => {
                  setKind(option.key);
                  setPurpose(`${option.purpose} · ${props.clientName}`);
                }}
              />
            ))}
          </View>
          <PremiumInput label="Fahrtzweck" value={purpose} onChangeText={setPurpose} />
          {kind === 'next_client' ? (
            <CareEntitySelect
              label="Nächsten Einsatz auswählen"
              value={selectedNextAssignment?.id ?? ''}
              options={nextAssignments.map((item) => ({
                value: item.id,
                label: `${new Date(item.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · ${item.clientName || item.title}`,
                description: [item.title, item.location].filter(Boolean).join(' · '),
              }))}
              onChange={(value) => {
                setNextAssignmentId(value);
                const item = nextAssignments.find((candidate) => candidate.id === value);
                if (item) setPurpose(`Weiterfahrt zum nächsten Einsatz · ${item.clientName || item.title}`);
              }}
              required
              searchPlaceholder="Folgeeinsatz suchen…"
              emptyMessage="Kein geplanter Folgeeinsatz vorhanden."
            />
          ) : null}
          <PremiumButton title="PKW-Fahrt und GPS starten" size="lg" fullWidth disabled={kind === 'next_client' && !selectedNextAssignment} loading={busy} onPress={() => void start()} />
        </View>
      ) : activeForVisit ? (
        <View style={styles.stack}>
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>{TRAVEL_ROUTE_TYPE_LABELS[activeForVisit.routeType]}</Text>
            <Text style={styles.copy}>{activeForVisit.purpose}</Text>
            <Text style={styles.copy}>Gestartet: {new Date(activeForVisit.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</Text>
          </View>
          <Text style={styles.label}>Zwischenziel oder Abschlussziel</Text>
          <View style={styles.actions}>
            {STOP_OPTIONS.map((option) => (
              <PremiumButton key={option.key} title={option.label} size="sm" variant={stopKind === option.key ? 'primary' : 'secondary'} onPress={() => setStopKind(option.key)} />
            ))}
          </View>
          <PremiumInput label="Name / Zweck des Ziels" value={stopLabel} onChangeText={setStopLabel} placeholder="z. B. Apotheke am Markt" />
          <PremiumInput label="Adresse / Ziel" value={destination} onChangeText={setDestination} placeholder="Straße, PLZ Ort" />
          <View style={styles.actions}>
            <PremiumButton title="Zwischenziel erreicht – weiter aufzeichnen" variant="secondary" disabled={!stopLabel.trim()} loading={busy} onPress={() => void addStop()} />
            <PremiumButton title="Am Ziel – Fahrt beenden" loading={busy} onPress={() => void finish()} />
          </View>
        </View>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  label: { ...typography.label, color: portalPremium.text.primary },
  copy: { ...typography.caption, color: portalPremium.text.secondary, flex: 1 },
  activeCard: { gap: 4, borderWidth: 1, borderColor: portalPremium.borderSoft, borderRadius: 14, padding: spacing.md, backgroundColor: portalPremium.surfaceSoft },
  activeTitle: { ...typography.h3, color: portalPremium.text.primary },
});
