import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import {
  confirmEmployeeLogbookTrip, finishActiveVisitLogbookTrip, finishVisitApproachLogbook,
  loadEmployeeLogbook, resolveEmployeeLogbookEligibility, startVisitServiceLogbookTrip,
  type EmployeeLogbookEligibility,
} from '@/lib/employeeLogbook';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import type { EmployeeLogbookBundle } from '@/types/modules/employeeLogbook';
import type { EmployeeTransportMode } from '@/types/modules/employeeMobility';
import { portalPremium } from '@/design/tokens/portalPremium';
import { spacing, typography } from '@/theme';
import { parseTripKilometres, selectVisitLogbookState } from '@/lib/employeeLogbook/visitLogbookState';
import { withWorkflowTimeout, WorkflowActionTimeoutError } from '@/features/assistWorkflow/internal/withWorkflowTimeout';

type Props = {
  tenantId: string; employeeId: string; assignmentId: string; clientId: string;
  clientName: string; startAddress: string; transportMode: EmployeeTransportMode;
  phase: string; refreshToken?: number;
  onConfirmationRequiredChange?: (required: boolean) => void;
  onOpenLogbook?: () => void;
  onVisitChanged?: () => Promise<unknown>;
};

/** A single card stays mounted through arrival and service, including late server confirmations. */
export function EmployeePortalVisitLogbookCard(props: Props) {
  const { tenantId, employeeId, assignmentId, transportMode, phase, onConfirmationRequiredChange } = props;
  const [data, setData] = useState<{ eligibility: EmployeeLogbookEligibility; bundle: EmployeeLogbookBundle } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<'with_client' | 'client_errand'>('with_client');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [correctionTrip, setCorrectionTrip] = useState<EmployeeLogbookBundle['trips'][number] | null>(null);
  const [confirmationKm, setConfirmationKm] = useState('');
  const [confirmationReason, setConfirmationReason] = useState('');
  const [confirmationOpen, setConfirmationOpen] = useState(true);
  const mutationRef = useRef(false);
  const requestRef = useRef(0);
  const arrivalAttempt = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const bundle = await withWorkflowTimeout(loadEmployeeLogbook(tenantId, employeeId), 12_000, 'Fahrtenbuch');
      const eligibility = await withWorkflowTimeout(resolveEmployeeLogbookEligibility(tenantId, employeeId, transportMode, bundle), 8_000, 'Fahrzeugzuordnung');
      if (request !== requestRef.current) return;
      setData({ eligibility, bundle });
      setError(null);
    } catch (cause) {
      if (request === requestRef.current) setError(cause instanceof WorkflowActionTimeoutError ? 'Fahrtenbuch noch nicht erreichbar. Bitte die Verbindung prüfen und erneut laden.' : cause instanceof Error ? cause.message : 'Fahrtenbuch konnte nicht geladen werden.');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [tenantId, employeeId, transportMode]);

  useEffect(() => {
    void reload();
    return () => { requestRef.current += 1; };
  }, [reload, phase, props.refreshToken]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void reload(); });
    return () => listener.remove();
  }, [reload]);

  const { active, pending, otherActive } = selectVisitLogbookState(data?.bundle.trips ?? [], resolveVisitMasterId(assignmentId));
  const blocked = loading || busy || Boolean(error || active || pending || otherActive);
  useEffect(() => { onConfirmationRequiredChange?.(blocked); }, [blocked, onConfirmationRequiredChange]);
  const pendingId = pending?.id;
  const suggestedKm = pending?.distanceFinalKm;
  const confirmationId = useRef<string | undefined>(undefined);
  useEffect(() => {
    // A refresh must not replace kilometres currently being edited.
    if (pendingId !== confirmationId.current) {
      confirmationId.current = pendingId;
      setConfirmationKm(suggestedKm?.toFixed(2).replace('.', ',') ?? '');
      setConfirmationReason('');
      setConfirmationOpen(true);
    }
  }, [pendingId, suggestedKm]);

  const mutate = useCallback(async (operation: () => Promise<void>) => {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setBusy(true); setError(null); setFeedback(null);
    let timedOut = false;
    try {
      const pendingOperation = operation();
      void pendingOperation.then(() => { if (timedOut) void reload(); }, () => undefined);
      await withWorkflowTimeout(pendingOperation, 15_000, 'Fahrt speichern');
      await reload();
    } catch (cause) {
      timedOut = cause instanceof WorkflowActionTimeoutError;
      setError(timedOut ? 'Serverbestätigung ausstehend. Bitte den Fahrtenbuchstatus prüfen; die laufende Anfrage wird weiter abgeglichen.' : cause instanceof Error ? cause.message : 'Die Fahrt konnte nicht gespeichert werden. Bitte erneut prüfen.');
    } finally { mutationRef.current = false; setBusy(false); }
  }, [reload]);

  const finishApproach = useCallback(() => mutate(async () => {
    await finishVisitApproachLogbook({ tenantId, employeeId, assignmentId, endAddress: props.startAddress });
  }), [mutate, tenantId, employeeId, assignmentId, props.startAddress]);

  useEffect(() => {
    if (phase !== 'arrived' || !active || loading || busy || error) return;
    if (arrivalAttempt.current === active.id) return;
    arrivalAttempt.current = active.id;
    // Also reconciles a restored visit and an arrival confirmed after timeout.
    void finishApproach();
  }, [phase, active, loading, busy, error, finishApproach]);

  const confirmationTrip = pending ?? correctionTrip;
  const km = parseTripKilometres(confirmationKm);
  const corrected = confirmationTrip && km !== null && Math.abs(km - confirmationTrip.distanceFinalKm) >= 0.005;
  const canConfirm = km !== null && (!corrected || confirmationReason.trim().length >= 3);
  const confirm = () => {
    if (!confirmationTrip || !canConfirm || km === null) return;
    void mutate(async () => {
      await confirmEmployeeLogbookTrip({ trip: confirmationTrip, distanceKm: km, reason: confirmationReason });
      setCorrectionTrip(null);
      if (correctionTrip && corrected) await props.onVisitChanged?.();
      setFeedback(correctionTrip && corrected ? 'Kilometer korrigiert. Bitte die Unterschrift anschließend erneut einholen.' : 'Kilometer bestätigt.');
    });
  };
  const start = () => void mutate(async () => {
    const result = await startVisitServiceLogbookTrip({
      tenantId, employeeId, assignmentId, clientId: props.clientId, clientName: props.clientName,
      kind, purpose, startAddress: props.startAddress, transportMode,
    });
    if (!result.started) throw new Error('Die PKW-Fahrt wurde nicht gestartet. Bitte die Fahrzeugzuordnung prüfen.');
    setEditing(false);
  });
  const finish = () => void mutate(async () => {
    const trip = await finishActiveVisitLogbookTrip({
      tenantId, employeeId, assignmentId, endAddress: destination,
      notes: 'Im Einsatzworkflow abgeschlossen.',
    });
    if (!trip) throw new Error('Keine laufende Fahrt gefunden. Bitte den Fahrtenbuchstatus erneut prüfen.');
    setDestination('');
  });

  return (
    <SectionPanel title="Fahrtenbuch" subtitle={phase === 'en_route' ? 'Anfahrt zum Einsatz' : 'PKW-Fahrten für diesen Einsatz'}>
      <Modal visible={Boolean(confirmationTrip && confirmationOpen)} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmationOpen(false); }}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Fahrt beendet · Kilometer prüfen</Text>
              <Text style={styles.copy}>{confirmationTrip?.purpose}</Text>
              {confirmationTrip?.notes ? <Text style={styles.copy}>{confirmationTrip.notes}</Text> : null}
              <PremiumInput label="Gefahrene Kilometer" value={confirmationKm} onChangeText={setConfirmationKm} keyboardType="decimal-pad" />
              {corrected ? <PremiumInput label="Korrektur kurz begründen (mindestens 3 Zeichen)" value={confirmationReason} onChangeText={setConfirmationReason} /> : null}
              {km === null ? <Text style={styles.error}>Bitte gültige Kilometer eingeben, z. B. 1,2.</Text> : null}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <Text style={styles.copy}>Vergleiche den Vorschlag mit der gefahrenen Strecke. Erst mit deiner Bestätigung ist die Fahrt abgeschlossen.</Text>
              <PremiumButton title="Kilometer bestätigen" fullWidth loading={busy} disabled={!canConfirm || loading} onPress={confirm} />
              <PremiumButton title="Zur Einsatzansicht" variant="ghost" disabled={busy} onPress={() => setConfirmationOpen(false)} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {loading ? <Text style={styles.copy}>Fahrtenbuch wird abgeglichen …</Text> : null}
      {error ? <View style={styles.stack}><InfoBanner message={error} variant="warning" /><PremiumButton title="Fahrtenbuch erneut prüfen" variant="secondary" disabled={busy || loading} onPress={() => void reload()} /></View> : null}
      {feedback ? <InfoBanner message={feedback} variant="info" /> : null}
      {otherActive ? <InfoBanner message="Es läuft noch eine PKW-Fahrt eines anderen Einsatzes. Bitte dort oder im Fahrtenbuch zuerst beenden." variant="warning" /> : null}
      {props.onOpenLogbook && (error || otherActive || (!loading && (!data?.eligibility.eligible || (phase === 'en_route' && !active)))) ? <PremiumButton title="Fahrtenbuch öffnen" variant="secondary" onPress={props.onOpenLogbook} /> : null}
      {phase !== 'completed' ? (data?.bundle.trips ?? []).filter((trip) => trip.assignmentId === resolveVisitMasterId(assignmentId) && ['completed', 'confirmed', 'corrected'].includes(trip.status)).map((trip) => (
        <PremiumButton key={trip.id} variant="secondary" title={`${trip.purpose || 'Fahrt'} · ${trip.distanceFinalKm.toFixed(2).replace('.', ',')} km bearbeiten`}
          disabled={busy || Boolean(pending)} onPress={() => {
            setCorrectionTrip(trip); setConfirmationKm(trip.distanceFinalKm.toFixed(2).replace('.', ','));
            setConfirmationReason(''); setConfirmationOpen(true);
          }} />
      )) : null}
      {pending ? <PremiumButton title="Kilometer prüfen und bestätigen" fullWidth onPress={() => setConfirmationOpen(true)} /> : null}
      {active ? (
        <View style={styles.stack}>
          <Text style={styles.title}>{phase === 'en_route' || phase === 'arrived' ? 'Anfahrt' : 'Laufende Fahrt'}</Text>
          <Text style={styles.copy}>{active.purpose}</Text>
          <Text style={styles.copy}>Beginn {new Date(active.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</Text>
          {phase === 'en_route' ? <Text style={styles.copy}>Am Ziel unten einmal „Angekommen“ antippen. Danach die Kilometer bestätigen.</Text>
            : phase === 'arrived' ? <PremiumButton title={busy ? 'Anfahrt wird abgeschlossen …' : 'Anfahrt abschließen · Kilometer prüfen'} fullWidth loading={busy} disabled={loading} onPress={() => void finishApproach()} />
              : <>
                <PremiumInput label="Erreichtes Ziel / Adresse" value={destination} onChangeText={setDestination} placeholder="z. B. Arztpraxis, Straße und Ort" />
                <PremiumButton title="Ziel erreicht · Fahrt beenden" fullWidth loading={busy} disabled={loading} onPress={finish} />
                <Text style={styles.copy}>Jede Fahrt einzeln beenden und die Kilometer bestätigen. Für das nächste Ziel anschließend eine neue Fahrt starten.</Text>
              </>}
        </View>
      ) : null}
      {!loading && !active && !pending && !otherActive && !error ? (
        !data?.eligibility.eligible ? <InfoBanner message="Für ein PKW-Fahrtenbuch muss die Verwaltung ein aktives Fahrzeug zuordnen." variant="warning" />
          : phase === 'live' ? <View style={styles.stack}>
            {!editing ? <PremiumButton title="Weitere PKW-Fahrt · Arzt, Einkauf …" variant="secondary" onPress={() => setEditing(true)} /> : <>
              <Text style={styles.copy}>Jede Hin- und Rückfahrt separat starten und am Ziel bestätigen.</Text>
              <View style={styles.actions}>
                <PremiumButton title="Mit Klient:in" variant={kind === 'with_client' ? 'primary' : 'secondary'} onPress={() => setKind('with_client')} />
                <PremiumButton title="Besorgung ohne Klient:in" variant={kind === 'client_errand' ? 'primary' : 'secondary'} onPress={() => setKind('client_errand')} />
              </View>
              <PremiumInput label="Ziel / Fahrtzweck" value={purpose} onChangeText={setPurpose} placeholder="z. B. Arztbesuch, Einkauf oder Rückfahrt zur Wohnung" />
              <PremiumButton title="Diese PKW-Fahrt starten" fullWidth loading={busy} disabled={!purpose.trim()} onPress={start} />
              <PremiumButton title="Abbrechen" variant="ghost" disabled={busy} onPress={() => setEditing(false)} />
            </>}
          </View>
            : <Text style={styles.copy}>{phase === 'arrived' ? 'Keine offene Kilometerbestätigung. Die Einsatzzeit startet mit „Einsatz starten“.' : phase === 'en_route' ? 'Keine laufende PKW-Anfahrt gefunden. Bitte die Fahrt im Fahrtenbuch prüfen.' : 'Keine offene PKW-Fahrt. Nach dem Abschluss kannst du den nächsten Einsatz oder die Heim-/Bürofahrt wählen.'}</Text>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  copy: { ...typography.caption, color: portalPremium.text.secondary },
  title: { ...typography.h3, color: portalPremium.text.primary },
  error: { ...typography.body, color: '#B4233A' },
  backdrop: { flex: 1, backgroundColor: 'rgba(2,16,34,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: 20, padding: spacing.lg, backgroundColor: '#FFFFFF' },
});
