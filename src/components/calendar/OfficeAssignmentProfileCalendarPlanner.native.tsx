// Generated native presentation from src/components/calendar/OfficeAssignmentProfileCalendarPlanner.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {CareSuiteNativeText as Text,CareSuiteNativeTextInput as TextInput} from '@/components/ui/CareSuiteNativeText';
import { SemanticArtwork } from "../icons/SemanticArtwork.native.tsx";
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, } from 'react';
import { Platform, Pressable, StyleSheet, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { CareTimeInput } from '@/components/inputs/CareTimeInput';
import { EmptyState, ErrorState, LoadingState, PremiumButton, } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listClientAssignmentProfiles, scheduleClientAssignmentProfile, } from '@/lib/office/clientAssignmentProfileService';
import { subscribeToClientAssignmentProfileChanges } from '@/lib/realtime';
import { toDateKey } from '@/lib/office/calendarDateUtils';
import type { ClientAssignmentProfile } from '@/types/modules/clientAssignmentProfile';
import { spacing } from '@/theme';
import { isNormalizedTimeInput, normalizeTimeInput } from '@/lib/formatters/normalizeTimeInput';
import { AssignmentProfileDateSelectionContext } from './AssignmentProfileDateSelection';
import { scheduleAssignmentProfileDates, selectAssignmentProfileDate } from './assignmentProfileMultiDay';
export const ASSIGNMENT_PROFILE_DRAG_MIME = 'application/x-caresuite-assignment-profile';
export type AssignmentProfileDropHandler = (profileId: string, date: Date, suggestedTime?: string) => void;
type PlannerRenderState = {
    selectedProfileId: string | null;
    onProfileDrop: AssignmentProfileDropHandler;
};
type Props = {
    children: (state: PlannerRenderState) => ReactNode;
    onScheduled: () => void | boolean | Promise<void | boolean>;
    employeeIdFilter?: string;
    readOnly?: boolean;
    /** Temporarily blocks new planning actions without discarding an in-progress batch. */
    dataReady?: boolean;
};
const ASSIGNMENT_DROP_DATE_DATA_KEY = 'csAssignmentDropDate';
const ASSIGNMENT_DROP_TIME_DATA_KEY = 'csAssignmentDropTime';
const ASSIGNMENT_DROP_SELECTOR = '[data-cs-assignment-drop-date]';
type AssignmentDropElement = HTMLElement & {
    dataset: DOMStringMap & {
        csAssignmentDropDate?: string;
        csAssignmentDropTime?: string;
    };
};
type EmployeeProfileGroup = {
    employeeId: string;
    employeeName: string;
    profiles: ClientAssignmentProfile[];
};
function durationLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!hours)
        return `${minutes} Min.`;
    return remainder ? `${hours} Std. ${remainder} Min.` : `${hours} Std.`;
}
function suggestedStartTime(): string {
    const next = new Date();
    next.setMinutes(next.getMinutes() < 30 ? 30 : 60, 0, 0);
    return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
}
function formatSelectedDate(dateKey: string): string {
    return new Date(`${dateKey}T12:00:00`).toLocaleDateString('de-DE');
}
function DraggableProfileCard({ profile, selected, disabled, onSelect, onBrowserDragStart, onBrowserDragEnd, }: {
    profile: ClientAssignmentProfile;
    selected: boolean;
    disabled: boolean;
    onSelect: () => void;
    onBrowserDragStart: (profileId: string, pointerX: number, pointerY: number) => void;
    onBrowserDragEnd: () => void;
}) {
    const card = (<Pressable onPress={onSelect} disabled={disabled} style={({ pressed }) => [
            styles.profilePressable,
            selected && styles.profileSelected,
            pressed && styles.profilePressed,
        ]} accessibilityRole="button" accessibilityLabel={`Einsatzprofil ${profile.profileName} auswählen`} accessibilityState={{ selected, disabled }}>
      <View style={styles.profileHeader}>
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{profile.profileName}</Text>
          <Text style={styles.profileClient}>{profile.clientName}</Text>
        </View>
        <Text style={styles.duration}>{durationLabel(profile.durationMinutes)}</Text>
      </View>
      <Text style={styles.profileMeta}>
        {profile.taskTitles.length} Aufgabe{profile.taskTitles.length === 1 ? '' : 'n'}
      </Text>
    </Pressable>);
    return card;
}
export function buildAssignmentProfileDropTargetProps(date: Date, onDrop?: AssignmentProfileDropHandler, suggestedTime?: string): object {
    return {};
}
export function OfficeAssignmentProfileCalendarPlanner({ children, onScheduled, employeeIdFilter, readOnly = false, dataReady = true }: Props) {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [workspaceWidth, setWorkspaceWidth] = useState<number | null>(null);
    const compact = (workspaceWidth ?? Math.min(width, 900)) < 1040;
    const [plannerOpen, setPlannerOpen] = useState(false);
    const tenantId = useServiceTenantId();
    const query = useAsyncQuery(() => {
        if (!tenantId)
            return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
        return listClientAssignmentProfiles(tenantId);
    }, [tenantId], {
        enabled: Boolean(tenantId),
        queryKey: `assignment-profiles:${tenantId ?? ''}`,
        live: {
            tenantId,
            subscribe: subscribeToClientAssignmentProfileChanges,
        },
    });
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
    const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([]);
    const [pendingDateKeys, setPendingDateKeys] = useState<string[]>([]);
    const [confirmedDateKeys, setConfirmedDateKeys] = useState<string[]>([]);
    const [uncertainSave, setUncertainSave] = useState(false);
    const [startTime, setStartTime] = useState(suggestedStartTime);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [profileSearch, setProfileSearch] = useState('');
    const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(() => new Set());
    const workspaceRoot = useRef<HTMLElement | null>(null);
    const activeDragProfileId = useRef<string | null>(null);
    const dragPointer = useRef({ x: 0, y: 0 });
    const dragScrollFrame = useRef<number | null>(null);
    const savingRef = useRef(false);
    const mounted = useRef(true);
    const scopeKey = JSON.stringify([tenantId, employeeIdFilter ?? null, readOnly]);
    const currentScope = useRef({ key: scopeKey });
    if (currentScope.current.key !== scopeKey)
        currentScope.current = { key: scopeKey };
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            // Invalidates an in-flight batch even if the same scope is later reopened.
            currentScope.current = { key: currentScope.current.key };
        };
    }, []);
    const profiles = useMemo(() => (query.data ?? []).filter((profile) => profile.isActive !== false && profile.tenantId === tenantId && (!employeeIdFilter || profile.employeeId === employeeIdFilter)), [query.data, tenantId, employeeIdFilter]);
    useEffect(() => {
        setSelectedProfileId(null);
        setPendingProfileId(null);
        setSelectedDateKeys([]);
        setPendingDateKeys([]);
        setConfirmedDateKeys([]);
        setUncertainSave(false);
        setError(null);
        setNotice(null);
        setProfileSearch('');
        setExpandedEmployees(new Set());
        setSaving(false);
        savingRef.current = false;
    }, [scopeKey]);
    const employeeGroups = useMemo<EmployeeProfileGroup[]>(() => {
        const normalizedSearch = profileSearch.trim().toLocaleLowerCase('de-DE');
        const grouped = new Map<string, ClientAssignmentProfile[]>();
        profiles.forEach((profile) => {
            const employeeName = profile.employeeName?.trim() || 'Nicht zugeordnet';
            const searchable = [
                employeeName,
                profile.profileName,
                profile.clientName,
                profile.assignmentTitle,
            ].join(' ').toLocaleLowerCase('de-DE');
            if (normalizedSearch && !searchable.includes(normalizedSearch))
                return;
            const employeeId = profile.employeeId || 'unassigned';
            const current = grouped.get(employeeId) ?? [];
            current.push(profile);
            grouped.set(employeeId, current);
        });
        return Array.from(grouped.entries())
            .map(([employeeId, employeeProfiles]) => ({
            employeeId,
            employeeName: employeeProfiles[0].employeeName?.trim() || 'Nicht zugeordnet',
            profiles: employeeProfiles.sort((a, b) => a.clientName.localeCompare(b.clientName, 'de')),
        }))
            .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'));
    }, [profileSearch, profiles]);
    const pendingProfile = useMemo(() => profiles.find((profile) => profile.id === pendingProfileId) ?? null, [pendingProfileId, profiles]);
    const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
    useEffect(() => {
        if (!query.loading && selectedProfileId && !selectedProfile) {
            setSelectedProfileId(null);
        }
    }, [query.loading, selectedProfileId, selectedProfile]);
    const selectDate = useCallback((date: Date, clickCount: number, time?: string) => {
        if (readOnly || !dataReady || savingRef.current || pendingProfileId || Number.isNaN(date.getTime()))
            return;
        setSelectedDateKeys((current) => selectAssignmentProfileDate(current, toDateKey(date), clickCount));
        if (time)
            setStartTime(time);
        setNotice(null);
    }, [pendingProfileId, readOnly, dataReady]);
    const dateSelection = useMemo(() => plannerOpen && !readOnly ? {
        selectedDateKeys,
        disabled: readOnly || !dataReady || saving || Boolean(pendingProfileId),
        selectDate,
    } : null, [selectedDateKeys, saving, pendingProfileId, selectDate, readOnly, plannerOpen, dataReady]);
    const toggleEmployee = useCallback((employeeId: string) => {
        setExpandedEmployees((current) => {
            const next = new Set(current);
            if (next.has(employeeId))
                next.delete(employeeId);
            else
                next.add(employeeId);
            return next;
        });
    }, []);
    const handleDrop = useCallback((profileId: string, date: Date, time?: string) => {
        if (readOnly || !dataReady || savingRef.current || pendingProfileId || Number.isNaN(date.getTime()))
            return;
        if (!profiles.some((profile) => profile.id === profileId))
            return;
        const dateKey = toDateKey(date);
        const dates = [dateKey];
        setSelectedProfileId(profileId);
        ;
        setPendingProfileId(profileId);
        setPendingDateKeys([...dates]);
        setConfirmedDateKeys([]);
        setUncertainSave(false);
        setStartTime(time ?? suggestedStartTime());
        setError(null);
        setNotice(null);
    }, [profiles, selectedDateKeys, pendingProfileId, readOnly, dataReady]);
    const stopBrowserDrag = useCallback(() => { activeDragProfileId.current = null; }, []);
    const beginBrowserDrag = useCallback((profileId: string, pointerX: number, pointerY: number) => {
        if (!readOnly && dataReady && !savingRef.current && !pendingProfileId)
            setSelectedProfileId(profileId);
    }, [readOnly, pendingProfileId, profiles, dataReady]);
    useEffect(() => {
        return;
    }, [handleDrop, stopBrowserDrag]);
    useEffect(() => {
        stopBrowserDrag();
    }, [scopeKey, stopBrowserDrag]);
    function handleTouchDate(profileId: string, date: Date, time?: string) {
        handleDrop(profileId, date, time);
    }
    function openSelectedDates() {
        if (readOnly || !dataReady || savingRef.current || !selectedProfile || !selectedDateKeys.length)
            return;
        setPendingProfileId(selectedProfile.id);
        setPendingDateKeys([...selectedDateKeys]);
        setConfirmedDateKeys([]);
        setUncertainSave(false);
        setError(null);
        setNotice(null);
    }
    function closeTimeForm() {
        if (savingRef.current)
            return;
        if (uncertainSave) {
            setNotice('Eine Speicherung konnte nicht bestätigt werden. Bitte den Kalender prüfen, bevor du denselben Tag erneut freigibst.');
        }
        setPendingProfileId(null);
        setPendingDateKeys([]);
        setConfirmedDateKeys([]);
        setUncertainSave(false);
        setError(null);
    }
    async function handleSchedule() {
        if (readOnly || !dataReady || savingRef.current || uncertainSave || !tenantId || !pendingProfile || !pendingDateKeys.length)
            return;
        const normalizedStartTime = normalizeTimeInput(startTime);
        if (!isNormalizedTimeInput(normalizedStartTime)) {
            setError('Bitte eine gültige Uhrzeit im Format HH:MM eingeben.');
            return;
        }
        savingRef.current = true;
        const batchScope = currentScope.current;
        const profileId = pendingProfile.id;
        const previouslyConfirmed = confirmedDateKeys.length;
        const totalCount = previouslyConfirmed + pendingDateKeys.length;
        setStartTime(normalizedStartTime);
        setSaving(true);
        setError(null);
        try {
            const result = await scheduleAssignmentProfileDates(pendingDateKeys, (dateKey) => scheduleClientAssignmentProfile(tenantId, profileId, dateKey, normalizedStartTime), {
                shouldContinue: () => mounted.current && currentScope.current === batchScope,
                onConfirmed: (dateKey) => {
                    if (currentScope.current !== batchScope)
                        return;
                    setPendingDateKeys((current) => current.filter((key) => key !== dateKey));
                    setSelectedDateKeys((current) => current.filter((key) => key !== dateKey));
                    setConfirmedDateKeys((current) => [...current, dateKey]);
                },
            });
            if (currentScope.current !== batchScope)
                return;
            const confirmedCount = previouslyConfirmed + result.confirmedDates.length;
            setPendingDateKeys(result.remainingDates);
            if (result.failedDate) {
                setUncertainSave(result.uncertain);
                setError(`Gespeichert: ${confirmedCount} von ${totalCount}. Am ${formatSelectedDate(result.failedDate)}: ${result.error || 'Der Einsatz konnte nicht gespeichert werden.'}`);
            }
            else if (!result.interrupted) {
                setPendingProfileId(null);
                setPendingDateKeys([]);
                setConfirmedDateKeys([]);
                setSelectedProfileId(null);
                setNotice(`${totalCount === 1 ? '1 Einsatz' : `${totalCount} Einsätze`} um ${normalizedStartTime} Uhr freigegeben.`);
            }
            // A refresh error must never put already saved days back into the retry set.
            if (result.confirmedDates.length || result.uncertain) {
                try {
                    const refreshed = await onScheduled();
                    if (refreshed === false && currentScope.current === batchScope) {
                        setNotice('Der Kalender konnte nicht aktualisiert werden. Bitte die Ansicht neu laden; bereits bestätigte Einsätze bleiben gespeichert.');
                    }
                }
                catch {
                    if (currentScope.current === batchScope) {
                        setNotice('Der Kalender konnte nicht aktualisiert werden. Bitte die Ansicht neu laden; bereits bestätigte Einsätze bleiben gespeichert.');
                    }
                }
            }
        }
        finally {
            if (currentScope.current === batchScope) {
                savingRef.current = false;
                if (mounted.current)
                    setSaving(false);
            }
        }
    }
    const content = children({
        selectedProfileId: plannerOpen && !readOnly ? selectedProfileId : null,
        onProfileDrop: (profileId, date, time) => {
            const resolvedId = profileId || selectedProfileId;
            if (resolvedId)
                handleTouchDate(resolvedId, date, time);
        },
    });
    return <NativeWorkspaceStyleScope css={[`
        [data-cs-calendar-profile] { border-radius: 13px; transition: transform 160ms ease, box-shadow 160ms ease; }
        [data-cs-calendar-profile]:hover { box-shadow: 0 5px 16px rgba(36, 100, 154, .12); }
        [data-cs-calendar-planner] :is(button, [role="button"], input):focus-visible { outline: 2px solid #1674d1; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) { [data-cs-calendar-profile] { transition: none; } }
      `]}>{(<AssignmentProfileDateSelectionContext.Provider value={dateSelection}>
      {createElement(NativeStyle, { key: 'calendar-profile-effects' }, `
        [data-cs-calendar-profile] { border-radius: 13px; transition: transform 160ms ease, box-shadow 160ms ease; }
        [data-cs-calendar-profile]:hover { box-shadow: 0 5px 16px rgba(36, 100, 154, .12); }
        [data-cs-calendar-planner] :is(button, [role="button"], input):focus-visible { outline: 2px solid #1674d1; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) { [data-cs-calendar-profile] { transition: none; } }
      `)}
      <View ref={(node) => { workspaceRoot.current = node as unknown as HTMLElement | null; }} style={styles.workspace} {...({ dataSet: { csCalendarPlanner: 'true' } } as object)} onLayout={(event) => {
            const nextWidth = event.nativeEvent.layout.width;
            if (nextWidth > 0)
                setWorkspaceWidth(nextWidth);
        }}>
        <View style={styles.plannerToolbar}>
          <Pressable onPress={() => setPlannerOpen((open) => !open)} accessibilityRole="button" accessibilityLabel={plannerOpen ? 'Einsatzprofile einklappen' : 'Einsatzprofile öffnen'} accessibilityState={{ expanded: plannerOpen }} style={({ pressed }) => [styles.plannerToggle, plannerOpen && styles.plannerToggleActive, pressed && styles.profilePressed]}>
            <SemanticArtwork webSize={20} style={styles.plannerToggleIcon}>{plannerOpen ? '−' : '+'}</SemanticArtwork>
            <Text style={styles.plannerToggleLabel}>Einsatzprofile</Text>
            <Text style={styles.plannerCount}>{query.loading && !query.data ? '…' : profiles.length}</Text>
          </Pressable>
          <View style={styles.toolbarCopy}>
            <Text style={styles.toolbarSummary}>
              {selectedProfile ? `${selectedProfile.profileName} · ${selectedProfile.clientName}` : 'Wiederkehrende Einsätze schnell planen'}
            </Text>
            {selectedDateKeys.length > 0 ? <Text style={styles.selectionCount} accessibilityLiveRegion="polite">
              {selectedDateKeys.length === 1 ? '1 Tag ausgewählt' : `${selectedDateKeys.length} Tage ausgewählt`}
            </Text> : null}
          </View>
          {!plannerOpen && selectedProfile && selectedDateKeys.length > 0 ? <PremiumButton title="Uhrzeit festlegen" size="sm" onPress={openSelectedDates} disabled={readOnly || !dataReady || saving || Boolean(pendingProfileId)}/> : null}
        </View>
        {!dataReady ? <Text style={styles.readinessNotice} accessibilityLiveRegion="polite">Kalenderdaten werden geprüft…</Text> : null}
        {notice ? <Text style={styles.planningNotice} accessibilityLiveRegion="polite">{notice}</Text> : null}
        {!plannerOpen && (query.error || query.refreshError) ? <ErrorState message={query.error || query.refreshError || ''} onRetry={query.refresh}/> : null}
        <View style={[styles.workspaceBody, compact && styles.workspaceCompact]}>
          {plannerOpen ? <View style={[styles.palette, compact && styles.paletteCompact]}>
            <View style={styles.paletteHeader}>
              <Text style={styles.paletteTitle}>Profil auswählen</Text>
              <Text style={styles.paletteHint}>
                {readOnly ? 'Für Ihre Rolle ist die Planung schreibgeschützt.' : 'Profil wählen, Tage markieren und gemeinsam freigeben. Alternativ auf einen Tag ziehen.'}
              </Text>
            </View>
            <TextInput value={profileSearch} onChangeText={setProfileSearch} placeholder="Name oder Profil suchen" placeholderTextColor="#657A90" style={styles.profileSearch} accessibilityLabel="Einsatzprofile durchsuchen"/>
            <ScrollView style={[styles.profileScroll, compact && styles.profileScrollCompact]} contentContainerStyle={styles.profileList} showsVerticalScrollIndicator nestedScrollEnabled>
              {!tenantId ? <Text style={styles.paletteHint}>Bitte zuerst ein Unternehmen auswählen.</Text> : null}
              {query.loading && !query.data ? <LoadingState message="Profile werden geladen…"/> : null}
              {query.error && !query.data ? <ErrorState message={query.error} onRetry={query.refresh}/> : null}
              {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh}/> : null}
              {tenantId && !query.loading && !query.error && profiles.length === 0 ? <EmptyState title="Keine Einsatzprofile" message="Profile lassen sich in der Klientenakte unter „Einsätze & Termine“ anlegen." actionLabel="Klientenakten öffnen" onAction={() => router.push('/office/clients' as never)}/> : null}
              {employeeGroups.map((group) => {
                const expanded = expandedEmployees.has(group.employeeId) || Boolean(profileSearch.trim());
                return <View key={group.employeeId} style={styles.employeeGroup}>
                  <Pressable onPress={() => toggleEmployee(group.employeeId)} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${group.employeeName}, ${group.profiles.length} Einsatzprofile`} style={({ pressed }) => [styles.employeeHeader, expanded && styles.employeeHeaderExpanded, pressed && styles.profilePressed]}>
                    <View style={styles.employeeAvatar}><Text style={styles.employeeAvatarText}>
                      {group.employeeName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                    </Text></View>
                    <View style={styles.employeeCopy}>
                      <Text style={styles.employeeName}>{group.employeeName}</Text>
                      <Text style={styles.employeeMeta}>{group.profiles.length} Profil{group.profiles.length === 1 ? '' : 'e'}</Text>
                    </View>
                    <SemanticArtwork webSize={20} style={styles.employeeChevron}>{expanded ? '−' : '+'}</SemanticArtwork>
                  </Pressable>
                  {expanded ? <View style={styles.employeeProfiles}>
                    {group.profiles.map((profile) => <DraggableProfileCard key={profile.id} profile={profile} selected={selectedProfileId === profile.id} disabled={readOnly || !dataReady || saving || Boolean(pendingProfileId)} onSelect={() => {
                                setSelectedProfileId((current) => current === profile.id ? null : profile.id);
                                setNotice(null);
                            }} onBrowserDragStart={beginBrowserDrag} onBrowserDragEnd={stopBrowserDrag}/>)}
                  </View> : null}
                </View>;
            })}
              {!query.loading && profiles.length > 0 && employeeGroups.length === 0 && profileSearch.trim() ? <View style={styles.noSearchResult}>
                <Text style={styles.noSearchResultTitle}>Keine passenden Profile</Text>
                <Pressable onPress={() => setProfileSearch('')} accessibilityRole="button" style={styles.clearSelection}>
                  <Text style={styles.clearSelectionText}>Suche zurücksetzen</Text>
                </Pressable>
              </View> : null}
            </ScrollView>
            {!readOnly ? <View style={styles.dateSelection}>
              <Text style={styles.dateSelectionTitle} accessibilityLiveRegion="polite">
                {selectedDateKeys.length ? `${selectedDateKeys.length} ${selectedDateKeys.length === 1 ? 'Tag' : 'Tage'} ausgewählt` : 'Tage im Kalender markieren'}
              </Text>
              <Text style={styles.dateSelectionDates}>
                {selectedDateKeys.length
                    ? `${selectedDateKeys.slice(0, 5).map(formatSelectedDate).join(' · ')}${selectedDateKeys.length > 5 ? ` · +${selectedDateKeys.length - 5} weitere` : ''}`
                    : 'Ein Doppelklick wählt nur diesen Tag.'}
              </Text>
              <PremiumButton title="Uhrzeit festlegen" size="sm" fullWidth onPress={openSelectedDates} disabled={!dataReady || saving || Boolean(pendingProfileId) || !selectedProfile || !selectedDateKeys.length}/>
              {selectedDateKeys.length ? <Pressable onPress={() => {
                        if (dataReady && !savingRef.current && !pendingProfileId)
                            setSelectedDateKeys([]);
                    }} disabled={!dataReady || saving || Boolean(pendingProfileId)} accessibilityRole="button" style={styles.clearSelection}><Text style={styles.clearSelectionText}>Tage abwählen</Text></Pressable> : null}
            </View> : null}
          </View> : null}
          <View style={styles.calendar}>{content}</View>
        </View>
      </View>

      <AppGlassModal visible={Boolean(pendingProfileId && (pendingDateKeys.length || saving))} title="Uhrzeit festlegen" subtitle={pendingProfile && pendingDateKeys.length
            ? `${pendingProfile.clientName} · ${pendingDateKeys.length === 1 ? formatSelectedDate(pendingDateKeys[0]) : `${pendingDateKeys.length} Tage`}`
            : undefined} onClose={closeTimeForm} maxWidth={480} surfaceScope="personal" footerActions={[
            {
                title: confirmedDateKeys.length || uncertainSave ? 'Schließen' : 'Abbrechen',
                variant: 'secondary',
                disabled: saving,
                onPress: closeTimeForm,
            },
            {
                title: pendingDateKeys.length > 1 ? `${pendingDateKeys.length} Einsätze freigeben` : 'Einsatz direkt freigeben',
                loading: saving,
                disabled: readOnly || !dataReady || saving || uncertainSave || !pendingProfile || !pendingDateKeys.length || !isNormalizedTimeInput(normalizeTimeInput(startTime)),
                onPress: handleSchedule,
            },
        ]}>
        {pendingProfile ? (<View style={styles.timeForm}>
            {!dataReady ? <Text style={styles.readinessNotice} accessibilityLiveRegion="polite">Kalenderdaten werden geprüft…</Text> : null}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{pendingProfile.profileName}</Text>
              <Text style={styles.summaryMeta}>
                {pendingProfile.assignmentTitle} · {durationLabel(pendingProfile.durationMinutes)}
              </Text>
              <Text style={styles.summaryMeta}>{pendingProfile.employeeName}</Text>
            </View>
            {null}
            {saving || confirmedDateKeys.length > 0 ? (<Text style={styles.summaryDates}>Gemeinsame Startzeit: {startTime} Uhr</Text>) : (<CareTimeInput label={pendingDateKeys.length > 1 ? 'Startzeit für alle ausgewählten Tage' : 'Startzeit'} value={startTime} placeholder="09:00" onChange={setStartTime} onLightSurface showFormatHint={false} autoFocus/>)}
            <Text style={styles.releaseHint}>
              {pendingDateKeys.length > 1 ? 'Diese Startzeit gilt für alle ausgewählten Tage. ' : ''}
              Zeitangaben gelten für Deutschland. Freigegebene Einsätze erscheinen direkt im Kalender und im Mitarbeitendenportal.
            </Text>
            {null}
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          </View>) : <Text style={styles.error}>Das Einsatzprofil ist nicht mehr verfügbar. Bitte das Fenster schließen und ein anderes Profil auswählen.</Text>}
      </AppGlassModal>
    </AssignmentProfileDateSelectionContext.Provider>)}</NativeWorkspaceStyleScope>;
}
const styles = StyleSheet.create({
    workspace: { width: '100%', minWidth: 0, gap: 12 },
    workspaceBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, minWidth: 0 },
    workspaceCompact: { flexDirection: 'column', alignItems: 'stretch' },
    plannerToolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: '#D5E5F1', backgroundColor: 'rgba(248,252,255,0.96)' },
    plannerToggle: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D6E5F1', backgroundColor: '#FFFFFF' },
    plannerToggleActive: { backgroundColor: '#E8F3FF', borderColor: '#9CC6EF' },
    plannerToggleIcon: { color: '#1967AB', fontSize: 21, fontWeight: '600' },
    plannerToggleLabel: { color: '#173A5C', fontSize: 14, fontWeight: '700' },
    plannerCount: { color: '#3479B8', fontSize: 12, fontWeight: '700', paddingHorizontal: 6 },
    toolbarCopy: { flex: 1, minWidth: 160, gap: 2 },
    toolbarSummary: { color: '#536B83', fontSize: 13, lineHeight: 18 },
    selectionCount: { color: '#1762A2', fontSize: 12, lineHeight: 17, fontWeight: '700' },
    palette: { width: 286, maxWidth: '100%', flexShrink: 0, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#CFE1F0', backgroundColor: '#F7FBFF' },
    paletteCompact: { width: '100%' },
    paletteHeader: { gap: 4, marginBottom: 12 },
    paletteTitle: { color: '#133654', fontSize: 16, fontWeight: '700', lineHeight: 22 },
    paletteHint: { color: '#536B83', fontSize: 12, lineHeight: 18 },
    profileSearch: { minHeight: 40, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: '#C8DCEC', backgroundColor: '#FFFFFF', color: '#153957', fontSize: 13, paddingHorizontal: 12 },
    profileScroll: { maxHeight: 480 },
    profileScrollCompact: { maxHeight: 220 },
    profileList: { gap: 8, paddingBottom: 4 },
    employeeGroup: { borderRadius: 14, borderWidth: 1, borderColor: '#D6E5F1', backgroundColor: '#FFFFFF', overflow: 'hidden' },
    employeeHeader: { minHeight: 52, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
    employeeHeaderExpanded: { backgroundColor: '#EDF5FC' },
    employeeAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E1EFFC', alignItems: 'center', justifyContent: 'center' },
    employeeAvatarText: { color: '#246CA9', fontSize: 11, fontWeight: '800' },
    employeeCopy: { flex: 1, minWidth: 0 },
    employeeName: { color: '#173A58', fontSize: 13, lineHeight: 18, fontWeight: '700' },
    employeeMeta: { color: '#657B90', fontSize: 11, lineHeight: 16 },
    employeeChevron: { color: '#3B7BAF', fontSize: 18, width: 16, textAlign: 'center' },
    employeeProfiles: { gap: 7, padding: 8 },
    profilePressable: { borderWidth: 1, borderColor: '#D3E3F0', borderRadius: 12, padding: 10, backgroundColor: '#FFFFFF' },
    profileSelected: { borderColor: '#3288D2', backgroundColor: '#E7F3FF' },
    profilePressed: { opacity: 0.8 },
    profileHeader: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', flexWrap: 'wrap' },
    profileText: { flex: 1, minWidth: 100 },
    profileName: { color: '#173A58', fontSize: 13, lineHeight: 18, fontWeight: '700' },
    profileClient: { color: '#4D6982', fontSize: 12, lineHeight: 17, marginTop: 2 },
    profileMeta: { color: '#5B758D', fontSize: 11, lineHeight: 16, marginTop: 5 },
    duration: { color: '#17699F', fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: '#EDF7FD' },
    dateSelection: { gap: 7, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#D4E4F0' },
    dateSelectionTitle: { color: '#1A4669', fontSize: 13, lineHeight: 18, fontWeight: '700' },
    dateSelectionDates: { color: '#567086', fontSize: 12, lineHeight: 18 },
    clearSelection: { minHeight: 32, justifyContent: 'center', alignItems: 'center' },
    clearSelectionText: { color: '#176AAA', fontSize: 12, fontWeight: '600', lineHeight: 18 },
    readinessNotice: { color: '#536B83', fontSize: 13, lineHeight: 19 },
    planningNotice: { color: '#155F49', fontSize: 13, lineHeight: 19, borderRadius: 12, backgroundColor: '#EAF7F0', padding: 12 },
    noSearchResult: { padding: 12, alignItems: 'center' },
    noSearchResultTitle: { color: '#34556F', fontSize: 13, lineHeight: 18, fontWeight: '600' },
    calendar: { flex: 1, minWidth: 0, width: '100%' },
    timeForm: { gap: spacing.md },
    summary: { gap: 4 },
    summaryTitle: { color: '#163956', fontSize: 18, fontWeight: '700', lineHeight: 25 },
    summaryMeta: { color: '#567086', fontSize: 13, lineHeight: 19 },
    summaryDates: { color: '#173F60', fontSize: 14, lineHeight: 21 },
    releaseHint: { color: '#567086', fontSize: 12, lineHeight: 18 },
    error: { color: '#B1313E', fontSize: 13, lineHeight: 19 },
});
