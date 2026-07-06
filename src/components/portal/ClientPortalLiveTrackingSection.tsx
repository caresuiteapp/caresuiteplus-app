import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { usePortalClientLiveTracking } from '@/hooks/usePortalClientLiveTracking';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { lightSurfaceText } from '@/design/tokens/auroraGlass';

/** Compact live-tracking block for client appointments tab (Anfahrt / laufender Einsatz). */
export function ClientPortalLiveTrackingSection() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const text = lightSurfaceText;
  const { state, loading } = usePortalClientLiveTracking();

  if (loading && !state?.assignmentId) return null;
  if (!state?.assignmentId) return null;

  const liveVisit = state.liveVisit;

  return (
    <SectionPanel
      title="Live-Standort Ihrer Betreuungskraft"
      subtitle={liveVisit?.statusLabel ?? 'Aktueller Einsatzstatus'}
    >
      {state.title ? (
        <Text style={[styles.title, { color: text.primary }]}>{state.title}</Text>
      ) : null}
      {state.caregiverName ? (
        <Text style={[styles.meta, { color: text.secondary }]}>
          Betreuungskraft: {state.caregiverName}
        </Text>
      ) : null}

      {liveVisit?.mapVisible && liveVisit.lastPosition ? (
        <AssistLiveMap
          position={liveVisit.lastPosition}
          markerLabel={state.caregiverName ?? 'Betreuungskraft'}
          height={220}
          tenantId={tenantId}
        />
      ) : (
        <View style={styles.fallbackBox}>
          <Text style={[styles.fallbackText, { color: text.muted }]}>
            {liveVisit?.fallbackMessage ??
              'Noch keine Standortdaten — Tracking startet während der Anfahrt im Mitarbeiterportal.'}
          </Text>
        </View>
      )}

      <PremiumButton
        title="Einsatzdetails"
        variant="secondary"
        size="sm"
        onPress={() => router.push(`/portal/client/appointments/${state.assignmentId}` as never)}
      />
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  title: { ...careTypography.bodyStrong, marginBottom: careSpacing.xs },
  meta: { ...careTypography.body, marginBottom: careSpacing.sm },
  fallbackBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    padding: careSpacing.md,
    minHeight: 120,
    justifyContent: 'center',
  },
  fallbackText: { ...careTypography.caption, textAlign: 'center' },
});
