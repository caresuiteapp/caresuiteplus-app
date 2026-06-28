import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalClientLiveTracking } from '@/hooks/usePortalClientLiveTracking';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { colors, spacing, typography } from '@/theme';

export function PortalClientLiveTrackingScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.client.appointments.view');
  const { state, loading, error, refresh } = usePortalClientLiveTracking();

  if (!canView) {
    return (
      <ScreenShell title="Live-Standort" subtitle={resolvePortalScreenSubtitle(roleLabel, 'client')}>
        <LockedActionBanner
          message={check('portal.client.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && !state) {
    return (
      <ScreenShell title="Live-Standort" subtitle="Wird geladen…">
        <LoadingState message="Live-Standort wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !state) {
    return (
      <ScreenShell title="Live-Standort" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const liveVisit = state?.liveVisit;
  const hasActiveAssignment = Boolean(state?.assignmentId);

  return (
    <ScreenShell
      title="Live-Standort"
      subtitle="Live-Standort Ihrer Betreuungskraft"
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <InfoBanner
          variant="info"
          title="Datenschutz"
          message="Der Standort wird nur während eines laufenden Einsatzes und nach Einwilligung der Betreuungskraft angezeigt. Es werden keine Fahrten oder GPS-Verläufe gespeichert."
        />

        {!hasActiveAssignment ? (
          <EmptyState
            title="Kein laufender Einsatz"
            message="Live-Standort ist nur verfügbar, wenn Ihre Betreuungskraft gerade unterwegs ist oder den Einsatz durchführt."
            actionLabel="Zu meinen Einsätzen"
            onAction={() => router.push('/portal/client/appointments' as never)}
          />
        ) : (
          <SectionPanel
            title={state?.title ?? 'Aktueller Einsatz'}
            subtitle={liveVisit?.statusLabel ?? 'Einsatzstatus'}
          >
            {state?.caregiverName ? (
              <Text style={styles.caregiver}>Betreuungskraft: {state.caregiverName}</Text>
            ) : null}

            {liveVisit?.mapVisible && liveVisit.lastPosition ? (
              <AssistLiveMap
                position={liveVisit.lastPosition}
                markerLabel={state?.caregiverName ?? 'Betreuungskraft'}
                height={320}
              />
            ) : (
              <View style={styles.fallbackBox}>
                <Text style={styles.fallbackIcon}>🗺️</Text>
                <Text style={styles.fallbackText}>
                  {liveVisit?.fallbackMessage ??
                    'Noch keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.'}
                </Text>
              </View>
            )}

            {state?.assignmentId ? (
              <PremiumButton
                title="Einsatzdetails öffnen"
                variant="secondary"
                size="sm"
                onPress={() =>
                  router.push(`/portal/client/appointments/${state.assignmentId}` as never)
                }
              />
            ) : null}
          </SectionPanel>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  caregiver: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  fallbackBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 200,
  },
  fallbackIcon: { fontSize: 28 },
  fallbackText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
