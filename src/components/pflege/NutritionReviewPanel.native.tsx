// Generated native presentation from src/components/pflege/NutritionReviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { makeNutritionReviewPacket, nutritionReviewPacketIssue, type NutritionEliminationOriginal, type NutritionReviewPacket } from "../../lib/pflege/nutritionEliminationPacket.native.ts";
import type { NutritionEliminationWorkspace } from "../../lib/pflege/nutritionEliminationRepository.supabase.native.ts";
import { recoverNutritionReview, saveNutritionReviewDurably } from "../../lib/pflege/nutritionEliminationWorkflow.native.ts";
import { nutritionWorkspaceIssue } from "../../lib/pflege/nutritionWorkspaceActions.native.ts";
import { sameClientNativeOriginal } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import { spacing, typography } from '@/theme';
type Phase = {
    busy: boolean;
    dirty: boolean;
    uncertain: boolean;
};
type Props = {
    tenantId: string;
    clientId: string;
    actorId: string;
    canView: boolean;
    canRequest: boolean;
    canReview: boolean;
    careOriginal: NutritionEliminationOriginal;
    workspace: NutritionEliminationWorkspace;
    onChanged(): Promise<void> | void;
    isLeaving?(): boolean;
    isOwnerCurrent?(): boolean;
    registerLeave?(guard: (() => Promise<boolean>) | null): void;
    onStateChange?(phase: Phase): void;
};
export function useNutritionReviewController(props: Props) {
    const { tenantId, clientId, actorId, canView, canRequest, careOriginal, workspace } = props;
    const identity = `${tenantId}:${clientId}:${actorId}:${careOriginal.headId}:${careOriginal.contentFingerprint}:${workspace.stateFingerprint}:${canView}:${canRequest}`;
    const live = useRef(identity), alive = useRef(true), flight = useRef(false), pending = useRef(false), owner = useRef(props), operationId = useRef(0), epoch = useRef({ identity, value: 0, guard: props.isOwnerCurrent, retired: false });
    live.current = identity;
    owner.current = props;
    const guardCurrent = (guard: Props['isOwnerCurrent']) => { try {
        return guard ? guard() === true : true;
    }
    catch {
        return false;
    } };
    if (!guardCurrent(epoch.current.guard) || !guardCurrent(props.isOwnerCurrent))
        epoch.current.retired = true;
    if (epoch.current.identity !== identity || epoch.current.retired && guardCurrent(props.isOwnerCurrent))
        epoch.current = { identity, value: epoch.current.value + 1, guard: props.isOwnerCurrent, retired: false };
    const ownerToken = epoch.current;
    const [busy, setBusy] = useState(false), [checking, setChecking] = useState(true), [uncertain, setUncertain] = useState(false), [reason, setReason] = useState(''), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), draft = useRef(reason);
    draft.current = reason;
    const joinedIssue = nutritionWorkspaceIssue(workspace, { tenantId, clientId }, careOriginal), current = () => { if (!alive.current || !canView || live.current !== identity || epoch.current !== ownerToken || ownerToken.retired || joinedIssue)
        return false; if (!guardCurrent(ownerToken.guard) || !guardCurrent(owner.current.isOwnerCurrent)) {
        ownerToken.retired = true;
        return false;
    } return true; };
    const publish = (changes: Partial<Phase> = {}) => owner.current.onStateChange?.({ busy: flight.current, uncertain: pending.current, dirty: !!draft.current, ...changes });
    const uncertainty = (value: boolean) => { pending.current = value; setUncertain(value); publish(); };
    const snapshot = () => ({ identity, reason: draft.current, pending: pending.current });
    const confirmLeave = useUnsavedWebChanges(!!reason || uncertain, busy || uncertain, undefined, () => { const before = snapshot(); return () => current() && !flight.current && !pending.current && sameClientNativeOriginal(before, snapshot()); });
    useEffect(() => { props.registerLeave?.(confirmLeave); return () => props.registerLeave?.(null); }, [props.registerLeave, confirmLeave, ownerToken]);
    const load = async (refresh = false) => { if (!current() || flight.current || owner.current.isLeaving?.() || draft.current && !pending.current)
        return; const operation = ++operationId.current, ownCurrent = () => current() && operationId.current === operation; flight.current = true; setBusy(true); setChecking(true); publish(); setError(null); let inspected = false; try {
        const result = await recoverNutritionReview({ tenantId, clientId, actorId }, ownCurrent);
        if (!ownCurrent())
            return;
        inspected = true;
        if (result?.ok) {
            uncertainty(false);
            setSuccess('Die ursprüngliche eigene Prüfquittung wurde bestätigt.');
            await owner.current.onChanged();
        }
        else if (result) {
            uncertainty(result.uncertain === true);
            setError(result.error);
        }
        else if (refresh)
            await owner.current.onChanged();
    }
    catch (cause) {
        if (ownCurrent()) {
            if (!inspected)
                uncertainty(true);
            setError(cause instanceof Error ? cause.message : 'Die ursprüngliche Prüfquittung bleibt ungeklärt.');
        }
    }
    finally {
        if (operationId.current === operation) {
            flight.current = false;
            if (current()) {
                setBusy(false);
                setChecking(false);
                publish();
            }
        }
    } };
    useEffect(() => { alive.current = true; publish(); if (!current() || owner.current.isLeaving?.() || draft.current && !pending.current) {
        setBusy(false);
        setChecking(false);
    }
    else
        void load(); return () => { alive.current = false; operationId.current++; flight.current = false; owner.current.onStateChange?.({ busy: false, dirty: false, uncertain: false }); }; }, [ownerToken]);
    const rows = joinedIssue ? [] : workspace.reviewOriginals, active = rows.find(o => o.careHeadId === careOriginal.headId && o.careFingerprint === careOriginal.contentFingerprint) ?? null;
    const candidate = () => nutritionReviewPacketIssue({ schemaVersion: '1', action: 'request', requestId: '00000000-0000-4000-8000-000000000001', tenantId, clientId, actorId, expectedHeadId: null, expectedRevision: 0, careOriginal, reviewOriginal: null, reason: reason.trim(), requiredChange: '', rationale: '' });
    const changeReason = (value: string) => { if (!current() || !canRequest || active || flight.current || pending.current || owner.current.isLeaving?.())
        return; draft.current = value; setReason(value); publish(); };
    const send = async (action: NutritionReviewPacket['action'] = 'request') => {
        if (action !== 'request' || !current() || !canRequest || active || flight.current || pending.current || checking || owner.current.isLeaving?.())
            return;
        const operation = ++operationId.current, ownCurrent = () => current() && operationId.current === operation;
        flight.current = true;
        setBusy(true);
        publish();
        setError(null);
        setSuccess(null);
        try {
            const packet = makeNutritionReviewPacket({ action: 'request', requestId: crypto.randomUUID(), tenantId, clientId, actorId, expectedHeadId: null, expectedRevision: 0, careOriginal: structuredClone(careOriginal), reviewOriginal: null, reason: draft.current.trim(), requiredChange: '', rationale: '' });
            const result = await saveNutritionReviewDurably(packet, () => ownCurrent() && canRequest);
            if (!ownCurrent())
                return;
            if (!result.ok) {
                setError(result.error);
                uncertainty(result.uncertain === true);
                return;
            }
            uncertainty(false);
            draft.current = '';
            setReason('');
            setSuccess('Die gebundene Prüfanfrage wurde mit ihrer ursprünglichen eigenen Quittung bestätigt.');
            await owner.current.onChanged();
        }
        catch (cause) {
            if (ownCurrent())
                setError(cause instanceof Error ? cause.message : 'Die Prüfanfrage konnte nicht gespeichert werden.');
        }
        finally {
            if (operationId.current === operation) {
                flight.current = false;
                if (current()) {
                    setBusy(false);
                    publish();
                }
            }
        }
    };
    return { rows, active, busy, checking, uncertain, reason, error: error ?? joinedIssue, success, current, changeReason, candidate, send, load };
}
export function NutritionReviewPanel(props: Props) {
    const { careOriginal, canView, canRequest } = props, { rows, active, busy, checking, uncertain, reason, error, success, changeReason, candidate, send, load } = useNutritionReviewController(props);
    if (!canView)
        return null;
    return <SectionPanel title="Gebundene Prüfanfrage und historische Entscheidungen" subtitle="Die Prüfung gehört zu genau einer gespeicherten Fassung">
  <InfoBanner variant="info" message={`Grundlage: Fassung ${careOriginal.revision}, Kopf ${careOriginal.headId}. ${active?.status === 'accepted' ? 'Historische Annahme ist im Original erhalten.' : active?.status === 'returned' ? 'Historische Rückgabe ist im Original erhalten.' : active?.status === 'requested' ? 'Die Prüfanfrage ist offen.' : 'Für diese Fassung liegt keine Prüfung vor.'}`}/>
  <InfoBanner variant="info" message="Neue fachliche Annahmen und Rückgaben bleiben gesperrt. Eine Prüfanfrage bestätigt keine tatsächliche Durchführung oder klinische Freigabe."/>
  {checking && !error ? <LoadingState message="Ursprüngliche Prüfquittung und gemeinsamer Bestand werden geprüft…"/> : null}
  {!checking && !uncertain && !active && canRequest ? <View style={{ gap: spacing.sm }}><PremiumInput label="Konkreter Prüfanlass" value={reason} onChangeText={changeReason} editable={!busy} multiline/><PremiumButton title="Prüfung dieser Fassung anfragen" loading={busy} disabled={busy || !!candidate()} onPress={() => void send('request')}/>{candidate() ? <Text style={typography.caption}>{candidate()}</Text> : null}</View> : null}
  {rows.filter(o => o.careRootId === careOriginal.rootId).map(o => <View key={o.rootId} style={{ gap: spacing.xs }}><Text style={typography.label}>{o.careHeadId === careOriginal.headId ? 'Aktuelle Fassung' : 'Frühere Fassung'} · {o.status === 'accepted' ? 'historisch angenommen' : o.status === 'returned' ? 'historisch zurückgegeben' : 'angefragt'}</Text>{o.history.map(e => <Text key={e.id} style={typography.caption}>{e.recordedAt} · {e.actorName} · {e.action === 'request' ? 'Prüfanfrage' : e.action === 'return' ? 'Rückgabe' : 'Annahme'}: {e.reason || e.rationale}{e.requiredChange ? ` · Änderung: ${e.requiredChange}` : ''}{e.qualification ? ` · gespeicherte Qualifikation: ${e.qualification.title} (${e.qualification.id}), Prüfbereich ${e.qualification.scopeKind}` : ''}</Text>)}</View>)}
  {error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}
  {uncertain ? <InfoBanner variant="warning" title="Prüfausgang ungeklärt" message="Die ursprüngliche Anfrage bleibt erhalten. Erneut prüfen liest ausschließlich ihre Quittung."/> : null}
  <PremiumButton title={uncertain ? 'Ursprüngliche Prüfquittung erneut prüfen' : 'Gemeinsamen Bestand erneut laden'} variant="secondary" disabled={busy || !!reason && !uncertain} onPress={() => void load(true)}/>
 </SectionPanel>;
}
