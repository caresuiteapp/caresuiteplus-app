// Generated native presentation from src/components/pflege/RespiratoryCareReviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { makeRespiratoryCareReviewPacket, respiratoryCareReviewPacketIssue, type RespiratoryCareReviewOriginal, type RespiratoryCareReviewPacket } from "../../lib/pflege/respiratoryCareReview.native.ts";
import type { RespiratoryCareOriginal, RespiratoryCareSources } from "../../lib/pflege/respiratoryIntensiveCarePath.native.ts";
import { readRespiratoryCareReviewPage } from "../../lib/pflege/respiratoryCareReviewRepository.supabase.native.ts";
import { recoverRespiratoryCareReview, saveRespiratoryCareReviewDurably } from "../../lib/pflege/respiratoryCareReviewWorkflow.native.ts";
import { spacing, typography } from '@/theme';
type Props = {
    tenantId: string;
    clientId: string;
    measurementId: string;
    actorId: string;
    canView: boolean;
    canRequest: boolean;
    canReview: boolean;
    careOriginal: RespiratoryCareOriginal;
    sources: RespiratoryCareSources;
};
export function RespiratoryCareReviewPanel(props: Props) {
    const { tenantId, clientId, measurementId, actorId, canView, canRequest, canReview, careOriginal, sources } = props;
    const identity = `${tenantId}:${clientId}:${measurementId}:${actorId}:${careOriginal.headId}:${careOriginal.contentFingerprint}:${canView}:${canRequest}:${canReview}`, live = useRef(identity), alive = useRef(true), generation = useRef(0);
    live.current = identity;
    const current = () => alive.current && canView && live.current === identity;
    const [rows, setRows] = useState<RespiratoryCareReviewOriginal[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [reason, setReason] = useState(''), [requiredChange, setRequiredChange] = useState(''), [rationale, setRationale] = useState('');
    useUnsavedWebChanges(!!reason || !!requiredChange || !!rationale || uncertain, busy || uncertain);
    const remember = (o: RespiratoryCareReviewOriginal) => setRows(values => [o, ...values.filter(v => v.rootId !== o.rootId)]);
    const load = async () => { const ticket = ++generation.current; setLoaded(false); setError(null); try {
        const recovered = await recoverRespiratoryCareReview({ tenantId, clientId, measurementId, actorId }, current);
        if (!current() || ticket !== generation.current)
            return;
        if (recovered?.ok) {
            remember(recovered.data);
            setUncertain(false);
            setSuccess('Die ursprüngliche Atemfachprüfquittung wurde bestätigt.');
        }
        else if (recovered) {
            setUncertain(recovered.uncertain === true);
            setError(recovered.error);
        }
        const records = await readRespiratoryCareReviewPage({ tenantId, clientId, measurementId, actorId, isCurrent: current });
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
            setError(cause instanceof Error ? cause.message : 'Atemfachprüfbestand konnte nicht geladen werden.');
    } };
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [identity]);
    const active = rows.find(o => o.careHeadId === careOriginal.headId && o.careFingerprint === careOriginal.contentFingerprint) ?? null;
    const packet = (action: RespiratoryCareReviewPacket['action']) => ({ schemaVersion: '1' as const, action, requestId: '00000000-0000-4000-8000-000000000001', tenantId, clientId, measurementId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, careOriginal, sources, reviewOriginal: active, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' });
    const send = async (action: RespiratoryCareReviewPacket['action']) => { if (busy || uncertain || !loaded || !current() || (action === 'request' ? !canRequest : !canReview))
        return; setBusy(true); setError(null); setSuccess(null); try {
        const request = makeRespiratoryCareReviewPacket({ ...packet(action), requestId: crypto.randomUUID() });
        const result = await saveRespiratoryCareReviewDurably(request, () => current() && (action === 'request' ? canRequest : canReview));
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
        setSuccess(action === 'request' ? 'Atem-/Intensivpflegefachprüfung bestätigt angefragt.' : action === 'return' ? 'Begründete Rückgabe bestätigt gespeichert.' : 'Qualifizierte Annahme genau dieser unveränderten Atem-/Intensivpflegefassung bestätigt gespeichert.');
    }
    catch (cause) {
        if (current())
            setError(cause instanceof Error ? cause.message : 'Atem-/Intensivpflegefachprüfung konnte nicht gespeichert werden.');
    }
    finally {
        if (current())
            setBusy(false);
    } };
    const issue = (action: RespiratoryCareReviewPacket['action']) => respiratoryCareReviewPacketIssue(packet(action));
    if (!canView)
        return null;
    return <SectionPanel title="Getrennte Atem-/Intensivpflegefachprüfung" subtitle="Anfrage, Rückgabe und Annahme gehören zu genau einer unveränderten Fassung">
  <InfoBanner variant="info" message={`Prüfgrundlage: ${careOriginal.kind}, Fassung ${careOriginal.revision}, Kopf ${careOriginal.headId}. ${active?.status === 'accepted' ? 'Diese Fassung wurde qualifiziert angenommen.' : active?.status === 'returned' ? 'Diese Fassung wurde begründet zurückgegeben.' : active?.status === 'requested' ? 'Eine getrennte Entscheidung steht aus.' : 'Für diese Fassung liegt keine Fachprüfung vor.'}`}/>
  {!loaded && !error ? <LoadingState message="Vollständige Atemfachprüfhistorie und ursprüngliche Quittung werden geladen…"/> : null}
  {loaded && !uncertain ? <View style={{ gap: spacing.sm }}>
   {!active && canRequest ? <><PremiumInput label="Konkreter Anlass der Atemfachprüfung" value={reason} onChangeText={setReason} multiline/><PremiumButton title="Fachprüfung dieser Fassung anfragen" loading={busy} disabled={busy || !!issue('request')} onPress={() => send('request')}/></> : null}
   {active?.status === 'requested' && canReview ? <><PremiumInput label="Grund der Rückgabe" value={reason} onChangeText={setReason} multiline/><PremiumInput label="Erforderliche konkrete Änderung" value={requiredChange} onChangeText={setRequiredChange} multiline/><PremiumButton title="Begründete Rückgabe speichern" variant="secondary" loading={busy} disabled={busy || !!issue('return')} onPress={() => send('return')}/><PremiumInput label="Eigene fachliche Begründung der Annahme" value={rationale} onChangeText={setRationale} multiline/><PremiumButton title="Qualifizierte Annahme speichern" loading={busy} disabled={busy || !!issue('accept')} onPress={() => send('accept')}/><InfoBanner variant="info" message={issue('accept') ?? 'Aktuelle Beschäftigungs-, Qualifikations-, Dokument- und ausdrücklich freigegebene Atemprüfbereichsoriginale werden serverseitig geprüft.'}/></> : null}
   {active?.status === 'returned' ? <InfoBanner variant="warning" message="Die Rückgabe bleibt erhalten. Eine neue Atem-/Intensivpflegefassung erbt keine Annahme und benötigt eine neue Prüfanfrage."/> : null}
  </View> : null}
  {rows.filter(o => o.careRootId === careOriginal.rootId).map(o => <View key={o.rootId} style={{ gap: spacing.xs }}><Text style={typography.label}>{o.careHeadId === careOriginal.headId ? 'Aktuelle Fassung' : 'Frühere Fassung'} · {o.status === 'accepted' ? 'angenommen' : o.status === 'returned' ? 'zurückgegeben' : 'angefragt'}</Text>{o.history.map(e => <Text key={e.id} style={typography.caption}>{e.recordedAt} · {e.actorName} · {e.action === 'request' ? 'Prüfanfrage' : e.action === 'return' ? 'Rückgabe' : 'Annahme'}: {e.reason || e.rationale}{e.requiredChange ? ` · Änderung: ${e.requiredChange}` : ''}{e.qualification ? ` · Qualifikation: ${e.qualification.title} (${e.qualification.id}), Prüfbereich ${e.qualification.scopeKind}` : ''}</Text>)}</View>)}
  {error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}{uncertain ? <InfoBanner variant="warning" title="Prüfausgang ungeklärt" message="Die feste ursprüngliche Anfrage bleibt erhalten. Erneut prüfen liest ausschließlich ihre native Quittung."/> : null}
  <PremiumButton title={uncertain ? 'Ursprüngliche Prüfquittung erneut prüfen' : 'Fachprüfbestand erneut laden'} variant="secondary" disabled={busy} onPress={load}/>
 </SectionPanel>;
}
