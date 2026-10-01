import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { CareTimeInput } from '@/components/inputs/CareTimeInput';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  listClientAssignmentProfiles,
  scheduleClientAssignmentProfile,
} from '@/lib/office/clientAssignmentProfileService';
import { subscribeToClientAssignmentProfileChanges } from '@/lib/realtime';
import { toDateKey } from '@/lib/office/calendarDateUtils';
import type { ClientAssignmentProfile } from '@/types/modules/clientAssignmentProfile';
import { colors, spacing, typography } from '@/theme';
import { autoScrollAssignmentProfileDrag } from './assignmentProfileDragAutoScroll';
import { isNormalizedTimeInput, normalizeTimeInput } from '@/lib/formatters/normalizeTimeInput';
import { AssignmentProfileDateSelectionContext } from './AssignmentProfileDateSelection';
import { scheduleAssignmentProfileDates, selectAssignmentProfileDate } from './assignmentProfileMultiDay';

export const ASSIGNMENT_PROFILE_DRAG_MIME = 'application/x-caresuite-assignment-profile';

export type AssignmentProfileDropHandler = (
  profileId: string,
  date: Date,
  suggestedTime?: string,
) => void;

type PlannerRenderState = {
  selectedProfileId: string | null;
  onProfileDrop: AssignmentProfileDropHandler;
};

type Props = {
  children: (state: PlannerRenderState) => ReactNode;
  onScheduled: () => void | Promise<void>;
  employeeIdFilter?: string;
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
  employeeName: string;
  profiles: ClientAssignmentProfile[];
  totalMinutes: number;
};

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes} Min.`;
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

function DraggableProfileCard({
  profile,
  selected,
  disabled,
  onSelect,
  onBrowserDragStart,
  onBrowserDragEnd,
}: {
  profile: ClientAssignmentProfile;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onBrowserDragStart: (profileId: string, pointerX: number, pointerY: number) => void;
  onBrowserDragEnd: () => void;
}) {
  const card = (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      style={({ pressed }) => [
        styles.profilePressable,
        selected && styles.profileSelected,
        pressed && styles.profilePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Einsatzprofil ${profile.profileName} auswählen`}
      accessibilityState={{ selected, disabled }}
    >
      <View style={styles.profileHeader}>
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{profile.profileName}</Text>
          <Text style={styles.profileClient}>{profile.clientName}</Text>
        </View>
        <PremiumBadge label={durationLabel(profile.durationMinutes)} variant="cyan" />
      </View>
      <Text style={styles.profileMeta}>{profile.employeeName}</Text>
      <Text style={styles.profileMeta}>
        {profile.taskTitles.length} Aufgabe{profile.taskTitles.length === 1 ? '' : 'n'}
      </Text>
    </Pressable>
  );

  if (Platform.OS !== 'web') return card;

  return createElement(
    'div',
    {
      draggable: !disabled,
      onDragStart: (event: DragEvent) => {
        if (disabled) { event.preventDefault(); return; }
        event.dataTransfer?.setData(ASSIGNMENT_PROFILE_DRAG_MIME, profile.id);
        event.dataTransfer?.setData('text/plain', profile.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
        onBrowserDragStart(profile.id, event.clientX, event.clientY);
      },
      onDragEnd: onBrowserDragEnd,
      style: { cursor: 'grab' },
      title: 'In den Kalender ziehen',
    },
    card,
  );
}

export function buildAssignmentProfileDropTargetProps(
  date: Date,
  onDrop?: AssignmentProfileDropHandler,
  suggestedTime?: string,
): object {
  if (Platform.OS !== 'web' || !onDrop) return {};
  return {
    dataSet: {
      [ASSIGNMENT_DROP_DATE_DATA_KEY]: toDateKey(date),
      [ASSIGNMENT_DROP_TIME_DATA_KEY]: suggestedTime ?? '',
    },
  };
}

