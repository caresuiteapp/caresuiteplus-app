import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MobilePortalKpiCard } from '@/components/portal/assist/MobilePortalKpiCard';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { fetchClientPortalLiveMetrics } from '@/lib/portal/clientPortalDashboardLive';
import { resolveClientPortalHeroLines } from '@/lib/portal/clientPortalGreeting';
import { resolvePortalTerminology } from '@/lib/portal/engine';
import type { PortalContext } from '@/lib/portal/types';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';

type ClientPortalBaseOverviewProps = {
  context: PortalContext;
  onRefresh?: () => void;
};

/** Modern overview when modules are not yet assigned — still shows live KPIs and navigation. */
export function ClientPortalBaseOverview({ context, onRefresh }: ClientPortalBaseOverviewProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const terminology = resolvePortalTerminology('assist');
  const heroLines = resolveClientPortalHeroLines({
    displayName: context.displayName,
    tenantName: context.tenantName,
    moduleLabel: terminology.moduleLabel,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalVisits: 0,
    upcomingAppointments: 0,
    documents: 0,
    openMessages: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const live = await fetchClientPortalLiveMetrics(context.tenantId, context.clientId);
      setMetrics({
        totalVisits: live.totalVisits,
        upcomingAppointments: live.upcomingAppointments,
        documents: live.documents,
        openMessages: live.openMessages,
      });
    } catch {
      setError('Übersicht konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [context.clientId, context.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    await load();
    onRefresh?.();
  };

  if (loading && metrics.totalVisits === 0 && metrics.openMessages === 0) {
    return <LoadingState message="Übersicht wird geladen…" />;
  }

  if (error) {
    return <ErrorState title="Übersicht nicht geladen" message={error} onRetry={handleRefresh} />;
  }

  const einsatzCount = metrics.totalVisits || metrics.upcomingAppointments;

  return (
    <View style={styles.container}>
      <PortalGlassHero
        title={`${heroLines.greetingLine},`}
        titleSecondary={heroLines.nameLine}
        subtitle={heroLines.providerLine}
        showStatusDot
      />

      <Text style={[type.label, { color: text.primary }]}>Wichtig für Sie</Text>
      <View style={styles.grid}>
        <MobilePortalKpiCard
          icon="📅"
          label="Einsätze"
          value={einsatzCount}
          emptyMessage="Keine Einsätze sichtbar."
          ctaLabel="Einsätze öffnen →"
          accentColor="#4CC9F0"
          onCta={() => router.push('/portal/client/appointments' as never)}
          onPress={() => router.push('/portal/client/appointments' as never)}
        />
        <MobilePortalKpiCard
          icon="💬"
          label="Nachrichten"
          value={metrics.openMessages}
          emptyMessage="Keine neuen Nachrichten."
          ctaLabel="Nachrichten öffnen →"
          accentColor="#7B61FF"
          onCta={() => router.push('/portal/client/messages' as never)}
          onPress={() => router.push('/portal/client/messages' as never)}
        />
        <MobilePortalKpiCard
          icon="📄"
          label="Dokumente"
          value={metrics.documents}
          emptyMessage="Keine Dokumente freigegeben."
          ctaLabel="Dokumente öffnen →"
          accentColor="#FF9500"
          onCta={() => router.push('/portal/client/documents' as never)}
          onPress={() => router.push('/portal/client/documents' as never)}
        />
      </View>

      {!context.hasModuleAssignments ? (
        <GlassCard>
          <Text style={[type.bodyStrong, { color: text.primary, marginBottom: careSpacing.xs }]}>
            Module noch nicht freigegeben
          </Text>
          <Text style={[type.body, { color: text.secondary, marginBottom: careSpacing.md }]}>
            Assist, Pflege, Stationär oder Beratung können in Ihrem Pflegebüro freigeschaltet
            werden. Einsätze und Nachrichten sind bereits verfügbar, sobald Daten freigegeben sind.
          </Text>
          <PremiumButton title="Erneut prüfen" onPress={handleRefresh} />
        </GlassCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    justifyContent: 'space-between',
  },
});
