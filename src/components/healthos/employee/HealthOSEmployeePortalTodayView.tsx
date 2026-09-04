import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useClientGreeting } from '@/hooks/useClientGreeting';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { portalPremium } from '@/design/tokens/portalPremium';
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const employeeQuickActions: { label: string; icon: IoniconName; route: string }[] = [
  { label: 'Meine Einsätze', icon: 'calendar-outline', route: '/portal/employee/assignments' },
  { label: 'Nachrichten', icon: 'chatbubbles-outline', route: '/portal/employee/messages' },
  { label: 'Arbeitszeit', icon: 'time-outline', route: '/portal/employee/times' },
  { label: 'Dokumente', icon: 'folder-open-outline', route: '/portal/employee/documents' },
];

const breakLongWords = Platform.OS === 'web'
  ? ({ overflowWrap: 'anywhere', wordBreak: 'break-word' } as unknown as TextStyle)
  : null;

const premiumShadow = Platform.OS === 'web'
  ? ({ boxShadow: portalPremium.shadow.panel } as unknown as ViewStyle)
  : ({ shadowColor: '#001B42', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 13 }, elevation: 8 } as ViewStyle);

function EmployeePremiumWelcome({
  displayName,
  model,
  onNavigate,
}: {
  displayName: string;
  model: ReturnType<typeof buildEmployeePortalTodayModel>;
  onNavigate: (route?: string) => void;
}) {
  const { width } = useHydrationSafeWindowDimensions();
  const compact = width < 760;
  const type = resolveGalaxyTypography(width);
  const greeting = useClientGreeting();
  const guide = model.currentAssignment
    ? {
        title: 'Ihr aktueller Einsatz ist bereit',
        message: `${model.currentAssignment.title} · ${model.currentAssignment.timeRange}`,
        action: 'Einsatz öffnen',
        route: model.currentAssignment.navigationRoute,
      }
    : model.offeneAufgaben.length > 0
      ? {
          title: 'Es gibt noch etwas zu erledigen',
          message: 'Offene Dokumentationen und Unterschriften finden Sie direkt in Ihrer Tagesübersicht.',
          action: 'Aufgaben ansehen',
          route: model.offeneAufgaben[0]?.route,
        }
      : model.meineEinsaetze[0]
        ? {
            title: 'Ihr nächster Einsatz ist vorbereitet',
            message: `${model.meineEinsaetze[0].title} · ${model.meineEinsaetze[0].timeRange}`,
            action: 'Einsatz ansehen',
            route: model.meineEinsaetze[0].navigationRoute,
          }
        : {
            title: 'Alles ist im grünen Bereich',
            message: 'Heute gibt es keine dringenden Aufgaben. Neue Informationen erscheinen automatisch hier.',
            action: undefined,
            route: undefined,
          };

  return (
    <>
      <View style={[styles.welcomeHero, compact && styles.welcomeHeroCompact]} testID="employee-portal-premium-home-hero">
        <LinearGradient
          colors={['#FFFFFF', '#F1F7FF', '#DCEBFF']}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.welcomeGlow} pointerEvents="none" />
        <View style={[styles.welcomeCopy, compact && styles.welcomeCopyCompact]}>
          <View style={styles.portalPill}>
            <Ionicons name="briefcase" color={portalPremium.accent.blue} size={15} />
            <Text style={styles.portalPillText}>MEIN MITARBEITENDENPORTAL</Text>
          </View>
          <Text style={[type.h1, styles.welcomeTitle, breakLongWords]}>
            {greeting}, {displayName}
          </Text>
          <Text style={[type.body, styles.welcomeProvider]}>CareSuite – Ihr sicherer Arbeitsbereich</Text>
        </View>

        <View style={[styles.guideArea, compact && styles.guideAreaCompact]}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="CareSuite Portalbegleiter"
            resizeMode="contain"
            source={require('../../../../assets/auth/access-employee.png')}
            style={[styles.guideMascot, compact && styles.guideMascotCompact]}
          />
          <View style={[styles.guideBubble, compact && styles.guideBubbleCompact]}>
            {!compact ? <View style={styles.guideBubbleTail} /> : null}
            <Text style={[type.bodyStrong, styles.guideTitle, breakLongWords]}>{guide.title}</Text>
            <Text style={[type.caption, styles.guideMessage]}>{guide.message}</Text>
            {guide.action && guide.route ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onNavigate(guide.route)}
                style={({ pressed }) => [
                  styles.guideAction,
                  compact && styles.guideActionCompact,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.guideActionText}>{guide.action}</Text>
                <Ionicons name="arrow-forward" color="#FFFFFF" size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.quickPanel} testID="employee-portal-premium-quick-actions">
        <LinearGradient
          colors={['#FFFFFF', '#F1F7FF', '#E2EFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.quickPanelGlow} pointerEvents="none" />
        <View style={styles.quickHeading}>
          <Text style={[type.caption, styles.quickEyebrow]}>SCHNELL ERLEDIGT</Text>
          <Text style={[type.cardTitle, styles.quickTitle]}>Was möchten Sie tun?</Text>
        </View>
        <View style={[styles.quickTasks, compact && styles.quickTasksCompact]}>
          {employeeQuickActions.map((item) => (
            <Pressable
              key={item.route}
              accessibilityRole="button"
              onPress={() => onNavigate(item.route)}
              style={({ pressed }) => [styles.quickTask, compact && styles.quickTaskCompact, pressed && styles.quickTaskPressed]}
            >
              <View style={styles.quickTaskIcon}>
                <Ionicons name={item.icon} color={portalPremium.accent.blue} size={19} />
              </View>
              <Text style={[type.bodyStrong, styles.quickTaskLabel]}>{item.label}</Text>
              <Ionicons name="chevron-forward" color={portalPremium.accent.blueDark} size={18} />
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

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
      <EmployeePremiumWelcome displayName={displayName} model={model} onNavigate={navigate} />
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
  welcomeHero: {
    minHeight: 220,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: portalPremium.border,
    borderRadius: 26,
    padding: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    ...premiumShadow,
  },
  welcomeHeroCompact: {
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 14,
  },
  welcomeGlow: {
    position: 'absolute',
    right: -90,
    top: -130,
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: 'rgba(53,151,255,0.20)',
  },
  welcomeCopy: { flex: 1.25, minWidth: 0, gap: 8 },
  welcomeCopyCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
  },
  portalPill: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  portalPillText: { color: portalPremium.accent.blueDark, fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.75 },
  welcomeTitle: { color: portalPremium.text.primary, fontWeight: '900', letterSpacing: -0.6 },
  welcomeProvider: { color: portalPremium.text.secondary, fontWeight: '700' },
  guideArea: { flex: 1, minWidth: 330, maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: 9 },
  guideAreaCompact: {
    flexGrow: 0, flexShrink: 0, flexBasis: 'auto',
    minWidth: 0, maxWidth: '100%', width: '100%',
    flexDirection: 'row', alignItems: 'flex-start',
  },
  guideMascot: { width: 102, height: 118, flexShrink: 0 },
  guideMascotCompact: { width: 52, height: 61, alignSelf: 'flex-start' },
  guideBubble: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    padding: 15,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.84)',
    gap: 5,
  },
  guideBubbleCompact: { flex: 1, minWidth: 0, width: 'auto', alignSelf: 'stretch', padding: 14 },
  guideBubbleTail: {
    position: 'absolute', left: -7, bottom: 22, width: 14, height: 14,
    borderLeftWidth: 1, borderBottomWidth: 1, borderColor: portalPremium.borderSoft,
    backgroundColor: '#F5FAFF', transform: [{ rotate: '45deg' }],
  },
  guideTitle: { color: portalPremium.text.primary, fontWeight: '800' },
  guideMessage: { color: portalPremium.text.secondary },
  guideAction: {
    alignSelf: 'flex-start', minHeight: 40, marginTop: 4, paddingHorizontal: 13,
    borderRadius: 11, backgroundColor: portalPremium.accent.blue,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  guideActionCompact: { width: '100%', alignSelf: 'stretch' },
  guideActionText: { color: '#FFFFFF', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  quickPanel: {
    position: 'relative', overflow: 'hidden', padding: 18, borderWidth: 1,
    borderColor: portalPremium.border, borderRadius: 21, gap: 12, ...premiumShadow,
  },
  quickPanelGlow: {
    position: 'absolute', right: -70, top: -90, width: 230, height: 230,
    borderRadius: 999, backgroundColor: 'rgba(53,151,255,0.16)',
  },
  quickHeading: { gap: 2 },
  quickEyebrow: { color: portalPremium.accent.blueDark, fontWeight: '900', letterSpacing: 0.9 },
  quickTitle: { color: portalPremium.text.primary, fontWeight: '900' },
  quickTasks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTasksCompact: { flexDirection: 'column' },
  quickTask: {
    flex: 1, minWidth: 210, minHeight: 48, paddingHorizontal: 10, borderWidth: 1,
    borderColor: portalPremium.borderSoft, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.82)', flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  quickTaskCompact: { width: '100%', minWidth: 0 },
  quickTaskPressed: { backgroundColor: '#DDEBFC' },
  quickTaskIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#E7F1FE',
    alignItems: 'center', justifyContent: 'center',
  },
  quickTaskLabel: { flex: 1, color: portalPremium.text.primary, fontWeight: '700' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.988 }] },
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
