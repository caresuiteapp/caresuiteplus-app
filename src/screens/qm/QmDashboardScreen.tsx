import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
import { CareLightModuleTile, EmptyState, ErrorState, InfoBanner, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useQmDashboard } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchQmDashboard } from '@/lib/qm/qmService';
import { useAuth } from '@/lib/auth/context';
import { buildQmDashboardKpis } from '@/lib/qm/qmDashboardStats';
import { mapToCareLightKpis } from '@/lib/adaptive/careLightKpiMap';
import {
  isQmDashboardLiveReady,
  QM_DASHBOARD_PREPARED_MESSAGE,
} from '@/lib/qm/qmModuleConfig';

const NAV_AREAS = [
  { id: 'handbook', icon: '📖', title: 'QM-Handbuch', route: '/business/office/qm/handbook', liveReady: true },
  { id: 'documents', icon: '📄', title: 'Dokumente', route: '/business/office/qm/documents', liveReady: true },
  { id: 'compliance', icon: '✅', title: 'Compliance', route: '/business/office/qm/compliance', liveReady: true },
  { id: 'md', icon: '📁', title: 'MD-Prüfung', route: '/business/office/qm/md-audit', liveReady: true },
  { id: 'audits', icon: '🔍', title: 'Audits', route: '/business/office/qm/audits', liveReady: true },
  { id: 'measures', icon: '📋', title: 'Maßnahmen', route: '/business/office/qm/measures', liveReady: true },
  { id: 'changes', icon: '🔄', title: 'Änderungen', route: '/business/office/qm/changes', liveReady: true },
  { id: 'exports', icon: '📤', title: 'Export', route: '/business/office/qm/exports', liveReady: false },
  { id: 'ai', icon: '🤖', title: 'KI-Assistent', route: '/business/office/qm/ai-assistant', liveReady: false },
  { id: 'templates', icon: '📝', title: 'Vorlagen', route: '/business/office/qm/templates', liveReady: true },
  { id: 'settings', icon: '⚙️', title: 'Einstellungen', route: '/business/office/qm/settings', liveReady: false },
];

/** QM Dashboard — Office Qualitätsmanagement */
export function QmDashboardScreen() {
  const router = useRouter();
  const { c } = useCareLightPalette();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: { gap: careSpacing.md },
        auditItem: { ...careTypography.body, color: c.text, marginBottom: careSpacing.xs },
      }),
    [c.text],
  );
  const { can, check, roleLabel } = usePermissions();
  const { data, loading, error, refresh } = useQmDashboard();
  const qmAccent = moduleColor('qm');

  if (!can('qm.view')) {
    return (
      <CareLightScreen>
        <LockedActionBanner message={check('qm.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightScreen>
    );
  }

  if (loading && !data) {
    return (
      <CareLightScreen>
        <LoadingState message="QM-Dashboard wird geladen…" />
      </CareLightScreen>
    );
  }

  if (error && !data) {
    return (
      <CareLightScreen>
        <ErrorState message={error} onRetry={refresh} />
      </CareLightScreen>
    );
  }

  const kpis = data ? mapToCareLightKpis(buildQmDashboardKpis(data)) : [];

  return (
    <CareLightScreen>
      {!isQmDashboardLiveReady() ? (
        <InfoBanner title="QM preparedOnly" message={QM_DASHBOARD_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="qm"
        subtitle={`Office · ${roleLabel ?? 'QM'}`}
        kpis={kpis}
        kpiTitle="Kennzahlen"
        recentTitle="Anstehende Audits"
        recentSubtitle={data!.upcomingAudits.length > 0 ? `${data!.upcomingAudits.length} geplant` : 'Keine geplant'}
        recentSection={
          data!.upcomingAudits.length > 0 ? (
            data!.upcomingAudits.map((audit) => (
              <Text key={audit.id} style={styles.auditItem}>• {audit.title}</Text>
            ))
          ) : (
            <EmptyState title="Keine geplanten Audits" message="Derzeit sind keine Audits geplant." />
          )
        }
        quickActions={
          <View style={styles.grid}>
            {NAV_AREAS.map((area) => (
              <CareLightModuleTile
                key={area.id}
                icon={area.icon}
                title={area.title}
                accentColor={qmAccent}
                isActive={area.liveReady}
                onPress={() => router.push(area.route as never)}
              />
            ))}
          </View>
        }
      />
    </CareLightScreen>
  );
}
