import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

type Props = {
  tasks: EmployeePortalTaskItem[];
  documentationSubmitted: boolean;
  signatureCaptured: boolean;
  signatureDeferred?: boolean;
  signatureApprovalPending?: boolean;
  signatureConfirmationPending?: boolean;
  requiresSignature: boolean;
  serviceDurationLabel?: string;
  serviceTimeComplete?: boolean;
  loading?: boolean;
  deferredLoading?: boolean;
  canFinalizeDeferred?: boolean;
  onFinalize: () => void | Promise<void>;
  onFinalizeDeferred?: (reason: string) => void | Promise<void>;
};

export function EmployeePortalVisitCompletionPanel({ tasks, documentationSubmitted, signatureCaptured, signatureDeferred = false, signatureApprovalPending = false, signatureConfirmationPending = false, requiresSignature, serviceDurationLabel, serviceTimeComplete = Boolean(serviceDurationLabel), loading = false, deferredLoading = false, canFinalizeDeferred = false, onFinalize, onFinalizeDeferred }: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const busy = loading || deferredLoading || submitting;
  const signatureReady = !requiresSignature || (signatureCaptured && !signatureConfirmationPending);
  const ready = documentationSubmitted && serviceTimeComplete && signatureReady && !signatureDeferred && !signatureApprovalPending;
  const canForward = canFinalizeDeferred && Boolean(onFinalizeDeferred) && documentationSubmitted && serviceTimeComplete && !signatureDeferred && !signatureApprovalPending && !signatureConfirmationPending;
  const checks = [
    { label: tasks.length ? `Aufgaben · ${countDoneTasks(tasks)} von ${tasks.length} markiert (optional)` : 'Keine Aufgaben hinterlegt (optional)', done: countDoneTasks(tasks) === tasks.length, optional: true },
    { label: documentationSubmitted ? 'Dokumentation gespeichert' : 'Dokumentation noch speichern', done: documentationSubmitted },
    { label: serviceTimeComplete ? 'Tatsächlicher Einsatzbeginn und Einsatzende erfasst' : 'Tatsächlichen Einsatzbeginn und Einsatzende vervollständigen', done: serviceTimeComplete },
    { label: !requiresSignature ? 'Unterschrift nicht erforderlich' : signatureConfirmationPending ? 'Speicherung der Unterschrift noch nicht bestätigt' : signatureDeferred ? 'Unterschrift im Klient:innenportal ausstehend' : signatureApprovalPending ? 'Anfrage zur Unterschrift noch offen' : signatureCaptured ? 'Unterschrift bestätigt' : 'Unterschrift noch erforderlich', done: signatureReady },
  ];
  const submit = async (forward: boolean) => {
    if (busy || inFlight.current || (forward ? !canForward : !ready)) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (forward) await onFinalizeDeferred?.(reason.trim());
      else await onFinalize();
    } catch {
      setError('Der Abschluss konnte nicht bestätigt werden. Bitte den Einsatzstatus erneut laden; Ihre Angaben bleiben erhalten.');
    } finally { inFlight.current = false; setSubmitting(false); }
  };
  return <PremiumCard contentStyle={styles.card}>
    <Text style={styles.title}>Einsatz abschließen</Text>
    {serviceDurationLabel ? <Text style={styles.meta}>Erfasste Einsatzdauer: {serviceDurationLabel}</Text> : null}
    {checks.map(item => <View key={item.label} style={styles.row} accessibilityLabel={`${item.label}: ${item.done ? 'erfüllt' : item.optional ? 'optional' : 'offen'}`}>
      <View style={[styles.indicator, item.done && styles.complete]}><Text style={[styles.symbol, item.done && styles.check]}>{item.done ? '✓' : item.optional ? '–' : '○'}</Text></View>
      <Text style={styles.label}>{item.label}</Text>
    </View>)}
    <Text style={styles.explanation}>{ready ? 'Alle erforderlichen Angaben liegen vor. Beim bestätigten Abschluss wird der Leistungsnachweis erstellt.' : signatureDeferred || signatureApprovalPending ? 'Die Unterschrift ist noch offen. Ihr Einsatz bleibt mit den gespeicherten Angaben nachvollziehbar; eine erneute Weiterleitung ist nicht erforderlich.' : 'Ergänzen Sie die noch offenen Angaben. Ein laufender Zeitmesser ersetzt keinen gespeicherten Einsatzbeginn oder Einsatzabschluss.'}</Text>
    <PremiumButton title="Einsatz abschließen" testID="portal-finalize-button" fullWidth loading={busy} disabled={!ready || busy} onPress={() => void submit(false)} />
    {canFinalizeDeferred && onFinalizeDeferred && !signatureDeferred && !signatureApprovalPending ? <>
      <Text style={styles.sectionTitle}>Unterschrift später im Klient:innenportal</Text>
      <Text style={styles.explanation}>Wenn vor Ort keine Unterschrift möglich ist, können Sie die Anfrage nach dem Speichern der Dokumentation und der tatsächlichen Einsatzzeiten weiterleiten.</Text>
      <PremiumInput label="Hinweis zur Weiterleitung (optional)" hint="Der Hinweis wird mit der Anfrage dokumentiert." value={reason} onChangeText={setReason} editable={!busy} multiline onLightSurface placeholder="Grund für die spätere Unterschrift" />
      <PremiumButton title="Ans Klient:innenportal weiterleiten" testID="portal-finalize-deferred-button" variant="secondary" fullWidth loading={busy} disabled={!canForward || busy} onPress={() => void submit(true)} />
    </> : null}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
  </PremiumCard>;
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14, minWidth: 0 },
  title: { fontSize: font(22), lineHeight: font(28), fontWeight: '800', color: '#102D4E' },
  sectionTitle: { fontSize: font(17), lineHeight: font(23), fontWeight: '700', color: '#102D4E', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  indicator: { width: 24, height: 24, flexShrink: 0, borderRadius: 12, borderWidth: 1, borderColor: '#AAC7E5', alignItems: 'center', justifyContent: 'center' },
  complete: { backgroundColor: '#087F6D', borderColor: '#087F6D' },
  symbol: { fontSize: 15, lineHeight: 20, color: '#365672', fontWeight: '700' },
  check: { color: '#FFFFFF' },
  label: { flex: 1, minWidth: 0, fontSize: font(16), lineHeight: font(24), color: '#102D4E' },
  meta: { fontSize: font(14), lineHeight: font(20), color: '#48627C' },
  explanation: { fontSize: font(15), lineHeight: font(22), color: '#365672' },
  error: { fontSize: font(15), lineHeight: font(22), color: '#AD263F' },
});
