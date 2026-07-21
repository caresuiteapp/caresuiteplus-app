import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  HealthOSAlert,
  HealthOSEmptyState,
  HealthOSErrorState,
  HealthOSLoadingState,
  HealthOSPage,
  HealthOSStatusBadge,
} from '@/components/healthos';
import { resolveHealthOSShellBreakpoint } from '@/components/healthos/shell/healthosShellLayoutRules';
import { PremiumListRow, CachedDataBanner } from '@/components/ui';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import {
  buildEmployeePortalTodayModel,
  type EmployeePortalTodayMetric,
  type EmployeePortalTodayTask,
  type EmployeePortalTodayAssignment,
} from '@/lib/portal/employee/employeePortalTodayModel';
import { spacing, typography } from '@/theme';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import {
  SpatialPortalMetric,
  SpatialPortalPearlState,
  SpatialPortalSection,
  SpatialPortalSurface,
} from '@/components/portal/SpatialPortalSurface';

type Props = {
  dashboard: EmployeePortalDashboardProjection | null;
  loading: boolean;
  error: string | null;
  displayName: string;
  onRefresh: () => void;
  fromCache?: boolean;
  cachedAt?: string | null;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricsSection({
  metrics,
  accentColor,
  columns,
  onNavigate,
}: {
  metrics: EmployeePortalTodayMetric[];
  accentColor: string;
  columns: 2 | 4;
  onNavigate: (route?: string) => void;
}) {
  return (
    <AdaptiveKpiGrid
      columns={{ phone: 2, tablet: 2, desktop: columns, wide: columns }}
      items={metrics.map((metric) => ({
        id: metric.id,
        node: (
          <Pressable
            onPress={() => onNavigate(metric.route)}
            accessibilityRole="button"
            accessibilityLabel={`${metric.label}: ${metric.value}`}
            testID={`healthos-employee-metric-${metric.id}`}
          >
            <SpatialPortalMetric
              label={metric.label}
              value={metric.value}
              subValue={metric.subValue}
              icon={metric.icon}
              accentColor={accentColor}
            />
          </Pressable>
        ),
      }))}
    />
  );
}

function AssignmentList({
  assignments,
  accentColor,
  onNavigate,
}: {
  assignments: EmployeePortalTodayAssignment[];
  accentColor: string;
  onNavigate: (route: string) => void;
}) {
  return (
    <View style={styles.listContainer}>
      {assignments.map((item, index) => (
        <PremiumListRow
          key={item.assignmentId}
          title={item.title}
          subtitle={`${item.clientName} · ${item.timeRange}`}
          multiline
          leading={
            <HealthOSStatusBadge
              domain="assignment"
              technicalValue={item.statusTechnical}
              dot
            />
          }
          trailing={
            item.isActive ? (
              <Text style={[styles.actionLabel, { color: accentColor }]}>Aktiv</Text>
            ) : item.hasOpenDocumentation ? (
              <Text style={[styles.actionLabel, { color: accentColor }]}>Dok. offen</Text>
            ) : item.signaturePending ? (
              <Text style={[styles.actionLabel, { color: accentColor }]}>Unterschr. offen</Text>
            ) : undefined
          }
          showChevron
          showDivider={index < assignments.length - 1}
          onPress={() => onNavigate(item.navigationRoute)}
        />
      ))}
    </View>
  );
}

function TaskList({
  tasks,
  accentColor,
  onNavigate,
}: {
  tasks: EmployeePortalTodayTask[];
  accentColor: string;
  onNavigate: (route?: string) => void;
}) {
  return (
    <View style={styles.listContainer}>
      {tasks.map((task, index) => (
        <PremiumListRow
          key={task.id}
          title={task.label}
          trailing={
            <Text style={[styles.countBadge, { color: accentColor }]}>{task.count}</Text>
          }
          showChevron={Boolean(task.route)}
          showDivider={index < tasks.length - 1}
          onPress={() => onNavigate(task.route)}
        />
      ))}
    </View>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function HealthOSEmployeePortalTodayView({
  dashboard,
  loading,
  error,
  displayName,
  onRefresh,
  fromCache = false,
  cachedAt = null,
}: Props) {
  const router = useRouter();
  const { width } = useHydrationSafeWindowDimensions();
  const breakpoint = resolveHealthOSShellBreakpoint(width);
  const kpiColumns: 2 | 4 = breakpoint === 'desktop' ? 4 : 2;
  const moduleAccent = useMainModuleAccent();
  useShellHostsAurora();
  const navigate = (route?: string) => {
    if (route) router.push(route as never);
  };

  const model = useMemo(
    () =>
      dashboard
        ? buildEmployeePortalTodayModel({ dashboard, displayName })
        : null,
    [dashboard, displayName],
  );

  if (loading && !dashboard) {
    return <HealthOSLoadingState message="Mitarbeiterportal wird geladen…" />;
  }

  if (error && !dashboard) {
    return (
      <HealthOSErrorState
        title="Portal nicht verfügbar"
        message={error}
        onRetry={onRefresh}
      />
    );
  }

  if (!dashboard || !model) {
    return (
      <HealthOSEmptyState
        title="Keine Portaldaten"
        message="Für Ihre Rolle sind aktuell keine Portaldaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const hasEinsaetze = model.meineEinsaetze.length > 0;
  const hasAufgaben = model.offeneAufgaben.length > 0;

  return (
    <HealthOSPage scroll testID="healthos-employee-portal-today">
      <CachedDataBanner visible={fromCache} cachedAt={cachedAt} />
      {/* A: Tagesübersicht */}
      <SpatialPortalSection
        title="Heute"
        subtitle={`${model.greetingLine} · Tagesübersicht`}
        accentColor={moduleAccent}
      >
        <MetricsSection
          metrics={model.tagesübersicht}
          accentColor={moduleAccent}
          columns={kpiColumns}
          onNavigate={navigate}
        />
      </SpatialPortalSection>

      {model.openSignatures ? (
        <SpatialPortalSection
          title="Offene Unterschriften"
          subtitle="Dokumente vom Office — bitte zeitnah unterschreiben"
          accentColor={moduleAccent}
        >
          {model.openSignatures.subValue?.includes('überfällig') ? (
            <HealthOSAlert
              variant="warning"
              title="Überfällige Unterschriften"
              message="Es liegen überfällige Dokumente zur Unterschrift vor."
            />
          ) : null}
          <Pressable
            onPress={() => navigate(model.openSignatures?.route)}
            accessibilityRole="button"
            testID="healthos-employee-open-signatures"
          >
            <SpatialPortalMetric
              label={model.openSignatures.label}
              value={model.openSignatures.value}
              subValue={model.openSignatures.subValue}
              icon={model.openSignatures.icon}
              accentColor={moduleAccent}
            />
          </Pressable>
        </SpatialPortalSection>
      ) : null}

      {/* B: Meine Einsätze */}
      <SpatialPortalSection
        title="Meine Einsätze"
        subtitle="Heutige und nächste Einsätze — antippen für Details"
        accentColor={moduleAccent}
      >
        {hasEinsaetze ? (
          <SpatialPortalSurface compact>
            <AssignmentList
              assignments={model.meineEinsaetze}
              accentColor={moduleAccent}
              onNavigate={(route) => navigate(route)}
            />
          </SpatialPortalSurface>
        ) : (
          <SpatialPortalPearlState
            title="Keine Einsätze"
            message="Für heute und die nächsten Tage sind keine Einsätze eingetragen."
          />
        )}
      </SpatialPortalSection>

      {/* C: Offene Aufgaben */}
      <SpatialPortalSection
        title="Offene Aufgaben"
        subtitle="Dokumentation und Unterschriften mit Handlungsbedarf"
        accentColor={moduleAccent}
      >
        {hasAufgaben ? (
          <>
            <HealthOSAlert
              variant="warning"
              title="Ausstehende Aufgaben"
              message="Bitte schließen Sie offene Dokumentationen und Unterschriften zeitnah ab."
            />
            <TaskList
              tasks={model.offeneAufgaben}
              accentColor={moduleAccent}
              onNavigate={navigate}
            />
          </>
        ) : (
          <SpatialPortalPearlState
            title="Alles erledigt"
            message="Keine offenen Dokumentationen oder Unterschriften."
          />
        )}
      </SpatialPortalSection>

    </HealthOSPage>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    gap: spacing.xs,
  },
  countBadge: {
    ...typography.caption,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'right',
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
});
