import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import {
  HealthOSAlert,
  HealthOSCard,
  HealthOSEmptyState,
  HealthOSErrorState,
  HealthOSLoadingState,
  HealthOSMetricCard,
  HealthOSPage,
  HealthOSSection,
  HealthOSStatusBadge,
} from '@/components/healthos';
import { resolveHealthOSShellBreakpoint } from '@/components/healthos/shell/healthosShellLayoutRules';
import { PremiumListRow, CachedDataBanner } from '@/components/ui';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import {
  buildEmployeePortalTodayModel,
  type EmployeePortalTodayMetric,
  type EmployeePortalTodayLink,
  type EmployeePortalTodayTask,
  type EmployeePortalTodayAssignment,
} from '@/lib/portal/employee/employeePortalTodayModel';
import { spacing, typography } from '@/theme';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';

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
  variant,
  columns,
  onNavigate,
}: {
  metrics: EmployeePortalTodayMetric[];
  accentColor: string;
  variant: 'glass' | 'light';
  columns: { phone: number; tablet: number; desktop: number; wide: number };
  onNavigate: (route?: string) => void;
}) {
  return (
    <AdaptiveKpiGrid
      columns={columns}
      items={metrics.map((metric) => ({
        id: metric.id,
        node: (
          <Pressable
            onPress={() => onNavigate(metric.route)}
            accessibilityRole="button"
            accessibilityLabel={`${metric.label}: ${metric.value}`}
            testID={`healthos-employee-metric-${metric.id}`}
          >
            <HealthOSMetricCard
              label={metric.label}
              value={metric.value}
              subValue={metric.subValue}
              icon={metric.icon}
              accentColor={accentColor}
              variant={variant}
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

function LinkList({
  links,
  accentColor,
  onNavigate,
}: {
  links: EmployeePortalTodayLink[];
  accentColor: string;
  onNavigate: (route: string) => void;
}) {
  return (
    <View style={styles.listContainer}>
      {links.map((link, index) => (
        <PremiumListRow
          key={link.id}
          title={link.label}
          leading={
            link.icon ? <Text style={styles.leadingIcon}>{link.icon}</Text> : undefined
          }
          showChevron
          showDivider={index < links.length - 1}
          onPress={() => onNavigate(link.route)}
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
  const kpiColumns =
    breakpoint === 'mobile'
      ? { phone: 2, tablet: 2, desktop: 4, wide: 4 }
      : breakpoint === 'tablet'
        ? { phone: 2, tablet: 2, desktop: 3, wide: 3 }
        : { phone: 2, tablet: 2, desktop: 4, wide: 4 };
  const moduleAccent = useMainModuleAccent();
  const shellHostsAurora = useShellHostsAurora();
  const cardVariant = shellHostsAurora ? 'light' : 'glass';

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
      <HealthOSSection
        title="Heute"
        subtitle={`${model.greetingLine} · Tagesübersicht`}
        accentColor={moduleAccent}
      >
        <MetricsSection
          metrics={model.tagesübersicht}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={kpiColumns}
          onNavigate={navigate}
        />
      </HealthOSSection>

      {model.openSignatures ? (
        <HealthOSSection
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
            <HealthOSMetricCard
              label={model.openSignatures.label}
              value={model.openSignatures.value}
              subValue={model.openSignatures.subValue}
              icon={model.openSignatures.icon}
              accentColor={moduleAccent}
              variant={cardVariant}
            />
          </Pressable>
        </HealthOSSection>
      ) : null}

      {/* B: Meine Einsätze */}
      <HealthOSSection
        title="Meine Einsätze"
        subtitle="Heutige und nächste Einsätze — Tap für Details"
        accentColor={moduleAccent}
      >
        {hasEinsaetze ? (
          <HealthOSCard variant="elevated">
            <AssignmentList
              assignments={model.meineEinsaetze}
              accentColor={moduleAccent}
              onNavigate={(route) => navigate(route)}
            />
          </HealthOSCard>
        ) : (
          <HealthOSEmptyState
            title="Keine Einsätze"
            message="Für heute und die nächsten Tage sind keine Einsätze eingetragen."
          />
        )}
      </HealthOSSection>

      {/* C: Meine Zeiten — read-only link */}
      <HealthOSSection
        title="Meine Zeiten"
        subtitle="Arbeitszeit, Fahrten und Abwesenheiten"
        accentColor={moduleAccent}
      >
        <HealthOSAlert
          variant="info"
          title="Zeiterfassung"
          message="Prüfen Sie Einsatzzeiten und Fahrten oder öffnen Sie Ihre Abwesenheitsanträge."
        />
        <Pressable
          onPress={() => navigate('/portal/employee/times')}
          accessibilityRole="button"
          accessibilityLabel="Zur Zeiterfassung"
          testID="healthos-employee-times-link"
        >
          <HealthOSCard variant="elevated">
            <PremiumListRow
              title="Zur Zeiterfassung"
              leading={<Text style={styles.leadingIcon}>⏱️</Text>}
              showChevron
            />
          </HealthOSCard>
        </Pressable>
      </HealthOSSection>

      {/* D: Offene Aufgaben */}
      <HealthOSSection
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
          <HealthOSEmptyState
            title="Alles erledigt"
            message="Keine offenen Dokumentationen oder Unterschriften."
          />
        )}
      </HealthOSSection>

      {/* E: Schnellzugriffe */}
      <HealthOSSection
        title="Schnellzugriffe"
        subtitle="Portalnavigation"
        accentColor={moduleAccent}
      >
        <LinkList
          links={model.schnellzugriffe}
          accentColor={moduleAccent}
          onNavigate={(route) => navigate(route)}
        />
      </HealthOSSection>
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
  leadingIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
});