export function OfficeAssignmentProfileCalendarPlanner({ children, onScheduled, employeeIdFilter }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 1100;
  const tenantId = useServiceTenantId();
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listClientAssignmentProfiles(tenantId);
    },
    [tenantId],
    {
      enabled: Boolean(tenantId),
      queryKey: `assignment-profiles:${tenantId ?? ''}`,
      live: {
        tenantId,
        subscribe: subscribeToClientAssignmentProfileChanges,
      },
    },
  );
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
  const activeDragProfileId = useRef<string | null>(null);
  const dragPointer = useRef({ x: 0, y: 0 });
  const dragScrollFrame = useRef<number | null>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const scopeKey = JSON.stringify([tenantId, employeeIdFilter ?? null]);
  const currentScope = useRef({ key: scopeKey });
  if (currentScope.current.key !== scopeKey) currentScope.current = { key: scopeKey };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Invalidates an in-flight batch even if the same scope is later reopened.
      currentScope.current = { key: currentScope.current.key };
    };
  }, []);
  const profiles = useMemo(() => (query.data ?? []).filter((profile) =>
    profile.tenantId === tenantId && (!employeeIdFilter || profile.employeeId === employeeIdFilter)),
  [query.data, tenantId, employeeIdFilter]);
  useEffect(() => {
    setSelectedProfileId(null);
    setPendingProfileId(null);
    setSelectedDateKeys([]);
    setPendingDateKeys([]);
    setConfirmedDateKeys([]);
    setUncertainSave(false);
    setError(null);
    setNotice(null);
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
      if (normalizedSearch && !searchable.includes(normalizedSearch)) return;
      const current = grouped.get(employeeName) ?? [];
      current.push(profile);
      grouped.set(employeeName, current);
    });
    return Array.from(grouped.entries())
      .map(([employeeName, employeeProfiles]) => ({
        employeeName,
        profiles: employeeProfiles.sort((a, b) => a.clientName.localeCompare(b.clientName, 'de')),
        totalMinutes: employeeProfiles.reduce((sum, profile) => sum + profile.durationMinutes, 0),
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'));
  }, [profileSearch, profiles]);
  const pendingProfile = useMemo(
    () => profiles.find((profile) => profile.id === pendingProfileId) ?? null,
    [pendingProfileId, profiles],
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  const selectDate = useCallback((date: Date, clickCount: number, time?: string) => {
    if (savingRef.current || pendingProfileId || Number.isNaN(date.getTime())) return;
    setSelectedDateKeys((current) => selectAssignmentProfileDate(current, toDateKey(date), clickCount));
    if (time) setStartTime(time);
    setNotice(null);
  }, [pendingProfileId]);

  const dateSelection = useMemo(() => Platform.OS === 'web' ? {
    selectedDateKeys,
    disabled: saving || Boolean(pendingProfileId),
    selectDate,
  } : null, [selectedDateKeys, saving, pendingProfileId, selectDate]);

  const toggleEmployee = useCallback((employeeName: string) => {
    setExpandedEmployees((current) => {
      const next = new Set(current);
      if (next.has(employeeName)) next.delete(employeeName);
      else next.add(employeeName);
      return next;
    });
  }, []);

  const handleDrop = useCallback((profileId: string, date: Date, time?: string) => {
    if (savingRef.current || pendingProfileId) return;
    if (!profiles.some((profile) => profile.id === profileId)) return;
    const dateKey = toDateKey(date);
    const dates = Platform.OS === 'web' && selectedDateKeys.includes(dateKey)
      ? selectedDateKeys : [dateKey];
    setSelectedProfileId(profileId);
    if (Platform.OS === 'web') setSelectedDateKeys(dates);
    setPendingProfileId(profileId);
    setPendingDateKeys([...dates]);
    setConfirmedDateKeys([]);
    setUncertainSave(false);
    setStartTime(time ?? suggestedStartTime());
    setError(null);
    setNotice(null);
  }, [profiles, selectedDateKeys, pendingProfileId]);

  const stopBrowserDrag = useCallback(() => {
    activeDragProfileId.current = null;
    if (dragScrollFrame.current !== null) {
      cancelAnimationFrame(dragScrollFrame.current);
      dragScrollFrame.current = null;
    }
    if (typeof document !== 'undefined') {
      delete document.documentElement.dataset.csAssignmentProfileDragging;
    }
  }, []);

  const beginBrowserDrag = useCallback((profileId: string, pointerX: number, pointerY: number) => {
    if (savingRef.current) return;
    activeDragProfileId.current = profileId;
    dragPointer.current = { x: pointerX, y: pointerY };
    setSelectedProfileId(profileId);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.csAssignmentProfileDragging = 'true';
    }
    if (dragScrollFrame.current === null) {
      const tick = () => {
        if (!activeDragProfileId.current) {
          dragScrollFrame.current = null;
          return;
        }
        autoScrollAssignmentProfileDrag(dragPointer.current.x, dragPointer.current.y);
        dragScrollFrame.current = requestAnimationFrame(tick);
      };
      dragScrollFrame.current = requestAnimationFrame(tick);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleBrowserDragOver = (event: DragEvent) => {
      if (!activeDragProfileId.current) return;
      event.preventDefault();
      dragPointer.current = { x: event.clientX, y: event.clientY };
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const handleBrowserDrop = (event: DragEvent) => {
      const profileId =
        event.dataTransfer?.getData(ASSIGNMENT_PROFILE_DRAG_MIME)
        || event.dataTransfer?.getData('text/plain')
        || activeDragProfileId.current
        || '';
      if (!profileId) return;

      const elementAtPointer = document.elementFromPoint(event.clientX, event.clientY);
      const dropElement = elementAtPointer?.closest(
        ASSIGNMENT_DROP_SELECTOR,
      ) as AssignmentDropElement | null;
      if (!dropElement?.dataset.csAssignmentDropDate) {
        stopBrowserDrag();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const date = new Date(`${dropElement.dataset.csAssignmentDropDate}T12:00:00`);
      if (!Number.isNaN(date.getTime())) {
        handleDrop(
          profileId,
          date,
          dropElement.dataset.csAssignmentDropTime || undefined,
        );
      }
      stopBrowserDrag();
    };

    window.addEventListener('dragover', handleBrowserDragOver, true);
    window.addEventListener('drop', handleBrowserDrop, true);
    window.addEventListener('dragend', stopBrowserDrag, true);
    return () => {
      window.removeEventListener('dragover', handleBrowserDragOver, true);
      window.removeEventListener('drop', handleBrowserDrop, true);
      window.removeEventListener('dragend', stopBrowserDrag, true);
      stopBrowserDrag();
    };
  }, [handleDrop, stopBrowserDrag]);

  function handleTouchDate(profileId: string, date: Date, time?: string) {
    handleDrop(profileId, date, time);
  }

  function openSelectedDates() {
    if (savingRef.current || !selectedProfile || !selectedDateKeys.length) return;
    setPendingProfileId(selectedProfile.id);
    setPendingDateKeys([...selectedDateKeys]);
    setConfirmedDateKeys([]);
    setUncertainSave(false);
    setError(null);
    setNotice(null);
  }

  function closeTimeForm() {
    if (savingRef.current) return;
    setPendingProfileId(null);
    setPendingDateKeys([]);
    setConfirmedDateKeys([]);
    setUncertainSave(false);
    setError(null);
  }

  async function handleSchedule() {
    if (savingRef.current || uncertainSave || !tenantId || !pendingProfile || !pendingDateKeys.length) return;
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
      const result = await scheduleAssignmentProfileDates(
        pendingDateKeys,
        (dateKey) => scheduleClientAssignmentProfile(tenantId, profileId, dateKey, normalizedStartTime),
        {
          shouldContinue: () => mounted.current && currentScope.current === batchScope,
          onConfirmed: (dateKey) => {
            if (currentScope.current !== batchScope) return;
            setPendingDateKeys((current) => current.filter((key) => key !== dateKey));
            setSelectedDateKeys((current) => current.filter((key) => key !== dateKey));
            setConfirmedDateKeys((current) => [...current, dateKey]);
          },
        },
      );
      if (currentScope.current !== batchScope) return;
      const confirmedCount = previouslyConfirmed + result.confirmedDates.length;
      setPendingDateKeys(result.remainingDates);
      if (result.failedDate) {
        setUncertainSave(result.uncertain);
        setError(`Gespeichert: ${confirmedCount} von ${totalCount}. Am ${formatSelectedDate(result.failedDate)}: ${result.error || 'Der Einsatz konnte nicht gespeichert werden.'}`);
      } else if (!result.interrupted) {
        setPendingProfileId(null);
        setPendingDateKeys([]);
        setConfirmedDateKeys([]);
        setSelectedProfileId(null);
        setNotice(`${totalCount === 1 ? '1 Einsatz' : `${totalCount} Einsätze`} um ${normalizedStartTime} Uhr freigegeben.`);
      }
      // A refresh error must never put already saved days back into the retry set.
      if (result.confirmedDates.length || result.uncertain) {
        try {
          await onScheduled();
        } catch {
          if (currentScope.current === batchScope) {
            setNotice('Der Kalender konnte nicht aktualisiert werden. Bitte die Ansicht neu laden; bereits bestätigte Einsätze bleiben gespeichert.');
          }
        }
      }
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const content = children({
    selectedProfileId,
    onProfileDrop: (profileId, date, time) => {
      const resolvedId = profileId || selectedProfileId;
      if (resolvedId) handleTouchDate(resolvedId, date, time);
    },
  });

  return (
    <AssignmentProfileDateSelectionContext.Provider value={dateSelection}>
      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        <PremiumCard
          onDarkSurface
          style={[styles.palette, compact && styles.paletteCompact]}
        >
          <View style={styles.paletteHeader}>
            <View style={styles.paletteTitleWrap}>
              <Text style={styles.paletteEyebrow}>SCHNELLPLANUNG</Text>
              <Text style={styles.paletteTitle}>Einsatzprofile</Text>
              <Text style={styles.paletteHint}>
                {Platform.OS === 'web'
                  ? 'Profil auswählen und Tage markieren oder das Profil in den Kalender ziehen.'
                  : 'Mitarbeitende öffnen, Profil wählen und Tag antippen'}
              </Text>
              {Platform.OS === 'web' ? (
                <Text style={styles.paletteHint}>
                  Mehrere Tage anklicken: Die gewählte Uhrzeit gilt für alle ausgewählten Tage.
                  {' '}Ein Doppelklick wählt nur diesen Tag aus.
                </Text>
              ) : null}
            </View>
            <PremiumBadge label={String(profiles.length)} variant="cyan" />
          </View>
          {Platform.OS === 'web' ? (
            <View style={styles.dateSelection}>
              <Text style={styles.dateSelectionTitle} accessibilityLiveRegion="polite">
                {selectedDateKeys.length === 1 ? '1 Tag ausgewählt' : `${selectedDateKeys.length} Tage ausgewählt`}
              </Text>
              {selectedDateKeys.length ? (
                <Text style={styles.dateSelectionDates}>
                  {selectedDateKeys.map(formatSelectedDate).join(' · ')}
                </Text>
              ) : null}
              <Text style={styles.dateSelectionDates}>
                {selectedProfile ? `${selectedProfile.profileName} · ${selectedProfile.clientName}` : 'Bitte ein Einsatzprofil auswählen.'}
              </Text>
              <PremiumButton
                title="Uhrzeit festlegen"
                size="sm"
                fullWidth
                onPress={openSelectedDates}
                disabled={saving || !selectedProfile || !selectedDateKeys.length}
              />
              {selectedDateKeys.length ? (
                <Pressable
                  onPress={() => setSelectedDateKeys([])}
                  disabled={saving}
                  accessibilityRole="button"
                  style={styles.clearSelection}
                >
                  <Text style={styles.clearSelectionText}>Auswahl aufheben</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {Platform.OS === 'web' && notice ? <Text style={styles.planningNotice} accessibilityLiveRegion="polite">{notice}</Text> : null}
          <View style={styles.paletteStats}>
            <View style={styles.paletteStat}>
              <Text style={styles.paletteStatValue}>{employeeGroups.length}</Text>
              <Text style={styles.paletteStatLabel}>Mitarbeitende</Text>
            </View>
            <View style={styles.paletteStatDivider} />
            <View style={styles.paletteStat}>
              <Text style={styles.paletteStatValue}>{profiles.length}</Text>
              <Text style={styles.paletteStatLabel}>Profile gesamt</Text>
            </View>
          </View>
          <TextInput
            value={profileSearch}
            onChangeText={setProfileSearch}
            placeholder="Mitarbeitende, Klient:in oder Profil suchen"
            placeholderTextColor="#7591AA"
            style={styles.profileSearch}
            accessibilityLabel="Einsatzprofile durchsuchen"
          />
          {query.loading && !query.data ? <LoadingState message="Profile werden geladen…" /> : null}
          {query.error && !query.data ? <ErrorState message={query.error} onRetry={query.refresh} /> : null}
          {!query.loading && !query.error && profiles.length === 0 ? (
            <EmptyState
              title="Keine Einsatzprofile"
              message="Einsatzprofile werden in der jeweiligen Klientenakte im Tab „Einsätze & Termine“ erstellt."
              actionLabel="Klientenakten öffnen"
              onAction={() => router.push('/office/clients' as never)}
            />
          ) : (
            <View style={[styles.profileList, compact && styles.profileListCompact]}>
              {employeeGroups.map((group) => {
                const expanded = expandedEmployees.has(group.employeeName) || Boolean(profileSearch.trim());
                return (
                  <View key={group.employeeName} style={styles.employeeGroup}>
                    <Pressable
                      onPress={() => toggleEmployee(group.employeeName)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      accessibilityLabel={`${group.employeeName}, ${group.profiles.length} Einsatzprofile`}
                      style={({ pressed }) => [
                        styles.employeeHeader,
                        expanded && styles.employeeHeaderExpanded,
                        pressed && styles.profilePressed,
                      ]}
                    >
                      <View style={styles.employeeAvatar}>
                        <Text style={styles.employeeAvatarText}>
                          {group.employeeName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.employeeCopy}>
                        <Text style={styles.employeeName} numberOfLines={1}>{group.employeeName}</Text>
                        <Text style={styles.employeeMeta}>
                          {group.profiles.length} Profil{group.profiles.length === 1 ? '' : 'e'} · {durationLabel(group.totalMinutes)}
                        </Text>
                      </View>
                      <View style={styles.employeeCount}>
                        <Text style={styles.employeeCountText}>{group.profiles.length}</Text>
                      </View>
                      <Text style={styles.employeeChevron}>{expanded ? '⌃' : '⌄'}</Text>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.employeeProfiles}>
                        {group.profiles.map((profile) => (
                          <DraggableProfileCard
                            key={profile.id}
                            profile={profile}
                            selected={selectedProfileId === profile.id}
                            disabled={saving || Boolean(pendingProfileId)}
                            onSelect={() =>
                              setSelectedProfileId((current) => (current === profile.id ? null : profile.id))
                            }
                            onBrowserDragStart={beginBrowserDrag}
                            onBrowserDragEnd={stopBrowserDrag}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {!query.loading && employeeGroups.length === 0 && profileSearch.trim() ? (
                <View style={styles.noSearchResult}>
                  <Text style={styles.noSearchResultTitle}>Keine passenden Profile</Text>
                  <Text style={styles.noSearchResultText}>Suchbegriff ändern oder Suche leeren.</Text>
                </View>
              ) : null}
            </View>
          )}
        </PremiumCard>
        <View style={styles.calendar}>{content}</View>
      </View>

      <AppGlassModal
        visible={Boolean(pendingProfileId && (pendingDateKeys.length || saving))}
        title="Uhrzeit festlegen"
        subtitle={
          pendingProfile && pendingDateKeys.length
            ? `${pendingProfile.clientName} · ${pendingDateKeys.length === 1 ? formatSelectedDate(pendingDateKeys[0]) : `${pendingDateKeys.length} Tage`}`
            : undefined
        }
        onClose={closeTimeForm}
        maxWidth={430}
        footerActions={[
          {
            title: confirmedDateKeys.length || uncertainSave ? 'Schließen' : 'Abbrechen',
            variant: 'secondary',
            disabled: saving,
            onPress: closeTimeForm,
          },
          {
            title: pendingDateKeys.length > 1 ? `${pendingDateKeys.length} Einsätze freigeben` : 'Einsatz direkt freigeben',
            loading: saving,
            disabled: saving || uncertainSave || !pendingProfile || !pendingDateKeys.length || !isNormalizedTimeInput(normalizeTimeInput(startTime)),
            onPress: handleSchedule,
          },
        ]}
      >
        {pendingProfile ? (
          <View style={styles.timeForm}>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{pendingProfile.profileName}</Text>
              <Text style={styles.summaryMeta}>
                {pendingProfile.assignmentTitle} · {durationLabel(pendingProfile.durationMinutes)}
              </Text>
              <Text style={styles.summaryMeta}>{pendingProfile.employeeName}</Text>
            </View>
            {Platform.OS === 'web' ? (
              <View style={styles.summary}>
                <Text style={styles.summaryMeta}>Ausgewählte Tage</Text>
                <Text style={styles.summaryDates}>{pendingDateKeys.map(formatSelectedDate).join(' · ') || 'Alle Tage gespeichert.'}</Text>
                {confirmedDateKeys.length ? (
                  <Text style={styles.summaryMeta}>
                    Bereits gespeichert: {confirmedDateKeys.map(formatSelectedDate).join(' · ')}.
                    {' '}Diese Tage werden nicht erneut angelegt.
                  </Text>
                ) : null}
              </View>
            ) : null}
            {Platform.OS === 'web' && (saving || confirmedDateKeys.length > 0) ? (
              <Text style={styles.summaryDates}>Gemeinsame Startzeit: {startTime} Uhr</Text>
            ) : (
              <CareTimeInput
                label={pendingDateKeys.length > 1 ? 'Startzeit für alle ausgewählten Tage' : 'Startzeit'}
                value={startTime}
                placeholder="09:00"
                onChange={setStartTime}
                onDarkSurface
                showFormatHint={false}
                autoFocus
              />
            )}
            <Text style={styles.releaseHint}>
              {pendingDateKeys.length > 1
                ? 'Die Startzeit gilt für alle ausgewählten Tage. Nach Bestätigung werden die Einsätze einzeln freigegeben, im Assist-Kalender veröffentlicht und dem Mitarbeitendenportal bereitgestellt.'
                : 'Nach Bestätigung wird der Einsatz unmittelbar als bestätigt gespeichert, im Assist-Kalender veröffentlicht und dem Mitarbeitendenportal bereitgestellt.'}
            </Text>
            {Platform.OS === 'web' && saving ? <Text style={styles.summaryMeta} accessibilityLiveRegion="polite">{confirmedDateKeys.length} gespeichert · Freigabe läuft…</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : <Text style={styles.error}>Das Einsatzprofil ist nicht mehr verfügbar. Bitte das Fenster schließen und ein anderes Profil auswählen.</Text>}
      </AppGlassModal>
    </AssignmentProfileDateSelectionContext.Provider>
  );
}

const styles = StyleSheet.create({
  workspace: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minWidth: 0,
  },
  palette: {
    width: 336,
    flexShrink: 0,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(127,218,255,0.34)',
    backgroundColor: 'rgba(4,24,48,0.92)',
  },
  workspaceCompact: {
    flexDirection: 'column',
  },
  paletteCompact: {
    width: '100%',
  },
  paletteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paletteTitleWrap: { flex: 1, minWidth: 0 },
  paletteEyebrow: { color: '#72DEFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  paletteTitle: { ...typography.h3, color: '#FFFFFF', fontSize: 23, lineHeight: 28, marginTop: 3 },
  paletteHint: { ...typography.caption, color: '#9EB9CE', marginTop: 4, lineHeight: 17 },
  dateSelection: {
    gap: 8, padding: 12, marginBottom: 12, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(128,226,255,0.4)', backgroundColor: 'rgba(28,124,183,0.14)',
  },
  dateSelectionTitle: { color: '#EAFBFF', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  dateSelectionDates: { color: '#B9D3E7', fontSize: 12, lineHeight: 18, flexShrink: 1 },
  clearSelection: { minHeight: 32, justifyContent: 'center', alignItems: 'center' },
  clearSelectionText: { color: '#8CE8FF', fontSize: 12, lineHeight: 18 },
  planningNotice: { color: '#B9EDD8', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  paletteStats: {
    minHeight: 58,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(126,215,255,0.2)',
    backgroundColor: 'rgba(9,43,76,0.66)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  paletteStat: { flex: 1, alignItems: 'center' },
  paletteStatValue: { color: '#FFFFFF', fontSize: 19, lineHeight: 23, fontWeight: '900' },
  paletteStatLabel: { color: '#91ADC3', fontSize: 9, lineHeight: 12, fontWeight: '700', marginTop: 2 },
  paletteStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(133,215,255,0.2)' },
  profileSearch: {
    minHeight: 44,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(128,210,255,0.28)',
    backgroundColor: 'rgba(2,15,34,0.82)',
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 13,
  },
  profileList: { gap: 9 },
  profileListCompact: { flexDirection: 'row', flexWrap: 'wrap' },
  employeeGroup: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(120,204,248,0.2)',
    backgroundColor: 'rgba(2,15,34,0.62)',
    overflow: 'hidden',
  },
  employeeHeader: {
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  employeeHeaderExpanded: { backgroundColor: 'rgba(14,65,105,0.72)' },
  employeeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128,226,255,0.46)',
    backgroundColor: 'rgba(28,124,183,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeAvatarText: { color: '#EAFBFF', fontSize: 12, fontWeight: '900' },
  employeeCopy: { flex: 1, minWidth: 0 },
  employeeName: { color: '#FFFFFF', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  employeeMeta: { color: '#9EB9CE', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  employeeCount: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 6,
    borderRadius: 13,
    backgroundColor: 'rgba(40,157,222,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeCountText: { color: '#7FE4FF', fontSize: 10, fontWeight: '900' },
  employeeChevron: { color: '#88DFFF', fontSize: 17, width: 16, textAlign: 'center' },
  employeeProfiles: { gap: 8, padding: 9, paddingTop: 4 },
  profilePressable: {
    borderWidth: 1,
    borderColor: 'rgba(132,213,255,0.3)',
    borderRadius: 14,
    padding: 11,
    backgroundColor: '#F6FAFF',
  },
  profileSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(35,136,255,0.16)',
  },
  profilePressed: { opacity: 0.82 },
  profileHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  profileText: { flex: 1 },
  profileName: { ...typography.label, color: '#0B223D', fontSize: 12, lineHeight: 16 },
  profileClient: { ...typography.caption, color: '#49647D', marginTop: 2 },
  profileMeta: { ...typography.caption, color: '#587089', marginTop: spacing.xs },
  noSearchResult: { padding: 18, alignItems: 'center' },
  noSearchResultTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  noSearchResultText: { color: '#91ADC3', fontSize: 11, marginTop: 4, textAlign: 'center' },
  calendar: { flex: 1, minWidth: 0 },
  timeForm: { gap: spacing.md },
  summary: { gap: spacing.xs },
  summaryTitle: { ...typography.h3 },
  summaryMeta: { ...typography.caption, color: colors.textMuted },
  summaryDates: { ...typography.body, color: colors.textPrimary, lineHeight: 21 },
  releaseHint: { ...typography.caption, color: colors.textMuted, lineHeight: 20 },
  error: { ...typography.caption, color: colors.error },
});
