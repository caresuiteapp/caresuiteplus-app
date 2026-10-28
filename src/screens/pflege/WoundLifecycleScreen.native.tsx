// Generated native presentation from src/screens/pflege/WoundLifecycleScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { woundEditorAccess as captureWoundEditorAccess, isKnownWoundEditorRole, WoundEditorRequestGuard, type WoundEditorAccess } from "../../lib/pflege/woundEditorRequestGuard.native.ts";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useWoundSubmission } from "../../hooks/pflege/useWoundSubmission.native.ts";
import { woundEditorAccess, type WoundEditorOwner } from "../../lib/pflege/woundEditorAccess.native.ts";
import { MedicationEventTimeInput, currentMedicationEventTime, medicationEventInstant } from "../../components/pflege/MedicationEventTimeInput.native.tsx";
import { spacing, typography } from '@/theme';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { writeWoundLifecycle } from '@/lib/pflege/ambulatoryWoundService';
import { fetchWoundWithCorrections } from '@/lib/pflege/woundAssessmentCorrectionService';
import { validateWoundHealingCorrectionBasis } from '@/lib/pflege/woundAssessmentCorrectionDomain';
import { emptyWoundLifecycle, closedWoundStatuses, openWoundStatuses, validateWoundLifecycle, validateWoundLifecycleSnapshot, type WoundLifecycleRequest } from '@/lib/pflege/woundLifecycleDomain';
export function WoundLifecycleScreen({ onClose, sessionOwner, accessBlocked = false }: {
    onClose: () => void;
    sessionOwner?: WoundEditorOwner | null;
    accessBlocked?: boolean;
}) {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), tenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions();
    const stableOwner = useRef<WoundEditorOwner | null>(null);
    if (isKnownWoundEditorRole(profile?.roleKey) && woundUuid(profile?.tenantId) && woundUuid(profile?.id))
        stableOwner.current = { tenantId: profile.tenantId, profileId: profile.id, role: profile.roleKey };
    const latestNative = useRef({ tenant, profile, permissions, sessionOwner, accessBlocked, id, owner: stableOwner.current });
    latestNative.current = { tenant, profile, permissions, sessionOwner, accessBlocked, id, owner: stableOwner.current };
    const liveAccess = useRef<() => WoundEditorAccess>(() => {
        const { tenant, profile, permissions, sessionOwner, accessBlocked, id, owner } = latestNative.current;
        const can = Object.getOwnPropertyDescriptor(permissions, 'can');
        if (!can || !Object.hasOwn(can, 'value') || typeof can.value !== 'function')
            throw Error('Aktuelle native Berechtigungsabfrage fehlt.');
        const grant = (key: Parameters<typeof permissions.can>[0]) => can.value(key) === true;
        const current = woundEditorAccess({ owner: sessionOwner === undefined ? owner : sessionOwner, profile, serviceTenant: tenant, runtimeTenant: permissions.tenantId, runtimeRole: permissions.roleKey, blocked: accessBlocked, canView: grant('pflege.wounds.view'), canManage: grant('pflege.wounds.manage') });
        return captureWoundEditorAccess({ originalOwner: current.owner, tenantId: tenant, profileTenantId: profile?.tenantId, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId: permissions.tenantId, runtimeRole: permissions.roleKey, sourceId: id ?? '', woundId: id ?? '', kind: 'lifecycle', action: 'lifecycle', canRead: current.canView, canManage: grant('pflege.wounds.manage') });
    });
    const access = woundEditorAccess({ owner: sessionOwner === undefined ? stableOwner.current : sessionOwner, profile, serviceTenant: tenant, runtimeTenant: permissions.tenantId, runtimeRole: permissions.roleKey, blocked: accessBlocked, canView: permissions.can('pflege.wounds.view'), canManage: permissions.can('pflege.wounds.manage') });
    const guardAccess = { ...captureWoundEditorAccess({ originalOwner: access.owner, tenantId: tenant, profileTenantId: profile?.tenantId, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId: permissions.tenantId, runtimeRole: permissions.roleKey, sourceId: id ?? '', woundId: id ?? '', kind: 'lifecycle', action: 'lifecycle', canRead: access.canView, canManage: permissions.can('pflege.wounds.manage') }), liveAccess: liveAccess.current };
    return <LifecycleForm access={guardAccess} key={`${access.key}:${id}`} onClose={onClose} id={id ?? ''} tenant={access.owner?.tenantId ?? ''} role={access.owner?.role ?? null} canView={access.canView} canManage={access.canManage}/>;
}
function LifecycleForm({ access, id, tenant, role, canView, canManage, onClose }: {
    access: WoundEditorAccess;
    onClose: () => void;
    id: string;
    tenant: string;
    role: ReturnType<typeof usePermissions>['roleKey'];
    canView: boolean;
    canManage: boolean;
}) {
    const guard = useRef(new WoundEditorRequestGuard<WoundLifecycleRequest>(access));
    guard.current.update(access);
    const readEpoch = guard.current.readEpoch;
    useEffect(() => { guard.current.mount(); return () => guard.current.dispose(); }, []);
    const { c } = useCareLightPalette();
    const styles = useMemo(() => StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, body: { ...typography.body, color: c.text } }), [c]);
    const [draft, setDraft] = useState(emptyWoundLifecycle), [at, setAt] = useState(currentMedicationEventTime), [editedTime, setEditedTime] = useState(false), [confirmed, setConfirmed] = useState(false);
    const q = useAsyncQuery(() => guard.current.read(readEpoch, () => fetchWoundWithCorrections(tenant, id, role)), [access.readScope, tenant, id, role], { enabled: guard.current.canRead() && !!tenant && !!id && canView, queryKey: `${tenant}:${role}:${id}:${access.readScope}:wound-lifecycle` });
    guard.current.setView(q.data, q.loading || q.refreshing || !!q.error || !!q.refreshError || q.previewData || q.tableMissing || q.cacheMeta.fromCache || !!q.cacheMeta.partialDetail);
    const readTicket = guard.current.readTicket;
    const write = useWoundSubmission<WoundLifecycleRequest>((editedTime || Object.values(draft).some(Boolean)) && !confirmed, guard.current.canRead(), async (requestId, payload, replay) => guard.current.execute(requestId, payload, replay, () => writeWoundLifecycle(tenant, requestId, payload, role, replay), readEpoch, readTicket, q.data), () => setConfirmed(true));
    const w = guard.current.canShow(readEpoch, readTicket, q.data) ? q.data?.row : null, status = String(w?.status), action = closedWoundStatuses.includes(status) ? 'reopen' : openWoundStatuses.includes(status) ? 'close' : null;
    const latest = guard.current.canShow(readEpoch, readTicket, q.data) ? q.data?.assessments[0] : null;
    const actualTime = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : 'Nicht gesondert bestätigt';
    const value = (v: unknown) => typeof v === 'string' && v.trim() ? v : 'Nicht dokumentiert';
    const field = (key: 'reason' | 'decisionBasis' | 'handover', label: string) => <PremiumInput label={label} accessibilityLabel={label} value={draft[key]} onChangeText={value => { if (!write.locked && guard.current.mayWrite(readEpoch, readTicket, q.data) && !confirmed)
        setDraft(d => ({ ...d, [key]: value })); }} editable={!write.locked && guard.current.mayWrite(readEpoch, readTicket, q.data) && !confirmed} multiline maxLength={2000}/>;
    async function save() {
        if (!guard.current.canRead())
            return;
        if (write.uncertain) {
            await write.retry();
            return;
        }
        if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed) {
            write.setError('Aktuellen eigenen Originalstand und Schreibzugriff zuerst prüfen.');
            return;
        }
        if (!w || !q.data || q.refreshError || q.loading || !action) {
            write.setError('Aktuellen Fall und vollständigen Verlauf zuerst laden.');
            return;
        }
        const d = { ...draft, action, closureKind: action === 'reopen' ? '' : draft.closureKind, occurredAt: medicationEventInstant(at), expectedUpdatedAt: String(w.updated_at ?? ''), expectedStatus: status, expectedAssessmentId: String(q.data.assessments[0]?.id ?? '') };
        const payload = { woundId: id, dataJson: JSON.stringify(d) };
        const error = (d.action === 'close' && d.closureKind === 'healed' ? validateWoundHealingCorrectionBasis(d.expectedAssessmentId, q.data.corrections) : null) ?? validateWoundLifecycle(payload) ?? validateWoundLifecycleSnapshot(d, w, q.data.assessments[0] ?? null, q.data.lifecycle[0] ?? null, q.data.assessments);
        if (error) {
            write.setError(error);
            return;
        }
        await write.submit(payload);
    }
    if (!guard.current.canRead() || (!canManage && !write.uncertain))
        return <ScreenShell title="Wundfallstatus"><ErrorState message="Lese- und Schreibberechtigung für Wunddokumentation erforderlich."/></ScreenShell>;
    if (confirmed)
        return <ScreenShell title="Fallstatus gespeichert"><SuccessState message="Begründetes Fallstatusereignis gespeichert. Frühere Befunde bleiben erhalten. Offene Anordnungen und Eskalationen wurden nicht automatisch erledigt."/><PremiumButton title="Aktuellen Wundfall und Verlauf öffnen" disabled={write.busy} onPress={() => { if (guard.current.mayClose(readEpoch) && !write.locked)
            onClose(); }}/></ScreenShell>;
    if (!guard.current.canShow(readEpoch, readTicket, q.data))
        return <ScreenShell title="Ursprüngliche Wundanfrage"><ErrorState message={q.error ?? q.refreshError ?? 'Aktuellen vollständigen eigenen Originalbestand zuerst laden.'}/>{write.error ? <ErrorState message={write.error}/> : null}{write.uncertain ? <><InfoBanner variant="warning" message="Speicherbestätigung fehlt. Die ursprüngliche Anfrage bleibt erhalten; derselbe Originalauftrag kann mit eigenen aktuellen Leserechten erneut geprüft werden."/><PremiumButton title="Dieselbe ursprüngliche Anfrage erneut prüfen" disabled={write.busy} onPress={save}/></> : <PremiumButton title="Eigenen vollständigen Originalbestand laden" variant="secondary" onPress={q.refresh}/>}</ScreenShell>;
    return <ScreenShell title={action === 'reopen' ? 'Wundfall begründet wiederöffnen' : 'Wundfall begründet abschließen'} subtitle={q.data ? `${q.data.clientName} · ${String(w?.body_location)}` : undefined}><ScrollView contentContainerStyle={styles.content}>
 {q.loading && !q.data ? <LoadingState message="Fall und vollständiger Verlauf werden geladen…"/> : !q.data ? <ErrorState message={q.error ?? 'Wundfall nicht zugänglich.'} onRetry={q.refresh}/> : null}
 {q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}{write.error ? <ErrorState message={write.error}/> : null}
 {write.uncertain ? <InfoBanner variant="warning" message="Speicherbestätigung fehlt. Angaben bleiben gesperrt; dieselbe unveränderte Anfrage erneut prüfen."/> : null}
 {q.data?.corrections.some(c => c.assessment_id === latest?.id) ? <InfoBanner variant="warning" message="Der letzte Befund besitzt Berichtigungsvermerke. Für einen neuen Abheilungsabschluss ein eigenes tatsächlich erhobenes Assessment dokumentieren. Vermerke und Auswirkungen im Wundverlauf prüfen."/> : null}
 {q.data ? <SectionPanel title="Zuletzt dokumentierter Befund als Entscheidungsbezug">{latest ? <>
 <Text style={styles.body}>Befund-ID: {String(latest.id)} · beobachtet: {actualTime(latest.observed_at)}</Text>
 <Text style={styles.body}>Erfasst: {actualTime(latest.created_at)} · {value(latest.recorded_by_name)}</Text>
 <Text style={styles.body}>Wundbett: {value(latest.wound_bed)}</Text><Text style={styles.body}>Wundrand: {value(latest.wound_edge)}</Text><Text style={styles.body}>Wundumgebung: {value(latest.surrounding_skin)}</Text>
 <Text style={styles.body}>Beobachtungen zu Infektionszeichen: {value(latest.infection_signs)}</Text><Text style={styles.body}>Dokumentierte Reaktion: {value(latest.response)}</Text>
 <InfoBanner variant="info" message="Dieser Befund wird der Entscheidung zugeordnet. Eine fachliche Abheilungsbeurteilung und aktuelle weitere Versorgung müssen Sie ausdrücklich begründen."/>
 </> : <InfoBanner variant="warning" message="Kein Befund dokumentiert. Eine Abheilung kann so nicht bestätigt werden; andere Abschlussgründe sind ausdrücklich zu begründen."/>}</SectionPanel> : null}
 {action ? <SectionPanel title={action === 'reopen' ? 'Neue Beurteilung erforderlich' : 'Tatsächlicher Abschlussgrund'}>
 {action === 'close' ? <FilterChipGroup wrap options={[{ key: 'healed', label: 'Abheilung fachlich festgestellt' }, { key: 'transfer', label: 'Versorgung übergeben' }, { key: 'care_ended', label: 'Versorgung beendet' }, { key: 'other', label: 'Anderer begründeter Abschluss' }]} value={draft.closureKind} onChange={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed ? undefined : value => { if (guard.current.mayWrite(readEpoch, readTicket, q.data) && !write.locked && !confirmed)
            setDraft(d => ({ ...d, closureKind: value })); }}/> : <InfoBanner variant="info" message="Die Wiederöffnung erfolgt im Entwurfsstatus. Frühere Abheilung oder Archivierung bleibt im Verlauf; neue Befunde und eine aktuelle Versorgung müssen gesondert beurteilt werden."/>}
 <MedicationEventTimeInput label="Tatsächlicher Zeitpunkt der Entscheidung" value={at} disabled={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed} onChange={value => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
            return; setAt(value); setEditedTime(true); }}/>
 {field('reason', action === 'reopen' ? 'Tatsächlicher Grund für Wiederöffnung *' : 'Tatsächlicher Abschlussgrund *')}
 {field('decisionBasis', 'Entscheidungsgrundlage, verantwortliche Beurteilung und Bezug auf Befund *')}
 {field('handover', 'Weitere Versorgung, Übergabe / noch offene Abstimmung oder begründet kein Bedarf *')}
 <InfoBanner variant="info" message="Abheilung benötigt einen zugeordneten tatsächlich erhobenen Befund. Der Fallabschluss löscht keine Dokumentation und beendet keine offene Anordnung oder Eskalation automatisch."/>
 </SectionPanel> : q.data ? <ErrorState message="Fallstatus nicht eindeutig. Keine Änderung möglich."/> : null}
 <View style={styles.actions}><PremiumButton title={write.busy ? 'Fallstatus wird gespeichert…' : write.uncertain ? 'Dieselbe Anfrage erneut prüfen' : action === 'reopen' ? 'Begründet wiederöffnen' : 'Begründet abschließen'} disabled={write.busy || (!write.uncertain && (!action || !q.data || !!q.refreshError || q.loading))} onPress={save}/><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.locked} onPress={async () => { if (guard.current.mayClose(readEpoch) && !write.locked && await write.confirmLeave() && guard.current.mayClose(readEpoch) && !write.locked)
        onClose(); }}/></View>
 {!write.locked ? <PremiumButton title="Fall und Verlauf neu laden" variant="secondary" onPress={q.refresh}/> : null}
 </ScrollView></ScreenShell>;
}
