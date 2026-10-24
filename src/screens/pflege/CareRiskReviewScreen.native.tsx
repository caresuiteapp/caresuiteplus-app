// Generated native presentation from src/screens/pflege/CareRiskReviewScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ScreenShell } from '@/components/layout';
import { DetailInfoRow } from '@/components/detail';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { onAuthStateChange } from '@/lib/supabase/authService';
import { confirmAction } from '@/lib/platform/confirmAction';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { FALL_REVIEW_READ_KEYS } from "../../lib/pflege/fallRiskReviewOriginals.native.ts";
import { attachCareRiskReviewSession, detachCareRiskReviewSession, subscribeCareRiskReviewSession, readCareRiskReviewSession, viewCareRiskReviewSession, updateCareRiskReviewSession, saveCareRiskReviewSession, closeCareRiskReviewSession, type CareRiskReviewSessionToken, type CareRiskReviewSessionView, type CareRiskReviewField } from "../../lib/pflege/careRiskReviewSession.native.ts";
import type { CareRiskReviewForm } from "../../lib/pflege/careRiskReviewWrite.native.ts";
const labels: Record<keyof CareRiskReviewForm, string> = { state: 'Gespeicherte Risikoeinstufung', urgency: 'Dringlichkeit', evidence: 'Belege und Beobachtungen', protectiveFactors: 'Schutzfaktoren', professionalRationale: 'Fachliche Begründung *', counselingProvided: 'Beratung und Aufklärung', personDecision: 'Entscheidung der versorgten Person', refusalDocumented: 'Ablehnung dokumentiert', nextReviewAt: 'Reviewvereinbarung · Zeitpunkt mit Zeitzone' };
const stateOptions = [{ key: 'none', label: 'Kein Risiko' }, { key: 'unclear', label: 'Unklar' }, { key: 'present', label: 'Vorhanden' }, { key: 'controlled', label: 'Kontrolliert' }];
const urgencyOptions = [{ key: 'routine', label: 'Routine' }, { key: 'timely', label: 'Zeitnah' }, { key: 'urgent', label: 'Dringend' }, { key: 'immediate', label: 'Sofort' }];
const yesNo = [{ key: 'yes', label: 'Ja' }, { key: 'no', label: 'Nein' }];
type Inputs = {
    auth: ReturnType<typeof useAuth>;
    tenantId: string | null;
    riskId: unknown;
    permissions: ReturnType<typeof useCareRuntimePermissions>;
};
type Frame = {
    serial: number;
    live: boolean;
    signature: string;
    param: unknown;
    token: CareRiskReviewSessionToken | null;
    held: boolean;
    retainedDirty: boolean;
    reading: boolean;
    lastStage: CareRiskReviewSessionView['stage'] | null;
    unsubscribe: () => void;
};
// Private UI identity only, never a field/permission grant or a serialized Child prop.
function signature(i: Inputs): string { return JSON.stringify([i.tenantId, i.auth.profile?.id ?? null, i.auth.profile?.tenantId ?? null, i.auth.profile?.roleKey ?? null, i.auth.user?.id ?? null, i.auth.session?.user.id ?? null, i.auth.session?.accessToken ?? null, i.auth.session?.expiresAt ?? null, i.auth.portalSession === null]); }
function sameInitialSession(i: Inputs, value: unknown): boolean {
    const data = (object: unknown, key: string, optional = false): unknown => { if (!object || typeof object !== 'object' || Array.isArray(object))
        throw Error('Ungeklärte Sitzungsdaten'); const d = Object.getOwnPropertyDescriptor(object, key); if (!d && optional)
        return undefined; if (!d || !d.enumerable || !('value' in d))
        throw Error('Ungeklärte Sitzungsdaten'); return d.value; };
    try {
        if (value === null)
            return i.auth.session === null && i.auth.user === null;
        const user = data(value, 'user'), expires = data(value, 'expires_at', true);
        return data(user, 'id') === i.auth.user?.id && data(value, 'access_token') === i.auth.session?.accessToken && (expires === undefined || expires === null ? i.auth.session?.expiresAt === null : typeof expires === 'number' && Number.isFinite(expires) && expires * 1000 === i.auth.session?.expiresAt);
    }
    catch {
        return false;
    }
}
function fieldText(field: CareRiskReviewField, boolean = false): string {
    if (field.kind === 'missing')
        return 'Nicht im gelieferten Original enthalten';
    if (field.kind === 'null')
        return 'Kein Wert hinterlegt';
    if (field.kind === 'empty')
        return 'Leer hinterlegt';
    if (field.kind === 'unresolved')
        return 'Originalwert nicht bestätigt';
    return boolean && typeof field.value === 'boolean' ? (field.value ? 'Ja' : 'Nein') : typeof field.value === 'string' ? field.value : 'Originalwert nicht bestätigt';
}
function rawTime(field: CareRiskReviewField): string { return typeof field.value === 'string' && field.kind === 'unresolved' ? `Ungeklärte Originalzeit: ${field.value}` : fieldText(field); }
/** Each historical row consumes a fresh own safe projection. A parent snapshot is no grant. */
function RiskAuditRow({ token, id }: {
    token: CareRiskReviewSessionToken;
    id: string;
}) {
    const { c } = useCareLightPalette(), view = viewCareRiskReviewSession(token), row = view?.history.find(item => item.id.value === id);
    if (!row)
        return null;
    return <View style={[staticStyles.historyRow, { borderColor: c.border }]}>
  <DetailInfoRow label="Gespeicherte Auditkennung" value={fieldText(row.id)}/><DetailInfoRow label="Gespeicherter Entitätsbezug · kein geprüfter Zielverweis" value={fieldText(row.entityId)}/>
  <DetailInfoRow label="Gespeicherte prüfende Kennung" value={fieldText(row.actorId)}/><DetailInfoRow label="Gespeicherter Name" value={fieldText(row.actorName)}/><DetailInfoRow label="Erfasst" value={rawTime(row.recordedAt)}/>
  <DetailInfoRow label="Gespeicherte Aktion" value={fieldText(row.action)}/><DetailInfoRow label="Gespeicherte Zusammenfassung" value={fieldText(row.summary)}/>
  {(['before', 'after'] as const).map(kind => {
            const snapshot = row[kind];
            return <View key={kind} style={staticStyles.snapshot}>
   <Text style={[staticStyles.label, { color: c.text }]}>{kind === 'before' ? 'Gespeichertes Vorher' : 'Gespeichertes Nachher'}</Text>
   {snapshot.kind !== 'own_assessment_snapshot' ? <Text style={[staticStyles.caption, { color: c.muted }]}>{snapshot.kind === 'missing' ? 'Kein Snapshot geliefert' : snapshot.kind === 'null' ? 'Kein Snapshot hinterlegt' : 'Snapshotbezug nicht bestätigt; keine abgeleiteten Risikoangaben'}</Text> : <>
    <DetailInfoRow label="Gespeicherte Risikokennung" value={snapshot.riskId ?? 'Nicht bestätigt'}/><DetailInfoRow label="Gespeicherte Assessmentkennung" value={snapshot.assessmentId ?? 'Nicht bestätigt'}/><DetailInfoRow label="Gespeicherter Risikoschlüssel · Textbezug" value={snapshot.riskKey ?? 'Nicht bestätigt'}/>
    {snapshot.fields ? Object.entries(snapshot.fields).map(([key, value]) => <DetailInfoRow key={key} label={labels[key as keyof CareRiskReviewForm]} value={key === 'nextReviewAt' ? rawTime(value) : fieldText(value, key === 'refusalDocumented')}/>) : null}
   </>}
  </View>;
        })}
 </View>;
}
/** Web sibling only; inherited Auth/Role/Product routes remain unchanged and unreleased. */
export function CareRiskReviewScreen() {
    const window = useNativeWorkflowWindow();
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>(), router = useRouter(), navigation = useNavigation();
    const auth = useAuth(), tenantId = useServiceTenantId(), permissions = useCareRuntimePermissions(), { c } = useCareLightPalette();
    const [, render] = useState(0), [cycle, setCycle] = useState(0), [historyLimit, setHistoryLimit] = useState(20), [width, setWidth] = useState(0);
    const latest = useRef<Inputs>({ auth, tenantId, riskId: params.id, permissions }), frameRef = useRef<Frame | null>(null), serial = useRef(0), allowNavigation = useRef<Frame | null>(null);
    latest.current = { auth, tenantId, riskId: params.id, permissions };
    const ownerSignature = signature(latest.current);
    const alive = (frame: Frame | null): frame is Frame => !!frame && frame.live && frameRef.current === frame && frame.signature === signature(latest.current) && frame.param === latest.current.riskId;
    const access = () => ({ auth: latest.current.auth, tenantId: latest.current.tenantId, riskId: latest.current.riskId, permissions: latest.current.permissions.permissions, can: latest.current.permissions.can });
    const reads = () => FALL_REVIEW_READ_KEYS.every(key => latest.current.permissions.can(key) === true);
    const current = (frame: Frame | null) => {
        if (!alive(frame) || !frame.token)
            return null;
        const view = viewCareRiskReviewSession(frame.token);
        if (view) {
            frame.retainedDirty = view.dirty;
            frame.lastStage = view.stage;
            if (view.stage === 'saving' || view.stage === 'uncertain')
                frame.held = true;
            else if (view.stage === 'risk_response_acknowledged')
                frame.held = false;
        }
        return alive(frame) ? view : null;
    };
    useEffect(() => {
        const frame: Frame = { serial: ++serial.current, live: true, signature: ownerSignature, param: params.id, token: null, held: false, retainedDirty: false, reading: false, lastStage: null, unsubscribe: () => { } };
        frameRef.current = frame;
        allowNavigation.current = null;
        setHistoryLimit(20);
        const invalidate = () => { if (alive(frame))
            render(value => value + 1); };
        const attach = () => { if (!alive(frame) || frame.token || !reads())
            return; frame.token = attachCareRiskReviewSession(access); if (frame.token)
            frame.unsubscribe = subscribeCareRiskReviewSession(frame.token, invalidate); };
        attach();
        invalidate();
        const timer = setInterval(() => { attach(); current(frame); invalidate(); }, 1000);
        const authEvents = onAuthStateChange((event, nativeSession) => {
            // Initial subscription is not a new actor/intent. Every actual subsequent auth event closes
            // old callbacks synchronously; native permission refresh is a denial until its new read ends.
            if (!alive(frame) || event === 'INITIAL_SESSION' && sameInitialSession(latest.current, nativeSession))
                return;
            frame.live = false;
            frame.unsubscribe();
            if (frame.token)
                detachCareRiskReviewSession(frame.token);
            latest.current.permissions.refreshPermissions();
            setCycle(value => value + 1);
            render(value => value + 1);
        });
        return () => { clearInterval(timer); authEvents.unsubscribe(); frame.live = false; frame.unsubscribe(); if (frame.token)
            detachCareRiskReviewSession(frame.token); if (frameRef.current === frame)
            frameRef.current = null; };
        // Permission/loading/origin changes intentionally do not detach a same-owner token: it is also
        // the retained identity-only local-close/unknown anchor. A new read needs an explicit new cycle.
    }, [ownerSignature, params.id, cycle]);
    const frame = frameRef.current, view = current(frame);
    const confirmDiscard = () => confirmAction({ title: 'Ungespeicherte Änderungen', message: 'Möchten Sie Ihre Eingaben verwerfen und diese Risikoprüfung schließen?', confirmLabel: 'Verwerfen', cancelLabel: 'Weiter bearbeiten' });
    const close = async (followup: () => void) => {
        if (!alive(frame))
            return false;
        const token = frame.token;
        if (token) {
            if (!await closeCareRiskReviewSession(token, confirmDiscard) || !alive(frame) || frame.token !== token)
                return false;
        }
        else if (woundUuid(frame.param))
            return false; // No token is not proof that a prior own unknown journal is absent.
        if (!alive(frame))
            return false;
        frame.retainedDirty = false;
        frame.held = false;
        allowNavigation.current = frame;
        followup();
        return true;
    };
    const back = () => void close(() => router.back());
    const read = async () => { if (!alive(frame) || !frame.token || frame.reading || current(frame)?.stage !== 'choose')
        return false; const token = frame.token; frame.reading = true; try {
        const result = await readCareRiskReviewSession(token);
        if (!alive(frame) || frame.token !== token)
            return false;
        current(frame);
        return result;
    }
    finally {
        if (alive(frame) && frame.token === token) {
            frame.reading = false;
            render(value => value + 1);
        }
    } };
    // The fixed Session.update true-return follows its own synchronous dirty=true assignment.
    const input = (key: keyof CareRiskReviewForm, value: unknown) => { if (!alive(frame) || !frame.token || !current(frame)?.canEdit)
        return false; const accepted = updateCareRiskReviewSession(frame.token, key, value); if (accepted && alive(frame)) {
        frame.retainedDirty = true;
        current(frame);
    } return accepted; };
    const save = async () => { if (!alive(frame) || !frame.token || !current(frame)?.canSave)
        return false; const token = frame.token; frame.held = true; const result = await saveCareRiskReviewSession(token); if (!alive(frame) || frame.token !== token)
        return false; const now = current(frame); if (now && !['saving', 'uncertain'].includes(now.stage))
        frame.held = false; render(value => value + 1); return !!now && now.stage === 'risk_response_acknowledged' && result; };
    const reopen = async () => {
        if (!alive(frame) || !frame.token || !reads())
            return false;
        const token = frame.token;
        if (!await closeCareRiskReviewSession(token, confirmDiscard) || !alive(frame) || frame.token !== token || !reads())
            return false;
        frame.live = false;
        frame.unsubscribe();
        frameRef.current = null;
        setCycle(value => value + 1);
        render(value => value + 1);
        return true;
    };
    const refresh = () => { if (!alive(frame))
        return false; latest.current.permissions.refreshPermissions(); render(value => value + 1); return true; };
    const more = () => { if (!alive(frame) || !frame.token || !current(frame)?.history.length)
        return false; setHistoryLimit(value => value + 20); return true; };
    usePreventRemove(!!frame && alive(frame) && (frame.held || frame.reading || frame.retainedDirty || !frame.token && !!woundUuid(frame.param) || view?.stage === 'loading'), ({ data }) => {
        if (allowNavigation.current === frame && alive(frame)) {
            navigation.dispatch(data.action);
            return;
        }
        void close(() => navigation.dispatch(data.action));
    });
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const unload = (event: BeforeUnloadEvent) => { const frame = frameRef.current; if (!alive(frame))
            return; const view = current(frame); if (frame.held || frame.reading || frame.retainedDirty || !frame.token && !!woundUuid(frame.param) || view?.stage === 'loading') {
            event.preventDefault();
            event.returnValue = '';
        } };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, []);
    // The handler prefix above is executed with actual native modules in Node QA. JSX/React layout is separate.
    const style = StyleSheet.create({ columns: { minWidth: 0, gap: spacing.md, ...(width >= 1000 ? { flexDirection: 'row' as const, alignItems: 'flex-start' as const } : {}) }, column: { flex: 1, minWidth: 0, gap: spacing.md }, caption: { ...typography.caption, color: c.muted }, body: { ...typography.body, color: c.text } });
    const field = (key: keyof CareRiskReviewForm) => {
        if (!view?.fields)
            return null;
        const value = view.fields[key];
        const error = view.fieldErrors.includes(key) ? key === 'professionalRationale' ? 'Bitte eine ausdrückliche Begründung angeben.' : key === 'nextReviewAt' ? 'Bitte einen vollständigen Zeitpunkt mit Zeitzone angeben oder ausdrücklich keinen Termin wählen.' : 'Bitte einen gültigen Wert wählen.' : undefined;
        if (key === 'state' || key === 'urgency')
            return <View key={key} style={staticStyles.field}><Text style={[staticStyles.label, { color: c.text }]}>{labels[key]}</Text><FilterChipGroup wrap options={key === 'state' ? stateOptions : urgencyOptions} value={typeof value.value === 'string' ? value.value : undefined} onChange={view.canEdit ? next => input(key, next) : undefined}/>{value.kind !== 'value' || !(key === 'state' ? stateOptions : urgencyOptions).some(option => option.key === value.value) ? <Text style={style.caption}>{fieldText(value)}</Text> : null}{error ? <Text style={style.caption}>{error}</Text> : null}</View>;
        if (key === 'refusalDocumented')
            return <View key={key} style={staticStyles.field}><Text style={[staticStyles.label, { color: c.text }]}>{labels[key]}</Text><FilterChipGroup options={yesNo} value={value.value === true ? 'yes' : value.value === false ? 'no' : undefined} onChange={view.canEdit ? next => { if (next === 'yes' || next === 'no')
                input(key, next === 'yes'); } : undefined}/>{value.kind !== 'value' || typeof value.value !== 'boolean' ? <Text style={style.caption}>{fieldText(value, true)}</Text> : null}</View>;
        return <View key={key} style={staticStyles.field}><PremiumInput label={labels[key]} value={typeof value.value === 'string' ? value.value : ''} editable={view.canEdit} onChangeText={next => input(key, next)} error={error} multiline={key !== 'nextReviewAt'} viewContext="form" sensitiveBusinessValue hint={key === 'nextReviewAt' ? 'Originalzeit bleibt vollständig erhalten, einschließlich Zeitzone und Nachkommastellen. Leere Eingabe ist keine automatische Nullwahl.' : value.kind === 'value' ? undefined : fieldText(value)}/>
   {key === 'nextReviewAt' ? <><Text style={style.caption}>{value.kind === 'null' ? 'Ausdrücklich kein Termin hinterlegt.' : rawTime(value)}</Text><PremiumButton title="Ausdrücklich keinen Reviewtermin hinterlegen" variant="secondary" disabled={!view.canEdit} onPress={() => input('nextReviewAt', null)}/></> : null}
  </View>;
    };
    return <ScreenShell title="Risiko fachlich überprüfen" subtitle="Eigene Originalangaben, ausdrückliche neue Einschätzung und gespeicherte Prüfhistorie" onBack={back} scroll={false}>
  <ScrollView style={staticStyles.scroll} contentContainerStyle={staticStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
   <View style={staticStyles.root} onLayout={event => setWidth(Math.max(0, event.nativeEvent.layout.width))}>
    {!woundUuid(params.id) ? <ErrorState presentation="inline" message="Es wurde keine einzelne gültige Risikokennung gewählt."/> : null}
    {!view && woundUuid(params.id) ? permissions.loading ? <LoadingState presentation="inline" message="Aktuelle eigene Berechtigungen werden geprüft…"/> : <ErrorState presentation="inline" message="Die eigene Risikoprüfung ist nicht aktuell freigegeben. Es werden keine früheren Angaben angezeigt."/> : null}
    {!view ? <PremiumButton title="Aktuelle Berechtigungen prüfen" variant="secondary" onPress={refresh}/> : null}
    {view?.stage === 'choose' ? <SectionPanel title="Originalgrundlage laden"><Text style={style.body}>Für diese ausdrücklich gewählte Risikoprüfung den ganzen eigenen Originalbestand laden.</Text>{view.draftState === 'retained' ? <InfoBanner presentation="inline" message="Ein eigener Entwurf bleibt erhalten. Übernommen wird er erst nach einer neuen Prüfung der unveränderten Originalgrundlage."/> : null}<PremiumButton title="Eigene Originale laden" variant="secondary" onPress={() => void read()}/></SectionPanel> : null}
    {view?.stage === 'loading' ? <LoadingState presentation="inline" message="Eigene Originalgrundlage und ganze Prüfhistorie werden geladen…"/> : null}
    {view?.stage === 'saving' ? <LoadingState presentation="inline" message="Ihre ausdrücklichen Angaben werden gesendet…"/> : null}
    {view?.stage === 'uncertain' ? <ErrorState presentation="inline" message="Der Schreibausgang ist unbestätigt. Dieser Auftrag wird nicht erneut gesendet. Die ursprünglichen Angaben bleiben erhalten."/> : null}
    {view?.stage === 'blocked' ? <ErrorState presentation="inline" message={view.draftState === 'conflict' ? 'Die Originalgrundlage hat sich geändert. Der eigene Entwurf wird nicht still übertragen.' : 'Die Originalgrundlage ist nicht vollständig oder aktuell bestätigt. Speichern bleibt gesperrt.'}/> : null}
    {view?.stage === 'risk_response_acknowledged' ? <SuccessState presentation="inline" message="Die aktualisierten Risikoangaben wurden bestätigt."/> : null}
    {view?.fields ? <View style={style.columns}>
     <View style={style.column}><SectionPanel title="Eingaben für diesen Auftrag" viewContext="form"><View style={staticStyles.fields}>{(Object.keys(labels) as (keyof CareRiskReviewForm)[]).map(field)}</View>
      {!view.canEdit ? <InfoBanner presentation="inline" message="Die Angaben sind hier nur lesbar. Eine weitere Änderung braucht eine ausdrücklich neue aktuelle Originalgrundlage."/> : null}
      {view.stage === 'ready' ? <PremiumButton title="Ausdrückliche Angaben speichern" fullWidth disabled={!view.canSave} onPress={() => void save()}/> : null}
     </SectionPanel><SectionPanel title="Gelieferter Originalstand"><DetailInfoRow label="Ursprünglich erfasst" value={rawTime(view.createdAt)}/><DetailInfoRow label="Änderungsstand des gelesenen Originals" value={rawTime(view.updatedAt)}/></SectionPanel></View>
     <View style={style.column}><SectionPanel title={`Gespeicherte Prüfhistorie (${view.history.length})`} subtitle="Ganze eigene Auditquellen; alte Risikokennungen bleiben eigenständige gespeicherte Bezüge">
      <InfoBanner presentation="inline" message="Gespeicherte Einstufung und Reviewvereinbarung bestätigen keine durchgeführte Maßnahme, abgeschlossene Kontrolle oder klinische Freigabe."/>
      {view.history.slice(0, historyLimit).map(row => typeof row.id.value === 'string' && frame?.token ? <RiskAuditRow key={row.id.value} token={frame.token} id={row.id.value}/> : null)}
      {!view.history.length ? <Text style={style.caption}>Im eigenen gelesenen Bestand sind keine Auditzeilen geliefert.</Text> : null}
      {view.history.length > historyLimit ? <PremiumButton title={`Weitere gespeicherte Einträge (${view.history.length - historyLimit})`} variant="secondary" onPress={more}/> : null}
     </SectionPanel></View>
    </View> : null}
    {view && ['blocked', 'risk_response_acknowledged'].includes(view.stage) ? <PremiumButton title="Bewusst eine neue Originalprüfung beginnen" variant="secondary" onPress={() => void reopen()}/> : null}
    {!view && frame?.token ? <PremiumButton title="Nach Bestätigung der Berechtigungen neue Originale wählen" variant="secondary" onPress={() => void reopen()}/> : null}
    <PremiumButton title="Risikoprüfung schließen" variant="secondary" disabled={view?.stage === 'saving' || view?.stage === 'uncertain' || view?.stage === 'loading'} onPress={back}/>
   </View>
  </ScrollView>
 </ScreenShell>;
}
const staticStyles = StyleSheet.create({ scroll: { flex: 1, minHeight: 0, width: '100%', minWidth: 0 }, content: { flexGrow: 1, paddingBottom: spacing.xxl }, root: { gap: spacing.md, minWidth: 0, width: '100%' }, fields: { gap: spacing.md }, field: { gap: spacing.xs, minWidth: 0 }, label: { ...typography.label }, caption: { ...typography.caption, flexShrink: 1 }, historyRow: { gap: spacing.xs, paddingVertical: spacing.md, borderBottomWidth: 1, minWidth: 0 }, snapshot: { gap: spacing.xs, paddingTop: spacing.sm, minWidth: 0 } });
