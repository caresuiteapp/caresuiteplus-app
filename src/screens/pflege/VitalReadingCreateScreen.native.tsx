// Generated native presentation from src/screens/pflege/VitalReadingCreateScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { MedicationEventTimeInput, currentMedicationEventTime, medicationEventInstant } from "../../components/pflege/MedicationEventTimeInput.native.tsx";
import { VitalMeasurementArtwork } from '@/components/pflege/VitalMeasurementArtwork';
import { useAuth } from '@/lib/auth/context';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from "../../hooks/useMedicationSubmission.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { radius, spacing, typography } from '@/theme';
import { getVitalDefinition, VITAL_CATEGORY_LABELS, VITAL_SIGN_CATALOG, type VitalCategoryKey, type VitalSignDefinition } from '@/lib/pflege/vitalCatalog';
import { deriveVitalValues, parseVitalNumber, requiredVitalComponents, validateVitalMeasurement, type VitalMeasurementPayload } from '@/lib/pflege/vitalMeasurementDomain';
import { VitalCreateRuntimeWeb } from "../../lib/pflege/vitalCreateRuntime.native.ts";
import { takeVitalCaptureClient } from '@/lib/pflege/vitalCaptureHandoff';
import { fetchVitalCreateClientsWeb, fetchVitalCreateChoicesWeb } from "../../lib/pflege/vitalCreateOriginalRead.native.ts";
import { executeVitalCreateNativeWeb } from "../../lib/pflege/vitalCreateNativeWrite.native.ts";
import { carePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import { CarePermissionStatus, type CarePermissionStatusState } from "./CarePermissionStatus.native.tsx";
const categories = Object.keys(VITAL_CATEGORY_LABELS) as VitalCategoryKey[];
const allCategories = 'all';
const clientPageSize = 12;
type CatalogueView = 'enabled' | 'catalogue';
const catalogueFilters: {
    key: CatalogueView;
    label: string;
}[] = [{ key: 'enabled', label: 'Für diese Akte aktiviert' }, { key: 'catalogue', label: 'Alle Messarten im Katalog' }];
const fluidCompleteness = [
    { key: 'complete', label: 'Vollständig erfasst' },
    { key: 'incomplete', label: 'Unvollständig erfasst' },
    { key: 'unknown', label: 'Umfang unbekannt' },
];
const painScale = [{ key: 'NRS', label: 'NRS 0–10' }];
const scaleOptions = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => {
    const key = String(min + i);
    return { key, label: key.replace('-', '−') };
});
const measurementScales: Readonly<Record<string, Readonly<Record<string, ReturnType<typeof scaleOptions>>>>> = {
    gcs: { eyes: scaleOptions(1, 4), verbal: scaleOptions(1, 5), motor: scaleOptions(1, 6) },
    rass: { value: scaleOptions(-5, 4) },
    pain_score: { value: scaleOptions(0, 10) },
};
const textOptions = (...labels: string[]) => labels.map(label => ({ key: label, label }));
// Optional shortcuts for the existing catalog fields. They never replace free text.
const contextOptions: Readonly<Partial<Record<VitalSignDefinition['key'], Readonly<Record<string, ReturnType<typeof textOptions>>>>>> = {
    blood_pressure: { position: textOptions('sitzend', 'liegend', 'stehend'), arm: textOptions('links', 'rechts'), cuff: textOptions('klein', 'Standard', 'groß', 'XL', 'Handgelenk') },
    pulse: { rhythm: textOptions('regelmäßig', 'unregelmäßig'), method: textOptions('manuell', 'Monitor') },
    respiratory_rate: { pattern: textOptions('regelmäßig', 'flach', 'vertieft') },
    oxygen: { oxygenSupport: textOptions('Raumluft', 'Nasenbrille', 'Maske', 'Reservoirmaske', 'HFNC'), perfusion: textOptions('gut', 'eingeschränkt') },
    temperature: { site: textOptions('Ohr', 'Stirn', 'oral', 'axillär', 'rektal'), method: textOptions('Kontakt', 'kontaktlos') },
    weight: { clothing: textOptions('ohne Kleidung', 'leicht bekleidet', 'bekleidet'), scale: textOptions('Standwaage', 'Sitzwaage', 'Bettwaage', 'Rollstuhlwaage') },
    blood_glucose: { mealContext: textOptions('nüchtern', 'präprandial', 'postprandial'), sample: textOptions('kapillär', 'venös', 'Sensor') },
    capillary_refill: { site: textOptions('Finger', 'Sternum') },
    pain_score: { location: textOptions('Kopf', 'Hals', 'Brustkorb', 'Bauch', 'Rücken', 'Arm', 'Bein', 'mehrere Regionen') },
    urine_output: { period: textOptions('Frühdienst', 'Spätdienst', 'Nachtdienst', '24 Stunden'), route: textOptions('spontan', 'Dauerkatheter', 'Einmalkatheter', 'Urostoma') },
    fluid_balance: { period: textOptions('Frühdienst', 'Spätdienst', 'Nachtdienst', '24 Stunden') },
    arterial_pressure: { site: textOptions('A. radialis', 'A. femoralis', 'A. brachialis', 'A. dorsalis pedis') },
    cvp: { reference: textOptions('Phlebostatische Achse', 'Rückenlage', 'Oberkörper erhöht') },
    pupils: { leftReaction: textOptions('prompt', 'träge', 'keine'), rightReaction: textOptions('prompt', 'träge', 'keine') },
    etco2: { method: textOptions('Hauptstrom', 'Nebenstrom') },
    oxygen_flow: { device: textOptions('Nasenbrille', 'Maske', 'HFNC') },
    ventilator_rate: { mode: textOptions('PSV', 'PCV', 'VC', 'SIMV', 'CPAP') },
    ph: { sample: textOptions('arteriell', 'venös', 'kapillär') },
};
const typeAliases: Readonly<Record<string, string>> = {
    blood_pressure: 'rr blutdruck', pulse: 'herzfrequenz hf',
    respiratory_rate: 'atemfrequenz af', oxygen: 'sauerstoff o2 spo2',
};
const searchText = (value: string) => value.normalize('NFKD').replace(/\p{Mark}/gu, '').toLocaleLowerCase('de-DE').replaceAll('ß', 'ss').trim();
const matches = (query: string, value: string) => query.split(/\s+/).every(term => searchText(value).includes(term));
const unitsFor = (definition: VitalSignDefinition) => [...new Set(definition.components.map(component => component.unit).filter(Boolean))].join(' · ');
function IntakeStep({ number, title, hint, badge, children, styles }: {
    number: number;
    title: string;
    hint?: string;
    badge?: string;
    children: ReactNode;
    styles: ReturnType<typeof useStyles>;
}) {
    return <View style={styles.step}>
    <View style={styles.stepHead}>
      <View style={styles.stepMarker} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <View style={styles.stepHeading}>
        <Text accessibilityRole="header" style={styles.stepTitle}>{title}</Text>
        {hint ? <Text style={styles.note}>{hint}</Text> : null}
      </View>
      {badge ? <Text style={styles.stepBadge}>{badge}</Text> : null}
    </View>
    <View style={styles.stepBody}>{children}</View>
  </View>;
}
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
        return <ScreenShell title="Vitalwerte erfassen"><CarePermissionStatus state={permissions} deniedMessage="Der eigene Benutzer- und Pflegezugriff konnte nicht bestätigt werden."/></ScreenShell>;
    return <VitalCreateWorkspace key={`${scope}:${runtime.originalDraftVersion}`} runtime={runtime} tenantId={runtime.tenantId} role={runtime.role} ownerProfileId={owner?.profileId ?? null} canView={runtime.canRead()} canManage={runtime.canManage()} permissionStatus={permissions}/>;
}
function VitalCreateWorkspace({ runtime, tenantId, role, ownerProfileId, canView, canManage, permissionStatus }: {
    runtime: VitalCreateRuntimeWeb;
    tenantId: string;
    role: RoleKey | null;
    ownerProfileId: string | null;
    canView: boolean;
    canManage: boolean;
    permissionStatus: CarePermissionStatusState;
}) {
    const router = useRouter(), styles = useStyles();
    const [clientId, setClientId] = useState(''), [type, setType] = useState(''), [values, setValues] = useState<Record<string, string>>({}), [context, setContext] = useState<Record<string, string>>({}), [note, setNote] = useState('');
    const [time, setTime] = useState(currentMedicationEventTime), [timeEdited, setTimeEdited] = useState(false);
    const [clientSearch, setClientSearch] = useState(''), [measurementSearch, setMeasurementSearch] = useState('');
    const [visibleClientCount, setVisibleClientCount] = useState(clientPageSize);
    const [category, setCategory] = useState<VitalCategoryKey | typeof allCategories>(allCategories);
    const [catalogueView, setCatalogueView] = useState<CatalogueView>('enabled');
    const [editingClient, setEditingClient] = useState(false), [editingMeasurement, setEditingMeasurement] = useState(false);
    const [showNote, setShowNote] = useState(false);
    const [suggestedClientId, setSuggestedClientId] = useState<string | null>(null);
    useEffect(() => {
        if (!ownerProfileId || !role || !canView || !canManage || !runtime.canManage())
            return;
        const suggested = takeVitalCaptureClient({ tenantId, profileId: ownerProfileId, roleKey: role });
        if (suggested)
            setSuggestedClientId(suggested);
    }, [runtime, tenantId, ownerProfileId, role, canView, canManage]);
    const readScope = runtime.captureReadScope(), readScopeVersion = runtime.readScopeVersion;
    const clientsQuery = useAsyncQuery(() => fetchVitalCreateClientsWeb(runtime, readScope), [runtime, readScope, canView], { enabled: canView && !!readScope, queryKey: `${tenantId}:${role}:${canView}:${readScopeVersion}:vital-clients` });
    const choicesQuery = useAsyncQuery(() => fetchVitalCreateChoicesWeb(runtime, clientId, readScope), [runtime, readScope, clientId, canView], { enabled: !!clientId && canView && !!readScope, queryKey: `${tenantId}:${role}:${clientId}:${canView}:${readScopeVersion}:vital-choices` });
    const flags = (query: typeof clientsQuery) => ({ loading: query.loading, refreshing: query.refreshing, error: !!query.error, refreshError: !!query.refreshError, previewData: query.previewData, tableMissing: query.tableMissing, fromCache: query.cacheMeta.fromCache, partialDetail: !!query.cacheMeta.partialDetail, usedDemoFallback: false });
    runtime.setView('clients', clientsQuery.data, flags(clientsQuery));
    runtime.setView('choices', choicesQuery.data, flags(choicesQuery as unknown as typeof clientsQuery));
    const clients = { ...clientsQuery, data: runtime.visible('clients', clientsQuery.data) }, choices = { ...choicesQuery, data: runtime.visible('choices', choicesQuery.data) };
    const definition = getVitalDefinition(type), choice = choices.data?.find(x => x.key === type), client = clients.data?.find(c => c.id === clientId);
    useEffect(() => {
        if (suggestedClientId && clients.data && clients.data.filter(item => item.id === suggestedClientId).length !== 1)
            setSuggestedClientId(null);
    }, [clients.data, suggestedClientId]);
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
    const changeClient = (id: string) => {
        if (renderRevision !== draftRevision.current || runtime.originalRequestState().pending || write.locked || !runtime.maySelect('clients', clientsQuery.data) || clients.data?.filter(c => c.id === id).length !== 1)
            return;
        setEditingClient(false);
        setSuggestedClientId(null);
        if (id === clientId)
            return;
        draftRevision.current++;
        runtime.clearChoices();
        setClientId(id);
        setType('');
        setValues({});
        setContext({});
        setNote('');
        setClientSearch('');
        setVisibleClientCount(clientPageSize);
        setMeasurementSearch('');
        setCategory(allCategories);
        setCatalogueView('enabled');
        setEditingMeasurement(false);
        setShowNote(false);
        write.setError(null);
    };
    const changeType = (key: string) => {
        if (editingClient || !currentDraft() || choices.data?.filter(c => c.key === key && c.enabled).length !== 1)
            return;
        setEditingMeasurement(false);
        if (key === type)
            return;
        draftRevision.current++;
        setType(key);
        setValues({});
        setContext({});
        setMeasurementSearch('');
        setCategory(allCategories);
        setCatalogueView('enabled');
        write.setError(null);
    };
    const toggleClientPicker = () => {
        if (renderRevision !== draftRevision.current || runtime.originalRequestState().pending || write.locked || !runtime.maySelect('clients', clientsQuery.data))
            return;
        draftRevision.current++;
        setEditingClient(!editingClient);
    };
    const toggleMeasurementPicker = () => { if (!editingClient && currentDraft()) {
        draftRevision.current++;
        setEditingMeasurement(!editingMeasurement);
    } };
    const mayEditFields = () => !editingClient && !editingMeasurement && currentDraft();
    const editValues = (next: Parameters<typeof setValues>[0]) => { if (mayEditFields()) {
        draftRevision.current++;
        setValues(next);
    } };
    const editContext = (next: Parameters<typeof setContext>[0]) => { if (mayEditFields()) {
        draftRevision.current++;
        setContext(next);
    } };
    const editNote = (value: string) => { if (mayEditFields()) {
        draftRevision.current++;
        setNote(value);
    } };
    const editTime = (value: typeof time) => { if (mayEditFields()) {
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
        if (editingClient || editingMeasurement) {
            write.setError('Bitte bestätigen Sie Pflegefall und Messart vor dem Speichern.');
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
    if (!canView || !canManage)
        return <ScreenShell title="Vitalwerte erfassen"><CarePermissionStatus state={permissionStatus} deniedMessage={canView ? 'Für das Erfassen von Vitalwerten fehlt die Schreibberechtigung.' : 'Für Vitalwerte fehlt die Leseberechtigung.'}/></ScreenShell>;
    const displayedReceipt = runtime.confirmedReceipt(), newDraftToken = runtime.captureNewDraft();
    const newMeasurement = () => { if (renderRevision !== draftRevision.current || !displayedReceipt)
        return; const freshTime = currentMedicationEventTime(); if (renderRevision !== draftRevision.current || !runtime.startNewDraft(newDraftToken))
        return; draftRevision.current++; setConfirmedId(''); receiptId.current = ''; setClientId(''); setType(''); setValues({}); setContext({}); setNote(''); setTime(freshTime); setTimeEdited(false); setClientSearch(''); setVisibleClientCount(clientPageSize); setMeasurementSearch(''); setCategory(allCategories); setCatalogueView('enabled'); setEditingClient(false); setEditingMeasurement(false); setShowNote(false); setSuggestedClientId(null); };
    const openReceipt = () => { if (displayedReceipt && runtime.confirmedReceipt() === displayedReceipt && runtime.mayConfirm(displayedReceipt))
        router.replace(`/pflege/vitalwerte/${displayedReceipt}` as never); };
    const openOverview = () => { if (displayedReceipt && runtime.confirmedReceipt() === displayedReceipt && runtime.mayConfirm(displayedReceipt))
        router.replace('/pflege/vitalwerte' as never); };
    if (displayedReceipt)
        return <ScreenShell title="Vitalwert gespeichert" compactHeader>
    <View style={styles.content}>
      <SuccessState message="Die Datenbank hat die Speicherung bestätigt."/>
      <View style={styles.actionButtons}>
        <PremiumButton title="Gespeicherte Messung öffnen" disabled={busy} onPress={openReceipt}/>
        <PremiumButton title="Neue Messung vorbereiten" variant="secondary" disabled={busy} onPress={newMeasurement}/>
        <PremiumButton title="Zur Vitalwertübersicht" variant="ghost" disabled={busy} onPress={openOverview}/>
      </View>
    </View>
  </ScreenShell>;
    const confirmedCatalogue = !!client && !!choices.data;
    const catalogue = confirmedCatalogue ? (choices.data ?? []).flatMap(item => {
        const definition = getVitalDefinition(item.key);
        return definition ? [{ definition, enabled: item.enabled }] : [];
    }) : VITAL_SIGN_CATALOG.map(definition => ({ definition, enabled: false }));
    const enabledCount = catalogue.filter(item => item.enabled).length;
    const typeOptions = confirmedCatalogue && catalogueView === 'enabled' ? catalogue.filter(item => item.enabled) : catalogue;
    const selectedMeasurement = choice?.enabled && client ? definition : null;
    const suggestedMatches = suggestedClientId ? (clients.data ?? []).filter(item => item.id === suggestedClientId) : [];
    const suggestedClient = !clientId && suggestedMatches.length === 1 ? suggestedMatches[0] : null;
    const clientNeedle = searchText(clientSearch);
    const visibleClients = (clients.data ?? []).filter(item => matches(clientNeedle, item.name));
    const measurementNeedle = searchText(measurementSearch);
    const visibleDefinitions = typeOptions.filter(({ definition: item }) => (category === allCategories || item.category === category)
        && matches(measurementNeedle, [item.label, item.shortLabel, unitsFor(item), typeAliases[item.key] ?? ''].join(' ')));
    const categoryOptions = [
        { key: allCategories as VitalCategoryKey | typeof allCategories, label: 'Alle Messarten' },
        ...categories.filter(key => typeOptions.some(({ definition: item }) => item.category === key)).map(key => ({ key, label: VITAL_CATEGORY_LABELS[key] })),
    ];
    const required = selectedMeasurement ? requiredVitalComponents(selectedMeasurement) : [];
    const editableMeasurement = mayEditFields() && !!selectedMeasurement;
    const stageHint = uncertain ? 'Speicherung prüfen' : !client || editingClient ? 'Pflegefall auswählen' : !selectedMeasurement || editingMeasurement ? 'Messart auswählen' : 'Werte und Zeitpunkt prüfen';
    return <ScreenShell title="Vitalwerte erfassen" subtitle={client ? client.name : 'Neue Messung'} scroll={false} compactHeader showBack={!locked} onBack={() => void close()}>
    <View style={styles.workspace}>
      <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {write.error ? <ErrorState message={write.error}/> : null}
          {uncertain ? <InfoBanner variant="warning" title="Speicherergebnis noch unklar" message="Die Anfrage bleibt unverändert. Bitte dieselbe Messung erneut prüfen. Änderungen und Schließen sind bis zur Klärung gesperrt."/> : null}

          <IntakeStep number={1} title="Pflegefall" hint="Wählen Sie die Person, bei der gemessen wurde." badge={client ? 'Ausgewählt' : undefined} styles={styles}>
            {clients.loading && !clients.data ? <LoadingState presentation="inline" message="Aktive Pflegefälle werden geladen…"/> : null}
            {clients.error ? <ErrorState presentation="inline" message={clients.error} onRetry={clients.refresh}/> : null}
            {clients.refreshError ? <ErrorState presentation="inline" message={clients.refreshError} onRetry={clients.refresh}/> : null}
            {clients.data && !clients.data.length ? <Text style={styles.note}>Keine aktiven, zugänglichen Pflegefälle vorhanden.</Text> : null}
            {suggestedClient ? <View style={styles.highlight}>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>{suggestedClient.name}</Text>
                <Text style={styles.note}>Aus dem Vitalwertverlauf. Bitte die Person bestätigen.</Text>
              </View>
              <PremiumButton title="Auswahl bestätigen" accessibilityLabel="Klientenauswahl aus dem Verlauf bestätigen" size="sm" disabled={locked} onPress={() => changeClient(suggestedClient.id)}/>
            </View> : null}
            {client ? <View style={styles.selection}>
              <Text style={styles.selectedTitle}>{client.name}</Text>
              <PremiumButton title={editingClient ? 'Pflegefall beibehalten' : 'Pflegefall ändern'} size="sm" variant="secondary" disabled={locked} onPress={toggleClientPicker}/>
            </View> : null}
            {clients.data?.length && (!client || editingClient) ? <>
              <PremiumInput label="Pflegefall suchen" accessibilityLabel="Pflegefall suchen" placeholder="Vor- oder Nachname" value={clientSearch} editable={!locked} maxLength={140} onChangeText={search => { setClientSearch(search); setVisibleClientCount(clientPageSize); }}/>
              <Text style={styles.note} accessibilityLiveRegion="polite">{visibleClients.length} {visibleClients.length === 1 ? 'Pflegefall' : 'Pflegefälle'}{clientNeedle ? ' gefunden' : ''}</Text>
              {visibleClients.length ? <View style={styles.row}>{visibleClients.slice(0, visibleClientCount).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Pflegefall auswählen: ${item.name}`} accessibilityState={{ selected: clientId === item.id, disabled: locked }} disabled={locked} onPress={() => changeClient(item.id)} style={({ pressed }) => [styles.clientCard, clientId === item.id && styles.choiceSelected, pressed && styles.pressed]}>
                <Text style={styles.choiceTitle}>{item.name}</Text>
                <Text style={styles.choiceChevron} importantForAccessibility="no">›</Text>
              </Pressable>)}</View> : <Text style={styles.note}>Kein Pflegefall passt zur Suche.</Text>}
              {visibleClients.length > visibleClientCount ? <View style={styles.actionButtons}>
                <PremiumButton title="Weitere Pflegefälle anzeigen" variant="secondary" size="sm" disabled={locked} onPress={() => setVisibleClientCount(previous => previous + clientPageSize)}/>
              </View> : null}
            </> : null}
          </IntakeStep>

          <IntakeStep number={2} title="Messarten" hint={client ?
            'Wählen Sie eine Messart, die für diese Akte aktiviert ist.' :
            'Alle Messarten im Überblick. Für die Erfassung zuerst einen Pflegefall auswählen.'} badge={selectedMeasurement ? 'Ausgewählt' : undefined} styles={styles}>
            {client && choices.loading && !choices.data ? <LoadingState presentation="inline" message="Verfügbare Messarten werden geladen…"/> : null}
            {client && choices.error ? <ErrorState presentation="inline" message={choices.error} onRetry={choices.refresh}/> : null}
            {client && choices.refreshError ? <ErrorState presentation="inline" message={choices.refreshError} onRetry={choices.refresh}/> : null}
            {confirmedCatalogue && !enabledCount ? <Text style={styles.note}>Für diesen Pflegefall ist keine Messart aktiviert. Bitte lassen Sie die Messkonfiguration prüfen.</Text> : null}
            {selectedMeasurement ? <View style={styles.selection}>
              <VitalMeasurementArtwork measurementKey={selectedMeasurement.key} size={48}/>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>{selectedMeasurement.label}</Text>
                <Text style={styles.note}>{unitsFor(selectedMeasurement) || 'Ohne Einheit'}</Text>
              </View>
              <PremiumButton title={editingMeasurement ? 'Messart beibehalten' : 'Messart ändern'} size="sm" variant="secondary" disabled={locked || editingClient} onPress={toggleMeasurementPicker}/>
            </View> : null}
            {catalogue.length && (!selectedMeasurement || editingMeasurement) ? <>
              {confirmedCatalogue && enabledCount < catalogue.length ? <FilterChipGroup wrap options={catalogueFilters} value={catalogueView} onChange={locked ? undefined : next => { setCatalogueView(next); setCategory(allCategories); }}/> : null}
              <PremiumInput label="Messart suchen" accessibilityLabel="Messart suchen" placeholder="Name, Kürzel oder Einheit" value={measurementSearch} editable={!locked} maxLength={100} onChangeText={setMeasurementSearch}/>
              {categoryOptions.length > 2 ? <FilterChipGroup wrap options={categoryOptions} value={category} onChange={locked ? undefined : setCategory}/> : null}
              <Text style={styles.note} accessibilityLiveRegion="polite">{visibleDefinitions.length} {visibleDefinitions.length === 1 ? 'Messart' : 'Messarten'}{measurementNeedle ? ' gefunden' : ''}</Text>
              {categories.map(key => {
                const group = visibleDefinitions.filter(({ definition: item }) => item.category === key);
                return group.length ? <View key={key} style={styles.measurementGroup}>
                  <Text accessibilityRole="header" style={styles.groupLabel}>{VITAL_CATEGORY_LABELS[key]}</Text>
                  <View style={styles.row}>{group.map(({ definition: item, enabled }) => !confirmedCatalogue ?
                        <View key={item.key} style={[styles.measurementCard, styles.catalogueCard]}>
                      <VitalMeasurementArtwork measurementKey={item.key} size={62}/>
                      <View style={styles.choiceText}><Text style={styles.choiceTitle}>{item.label}</Text>
                        <Text style={styles.note}>{unitsFor(item) || 'Ohne Einheit'}</Text>
                      </View>
                    </View> : <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`${item.label} ${enabled ? 'auswählen' : '– nicht für diese Akte aktiviert'}`} accessibilityState={{ selected: type === item.key, disabled: !editable || !enabled || editingClient }} disabled={!editable || !enabled || editingClient} onPress={enabled ? () => changeType(item.key) : undefined} style={({ pressed }) => [styles.measurementCard, !enabled && styles.catalogueCard, type === item.key && styles.choiceSelected, pressed && styles.pressed]}>
                    <VitalMeasurementArtwork measurementKey={item.key} size={62}/>
                    <View style={styles.choiceText}>
                      <Text style={styles.choiceTitle}>{item.label}</Text>
                      <Text style={styles.note}>{unitsFor(item) || 'Ohne Einheit'}</Text>
                      {!enabled ? <Text style={styles.note}>Nicht für diese Akte aktiviert</Text> : null}
                    </View>
                  </Pressable>)}</View>
                </View> : null;
            })}
              {typeOptions.length > 0 && !visibleDefinitions.length ? <Text style={styles.note}>Keine Messart passt zu Suche und Kategorie.</Text> : null}
            </> : null}
          </IntakeStep>

          {selectedMeasurement ? <>
            <IntakeStep number={3} title="Messwerte" hint="Die Einheit gehört zur Messart. Pflichtfelder sind mit * markiert." styles={styles}>
              {type === 'pain_score' ? <View style={styles.inputGroup}>
                <Text style={styles.groupLabel}>Verwendete Skala *</Text>
                <FilterChipGroup wrap options={painScale} value={context.scale ?? ''} onChange={editableMeasurement ? scale => editContext(c => ({ ...c, scale })) : undefined}/>
              </View> : null}
              <View style={styles.row}>{selectedMeasurement.components.filter(c => !['total', 'balance'].includes(c.key)).map(component => {
                const label = `${component.label}${component.unit ? ` (${component.unit})` : ''}${required.includes(component.key) ? ' *' : ''}`;
                const options = measurementScales[type]?.[component.key];
                return <View key={component.key} style={options ? styles.scaleField : styles.field}>
                  {options ? <View style={styles.inputGroup} accessibilityLabel={label}>
                    <Text style={styles.groupLabel}>{label}</Text>
                    <FilterChipGroup wrap options={options} value={values[component.key] ?? ''} onChange={editableMeasurement ? value => editValues(v => ({ ...v, [component.key]: value })) : undefined}/>
                  </View> : <PremiumInput label={label} accessibilityLabel={component.unit ? `${component.label} in ${component.unit}` : component.label} placeholder="Wert eingeben" value={values[component.key] ?? ''} editable={editableMeasurement} keyboardType="decimal-pad" onChangeText={value => editValues(v => ({ ...v, [component.key]: value }))}/>}
                </View>;
            })}</View>
              {type === 'gcs' || type === 'fluid_balance' ? <Text style={styles.note}>{type === 'gcs' ? 'Der Gesamtwert' : 'Die Bilanz'} wird aus den Einzelangaben berechnet.</Text> : null}
              {type === 'fluid_balance' ? <View style={styles.inputGroup}>
                <Text style={styles.groupLabel}>Umfang der erfassten Ein- und Ausfuhr *</Text>
                <FilterChipGroup wrap options={fluidCompleteness} value={context.completeness ?? ''} onChange={editableMeasurement ? completeness => editContext(c => ({ ...c, completeness, incompleteReason: '' })) : undefined}/>
                {context.completeness && context.completeness !== 'complete' ? <PremiumInput label="Fehlende Angaben / Einschränkung *" value={context.incompleteReason ?? ''} editable={editableMeasurement} maxLength={500} onChangeText={incompleteReason => editContext(c => ({ ...c, incompleteReason }))}/> : null}
              </View> : null}
              {selectedMeasurement.contextFields?.some(field => !(type === 'pain_score' && field.key === 'scale')) ? <View style={styles.inputGroup}>
                <Text accessibilityRole="header" style={styles.groupLabel}>Messbedingungen</Text>
                <View style={styles.row}>{selectedMeasurement.contextFields.filter(field => !(type === 'pain_score' && field.key === 'scale')).map(field => {
                    const options = contextOptions[selectedMeasurement.key]?.[field.key];
                    const value = context[field.key] ?? '';
                    const update = (changed: string) => editContext(c => ({ ...c, [field.key]: changed }));
                    return <View style={[styles.field, styles.inputGroup]} key={field.key}>
                    <PremiumInput label={`${field.label}${field.key === 'period' && (type === 'urine_output' || type === 'fluid_balance') ? ' *' : ''}`} accessibilityLabel={field.label} placeholder={field.placeholder} value={value} editable={editableMeasurement} maxLength={500} onChangeText={update}/>
                    {options ? <FilterChipGroup wrap options={options} value={value} onChange={editableMeasurement ? update : undefined}/> : null}
                  </View>;
                })}</View>
              </View> : null}
            </IntakeStep>

            <IntakeStep number={4} title="Messzeitpunkt" hint="Prüfen Sie das Datum und die Uhrzeit der tatsächlichen Messung." styles={styles}>
              <MedicationEventTimeInput pickers label="Tatsächlicher Messzeitpunkt" value={time} disabled={!editableMeasurement} onChange={editTime}/>
              {showNote || note ? <PremiumInput label="Messnotiz (optional)" hint="Beobachtung, Messbedingungen und Reaktion" accessibilityLabel="Messnotiz" value={note} editable={editableMeasurement} onChangeText={editNote} maxLength={4000} multiline/> :
                <View style={styles.actionButtons}><PremiumButton title="Messnotiz hinzufügen" size="sm" variant="secondary" disabled={!editableMeasurement} onPress={() => setShowNote(true)}/></View>}
              <Text style={styles.note}>Die Software protokolliert, wer die Messung wann erfasst hat. Konfigurierte Grenzbereiche sind keine Diagnose oder Therapieanweisung.</Text>
            </IntakeStep>
          </> : null}
        </View>
      </ScrollView>
      <View style={styles.actionBar}>
        <View style={styles.actionCopy}>
          <Text style={styles.groupLabel}>{stageHint}</Text>
          {client && selectedMeasurement ? <Text style={styles.note}>{client.name} · {selectedMeasurement.shortLabel}</Text> : null}
        </View>
        <View style={styles.actionButtons}>
          <PremiumButton title="Bearbeitung schließen" size="sm" variant="secondary" disabled={locked} onPress={close}/>
          <PremiumButton title={busy ? 'Messung wird gespeichert…' : uncertain ? 'Dieselbe Messung erneut prüfen' : 'Messung speichern'} disabled={busy || (!uncertain && (!definition || !choice?.enabled || !client || editingClient || editingMeasurement || !!choices.refreshError || !!clients.refreshError))} onPress={save}/>
        </View>
      </View>
    </View>
  </ScreenShell>;
}
function useStyles() {
    const { c } = useCareLightPalette();
    return useMemo(() => StyleSheet.create({
        workspace: { flex: 1, minHeight: 0, minWidth: 0, width: '100%' },
        scroller: { flex: 1, minHeight: 0, minWidth: 0 },
        scrollBody: { paddingBottom: spacing.md, minWidth: 0 },
        content: { width: '100%', maxWidth: 1120, alignSelf: 'center', minWidth: 0, gap: spacing.md },
        step: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, minWidth: 0 },
        stepHead: { padding: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
        stepMarker: { minWidth: 36, minHeight: 36, padding: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1, borderRadius: radius.md },
        stepNumber: { ...typography.label, color: c.text, fontWeight: '800' },
        stepHeading: { flexGrow: 1, flexShrink: 1, flexBasis: 170, minWidth: 0, gap: 3 },
        stepTitle: { ...typography.h3, color: c.text, fontWeight: '800' },
        stepBadge: { ...typography.caption, color: c.text, fontWeight: '700', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: c.surfaceAlt },
        stepBody: { gap: spacing.md, padding: spacing.md, minWidth: 0 },
        row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 },
        clientCard: { minHeight: 46, flexBasis: 215, flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: '100%', padding: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
        selection: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, minWidth: 0, backgroundColor: c.surfaceAlt, borderRadius: radius.md },
        highlight: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, minWidth: 0, backgroundColor: c.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: c.violet },
        measurementGroup: { gap: spacing.sm, minWidth: 0 },
        measurementCard: { minHeight: 72, flexBasis: 232, flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: '100%', padding: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        catalogueCard: { backgroundColor: c.surface, borderStyle: 'dashed' },
        choiceSelected: { borderColor: c.violet },
        pressed: { opacity: 0.78 },
        choiceText: { flexGrow: 1, flexBasis: 130, flexShrink: 1, minWidth: 0, gap: 3 },
        choiceTitle: { ...typography.label, color: c.text, fontWeight: '700', flexShrink: 1 },
        selectedTitle: { ...typography.body, color: c.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, flexBasis: 130, minWidth: 0 },
        choiceChevron: { fontSize: 18, color: c.muted },
        groupLabel: { ...typography.label, color: c.text, fontWeight: '700' },
        field: { flexGrow: 1, flexShrink: 1, flexBasis: 218, minWidth: 0 },
        scaleField: { width: '100%', minWidth: 0 },
        inputGroup: { gap: spacing.sm, minWidth: 0 },
        note: { ...typography.caption, color: c.muted, flexShrink: 1 },
        actionBar: { width: '100%', maxWidth: 1120, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.sm, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, minWidth: 0 },
        actionCopy: { flexBasis: 135, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 },
        actionButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, minWidth: 0, maxWidth: '100%' },
    }), [c]);
}
