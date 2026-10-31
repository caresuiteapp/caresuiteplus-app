// Generated native presentation from src/components/pflege/VitalCareReviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { makeVitalCareReviewPacket, vitalCareReviewPacketIssue, type VitalCareReviewOriginal, type VitalCareReviewPacket } from "../../lib/pflege/vitalCareReview.native.ts";
import type { VitalCareOriginal, VitalCareSources } from "../../lib/pflege/vitalCarePathPacket.native.ts";
import { sameVitalWorkspaceProofWeb } from "../../lib/pflege/vitalWorkspaceReadProof.native.ts";
import { readVitalCareReviewPage } from "../../lib/pflege/vitalCareReviewRepository.supabase.native.ts";
import { recoverVitalCareReview, saveVitalCareReviewDurably } from "../../lib/pflege/vitalCareReviewWorkflow.native.ts";
import { spacing, typography } from '@/theme';
type Props = {
    tenantId: string;
    clientId: string;
    measurementId: string;
    actorId: string;
    canView: boolean;
    canRequest: boolean;
    canReview: boolean;
    careOriginal: VitalCareOriginal;
    sources: VitalCareSources;
    onChanged?: () => Promise<boolean>;
};
export function VitalCareReviewPanel(props: Props) {
    const { tenantId, clientId, measurementId, actorId, canView, canRequest, canReview, careOriginal, sources, onChanged } = props;
    const identity = `${tenantId}:${clientId}:${measurementId}:${actorId}:${careOriginal.headId}:${careOriginal.contentFingerprint}:${canView}:${canRequest}:${canReview}`, live = useRef(identity), alive = useRef(true), generation = useRef(0), liveSources = useRef(sources);
    live.current = identity;
    liveSources.current = sources;
    const current = () => alive.current && canView && live.current === identity && liveSources.current === sources;
    const [rows, setRows] = useState<VitalCareReviewOriginal[]>([]), [loaded, setLoaded] = useState(false), [loadedSources, setLoadedSources] = useState<VitalCareSources | null>(null), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [reason, setReason] = useState(''), [requiredChange, setRequiredChange] = useState(''), [rationale, setRationale] = useState('');
    useUnsavedWebChanges(!!reason || !!requiredChange || !!rationale || uncertain, busy || uncertain);
    const changed = async () => { setRows([]); setLoaded(false); setLoadedSources(null); setBusy(false); if (!onChanged) {
        setError('Die eigene Prüfquittung wurde bestätigt. Alle Vitalpfadquellen müssen vor einer weiteren Aktion neu geladen werden.');
        return;
    } const refreshed = await onChanged(); if (current() && !refreshed)
        setError('Die eigene Prüfquittung wurde bestätigt. Der gemeinsame Vitalpfadstand konnte noch nicht neu geladen werden.'); };
    const load = async () => { const ticket = ++generation.current, isCurrent = () => current() && ticket === generation.current; setLoaded(false); setLoadedSources(null); setRows([]); setError(null); try {
        const recovered = await recoverVitalCareReview({ tenantId, clientId, measurementId, actorId }, isCurrent);
        if (!isCurrent())
            return;
        if (recovered?.ok) {
            setUncertain(false);
            setSuccess('Die ursprüngliche Vitalfachprüfquittung wurde bestätigt.');
            await changed();
            return;
        }
        else if (recovered) {
            setUncertain(recovered.uncertain === true);
            setError(recovered.error);
        }
        const records = await readVitalCareReviewPage({ tenantId, clientId, measurementId, actorId, isCurrent });
        if (!isCurrent())
            return;
        if (!records.ok) {
            setError(records.error);
            return;
        }
        if (!sameVitalWorkspaceProofWeb(sources, records.data))
            throw Error('Vitalquellen und Fachprüfverlauf stammen nicht aus demselben bestätigten Stand. Alle Vitalpfadquellen neu laden.');
        setRows(records.data);
        setLoadedSources(sources);
        setLoaded(true);
    }
    catch (cause) {
        if (isCurrent())
            setError(cause instanceof Error ? cause.message : 'Vitalfachprüfbestand konnte nicht geladen werden.');
    } };
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [identity, sources]);
    const ready = loaded && loadedSources === sources && sameVitalWorkspaceProofWeb(sources, rows);
    const active = (ready ? rows : []).find(o => o.careHeadId === careOriginal.headId && o.careFingerprint === careOriginal.contentFingerprint) ?? null;
    const packet = (action: VitalCareReviewPacket['action']) => ({ schemaVersion: '1' as const, action, requestId: '00000000-0000-4000-8000-000000000001', tenantId, clientId, measurementId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, careOriginal, sources, reviewOriginal: active, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' });
    const send = async (action: VitalCareReviewPacket['action']) => { if (busy || uncertain || !ready || !current() || (action === 'request' ? !canRequest : !canReview))
        return; setBusy(true); setError(null); setSuccess(null); try {
        const request = makeVitalCareReviewPacket({ ...packet(action), requestId: crypto.randomUUID() });
        const result = await saveVitalCareReviewDurably(request, () => current() && (action === 'request' ? canRequest : canReview));
        if (!current())
            return;
        if (!result.ok) {
            setError(result.error);
            setUncertain(result.uncertain === true);
            return;
        }
        setReason('');
        setRequiredChange('');
        setRationale('');
        setSuccess(action === 'request' ? 'Vitalfachprüfung bestätigt angefragt.' : action === 'return' ? 'Begründete Rückgabe bestätigt gespeichert.' : 'Qualifizierte Annahme genau dieser unveränderten Vitalpfadfassung bestätigt gespeichert.');
        await changed();
    }
    catch (cause) {
        if (current())
            setError(cause instanceof Error ? cause.message : 'Vitalfachprüfung konnte nicht gespeichert werden.');
    }
    finally {
        if (current())
            setBusy(false);
    } };
    const issue = (action: VitalCareReviewPacket['action']) => vitalCareReviewPacketIssue(packet(action));
    if (!canView)
        return null;
    return <SectionPanel title="Getrennte Vitalfachprüfung" subtitle="Anfrage, Rückgabe und Annahme gehören zu genau einer unveränderten Fassung">
  <InfoBanner variant="info" message={`Prüfgrundlage: ${careOriginal.kind}, Fassung ${careOriginal.revision}, Kopf ${careOriginal.headId}. ${active?.status === 'accepted' ? 'Diese Fassung wurde qualifiziert angenommen.' : active?.status === 'returned' ? 'Diese Fassung wurde begründet zurückgegeben.' : active?.status === 'requested' ? 'Eine getrennte Entscheidung steht aus.' : 'Für diese Fassung liegt keine Fachprüfung vor.'}`}/>
  {!ready && !error ? <LoadingState message="Vollständige Vitalfachprüfhistorie und ursprüngliche Quittung werden geladen…"/> : null}
  {ready && !uncertain ? <View style={{ gap: spacing.sm }}>
   {!active && canRequest ? <><PremiumInput label="Konkreter Anlass der Vitalfachprüfung" value={reason} onChangeText={setReason} multiline/><PremiumButton title="Fachprüfung dieser Fassung anfragen" loading={busy} disabled={busy || !!issue('request')} onPress={() => send('request')}/></> : null}
   {active?.status === 'requested' && canReview ? <><PremiumInput label="Grund der Rückgabe" value={reason} onChangeText={setReason} multiline/><PremiumInput label="Erforderliche konkrete Änderung" value={requiredChange} onChangeText={setRequiredChange} multiline/><PremiumButton title="Begründete Rückgabe speichern" variant="secondary" loading={busy} disabled={busy || !!issue('return')} onPress={() => send('return')}/><PremiumInput label="Eigene fachliche Begründung der Annahme" value={rationale} onChangeText={setRationale} multiline/><PremiumButton title="Qualifizierte Annahme speichern" loading={busy} disabled={busy || !!issue('accept')} onPress={() => send('accept')}/><InfoBanner variant="info" message={issue('accept') ?? 'Aktuelle Beschäftigungs-, Qualifikations-, Dokument- und ausdrücklich freigegebene Vitalprüfbereichsoriginale werden serverseitig geprüft.'}/></> : null}
   {active?.status === 'returned' ? <InfoBanner variant="warning" message="Die Rückgabe bleibt erhalten. Eine neue Vitalpfadfassung erbt keine Annahme und benötigt eine neue Prüfanfrage."/> : null}
  </View> : null}
  {(ready ? rows : []).filter(o => o.careRootId === careOriginal.rootId).map(o => <View key={o.rootId} style={{ gap: spacing.xs }}><Text style={typography.label}>{o.careHeadId === careOriginal.headId ? 'Aktuelle Fassung' : 'Frühere Fassung'} · {o.status === 'accepted' ? 'angenommen' : o.status === 'returned' ? 'zurückgegeben' : 'angefragt'}</Text>{o.history.map(e => <Text key={e.id} style={typography.caption}>{e.recordedAt} · {e.actorName} · {e.action === 'request' ? 'Prüfanfrage' : e.action === 'return' ? 'Rückgabe' : 'Annahme'}: {e.reason || e.rationale}{e.requiredChange ? ` · Änderung: ${e.requiredChange}` : ''}{e.qualification ? ` · Qualifikation: ${e.qualification.title} (${e.qualification.id}), Prüfbereich ${e.qualification.scopeKind}` : ''}</Text>)}</View>)}
  {error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}{uncertain ? <InfoBanner variant="warning" title="Prüfausgang ungeklärt" message="Die feste ursprüngliche Anfrage bleibt erhalten. Erneut prüfen liest ausschließlich ihre native Quittung."/> : null}
  <PremiumButton title={uncertain ? 'Ursprüngliche Prüfquittung erneut prüfen' : 'Fachprüfbestand erneut laden'} variant="secondary" disabled={busy} onPress={load}/>
 </SectionPanel>;
}
