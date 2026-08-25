import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LocationSubscription } from 'expo-location';
import { InfoBanner, PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import {
  finishEmployeeReturnTrip,
  formatReturnTripDuration,
  loadActiveEmployeeReturnTrip,
  returnTripDestinationFromTrip,
  returnTripDestinationLabel,
  startEmployeeReturnTrip,
  startEmployeeReturnTripForegroundTracking,
  type EmployeeReturnTripDestination,
} from '@/lib/portal/employeePortalReturnTrip';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { saveLogbookPromptDecision } from '@/lib/employeeLogbook';
import { portalPremium } from '@/design/tokens/portalPremium';
import { spacing, typography } from '@/theme';

type ModalMode = 'loading' | 'prompt' | 'starting' | 'tracking' | 'finishing' | 'complete' | 'error';

type EmployeePortalReturnTripModalProps = {
  visible: boolean;
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  clientId: string;
  clientName: string;
  startAddress: string;
  onClose: () => void;
};

export function EmployeePortalReturnTripModal({
  visible,
  tenantId,
  employeeId,
  assignmentId,
  clientId,
  clientName,
  startAddress,
  onClose,
}: EmployeePortalReturnTripModalProps) {
  const [mode, setMode] = useState<ModalMode>('loading');
  const [trip, setTrip] = useState<LogbookTrip | null>(null);
  const [destination, setDestination] = useState<EmployeeReturnTripDestination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedTrip, setCompletedTrip] = useState<LogbookTrip | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const webWatcherRef = useRef<LocationSubscription | null>(null);

  const stopWebWatcher = useCallback(() => {
    webWatcherRef.current?.remove();
    webWatcherRef.current = null;
  }, []);

  const attachWebWatcher = useCallback(async (activeTrip: LogbookTrip) => {
    if (Platform.OS !== 'web' || webWatcherRef.current) return;
    webWatcherRef.current = await startEmployeeReturnTripForegroundTracking({
      tripId: activeTrip.id,
      tenantId,
      employeeId,
    });
  }, [tenantId, employeeId]);

  useEffect(() => () => stopWebWatcher(), [stopWebWatcher]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setMode('loading');
    setError(null);
    setCompletedTrip(null);
    void loadActiveEmployeeReturnTrip(tenantId, employeeId)
      .then(async (active) => {
        if (cancelled) return;
        if (!active) {
          setTrip(null);
          setDestination(null);
          setMode('prompt');
          return;
        }
        const activeDestination = returnTripDestinationFromTrip(active);
        if (!activeDestination || active.assignmentId !== resolveVisitMasterId(assignmentId)) {
          setError('Es läuft bereits eine andere Fahrt. Bitte diese zuerst im Fahrtenbuch abschließen.');
          setMode('error');
          return;
        }
        const resumed = await startEmployeeReturnTrip({
          tenantId,
          employeeId,
          assignmentId,
          clientId,
          clientName,
          startAddress,
          destination: activeDestination,
        });
        if (cancelled) return;
        setTrip(resumed.trip);
        setDestination(activeDestination);
        setMode('tracking');
        await attachWebWatcher(resumed.trip);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Fahrtenbuch konnte nicht geprüft werden.');
        setMode('error');
      });
    return () => {
      cancelled = true;
    };
  }, [
    visible,
    tenantId,
    employeeId,
    assignmentId,
    clientId,
    clientName,
    startAddress,
    attachWebWatcher,
  ]);

  useEffect(() => {
    if (mode !== 'tracking') return;
    const timer = setInterval(() => setClock(new Date()), 1_000);
    return () => clearInterval(timer);
  }, [mode]);

  const start = useCallback(async (selectedDestination: EmployeeReturnTripDestination) => {
    setMode('starting');
    setError(null);
    try {
      const result = await startEmployeeReturnTrip({
        tenantId,
        employeeId,
        assignmentId,
        clientId,
        clientName,
        startAddress,
        destination: selectedDestination,
      });
      const actualDestination = returnTripDestinationFromTrip(result.trip) ?? selectedDestination;
      await saveLogbookPromptDecision({ tenantId, employeeId, assignmentId: resolveVisitMasterId(assignmentId), promptType: 'return_trip', decision: actualDestination });
      setTrip(result.trip);
      setDestination(actualDestination);
      setClock(new Date());
      setMode('tracking');
      await attachWebWatcher(result.trip);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rückfahrt konnte nicht gestartet werden.');
      setMode('error');
    }
  }, [tenantId, employeeId, assignmentId, clientId, clientName, startAddress, attachWebWatcher]);

  const finish = useCallback(async () => {
    if (!trip || !destination) return;
    setMode('finishing');
    setError(null);
    stopWebWatcher();
    try {
      const completed = await finishEmployeeReturnTrip({ trip, tenantId, employeeId, destination });
      await saveLogbookPromptDecision({ tenantId, employeeId, assignmentId: resolveVisitMasterId(assignmentId), promptType: 'return_trip', decision: 'completed' });
      setCompletedTrip(completed);
      setMode('complete');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rückfahrt konnte nicht abgeschlossen werden.');
      try {
        const resumed = await startEmployeeReturnTrip({
          tenantId,
          employeeId,
          assignmentId,
          clientId,
          clientName,
          startAddress,
          destination,
        });
        if (resumed.trip.id === trip.id) {
          await attachWebWatcher(resumed.trip);
        }
      } catch {
        // The visible retry remains available even when tracking recovery fails.
      }
      setMode('error');
    }
  }, [
    trip,
    destination,
    tenantId,
    employeeId,
    assignmentId,
    clientId,
    clientName,
    startAddress,
    stopWebWatcher,
    attachWebWatcher,
  ]);

  const canClose = mode === 'prompt' || mode === 'complete' || (mode === 'error' && !trip);
  const close = () => {
    if (!canClose) return;
    stopWebWatcher();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
      testID="employee-return-trip-modal"
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} disabled={!canClose} />
        <View style={styles.modalSurface}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={styles.icon}><Text style={styles.iconText}>⌖</Text></View>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>TAGESABSCHLUSS · FAHRTENBUCH</Text>
                <Text style={styles.title}>
                  {mode === 'tracking' || mode === 'finishing'
                    ? 'Rückfahrt wird aufgezeichnet'
                    : mode === 'complete'
                      ? 'Rückfahrt abgeschlossen'
                      : 'Wie geht es jetzt weiter?'}
                </Text>
              </View>
              <PremiumBadge
                label={mode === 'tracking' || mode === 'finishing' ? 'GPS AKTIV' : 'LETZTER EINSATZ'}
                variant={mode === 'tracking' || mode === 'finishing' ? 'green' : 'cyan'}
              />
            </View>

            {mode === 'loading' ? (
              <InfoBanner message="Fahrtenbuch und Tagesplan werden geprüft…" />
            ) : null}

            {mode === 'prompt' ? (
              <>
                <Text style={styles.lead}>
                  Das war dein letzter geplanter Einsatz heute. Soll die anschließende Fahrt per GPS im Fahrtenbuch aufgezeichnet werden?
                </Text>
                <PremiumCard style={styles.routeCard}>
                  <Text style={styles.routeLabel}>STARTPUNKT</Text>
                  <Text style={styles.routeValue}>{startAddress || clientName}</Text>
                  <Text style={styles.routeMeta}>Kilometer und Fahrtdauer werden automatisch ermittelt.</Text>
                </PremiumCard>
                <View style={styles.actions}>
                  <PremiumButton
                    title="Ja – nach Hause aufzeichnen"
                    size="lg"
                    fullWidth
                    onPress={() => void start('home')}
                    testID="employee-return-trip-home"
                  />
                  <PremiumButton
                    title="Ja – zum Büro aufzeichnen"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onPress={() => void start('office')}
                    testID="employee-return-trip-office"
                  />
                  <PremiumButton
                    title="Nein – nicht aufzeichnen"
                    variant="ghost"
                    fullWidth
                    onPress={() => {
                      void saveLogbookPromptDecision({ tenantId, employeeId, assignmentId: resolveVisitMasterId(assignmentId), promptType: 'return_trip', decision: 'declined' })
                        .finally(close);
                    }}
                    testID="employee-return-trip-decline"
                  />
                </View>
              </>
            ) : null}

            {mode === 'starting' ? (
              <InfoBanner message="Standort wird geprüft und die Rückfahrt verbindlich gestartet…" />
            ) : null}

            {(mode === 'tracking' || mode === 'finishing') && trip && destination ? (
              <>
                <View style={styles.liveCard}>
                  <Text style={styles.liveKicker}>ZIEL</Text>
                  <Text style={styles.liveDestination}>{returnTripDestinationLabel(destination)}</Text>
                  <Text style={styles.liveTime}>{formatReturnTripDuration(trip.startedAt, clock)}</Text>
                  <Text style={styles.liveMeta}>GPS-Aufzeichnung läuft seit dem Start der Rückfahrt.</Text>
                </View>
                <InfoBanner
                  variant="warning"
                  message={
                    Platform.OS === 'web'
                      ? 'CareSuite geöffnet lassen, Bildschirm nicht sperren und Standort sowie mobile Daten aktiviert lassen.'
                      : 'Die Android-Hintergrundaufzeichnung ist aktiv. Standort und mobile Daten müssen eingeschaltet bleiben.'
                  }
                />
                <PremiumButton
                  title="ANGEKOMMEN – Rückfahrt abschließen"
                  size="lg"
                  fullWidth
                  loading={mode === 'finishing'}
                  disabled={mode === 'finishing'}
                  onPress={() => void finish()}
                  testID="employee-return-trip-arrived"
                />
                <Text style={styles.lockHint}>
                  Die laufende Rückfahrt kann nicht versehentlich geschlossen werden. Erst „Angekommen“ beendet GPS und Fahrtenbuch.
                </Text>
              </>
            ) : null}

            {mode === 'complete' && completedTrip ? (
              <>
                <View style={styles.successCard}>
                  <Text style={styles.successMark}>✓</Text>
                  <Text style={styles.successTitle}>Tagesabschluss vollständig</Text>
                  <Text style={styles.successText}>
                    {completedTrip.distanceFinalKm.toFixed(2).replace('.', ',')} km wurden im Fahrtenbuch gespeichert. GPS-Aufzeichnung und Rückfahrt sind beendet.
                  </Text>
                </View>
                <PremiumButton title="Fertig" size="lg" fullWidth onPress={close} />
              </>
            ) : null}

            {mode === 'error' && error ? (
              <>
                <InfoBanner variant="warning" message={error} />
                {trip && destination ? (
                  <PremiumButton
                    title="Abschluss erneut versuchen"
                    fullWidth
                    onPress={() => void finish()}
                  />
                ) : (
                  <View style={styles.actions}>
                    <PremiumButton
                      title="Erneut prüfen"
                      fullWidth
                      onPress={() => {
                        setMode('loading');
                        setError(null);
                        void loadActiveEmployeeReturnTrip(tenantId, employeeId)
                          .then(async (active) => {
                            if (!active) setMode('prompt');
                            else {
                              const activeDestination = returnTripDestinationFromTrip(active);
                              if (!activeDestination || active.assignmentId !== resolveVisitMasterId(assignmentId)) {
                                throw new Error('Es läuft bereits eine andere Fahrt. Bitte diese zuerst im Fahrtenbuch abschließen.');
                              }
                              const resumed = await startEmployeeReturnTrip({
                                tenantId,
                                employeeId,
                                assignmentId,
                                clientId,
                                clientName,
                                startAddress,
                                destination: activeDestination,
                              });
                              setTrip(resumed.trip);
                              setDestination(activeDestination);
                              setMode('tracking');
                              void attachWebWatcher(resumed.trip);
                            }
                          })
                          .catch((cause) => {
                            setError(cause instanceof Error ? cause.message : 'Prüfung fehlgeschlagen.');
                            setMode('error');
                          });
                      }}
                    />
                    <PremiumButton title="Popup schließen" variant="ghost" fullWidth onPress={close} />
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(7, 17, 31, 0.68)',
  },
  modalSurface: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: '#F8FBFF',
    shadowColor: '#001D3D',
    shadowOpacity: 0.28,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  content: { gap: spacing.md, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#E6F3FF',
    borderWidth: 1,
    borderColor: '#A8D4FF',
  },
  iconText: { fontSize: 25, color: portalPremium.accent.blueDark },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  eyebrow: { ...typography.caption, color: portalPremium.accent.blueDark, fontWeight: '800', letterSpacing: 0.8 },
  title: { ...typography.h2, color: portalPremium.text.primary },
  lead: { ...typography.body, color: portalPremium.text.secondary, lineHeight: 24 },
  routeCard: { gap: 5, padding: spacing.md },
  routeLabel: { ...typography.caption, color: portalPremium.text.muted, fontWeight: '800' },
  routeValue: { ...typography.h3, color: portalPremium.text.primary },
  routeMeta: { ...typography.caption, color: portalPremium.text.secondary },
  actions: { gap: spacing.sm },
  liveCard: {
    alignItems: 'center',
    gap: 5,
    padding: spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#8AD9B5',
    backgroundColor: '#ECFDF5',
  },
  liveKicker: { ...typography.caption, color: '#047857', fontWeight: '900', letterSpacing: 1.1 },
  liveDestination: { ...typography.h2, color: '#064E3B' },
  liveTime: { fontSize: 38, lineHeight: 46, fontWeight: '900', color: '#065F46', fontVariant: ['tabular-nums'] },
  liveMeta: { ...typography.caption, color: '#047857', textAlign: 'center' },
  lockHint: { ...typography.caption, color: portalPremium.text.muted, textAlign: 'center' },
  successCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#8AD9B5',
  },
  successMark: { fontSize: 38, color: '#047857', fontWeight: '900' },
  successTitle: { ...typography.h2, color: '#064E3B', textAlign: 'center' },
  successText: { ...typography.body, color: '#065F46', textAlign: 'center' },
});
