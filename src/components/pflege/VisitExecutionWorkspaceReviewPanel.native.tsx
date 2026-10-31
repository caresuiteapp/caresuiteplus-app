// Generated native presentation from src/components/pflege/VisitExecutionWorkspaceReviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { makeVisitExecutionReviewPacket, visitExecutionReviewPacketIssue, type VisitExecutionReviewOriginal, type VisitExecutionReviewPacket, type VisitExecutionReviewSource } from "../../lib/pflege/visitExecutionWorkspaceReview.native.ts";
import { readVisitExecutionReviewPage } from "../../lib/pflege/visitExecutionWorkspaceReviewRepository.supabase.native.ts";
import { recoverVisitExecutionReview, saveVisitExecutionReviewDurably } from "../../lib/pflege/visitExecutionWorkspaceReviewWorkflow.native.ts";
import { spacing, typography } from '@/theme';
type Props = {
    tenantId: string;
    stopId: string;
    actorId: string;
    canView: boolean;
    canRequest: boolean;
    canReview: boolean;
    visitOriginal: VisitExecutionReviewSource;
};
export function VisitExecutionWorkspaceReviewPanel(props: Props) {
    const { tenantId, stopId, actorId, canView, canRequest, canReview, visitOriginal } = props, head = visitOriginal.history.headId!;
    const identity = `${tenantId}:${stopId}:${actorId}:${head}:${canView}:${canRequest}:${canReview}`, live = useRef(identity), alive = useRef(true), generation = useRef(0);
    live.current = identity;
    const current = () => alive.current && canView && live.current === identity;
    const [rows, setRows] = useState<VisitExecutionReviewOriginal[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [reason, setReason] = useState(''), [requiredChange, setRequiredChange] = useState(''), [rationale, setRationale] = useState('');
    useUnsavedWebChanges(!!reason || !!requiredChange || !!rationale || uncertain, busy || uncertain);
    const remember = (o: VisitExecutionReviewOriginal) => setRows(values => [o, ...values.filter(v => v.rootId !== o.rootId)]);
    const load = async () => { const ticket = ++generation.current; setLoaded(false); setError(null); try {
        const result = await recoverVisitExecutionReview({ tenantId, stopId, actorId }, current);
        if (!current() || ticket !== generation.current)
            return;
        if (result?.ok) {
            setUncertain(false);
            setSuccess('Die ursprüngliche Einsatzprüfquittung wurde bestätigt.');
        }
        else if (result) {
            setUncertain(result.uncertain === true);
            setError(result.error);
        }
        const records = await readVisitExecutionReviewPage({ tenantId, stopId, actorId, isCurrent: current });
        if (!current() || ticket !== generation.current)
            return;
        if (!records.ok) {
            setError(records.error);
            return;
        }
        setRows(records.data);
        setLoaded(true);
    }
    catch (cause) {
        if (current())
            setError(cause instanceof Error ? cause.message : 'Einsatzprüfbestand konnte nicht geladen werden.');
    } };
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [identity]);
    const active = rows.find(o => o.visitHeadId === head) ?? null;
    const send = async (action: VisitExecutionReviewPacket['action']) => { if (busy || uncertain || !loaded || !current() || (action === 'request' ? !canRequest : !canReview))
        return; setBusy(true); setError(null); setSuccess(null); try {
        const packet = makeVisitExecutionReviewPacket({ action, requestId: crypto.randomUUID(), tenantId, stopId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, visitOriginal: structuredClone(visitOriginal), reviewOriginal: active ? structuredClone(active) : null, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' }), result = await saveVisitExecutionReviewDurably(packet, () => current() && (action === 'request' ? canRequest : canReview));
        if (!current())
            return;
        if (!result.ok) {
            setError(result.error);
            setUncertain(result.uncertain === true);
            return;
        }
        remember(result.data);
        setReason('');
        setRequiredChange('');
        setRationale('');
        setSuccess(action === 'request' ? 'Prüfanfrage bestätigt gespeichert.' : action === 'return' ? 'Begründete Rückgabe bestätigt gespeichert.' : 'Qualifizierte Annahme dieser unveränderten Einsatzfassung bestätigt gespeichert.');
    }
    catch (cause) {
        if (current())
            setError(cause instanceof Error ? cause.message : 'Einsatzfachprüfung konnte nicht gespeichert werden.');
    }
    finally {
        if (current())
            setBusy(false);
    } };
    const candidate = (action: VisitExecutionReviewPacket['action']) => visitExecutionReviewPacketIssue({ schemaVersion: '1', action, requestId: '00000000-0000-4000-8000-000000000001', tenantId, stopId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, visitOriginal, reviewOriginal: active, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' });
    if (!canView)
        return null;
    return <SectionPanel title="Getrennte Einsatzfachprüfung" subtitle="Jede Entscheidung gehört zu genau einem unveränderten vollständigen Einsatzkopf"><InfoBanner variant="info" message={`Geprüfte Grundlage: ${visitOriginal.history.count} Originalereignisse, Kopf ${head}. ${active?.status === 'accepted' ? 'Diese Fassung wurde fachlich angenommen.' : active?.status === 'returned' ? 'Diese Fassung wurde zur begründeten Fortschreibung zurückgegeben.' : active?.status === 'requested' ? 'Eine getrennte Prüfentscheidung steht aus.' : 'Für diese Fassung liegt keine Prüfung vor.'}`}/>{!loaded && !error ? <LoadingState message="Prüfhistorie und ursprüngliche Quittung werden geladen…"/> : null}{loaded && !uncertain ? <View style={{ gap: spacing.sm }}>{!active && canRequest ? <><PremiumInput label="Konkreter Anlass der Fachprüfung" value={reason} onChangeText={setReason} multiline/><PremiumButton title="Fachprüfung dieser Fassung anfragen" loading={busy} disabled={busy || !!candidate('request')} onPress={() => send('request')}/></> : null}{active?.status === 'requested' && canReview ? <><PremiumInput label="Grund der Rückgabe" value={reason} onChangeText={setReason} multiline/><PremiumInput label="Erforderliche konkrete Änderung" value={requiredChange} onChangeText={setRequiredChange} multiline/><PremiumButton title="Begründete Rückgabe speichern" variant="secondary" loading={busy} disabled={busy || !!candidate('return')} onPress={() => send('return')}/><PremiumInput label="Eigene fachliche Begründung der Annahme" value={rationale} onChangeText={setRationale} multiline/><PremiumButton title="Qualifizierte Annahme speichern" loading={busy} disabled={busy || !!candidate('accept')} onPress={() => send('accept')}/><InfoBanner variant="info" message={candidate('accept') ?? 'Beschäftigung, Qualifikation, Dokument, Einsatzprüfbereich und Vier-Augen-Trennung werden serverseitig gegen aktuelle Originale geprüft.'}/></> : null}{active?.status === 'returned' ? <InfoBanner variant="warning" message="Die Rückgabe bleibt erhalten. Einsatzvorgänge mit einem neuen Original fortschreiben und den neuen Kopf gesondert prüfen lassen."/> : null}</View> : null}{rows.map(o => <View key={o.rootId} style={{ gap: spacing.xs }}><Text style={typography.label}>{o.visitHeadId === head ? 'Aktueller Einsatzkopf' : 'Früherer Einsatzkopf'} · {o.status === 'accepted' ? 'angenommen' : o.status === 'returned' ? 'zurückgegeben' : 'angefragt'}</Text>{o.history.map(e => <Text key={e.id} style={typography.caption}>{e.recordedAt} · {e.actorName} · {e.action === 'request' ? 'Prüfanfrage' : e.action === 'return' ? 'Rückgabe' : 'Annahme'}: {e.reason || e.rationale}{e.requiredChange ? ` · Änderung: ${e.requiredChange}` : ''}{e.qualification ? ` · Qualifikation: ${e.qualification.title} (${e.qualification.id}), Prüfbereich ${e.qualification.scopeKind}` : ''}</Text>)}</View>)}{error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}{uncertain ? <InfoBanner variant="warning" title="Prüfausgang ungeklärt" message="Die ursprüngliche Anfrage bleibt erhalten. Erneut prüfen liest ausschließlich ihre Quittung."/> : null}<PremiumButton title={uncertain ? 'Ursprüngliche Prüfquittung erneut prüfen' : 'Fachprüfbestand erneut laden'} variant="secondary" disabled={busy} onPress={load}/></SectionPanel>;
}
