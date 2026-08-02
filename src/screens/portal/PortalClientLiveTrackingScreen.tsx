import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalClientLiveTracking } from '@/hooks/usePortalClientLiveTracking';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, typography } from '@/theme';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { portalPremium } from '@/design/tokens/portalPremium';

export function PortalClientLiveTrackingScreen() {
  const router = useRouter();
  const { can } = usePermissions();
  const canView = can('portal.client.appointments.view');
  const tenantId = useServiceTenantId();
  const { state, loading, error, refresh } = usePortalClientLiveTracking();

  if (!canView) {
    return (
      <PortalTabScreen title="Live-Anfahrt">
        <ClientPortalGuide
          compact
          title="Hier gibt es noch nichts zu sehen"
          message="Sobald eine Live-Anfahrt für Sie verfügbar ist, erscheint sie automatisch an dieser Stelle."
        />
      </PortalTabScreen>
    );
  }

  if (loading && !state) {
    return (
      <PortalTabScreen title="Live-Anfahrt" subtitle="Wird geladen…">
        <LoadingState message="Live-Standort wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (error && !state) {
    return (
      <PortalTabScreen title="Live-Anfahrt">
        <ErrorState message="Die Live-Anfahrt konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut." onRetry={refresh} />
      </PortalTabScreen>
    );
  }

  const liveVisit = state?.liveVisit;
  const hasActiveAssignment = Boolean(state?.assignmentId);

  return (
    <PortalTabScreen
      title="Live-Anfahrt"
      subtitle="Sehen Sie, wann Ihre Betreuungskraft unterwegs ist"
      scroll={false}
      actionsSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <ClientPortalGuide
          compact
          title="Ihre Privatsphäre bleibt geschützt"
          message="Der Standort ist nur während der Anfahrt oder eines laufenden Einsatzes sichtbar und verschwindet danach automatisch."
        />

        {!hasActiveAssignment ? (
          <ClientPortalGuide
            compact
            title="Gerade ist niemand unterwegs"
            message="Wenn Ihre Betreuungskraft die Anfahrt startet, sehen Sie den aktuellen Stand automatisch hier."
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
                tenantId={tenantId}
              />
            ) : (
              <ClientPortalGuide
                compact
                title="Die Anfahrt wird vorbereitet"
                message={liveVisit?.fallbackMessage ?? 'Sobald ein Standort verfügbar ist, wird die Karte automatisch eingeblendet.'}
              />
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
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  caregiver: {
    ...typography.body,
    color: portalPremium.text.secondary,
    marginBottom: spacing.sm,
  },
});
