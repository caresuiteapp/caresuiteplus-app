// Generated native presentation from src/screens/pflege/PflegeProofWorkflowScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareSignatureModal } from "../../components/inputs/CareSignatureModal.native.tsx";
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import { fetchPflegeServiceProofs, advancePflegeServiceProof } from '@/lib/pflege/careBillingLiveService';
import { fetchPflegeProofSignature } from '@/lib/pflege/careTourPlanningService';
import { captureCareProofClientConfirmation, fetchCareProofClientConfirmationState, newCareProofClientConfirmationRequestId } from '@/lib/pflege/careProofClientConfirmationService';
import type { CareProofClientConfirmationInput, CareProofSignerKind } from '@/lib/pflege/careProofClientConfirmationDomain';
import { correctCareProof, fetchCareProofCorrectionState, newCareProofCorrectionRequestId } from '@/lib/pflege/careProofCorrectionService';
import type { CareProofCorrectionInput } from '@/lib/pflege/careProofCorrectionDomain';
import { formatDate, formatTime } from '@/lib/formatters/dateTimeFormatters';
import { downloadCareProofPdf } from '@/lib/pflege/careProofPdfService';
const labels: Record<string, string> = { draft: 'Entwurf', submitted: 'Eingereicht', signed: 'Unterschrieben', approved: 'Freigegeben', rejected: 'Zurückgewiesen', cancelled: 'Storniert' };
export function PflegeProofWorkflowScreen() { const { id = '' } = useLocalSearchParams<{
    id?: string;
}>(), tenantId = useServiceTenantId(), { profile } = useAuth(); return <PflegeProofWorkflow key={`${tenantId}:${profile?.id}:${id}`} id={id}/>; }
function PflegeProofWorkflow({ id }: {
    id: string;
}) {
    const tenantId = useServiceTenantId(), { profile } = useAuth(), { c } = useCareLightPalette(), router = useRouter();
    const query = useAsyncQuery(() => tenantId ? fetchPflegeServiceProofs(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey, id], { enabled: !!tenantId, queryKey: `${tenantId}:${profile?.id}:${id}` });
    const proof = query.data?.find(p => p.id === id);
    const confirmation = useAsyncQuery(() => tenantId ? fetchCareProofClientConfirmationState(tenantId, profile?.roleKey, id) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey, id, proof?.status], { enabled: !!tenantId && !!proof, queryKey: `${tenantId}:${profile?.id}:${id}:confirmation` });
    const correction = useAsyncQuery(() => tenantId ? fetchCareProofCorrectionState(tenantId, profile?.roleKey, id) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey, id, proof?.status], { enabled: !!tenantId && !!proof, queryKey: `${tenantId}:${profile?.id}:${id}:correction` });
    const signature = useAsyncQuery(() => tenantId ? fetchPflegeProofSignature(tenantId, id, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey, id, proof?.status], { enabled: !!tenantId && ['signed', 'approved', 'rejected'].includes(proof?.status ?? ''), queryKey: `${tenantId}:${profile?.id}:${id}:signature` });
    const [signerKind, setSignerKind] = useState<CareProofSignerKind>('client'), [signer, setSigner] = useState(''), [representation, setRepresentation] = useState(''), [signatureOpen, setSignatureOpen] = useState(false), [reason, setReason] = useState(''), [correctionReason, setCorrectionReason] = useState(''), [correctedNote, setCorrectedNote] = useState(''), [correctedDeviation, setCorrectedDeviation] = useState(''), [correctionTouched, setCorrectionTouched] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [retryPending, setRetryPending] = useState(false), [correctionRetryPending, setCorrectionRetryPending] = useState(false);
    const lock = useRef(false), pending = useRef<CareProofClientConfirmationInput | null>(null), pendingCorrection = useRef<CareProofCorrectionInput | null>(null);
    useEffect(() => { if (correction.data && !correctionTouched) {
        setCorrectedNote(correction.data.performanceNote);
        setCorrectedDeviation(correction.data.deviations);
    } }, [correction.data, correctionTouched]);
    async function execute(action: 'submit' | 'approve' | 'reject') { if (!tenantId || lock.current)
        return; lock.current = true; setBusy(true); setError(null); setSuccess(null); try {
        const result = await advancePflegeServiceProof(tenantId, profile?.roleKey, id, action, { reason });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setSuccess('Prüfentscheidung und Verlauf gespeichert.');
        await query.refresh();
    }
    catch {
        setError('Verbindung unterbrochen. Bitte den Nachweis erneut laden.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    async function confirmSignature(dataUrl: string) { if (!tenantId || lock.current || !confirmation.data?.proofUpdatedAt)
        return; lock.current = true; setBusy(true); setError(null); setSuccess(null); pending.current ??= { proofId: id, expectedProofUpdatedAt: confirmation.data.proofUpdatedAt, signerKind, signerName: signer, representationBasis: signerKind === 'representative' ? representation : '', pngDataUrl: dataUrl, requestId: newCareProofClientConfirmationRequestId() }; setRetryPending(true); try {
        const result = await captureCareProofClientConfirmation(tenantId, profile?.roleKey, pending.current);
        if (!result.ok) {
            const uncertain = result.error.includes('Verbindung unterbrochen');
            if (!uncertain) {
                pending.current = null;
                setRetryPending(false);
            }
            setError(result.error);
            throw new Error(result.error);
        }
        pending.current = null;
        setRetryPending(false);
        setSignatureOpen(false);
        setSuccess('Diese unveränderte Leistungsnachweisfassung wurde bestätigt.');
        await Promise.all([query.refresh(), confirmation.refresh(), signature.refresh()]);
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    async function submitCorrection() { if (!tenantId || lock.current || !correction.data)
        return; lock.current = true; setBusy(true); setError(null); setSuccess(null); pendingCorrection.current ??= { proofId: id, expectedProofUpdatedAt: correction.data.proofUpdatedAt, reason: correctionReason, performanceNote: correctedNote, deviations: correctedDeviation, requestId: newCareProofCorrectionRequestId() }; setCorrectionRetryPending(true); try {
        const result = await correctCareProof(tenantId, profile?.roleKey, pendingCorrection.current, { performanceNote: correction.data.performanceNote, deviations: correction.data.deviations });
        if (!result.ok) {
            const uncertain = result.error.includes('Verbindung unterbrochen');
            if (!uncertain) {
                pendingCorrection.current = null;
                setCorrectionRetryPending(false);
            }
            setError(result.error);
            return;
        }
        pendingCorrection.current = null;
        setCorrectionRetryPending(false);
        setSuccess('Original und Korrektur wurden getrennt gespeichert. Die neue Fassung muss erneut bestätigt und freigegeben werden.');
        router.replace(`/pflege/leistungsnachweis-workflow?id=${result.data.replacementProofId}` as never);
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    if (query.loading && !proof)
        return <ScreenShell title="Leistungsnachweis"><LoadingState message="Nachweis wird geladen…"/></ScreenShell>;
    if (!proof)
        return <ScreenShell title="Leistungsnachweis"><ErrorState message={query.error ?? 'Nachweis nicht gefunden.'} onRetry={query.refresh}/></ScreenShell>;
    const unsigned = proof.status === 'draft' || proof.status === 'submitted', record = confirmation.data?.confirmation;
    return <ScreenShell title="Leistungsnachweis" subtitle={`${proof.clientName} · ${labels[proof.status] ?? proof.status}`}><View style={styles.stack}>
  <PremiumButton title="Leistungsnachweis als PDF herunterladen" variant="secondary" disabled={busy || signature.loading || (['signed', 'approved'].includes(proof.status) && !signature.data)} onPress={() => { if (lock.current)
        return; lock.current = true; setBusy(true); setError(null); void downloadCareProofPdf(proof, signature.data ?? null).catch((err: unknown) => setError(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.')).finally(() => { lock.current = false; setBusy(false); }); }}/>
  <SectionPanel title={proof.serviceLabel}><Text style={{ color: c.text }}>{formatDate(proof.serviceDate)} · {formatTime(proof.startedAt)}–{formatTime(proof.endedAt)} · {proof.durationMinutes} Minuten</Text><Text style={{ color: c.text }}>{proof.serviceCode} · {proof.legalBasis.toUpperCase().replace('_', ' ')} · {(proof.grossAmountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text><Text style={{ color: c.text }}>{proof.performanceNote}</Text><Text style={{ color: c.muted }}>Kostenträger: {proof.costCarrierName || 'Privat'} · Erfasst von: {proof.employeeName}</Text>{proof.rejectionReason ? <ErrorState message={proof.rejectionReason}/> : null}</SectionPanel>
  {record ? <SectionPanel title="Versionsgebundene Bestätigung"><Text style={{ color: c.text }}>{record.signerKind === 'client' ? 'Klient:in selbst' : 'Vertretende Person'}: {record.signerName}</Text>{record.representationBasis ? <Text style={{ color: c.text }}>Vertretungsgrundlage: {record.representationBasis}</Text> : null}<Text style={{ color: c.muted }}>Bestätigt am {formatDate(record.confirmedAt)} um {formatTime(record.confirmedAt)} · genau ein Nachweis · Inhalt {record.proofContentHash.slice(0, 12)}</Text></SectionPanel> : null}
  {correction.data?.existingCorrection ? <SectionPanel title="Durch Korrektur ersetzt"><Text style={{ color: c.text }}>Grund: {correction.data.existingCorrection.reason}</Text><Text style={{ color: c.muted }}>Original, Bestätigung und damaliger Abrechnungsstand bleiben unverändert erhalten. Nur die neue Fassung kann erneut bestätigt und abgerechnet werden.</Text><PremiumButton title="Neue Fassung öffnen" variant="secondary" onPress={() => router.push(`/pflege/leistungsnachweis-workflow?id=${correction.data?.existingCorrection?.replacementProofId}` as never)}/></SectionPanel> : null}
  {signature.data ? <SectionPanel title="Erfasste Unterschrift"><Image accessibilityLabel={`Unterschrift von ${signature.data.signerName}`} source={{ uri: signature.data.dataUrl }} style={styles.signature} resizeMode="contain"/><Text style={{ color: c.muted }}>{signature.data.signerName} · {formatDate(signature.data.capturedAt)} · {formatTime(signature.data.capturedAt)}</Text></SectionPanel> : null}
  {!record && signature.data ? <ErrorState message="Für diese ältere Unterschrift liegt kein versionsgebundener Inhaltsnachweis vor. Daraus folgt keine Bestätigung anderer oder später geänderter Positionen."/> : null}
  {confirmation.error ? <ErrorState message={confirmation.error} onRetry={confirmation.refresh}/> : null}{correction.error ? <ErrorState message={correction.error} onRetry={correction.refresh}/> : null}{signature.error ? <ErrorState message={signature.error} onRetry={signature.refresh}/> : null}{query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh}/> : null}{error ? <ErrorState message={error}/> : null}{success ? <Text accessibilityRole="alert" style={{ color: c.text }}>{success}</Text> : null}
  {proof.status === 'draft' && hasPermission(profile?.roleKey, 'pflege.proofs.create') ? <PremiumButton title="Zur Prüfung einreichen" loading={busy} disabled={busy} onPress={() => void execute('submit')}/> : null}
  {unsigned && !record && hasPermission(profile?.roleKey, 'pflege.proofs.sign') ? <SectionPanel title="Konkrete Nachweisfassung bestätigen"><Text style={{ color: c.muted }}>Die Bestätigung gilt nur für diese angezeigte Leistungsposition und deren unveränderte Fassung. Andere Positionen müssen einzeln bestätigt werden.</Text><View style={styles.actions}><PremiumButton title="Klient:in selbst" variant={signerKind === 'client' ? 'primary' : 'secondary'} disabled={busy || retryPending} onPress={() => { setSignerKind('client'); setRepresentation(''); }}/><PremiumButton title="Vertretende Person" variant={signerKind === 'representative' ? 'primary' : 'secondary'} disabled={busy || retryPending} onPress={() => setSignerKind('representative')}/></View><PremiumInput label="Name der bestätigenden Person" value={signer} onChangeText={setSigner} editable={!busy && !retryPending}/>{signerKind === 'representative' ? <PremiumInput label="Vertretungsgrundlage und Umfang" value={representation} onChangeText={setRepresentation} multiline editable={!busy && !retryPending}/> : null}{retryPending ? <Text accessibilityRole="alert" style={{ color: c.muted }}>Übertragung unklar. Die unveränderte Anfrage bleibt für einen identischen Wiederholungsversuch gesperrt.</Text> : null}<PremiumButton title={retryPending ? 'Dieselbe Bestätigung erneut senden' : 'Unterschrift im Vollbild erfassen'} disabled={busy || confirmation.loading || !confirmation.data?.proofUpdatedAt || signer.trim().length < 2 || (signerKind === 'representative' && representation.trim().length < 3)} onPress={() => retryPending && pending.current ? void confirmSignature(pending.current.pngDataUrl) : setSignatureOpen(true)}/></SectionPanel> : null}
  {proof.status === 'signed' && hasPermission(profile?.roleKey, 'pflege.proofs.review') ? <SectionPanel title="Fachliche Prüfung durch zweite Person"><Text style={{ color: c.muted }}>Leistung, Zeiten, Kostenträger, Verordnungsbezug und bestätigte Fassung vor der Freigabe prüfen. Eigene Nachweise dürfen nicht selbst freigegeben werden.</Text><PremiumInput label="Begründung bei Zurückweisung" value={reason} onChangeText={setReason} multiline/><View style={styles.actions}><PremiumButton title="Nachweis freigeben" loading={busy} disabled={busy} onPress={() => void execute('approve')}/><PremiumButton title="Begründet zurückweisen" variant="secondary" disabled={busy || !reason.trim()} onPress={() => void execute('reject')}/></View></SectionPanel> : null}
  {correction.data && !correction.data.existingCorrection && correction.data.status !== 'cancelled' && hasPermission(profile?.roleKey, 'pflege.proofs.review') ? <SectionPanel title="Neue Korrekturfassung anlegen"><Text style={{ color: c.muted }}>Das Original, seine Unterschrift und sein damaliger Abrechnungsstand bleiben erhalten. Die neue Fassung startet unbestätigt als Entwurf; eine bereits in eine Rechnungsgrundlage übernommene Fassung kann hier nicht korrigiert werden.</Text><Text style={{ color: c.muted }}>Aktueller Abrechnungsstatus: {correction.data.billingStatus}</Text><PremiumInput label="Konkreter Korrekturgrund *" value={correctionReason} onChangeText={value => { setCorrectionReason(value); setCorrectionTouched(true); }} multiline editable={!busy && !correctionRetryPending}/><PremiumInput label="Korrigierter Durchführungsnachweis *" value={correctedNote} onChangeText={value => { setCorrectedNote(value); setCorrectionTouched(true); }} multiline editable={!busy && !correctionRetryPending}/><PremiumInput label="Korrigierte Abweichungen / Besonderheiten" value={correctedDeviation} onChangeText={value => { setCorrectedDeviation(value); setCorrectionTouched(true); }} multiline editable={!busy && !correctionRetryPending}/>{correctionRetryPending ? <Text accessibilityRole="alert" style={{ color: c.muted }}>Übertragung unklar. Die unveränderte Korrekturanfrage bleibt für denselben Wiederholungsversuch gesperrt.</Text> : null}<PremiumButton title={correctionRetryPending ? 'Dieselbe Korrektur erneut senden' : 'Korrekturfassung verbindlich anlegen'} disabled={busy || correction.loading || correctionReason.trim().length < 10 || correctedNote.trim().length < 5} onPress={() => void submitCorrection()}/></SectionPanel> : null}
  {proof.status === 'approved' && hasPermission(profile?.roleKey, 'pflege.billing.view') ? <PremiumButton title="Abrechnungsfreigabe öffnen" onPress={() => router.push('/pflege/abrechnung' as never)}/> : null}<PremiumButton title="Zur Nachweisliste" variant="secondary" onPress={() => router.replace('/pflege/leistungsnachweise' as never)}/>
 </View><CareSignatureModal visible={signatureOpen} forceFullscreen label={`${proof.clientName} · ${proof.serviceLabel} · ${formatDate(proof.serviceDate)}`} dismissScope={`pflege-proof-${id}`} disabled={busy} onConfirm={confirmSignature} onClose={() => setSignatureOpen(false)}/></ScreenShell>;
}
const styles = StyleSheet.create({ signature: { width: '100%', height: 150, backgroundColor: '#fff', borderRadius: 12 }, stack: { gap: 16, paddingBottom: 32 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
