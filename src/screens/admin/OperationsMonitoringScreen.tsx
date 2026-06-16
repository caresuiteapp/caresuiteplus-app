import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OperationsMonitoringHero } from '@/components/admin/OperationsMonitoringHero';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  ModuleTile,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { sanitizeUiText } from '@/lib/ui/uiVisibility';
import {
  fetchOperationsMonitoringDashboard,
  OPERATIONS_MONITORING_PREPARED_MESSAGE,
} from '@/lib/operations/operationsMonitoringService';
import { colors, spacing } from '@/theme';

export function OperationsMonitoringScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOperationsMonitoringDashboard(tenantId, profile?.roleKey, profile?.id);
    },
    [tenantId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Betrieb & Monitoring" subtitle="Wird geladen…" scroll>
        <LoadingState message="Systemstatus wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Betrieb & Monitoring" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const dashboard = query.data;
  if (!dashboard) {
    return (
      <ScreenShell title="Betrieb & Monitoring" scroll>
        <EmptyState title="Keine Daten" message="Monitoring-Übersicht nicht verfügbar." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Betrieb & Monitoring"
      subtitle={`Mehr → System · ${roleLabel ?? 'Admin'}`}
      scroll
    >
      <InfoBanner title="Backup & 24/7-Monitoring in Vorbereitung" message={OPERATIONS_MONITORING_PREPARED_MESSAGE} />
      <OperationsMonitoringHero dashboard={dashboard} />

      <SectionPanel title="Bereiche" subtitle="Systemstatus, Fehlerlogs, Incidents und vorbereitete Betriebsfunktionen">
        <View style={styles.grid}>
          {dashboard.areas.map((area) => (
            <ModuleTile
              key={area.areaKey}
              icon={area.preparedOnly ? '🛠️' : '📋'}
              title={area.label}
              description={`${area.openCount} Einträge · ${sanitizeUiText(area.statusLabel)}${area.preparedOnly ? ` · ${sanitizeUiText('In Vorbereitung')}` : ''}`}
              accentColor={area.preparedOnly ? colors.warning : colors.cyan}
              isActive={!area.preparedOnly}
              preparedOnly={area.preparedOnly}
              isNavigable={!area.preparedOnly}
              onPress={area.preparedOnly ? undefined : () => router.push(area.route as never)}
            />
          ))}
        </View>
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
});
