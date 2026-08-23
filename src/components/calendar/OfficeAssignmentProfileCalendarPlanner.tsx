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

function DraggableProfileCard({
  profile,
  selected,
  onSelect,
  onBrowserDragStart,
  onBrowserDragEnd,
}: {
  profile: ClientAssignmentProfile;
  selected: boolean;
  onSelect: () => void;
  onBrowserDragStart: (profileId: string, pointerX: number, pointerY: number) => void;
  onBrowserDragEnd: () => void;
}) {
  const card = (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.profilePressable,
        selected && styles.profileSelected,
        pressed && styles.profilePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Einsatzprofil ${profile.profileName} auswählen`}
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
      draggable: true,
      onDragStart: (event: DragEvent) => {
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

export function OfficeAssignmentProfileCalendarPlanner({ children, onScheduled }: Props) {
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
      live: {
        tenantId,
        subscribe: subscribeToClientAssignmentProfileChanges,
      },
    },
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState(suggestedStartTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(() => new Set());
  const activeDragProfileId = useRef<string | null>(null);
  const dragPointer = useRef({ x: 0, y: 0 });
  const dragScrollFrame = useRef<number | null>(null);
  const profiles = useMemo(() => query.data ?? [], [query.data]);
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

  const toggleEmployee = useCallback((employeeName: string) => {
    setExpandedEmployees((current) => {
      const next = new Set(current);
      if (next.has(employeeName)) next.delete(employeeName);
      else next.add(employeeName);
      return next;
    });
  }, []);

  const handleDrop = useCallback((profileId: string, date: Date, time?: string) => {
    if (!profiles.some((profile) => profile.id === profileId)) return;
    setPendingProfileId(profileId);
    setPendingDate(date);
    setStartTime(time ?? suggestedStartTime());
    setError(null);
  }, [profiles]);

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

  async function handleSchedule() {
    if (!tenantId || !pendingProfile || !pendingDate) return;
    const normalizedStartTime = normalizeTimeInput(startTime);
    if (!isNormalizedTimeInput(normalizedStartTime)) {
      setError('Bitte eine gültige Uhrzeit im Format HH:MM eingeben.');
      return;
    }
    setStartTime(normalizedStartTime);
    setSaving(true);
    setError(null);
    const result = await scheduleClientAssignmentProfile(
      tenantId,
      pendingProfile.id,
      toDateKey(pendingDate),
      normalizedStartTime,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPendingProfileId(null);
    setPendingDate(null);
    setSelectedProfileId(null);
    await onScheduled();
  }

  const content = children({
    selectedProfileId,
    onProfileDrop: (profileId, date, time) => {
      const resolvedId = profileId || selectedProfileId;
      if (resolvedId) handleTouchDate(resolvedId, date, time);
    },
  });

  return (
    <>
      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        <PremiumCard style={[styles.palette, compact && styles.paletteCompact]}>
          <View style={styles.paletteHeader}>
            <View style={styles.paletteTitleWrap}>
              <Text style={styles.paletteEyebrow}>SCHNELLPLANUNG</Text>
              <Text style={styles.paletteTitle}>Einsatzprofile</Text>
              <Text style={styles.paletteHint}>
                {Platform.OS === 'web'
                  ? 'Mitarbeitende öffnen und Profil in den Kalender ziehen'
                  : 'Mitarbeitende öffnen, Profil wählen und Tag antippen'}
              </Text>
            </View>
            <PremiumBadge label={String(profiles.length)} variant="cyan" />
          </View>
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
        visible={Boolean(pendingProfile && pendingDate)}
        title="Uhrzeit festlegen"
        subtitle={
          pendingProfile && pendingDate
            ? `${pendingProfile.clientName} · ${pendingDate.toLocaleDateString('de-DE')}`
            : undefined
        }
        onClose={() => {
          setPendingProfileId(null);
          setPendingDate(null);
          setError(null);
        }}
        maxWidth={430}
        footerActions={[
          {
            title: 'Abbrechen',
            variant: 'secondary',
            onPress: () => {
              setPendingProfileId(null);
              setPendingDate(null);
              setError(null);
            },
          },
          {
            title: 'Einsatz direkt freigeben',
            loading: saving,
            disabled: !isNormalizedTimeInput(normalizeTimeInput(startTime)),
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
            <CareTimeInput
              label="Startzeit"
              value={startTime}
              placeholder="09:00"
              onChange={setStartTime}
              onDarkSurface
              showFormatHint={false}
              autoFocus
            />
            <Text style={styles.releaseHint}>
              Nach Bestätigung wird der Einsatz unmittelbar als bestätigt gespeichert, im
              Assist-Kalender veröffentlicht und dem Mitarbeitendenportal bereitgestellt.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}
      </AppGlassModal>
    </>
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
  releaseHint: { ...typography.caption, color: colors.textMuted, lineHeight: 20 },
  error: { ...typography.caption, color: colors.error },
});
