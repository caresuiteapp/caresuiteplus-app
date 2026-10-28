// Generated native presentation from src/screens/pflege/VitalReadingCreateScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { MedicationEventTimeInput, currentMedicationEventTime, medicationEventInstant } from "../../components/pflege/MedicationEventTimeInput.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from "../../hooks/useMedicationSubmission.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { getVitalDefinition } from '@/lib/pflege/vitalCatalog';
import { deriveVitalValues, parseVitalNumber, requiredVitalComponents, validateVitalMeasurement, type VitalMeasurementPayload } from '@/lib/pflege/vitalMeasurementDomain';
import { VitalCreateRuntimeWeb } from "../../lib/pflege/vitalCreateRuntime.native.ts";
import { fetchVitalCreateClientsWeb, fetchVitalCreateChoicesWeb } from "../../lib/pflege/vitalCreateOriginalRead.native.ts";
import { executeVitalCreateNativeWeb } from "../../lib/pflege/vitalCreateNativeWrite.native.ts";
import { carePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
export function VitalReadingCreateScreen() {
    const auth = useAuth(), permissions = usePermissions(), tenantId = useServiceTenantId();
    const owner = carePermissionOwner(auth, tenantId, isDemoMode()), native = useRef({ auth, permissions, tenantId });
    native.current = { auth, permissions, tenantId };
    const live = useRef(() => { const current = native.current; if (current.permissions.tenantId !== current.tenantId || current.permissions.roleKey !== current.auth.profile?.roleKey || !Object.isFrozen(current.permissions.permissions))
        throw Error('Aktueller eigener nativer Rechteursprung fehlt.'); const descriptor = Object.getOwnPropertyDescriptor(current.permissions, 'can'); if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function')
        throw Error('Aktueller nativer Rechtebezug fehlt.'); return { owner: carePermissionOwner(current.auth, current.tenantId, isDemoMode()), can: descriptor.value }; });
    const scope = owner ? JSON.stringify([owner.tenantId, owner.profileId, owner.roleKey]) : null, held = useRef<{
        scope: string;
        runtime: VitalCreateRuntimeWeb;
    } | null>(null);
    if (scope && held.current?.scope !== scope) {
        held.current?.runtime.dispose();
        try {
            held.current = { scope, runtime: new VitalCreateRuntimeWeb(owner!, live.current) };
        }
        catch {
            held.current = null;
        }
    }
    useEffect(() => () => held.current?.runtime.dispose(), []);
    const runtime = held.current?.runtime ?? null;
    const [, setOwnerStoreRevision] = useState(0);
    useEffect(() => runtime?.subscribeOriginal(() => setOwnerStoreRevision(value => value + 1)), [runtime]);
    if (!runtime)
        return <ScreenShell title="Vitalwerte erfassen"><ErrorState message="Der aktuelle eigene Benutzer- und Pflegezugriff konnte nicht bestätigt werden."/></ScreenShell>;
    return <VitalCreateWorkspace key={`${scope}:${runtime.originalDraftVersion}`} runtime={runtime} tenantId={runtime.tenantId} role={runtime.role} canView={runtime.canRead()} canManage={runtime.canManage()}/>;
}
function VitalCreateWorkspace({ runtime, tenantId, role, canView, canManage }: {
    runtime: VitalCreateRuntimeWeb;
    tenantId: string;
    role: RoleKey | null;
    canView: boolean;
    canManage: boolean;
}) {
    const router = useRouter(), styles = useStyles();
    const [clientId, setClientId] = useState(''), [type, setType] = useState(''), [values, setValues] = useState<Record<string, string>>({}), [context, setContext] = useState<Record<string, string>>({}), [note, setNote] = useState('');
    const [time, setTime] = useState(currentMedicationEventTime), [timeEdited, setTimeEdited] = useState(false);
    const readScope = runtime.captureReadScope(), readScopeVersion = runtime.readScopeVersion;
    const clientsQuery = useAsyncQuery(() => fetchVitalCreateClientsWeb(runtime, readScope), [runtime, readScope, canView], { enabled: canView && !!readScope, queryKey: `${tenantId}:${role}:${canView}:${readScopeVersion}:vital-clients` });
    const choicesQuery = useAsyncQuery(() => fetchVitalCreateChoicesWeb(runtime, clientId, readScope), [runtime, readScope, clientId, canView], { enabled: !!clientId && canView && !!readScope, queryKey: `${tenantId}:${role}:${clientId}:${canView}:${readScopeVersion}:vital-choices` });
    const flags = (query: typeof clientsQuery) => ({ loading: query.loading, refreshing: query.refreshing, error: !!query.error, refreshError: !!query.refreshError, previewData: query.previewData, tableMissing: query.tableMissing, fromCache: query.cacheMeta.fromCache, partialDetail: !!query.cacheMeta.partialDetail, usedDemoFallback: false });
    runtime.setView('clients', clientsQuery.data, flags(clientsQuery));
    runtime.setView('choices', choicesQuery.data, flags(choicesQuery as unknown as typeof clientsQuery));
    const clients = { ...clientsQuery, data: runtime.visible('clients', clientsQuery.data) }, choices = { ...choicesQuery, data: runtime.visible('choices', choicesQuery.data) };
    const definition = getVitalDefinition(type), choice = choices.data?.find(x => x.key === type), client = clients.data?.find(c => c.id === clientId);
    const draftRevision = useRef(0), renderRevision = draftRevision.current;
    useEffect(() => { runtime.mount(); return () => runtime.dispose(); }, [runtime]);
    const [confirmedId, setConfirmedId] = useState('');
    const [, setOriginalRevision] = useState(0);
    useEffect(() => runtime.subscribeOriginal(() => setOriginalRevision(value => value + 1)), [runtime]);
    const dirty = !confirmedId && !!(clientId || type || Object.values(values).some(Boolean) || Object.values(context).some(Boolean) || note || timeEdited);
    const receiptId = useRef('');
    const write = useMedicationSubmission<VitalMeasurementPayload>(dirty || runtime.originalRequestState().pending, async (id, payload, replay) => {
        const result = await executeVitalCreateNativeWeb(runtime, id, payload, replay);
        if (result.ok)
            receiptId.current = result.data.id;
        return result;
    }, () => { if (runtime.mayConfirm(receiptId.current))
        setConfirmedId(receiptId.current); });
    const originalRequest = runtime.originalRequestState(), originalRetry = runtime.captureOriginalRetry(), busy = write.busy || originalRequest.busy, locked = write.locked || originalRequest.pending, uncertain = write.uncertain || originalRequest.uncertain;
    const currentDraft = () => !runtime.originalRequestState().pending && renderRevision === draftRevision.current && !write.locked && !confirmedId && runtime.maySelect('choices', choicesQuery.data) && runtime.canShow('clients', clientsQuery.data);
    const changeClient = (id: string) => { if (id === clientId)
        return; if (renderRevision !== draftRevision.current || runtime.originalRequestState().pending || write.locked || !runtime.maySelect('clients', clientsQuery.data) || clients.data?.filter(c => c.id === id).length !== 1)
        return; draftRevision.current++; runtime.clearChoices(); setClientId(id); setType(''); setValues({}); setContext({}); setNote(''); };
    const changeType = (key: string) => { if (!currentDraft() || choices.data?.filter(c => c.key === key && c.enabled).length !== 1)
        return; draftRevision.current++; setType(key); setValues({}); setContext({}); };
    const editValues = (next: Parameters<typeof setValues>[0]) => { if (currentDraft()) {
        draftRevision.current++;
        setValues(next);
    } };
    const editContext = (next: Parameters<typeof setContext>[0]) => { if (currentDraft()) {
        draftRevision.current++;
        setContext(next);
    } };
    const editNote = (value: string) => { if (currentDraft()) {
        draftRevision.current++;
        setNote(value);
    } };
    const editTime = (value: typeof time) => { if (currentDraft()) {
        draftRevision.current++;
        setTime(value);
        setTimeEdited(true);
    } };
    const editable = currentDraft();
    async function close() { if (renderRevision !== draftRevision.current)
        return; const originalClose = runtime.captureClose(); if (!originalClose)
        return; const leave = await write.confirmLeave(); if (leave && renderRevision === draftRevision.current && runtime.mayCloseCaptured(originalClose))
        router.back(); }
    async function save() {
        if (!runtime.canManage())
            return;
        if (runtime.confirmedReceipt() || runtime.originalRequestState().busy)
            return;
        if (originalRequest.pending) {
            if (write.uncertain) {
                await write.retry();
                return;
            }
            const result = await runtime.retryOriginal(originalRetry);
            if (!result.ok)
                write.setError(result.error);
            return;
        }
        if (write.uncertain) {
            await write.retry();
            return;
        }
        if (!currentDraft()) {
            write.setError('Aktuellen ganzen Originalbestand und eigene Rechte zuerst bestätigen.');
            return;
        }
        if (!definition || !choice?.enabled || !client || choices.refreshError || clients.refreshError) {
            write.setError('Klient:in, aktivierte Messart und aktuellen Konfigurationsstand prüfen.');
            return;
        }
        const numbers: Record<string, number> = {};
        for (const component of definition.components) {
            if (['total', 'balance'].includes(component.key))
                continue;
            const raw = values[component.key] ?? '';
            if (!raw.trim())
                continue;
            const value = parseVitalNumber(raw);
            if (value === null) {
                write.setError(`${component.label}: eine gültige Dezimalzahl ohne Tausendertrennzeichen eingeben.`);
                return;
            }
            numbers[component.key] = value;
        }
        const payload = { clientId, type, occurredAt: medicationEventInstant(time), valuesJson: JSON.stringify(deriveVitalValues(type, numbers)), contextJson: JSON.stringify(Object.fromEntries(Object.entries(context).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]))), note, catalogVersion: choice.catalogVersion, configurationVersion: choice.configurationVersion };
        const error = validateVitalMeasurement(payload, definition);
        if (error) {
            write.setError(error);
            return;
        }
        if (!runtime.prepare(payload, clientsQuery.data, choicesQuery.data)) {
            write.setError('Aktuelle native Messdefinition, Einheit und Pflegefallzuordnung zuerst bestätigen.');
            return;
        }
        await write.submit(payload);
    }
    if (!canView)
        return <ScreenShell title="Vitalwerte erfassen"><ErrorState message="Für Vitalwerte fehlt die Leseberechtigung."/></ScreenShell>;
    if (!canManage)
        return <ScreenShell title="Vitalwerte erfassen"><ErrorState message="Für das Erfassen von Vitalwerten fehlt die Schreibberechtigung."/></ScreenShell>;
    const displayedReceipt = runtime.confirmedReceipt(), newDraftToken = runtime.captureNewDraft();
    const newMeasurement = () => { if (renderRevision !== draftRevision.current || !displayedReceipt)
        return; const freshTime = currentMedicationEventTime(); if (renderRevision !== draftRevision.current || !runtime.startNewDraft(newDraftToken))
        return; draftRevision.current++; setConfirmedId(''); receiptId.current = ''; setClientId(''); setType(''); setValues({}); setContext({}); setNote(''); setTime(freshTime); setTimeEdited(false); };
    const openReceipt = () => { if (displayedReceipt && runtime.confirmedReceipt() === displayedReceipt && runtime.mayConfirm(displayedReceipt))
        router.replace(`/pflege/vitalwerte/${displayedReceipt}` as never); };
    const openOverview = () => { if (displayedReceipt && runtime.confirmedReceipt() === displayedReceipt && runtime.mayConfirm(displayedReceipt))
        router.replace('/pflege/vitalwerte' as never); };
    if (displayedReceipt)
        return <ScreenShell title="Vitalwert gespeichert"><SuccessState message="Die Datenbank hat die Speicherung bestätigt. Öffnen Sie die gespeicherte Messung, um Originalangaben und Folgedokumentation erneut zu laden."/><View style={styles.row}><PremiumButton title="Gespeicherte Messung öffnen" disabled={busy} onPress={openReceipt}/><PremiumButton title="Zur Vitalwertübersicht" variant="secondary" disabled={busy} onPress={openOverview}/><PremiumButton title="Neue Messung vorbereiten" variant="secondary" disabled={busy} onPress={newMeasurement}/></View></ScreenShell>;
    return <ScreenShell title="Vitalwerte erfassen" subtitle={client ? client.name : 'Pflegeklient:in ausdrücklich auswählen'}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {write.error ? <ErrorState message={write.error}/> : null}
    {uncertain ? <InfoBanner variant="warning" title="Speicherergebnis noch unklar" message="Die Anfrage bleibt unverändert. Bitte dieselbe Messung erneut prüfen. Änderungen und Schließen sind bis zur Klärung gesperrt."/> : null}
    <SectionPanel title="Klient:in">
      {clients.loading && !clients.data ? <LoadingState message="Aktive Pflegefälle werden geladen…"/> : clients.error ? <ErrorState message={clients.error} onRetry={clients.refresh}/> : clients.data?.length ? <FilterChipGroup wrap options={clients.data.map(c => ({ key: c.id, label: c.name }))} value={clientId} onChange={locked ? undefined : changeClient}/> : <Text style={styles.note}>Keine aktiven zugänglichen Pflegefälle vorhanden.</Text>}
      {clients.refreshError ? <ErrorState message={clients.refreshError} onRetry={clients.refresh}/> : null}
    </SectionPanel>
    {clientId ? <SectionPanel title="Messart und Einheit">
      {choices.loading && !choices.data ? <LoadingState message="Messkatalog und klientenbezogene Konfiguration werden geladen…"/> : choices.error ? <ErrorState message={choices.error} onRetry={choices.refresh}/> : <FilterChipGroup wrap options={(choices.data ?? []).filter(c => c.enabled).map(c => ({ key: c.key, label: getVitalDefinition(c.key)?.label ?? c.key }))} value={type} onChange={locked ? undefined : changeType}/>}
      {choices.data && !choices.data.some(c => c.enabled) ? <Text style={styles.note}>Keine Messart für diesen Pflegefall aktiviert. Die zuständige Person muss die Messkonfiguration prüfen.</Text> : null}
      {choices.refreshError ? <ErrorState message={choices.refreshError} onRetry={choices.refresh}/> : null}
      {definition ? <View style={styles.form}>
        <View style={styles.row}>{definition.components.filter(c => !['total', 'balance'].includes(c.key)).map(component => <View key={component.key} style={styles.field}><PremiumInput label={`${component.label} (${component.unit})${requiredVitalComponents(definition).includes(component.key) ? ' *' : ''}`} accessibilityLabel={`${component.label} in ${component.unit}`} value={values[component.key] ?? ''} editable={editable} keyboardType="decimal-pad" onChangeText={value => editValues(v => ({ ...v, [component.key]: value }))}/></View>)}</View>
        {type === 'gcs' || type === 'fluid_balance' ? <Text style={styles.note}>Gesamtwert wird aus den Einzelangaben berechnet und nicht als unabhängige Messung übernommen.</Text> : null}
        {type === 'fluid_balance' ? <><Text style={styles.note}>Umfang der erfassten Ein- und Ausfuhr:</Text><FilterChipGroup wrap options={[{ key: 'complete', label: 'Vollständig erfasst' }, { key: 'incomplete', label: 'Unvollständig erfasst' }, { key: 'unknown', label: 'Umfang unbekannt' }]} value={context.completeness ?? ''} onChange={locked ? undefined : completeness => editContext(c => ({ ...c, completeness, incompleteReason: '' }))}/>{context.completeness && context.completeness !== 'complete' ? <PremiumInput label="Fehlende Angaben / Einschränkung *" value={context.incompleteReason ?? ''} editable={editable} maxLength={500} onChangeText={incompleteReason => editContext(c => ({ ...c, incompleteReason }))}/> : null}</> : null}
        {type === 'pain_score' ? <><Text style={styles.note}>Verwendete Skala ausdrücklich bestätigen:</Text><FilterChipGroup options={[{ key: 'NRS', label: 'NRS 0–10' }]} value={context.scale ?? ''} onChange={locked ? undefined : scale => editContext(c => ({ ...c, scale }))}/></> : null}
        {(definition.contextFields ?? []).filter(f => !(type === 'pain_score' && f.key === 'scale')).map(field => <PremiumInput key={field.key} label={field.label} accessibilityLabel={field.label} value={context[field.key] ?? ''} editable={editable} maxLength={500} onChangeText={value => editContext(c => ({ ...c, [field.key]: value }))}/>)}</View> : null}
    </SectionPanel> : null}
    <SectionPanel title="Zeitpunkt und Messkontext">
      <MedicationEventTimeInput label="Tatsächlicher Messzeitpunkt" value={time} disabled={!editable} onChange={editTime}/>
      <PremiumInput label="Beobachtung, Messbedingungen und Reaktion" accessibilityLabel="Messnotiz" value={note} editable={editable} onChangeText={editNote} maxLength={4000} multiline/>
      <InfoBanner variant="info" message="Erfassungszeit und angemeldete Person werden serverseitig dokumentiert. Konfigurierte Grenzbereiche sind keine Diagnose oder Therapieanweisung. Auffälligkeiten nach dem fachlich vereinbarten Vorgehen behandeln."/>
    </SectionPanel>
    <View style={styles.row}><PremiumButton title={busy ? 'Messung wird gespeichert…' : uncertain ? 'Dieselbe Messung erneut prüfen' : 'Messung speichern'} disabled={busy || (!uncertain && (!definition || !choice?.enabled || !client || !!choices.refreshError || !!clients.refreshError))} onPress={save}/><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={locked} onPress={close}/></View>
  </ScrollView></ScreenShell>;
}
function useStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 }, form: { gap: spacing.md, minWidth: 0 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, field: { flex: 1, flexBasis: 240, minWidth: 0 }, body: { ...typography.body, color: c.text }, note: { ...typography.caption, color: c.muted } }), [c]); }
