// Generated native presentation from src/components/pflege/NutritionReviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { makeNutritionReviewPacket, nutritionReviewPacketIssue, type NutritionEliminationOriginal, type NutritionReviewOriginal, type NutritionReviewPacket } from "../../lib/pflege/nutritionEliminationPacket.native.ts";
import { readNutritionReviewPage } from "../../lib/pflege/nutritionEliminationRepository.supabase.native.ts";
import { recoverNutritionReview, saveNutritionReviewDurably } from "../../lib/pflege/nutritionEliminationWorkflow.native.ts";
import { spacing, typography } from '@/theme';
type Props = {
    tenantId: string;
    clientId: string;
    actorId: string;
    canView: boolean;
    canRequest: boolean;
    canReview: boolean;
    careOriginal: NutritionEliminationOriginal;
};
export function NutritionReviewPanel(props: Props) {
    const { tenantId, clientId, actorId, canView, canRequest, canReview, careOriginal } = props;
    const identity = `${tenantId}:${clientId}:${actorId}:${careOriginal.headId}:${canView}:${canRequest}:${canReview}`;
    const live = useRef(identity), alive = useRef(true), generation = useRef(0);
    live.current = identity;
    const current = () => alive.current && canView && live.current === identity;
    const [rows, setRows] = useState<NutritionReviewOriginal[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null);
    const [reason, setReason] = useState(''), [requiredChange, setRequiredChange] = useState(''), [rationale, setRationale] = useState('');
    useUnsavedWebChanges(!!reason || !!requiredChange || !!rationale || uncertain, busy || uncertain);
    const remember = (o: NutritionReviewOriginal) => setRows(values => [o, ...values.filter(v => v.rootId !== o.rootId)]);
    const load = async () => {
        const ticket = ++generation.current;
        setLoaded(false);
        setError(null);
        try {
            const result = await recoverNutritionReview({ tenantId, clientId, actorId }, current);
            if (!current() || ticket !== generation.current)
                return;
            if (result?.ok) {
                setUncertain(false);
                setSuccess('Die ursprüngliche Prüfquittung wurde bestätigt.');
            }
            else if (result) {
                setUncertain(result.uncertain === true);
                setError(result.error);
            }
            const records = await readNutritionReviewPage({ tenantId, clientId, actorId, isCurrent: current });
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
                setError(cause instanceof Error ? cause.message : 'Prüfbestand konnte nicht geladen werden.');
        }
    };
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [identity]);
    const active = rows.find(o => o.careHeadId === careOriginal.headId && o.careFingerprint === careOriginal.contentFingerprint) ?? null;
    const send = async (action: NutritionReviewPacket['action']) => {
        if (busy || uncertain || !loaded || !current() || (action === 'request' ? !canRequest : !canReview))
            return;
        setBusy(true);
        setError(null);
        setSuccess(null);
        try {
            const packet = makeNutritionReviewPacket({ action, requestId: crypto.randomUUID(), tenantId, clientId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, careOriginal: structuredClone(careOriginal), reviewOriginal: active ? structuredClone(active) : null, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' });
            const result = await saveNutritionReviewDurably(packet, () => current() && (action === 'request' ? canRequest : canReview));
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
            setSuccess(action === 'request' ? 'Prüfanfrage bestätigt gespeichert.' : action === 'return' ? 'Begründete Rückgabe bestätigt gespeichert.' : 'Qualifizierte Annahme dieser unveränderten Fassung bestätigt gespeichert.');
        }
        catch (cause) {
            if (current())
                setError(cause instanceof Error ? cause.message : 'Prüfung konnte nicht gespeichert werden.');
        }
        finally {
            if (current())
                setBusy(false);
        }
    };
    const candidate = (action: NutritionReviewPacket['action']) => nutritionReviewPacketIssue({ schemaVersion: '1', action, requestId: '00000000-0000-4000-8000-000000000001', tenantId, clientId, actorId, expectedHeadId: active?.headId ?? null, expectedRevision: active?.revision ?? 0, careOriginal, reviewOriginal: active, reason: action === 'accept' ? '' : reason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? rationale.trim() : '' });
    if (!canView)
        return null;
    return <SectionPanel title="Getrennte fachliche Prüfung" subtitle="Jede Prüfung gehört zu genau einer gespeicherten Fassung">
  <InfoBanner variant="info" message={`Geprüfte Grundlage: Fassung ${careOriginal.revision}, Kopf ${careOriginal.headId}. ${active?.status === 'accepted' ? 'Diese Fassung wurde fachlich angenommen.' : active?.status === 'returned' ? 'Diese Fassung wurde zur begründeten Fortschreibung zurückgegeben.' : active?.status === 'requested' ? 'Eine getrennte Prüfentscheidung steht aus.' : 'Für diese Fassung liegt keine Prüfung vor.'}`}/>
  {!loaded && !error ? <LoadingState message="Prüfhistorie und ursprüngliche Quittung werden geladen…"/> : null}
  {loaded && !uncertain ? <View style={{ gap: spacing.sm }}>
   {!active && canRequest ? <><PremiumInput label="Konkreter Anlass der Fachprüfung" value={reason} onChangeText={setReason} multiline/><PremiumButton title="Fachprüfung dieser Fassung anfragen" loading={busy} disabled={busy || !!candidate('request')} onPress={() => send('request')}/></> : null}
   {active?.status === 'requested' && canReview ? <><PremiumInput label="Grund der Rückgabe" value={reason} onChangeText={setReason} multiline/><PremiumInput label="Erforderliche konkrete Änderung" value={requiredChange} onChangeText={setRequiredChange} multiline/><PremiumButton title="Begründete Rückgabe speichern" variant="secondary" loading={busy} disabled={busy || !!candidate('return')} onPress={() => send('return')}/><PremiumInput label="Eigene fachliche Begründung der Annahme" value={rationale} onChangeText={setRationale} multiline/><PremiumButton title="Qualifizierte Annahme speichern" loading={busy} disabled={busy || !!candidate('accept')} onPress={() => send('accept')}/><InfoBanner variant="info" message={candidate('accept') ?? 'Die aktuellen Beschäftigungs-, Qualifikations-, Dokument- und Prüfbereichsoriginale werden vor dem Speichern auf dem Server geprüft.'}/></> : null}
   {active?.status === 'returned' ? <InfoBanner variant="warning" message="Die Rückgabe bleibt erhalten. Den Pflegeverlauf mit begründetem neuen Original fortschreiben und diese neue Fassung gesondert prüfen lassen."/> : null}
  </View> : null}
  {rows.filter(o => o.careRootId === careOriginal.rootId).map(o => <View key={o.rootId} style={{ gap: spacing.xs }}><Text style={typography.label}>{o.careHeadId === careOriginal.headId ? 'Aktuelle Fassung' : 'Frühere Fassung'} · {o.status === 'accepted' ? 'angenommen' : o.status === 'returned' ? 'zurückgegeben' : 'angefragt'}</Text>{o.history.map(e => <Text key={e.id} style={typography.caption}>{e.recordedAt} · {e.actorName} · {e.action === 'request' ? 'Prüfanfrage' : e.action === 'return' ? 'Rückgabe' : 'Annahme'}: {e.reason || e.rationale}{e.requiredChange ? ` · Änderung: ${e.requiredChange}` : ''}{e.qualification ? ` · Qualifikation: ${e.qualification.title} (${e.qualification.id}), Prüfbereich ${e.qualification.scopeKind}` : ''}</Text>)}</View>)}
  {error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}
  {uncertain ? <InfoBanner variant="warning" title="Prüfausgang ungeklärt" message="Die ursprüngliche Anfrage bleibt erhalten. Erneut prüfen liest ausschließlich ihre Quittung."/> : null}
  <PremiumButton title={uncertain ? 'Ursprüngliche Prüfquittung erneut prüfen' : 'Fachprüfbestand erneut laden'} variant="secondary" disabled={busy} onPress={load}/>
 </SectionPanel>;
}
