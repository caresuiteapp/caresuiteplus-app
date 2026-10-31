// Generated native presentation from src/components/office/ClientFinancingWorkspaceReviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { makeClientFinancingReviewPacket, clientFinancingReviewPacketIssue, type ClientFinancingReviewOriginal, type ClientFinancingReviewPacket, type ClientFinancingReviewSource } from "../../lib/clients/clientFinancingWorkspaceReview.native.ts";
import { readClientFinancingReviewPage } from "../../lib/clients/clientFinancingWorkspaceReviewRepository.supabase.native.ts";
import { recoverClientFinancingReview, saveClientFinancingReviewDurably } from "../../lib/clients/clientFinancingWorkspaceReviewWorkflow.native.ts";
import { spacing, typography } from '@/theme';
type Props = {
    tenantId: string;
    clientId: string;
    actorId: string;
    canView: boolean;
    canRequest: boolean;
    canReview: boolean;
    financingOriginal: ClientFinancingReviewSource;
};
export function ClientFinancingWorkspaceReviewPanel(props: Props) {
    const { tenantId, clientId, actorId, canView, canRequest, canReview, financingOriginal } = props, head = financingOriginal.history.headId!;
    const identity = `${tenantId}:${clientId}:${actorId}:${head}:${canView}:${canRequest}:${canReview}`, live = useRef(identity), alive = useRef(true), generation = useRef(0);
    live.current = identity;
    const current = () => alive.current && canView && live.current === identity;
    const [rows, setRows] = useState<ClientFinancingReviewOriginal[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [reason, setReason] = useState(''), [requiredChange, setRequiredChange] = useState(''), [rationale, setRationale] = useState('');
    useUnsavedWebChanges(!!reason || !!requiredChange || !!rationale || uncertain, busy || uncertain);
    const remember = (o: ClientFinancingReviewOriginal) => setRows(values => [o, ...values.filter(v => v.rootId !== o.rootId)]);
    const load = async () => { const ticket = ++generation.current; setLoaded(false); setError(null); try {
        const result = await recoverClientFinancingReview({ tenantId, clientId, actorId }, current);
        if (!current() || ticket !== generation.current)
            return;
        if (result?.ok) {
            setUncertain(false);
            setSuccess('Die ursprüngliche Vertrags- und Finanzierungsprüfquittung wurde bestätigt.');
        }
        else if (result) {
            setUncertain(result.uncertain === true);
            setError(result.error);
        }
        const records = await readClientFinancingReviewPage({ tenantId, clientId, actorId, isCurrent: current });
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
            setError(cause instanceof Error ? cause.message : 'Vertrags- und Finanzierungsprüfbestand konnte nicht geladen werden.');
    } };
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [identity]);
    const active = rows.find(o => o.financingHeadId === head) ?? null;
    const send = async (action: ClientFinancingReviewPacket['action']) => { if (busy || uncertain || !loaded || !current() || (action === 'request' ? !canRequest : !canReview))
        return; setBusy(true); setError(null); setSuccess(null); try {
        const packet = makeClientFinancingReviewPacket({ action, requestId: crypto.randomUUID(), tenantId, clientId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, financingOriginal: structuredClone(financingOriginal), reviewOriginal: active ? structuredClone(active) : null, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' }), result = await saveClientFinancingReviewDurably(packet, () => current() && (action === 'request' ? canRequest : canReview));
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
        setSuccess(action === 'request' ? 'Prüfanfrage bestätigt gespeichert.' : action === 'return' ? 'Begründete Rückgabe bestätigt gespeichert.' : 'Qualifizierte Annahme dieser unveränderten Vertrags- und Finanzierungsfassung bestätigt gespeichert.');
    }
    catch (cause) {
        if (current())
            setError(cause instanceof Error ? cause.message : 'Vertrags- und Finanzierungsfachprüfung konnte nicht gespeichert werden.');
    }
    finally {
        if (current())
            setBusy(false);
    } };
    const candidate = (action: ClientFinancingReviewPacket['action']) => clientFinancingReviewPacketIssue({ schemaVersion: '1', action, requestId: '00000000-0000-4000-8000-000000000001', tenantId, clientId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, financingOriginal, reviewOriginal: active, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' });
    if (!canView)
        return null;
    return <SectionPanel title="Getrennte Vertrags- und Finanzierungsfachprüfung" subtitle="Jede Entscheidung gehört zu genau einem unveränderten vollständigen Vertrags- und Finanzierungskopf"><InfoBanner variant="info" message={`Geprüfte Grundlage: ${financingOriginal.history.count} Originalereignisse, Kopf ${head}, Art ${financingOriginal.history.events.at(-1)!.command.kind}. ${active?.status === 'accepted' ? 'Diese Fassung wurde fachlich angenommen.' : active?.status === 'returned' ? 'Diese Fassung wurde zur begründeten Fortschreibung zurückgegeben.' : active?.status === 'requested' ? 'Eine getrennte Prüfentscheidung steht aus.' : 'Für diese Fassung liegt keine Prüfung vor.'}`}/><InfoBanner variant="info" message="Eine fachliche Annahme bestätigt weder Vertragswirksamkeit noch Finanzierung, Genehmigung, Budget, Bestellung, tatsächliche Lieferung oder Pflegeleistung, Kommunikation oder Abrechnung."/>{!loaded && !error ? <LoadingState message="Prüfhistorie und ursprüngliche Quittung werden geladen…"/> : null}{loaded && !uncertain ? <View style={{ gap: spacing.sm }}>{!active && canRequest ? <><PremiumInput label="Konkreter Anlass der Fachprüfung" value={reason} onChangeText={setReason} multiline/><PremiumButton title="Fachprüfung dieser Fassung anfragen" loading={busy} disabled={busy || !!candidate('request')} onPress={() => send('request')}/></> : null}{active?.status === 'requested' && canReview ? <><PremiumInput label="Grund der Rückgabe" value={reason} onChangeText={setReason} multiline/><PremiumInput label="Erforderliche konkrete Änderung" value={requiredChange} onChangeText={setRequiredChange} multiline/><PremiumButton title="Begründete Rückgabe speichern" variant="secondary" loading={busy} disabled={busy || !!candidate('return')} onPress={() => send('return')}/><PremiumInput label="Eigene fachliche Begründung der Annahme" value={rationale} onChangeText={setRationale} multiline/><PremiumButton title="Qualifizierte Annahme speichern" loading={busy} disabled={busy || !!candidate('accept')} onPress={() => send('accept')}/><InfoBanner variant="info" message={candidate('accept') ?? 'Beschäftigung, Qualifikation, Dokument, Vertrags- und Finanzierungsprüfbereich und Vier-Augen-Trennung werden serverseitig gegen aktuelle Originale geprüft.'}/></> : null}{active?.status === 'returned' ? <InfoBanner variant="warning" message="Die Rückgabe bleibt erhalten. Vertrags- und Finanzierungsvorgänge mit einem neuen Original fortschreiben und den neuen Kopf gesondert prüfen lassen."/> : null}</View> : null}{rows.map(o => <View key={o.rootId} style={{ gap: spacing.xs }}><Text style={typography.label}>{o.financingHeadId === head ? 'Aktueller Vertrags-/Finanzierungskopf' : 'Früherer Vertrags-/Finanzierungskopf'} · {o.financingKind} · {o.status === 'accepted' ? 'angenommen' : o.status === 'returned' ? 'zurückgegeben' : 'angefragt'}</Text>{o.history.map(e => <Text key={e.id} style={typography.caption}>{e.recordedAt} · {e.actorName} · {e.action === 'request' ? 'Prüfanfrage' : e.action === 'return' ? 'Rückgabe' : 'Annahme'}: {e.reason || e.rationale}{e.requiredChange ? ` · Änderung: ${e.requiredChange}` : ''}{e.qualification ? ` · Qualifikation: ${e.qualification.title} (${e.qualification.id}), Prüfbereich ${e.qualification.scopeKind}` : ''}</Text>)}</View>)}{error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}{uncertain ? <InfoBanner variant="warning" title="Prüfausgang ungeklärt" message="Die ursprüngliche Anfrage bleibt erhalten. Erneut prüfen liest ausschließlich ihre Quittung."/> : null}<PremiumButton title={uncertain ? 'Ursprüngliche Prüfquittung erneut prüfen' : 'Fachprüfbestand erneut laden'} variant="secondary" disabled={busy} onPress={load}/></SectionPanel>;
}
