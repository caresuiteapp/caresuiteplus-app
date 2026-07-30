import { createElement, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  PremiumInput,
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
}: {
  profile: ClientAssignmentProfile;
  selected: boolean;
  onSelect: () => void;
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
      },
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
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      const profileId =
        event.dataTransfer?.getData(ASSIGNMENT_PROFILE_DRAG_MIME)
        || event.dataTransfer?.getData('text/plain')
        || '';
      if (profileId) onDrop(profileId, date, suggestedTime);
    },
  };
}

export function OfficeAssignmentProfileCalendarPlanner({ children, onScheduled }: Props) {
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
  const profiles = useMemo(() => query.data ?? [], [query.data]);
  const pendingProfile = useMemo(
    () => profiles.find((profile) => profile.id === pendingProfileId) ?? null,
    [pendingProfileId, profiles],
  );

  function handleDrop(profileId: string, date: Date, time?: string) {
    if (!profiles.some((profile) => profile.id === profileId)) return;
    setPendingProfileId(profileId);
    setPendingDate(date);
    setStartTime(time ?? suggestedStartTime());
    setError(null);
  }

  function handleTouchDate(profileId: string, date: Date, time?: string) {
    handleDrop(profileId, date, time);
  }

  async function handleSchedule() {
    if (!tenantId || !pendingProfile || !pendingDate) return;
    setSaving(true);
    setError(null);
    const result = await scheduleClientAssignmentProfile(
      tenantId,
      pendingProfile.id,
      toDateKey(pendingDate),
      startTime,
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
              <Text style={styles.paletteTitle}>Einsatzprofile</Text>
              <Text style={styles.paletteHint}>
                {Platform.OS === 'web'
                  ? 'Profil auf einen Kalendertag ziehen'
                  : 'Profil wählen und danach einen Tag antippen'}
              </Text>
            </View>
            <PremiumBadge label={String(profiles.length)} variant="cyan" />
          </View>
          {query.loading && !query.data ? <LoadingState message="Profile werden geladen…" /> : null}
          {query.error && !query.data ? <ErrorState message={query.error} onRetry={query.refresh} /> : null}
          {!query.loading && !query.error && profiles.length === 0 ? (
            <EmptyState
              title="Keine Einsatzprofile"
              message="Einsatzprofile werden in der jeweiligen Klientenakte im Tab „Einsätze & Termine“ erstellt."
            />
          ) : (
            <View style={[styles.profileList, compact && styles.profileListCompact]}>
              {profiles.map((profile) => (
                <DraggableProfileCard
                  key={profile.id}
                  profile={profile}
                  selected={selectedProfileId === profile.id}
                  onSelect={() =>
                    setSelectedProfileId((current) => (current === profile.id ? null : profile.id))
                  }
                />
              ))}
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
            disabled: !/^\d{2}:\d{2}$/.test(startTime),
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
            <PremiumInput
              label="Startzeit"
              value={startTime}
              placeholder="09:00"
              maxLength={5}
              onChangeText={setStartTime}
              autoFocus
              onLightSurface
            />
            <Text style={styles.releaseHint}>
              Nach Bestätigung wird der Einsatz unmittelbar als bestätigt gespeichert und in Office,
              Assist sowie den freigegebenen Portalen veröffentlicht.
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
    width: 284,
    flexShrink: 0,
    padding: spacing.md,
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
  paletteTitleWrap: { flex: 1 },
  paletteTitle: { ...typography.h3 },
  paletteHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  profileList: { gap: spacing.sm },
  profileListCompact: { flexDirection: 'row', flexWrap: 'wrap' },
  profilePressable: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    backgroundColor: colors.bgSurface,
  },
  profileSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(35,136,255,0.16)',
  },
  profilePressed: { opacity: 0.82 },
  profileHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  profileText: { flex: 1 },
  profileName: { ...typography.label },
  profileClient: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  profileMeta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  calendar: { flex: 1, minWidth: 0 },
  timeForm: { gap: spacing.md },
  summary: { gap: spacing.xs },
  summaryTitle: { ...typography.h3 },
  summaryMeta: { ...typography.caption, color: colors.textMuted },
  releaseHint: { ...typography.caption, color: colors.textMuted, lineHeight: 20 },
  error: { ...typography.caption, color: colors.error },
});
