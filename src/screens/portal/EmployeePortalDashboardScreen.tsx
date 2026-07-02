import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText, useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useEmployeePortalDashboard } from '@/hooks/useEmployeePortalDashboard';
import { usePortalProfileAvatar } from '@/hooks/usePortalProfileAvatar';
import {
  isActiveEmployeeAssignment,
  isDocumentationPendingEmployeeAssignment,
  resolveDashboardCurrentAssignment,
} from '@/lib/portal/employeePortalLiveOverviewService';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { usePermissions } from '@/hooks/usePermissions';
import { resolveTimeBasedGermanGreeting } from '@/lib/portal/engine/portalHeroCopy';
import type { EmployeePortalAssignmentListItem } from '@/types/modules/employeePortalExecution';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';

type EmployeePortalDashboardScreenProps = {
  showSuccess?: boolean;
  onRefresh?: () => void;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveWorkStatus(assignments: EmployeePortalAssignmentListItem[]): string {
  const active = assignments.find((item) => isActiveEmployeeAssignment(item.status));
  if (active) return 'Im Einsatz';
  const docPending = assignments.find(
    (item) => item.documentationPending || isDocumentationPendingEmployeeAssignment(item.status),
  );
  if (docPending) return 'Dokumentation offen';
  if (assignments.length > 0) return 'Einsätze heute';
  return 'Keine Einsätze heute';
}

function resolvePrimaryAction(item: EmployeePortalAssignmentListItem): {
  label: string;
  route: string;
} | null {
  const executeRoute = `/portal/employee/assignments/${item.assignmentId}/execute`;
  if (isActiveEmployeeAssignment(item.status)) {
    return { label: 'Fortsetzen', route: executeRoute };
  }
  if (item.documentationPending || isDocumentationPendingEmployeeAssignment(item.status)) {
    return { label: 'Dokumentation fortsetzen', route: executeRoute };
  }
  if (item.status === 'bestaetigt' || item.status === 'geplant') {
    return { label: 'Einsatz starten', route: executeRoute };
  }
  return null;
}

function AssignmentCard({
  item,
  accentColor,
  onOpen,
  onNavigate,
  onStart,
  primaryActionLabel,
}: {
  item: EmployeePortalAssignmentListItem;
  accentColor: string;
  onOpen: () => void;
  onNavigate?: () => void;
  onStart?: () => void;
  primaryActionLabel?: string;
}) {
  const text = useAuroraAdaptiveText();
  const cardStyle = useAuroraGlassCardStyle();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <GlassCard glow accentColor={accentColor} style={cardStyle} onPress={onOpen}>
      <View style={styles.assignmentHeader}>
        <Text style={[type.cardTitle, { color: text.primary }]} {...noBreakTextProps}>
          {item.title}
        </Text>
        <PremiumBadge
          label={ASSIGNMENT_STATUS_LABELS[item.status] ?? item.status}
          variant={isActiveEmployeeAssignment(item.status) ? 'green' : 'orange'}
        />
      </View>
      <Text style={[type.body, { color: text.secondary }]}>{item.clientName}</Text>
      <Text style={[type.caption, { color: text.muted }]}>{item.locationAddress}</Text>
      <Text style={[type.caption, { color: text.primary, fontWeight: '700', marginTop: careSpacing.xs }]}>
        {formatDateTime(item.plannedStartAt)}
        {' – '}
        {new Date(item.plannedEndAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <View style={styles.assignmentActions}>
        {onNavigate ? (
          <PremiumButton title="Navigation" variant="secondary" onPress={onNavigate} />
        ) : null}
        {onStart ? (
          <PremiumButton title={primaryActionLabel ?? 'Starten'} variant="primary" onPress={onStart} />
        ) : null}
        <PremiumButton title="Öffnen" variant="secondary" onPress={onOpen} />
      </View>
    </GlassCard>
  );
}

export function EmployeePortalDashboardScreen({
  showSuccess,
  onRefresh,
}: EmployeePortalDashboardScreenProps) {
  const router = useRouter();
  const { displayName, isReady } = usePortalActor();
  const { avatarUrl, avatarVersion } = usePortalProfileAvatar();
  const { roleLabel } = usePermissions();
  const tenantName = useTenantDisplayName();
  const { dashboard, loading, error, refresh } = useEmployeePortalDashboard();
  const text = useAuroraAdaptiveText();
  const heroStyle = useAuroraGlassCardStyle();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const accent = moduleColor('assist');
  const greeting = resolveTimeBasedGermanGreeting();

  const handleRefresh = async () => {
    await refresh();
    onRefresh?.();
  };

  const currentAssignment = useMemo(() => {
    if (!dashboard) return null;
    return resolveDashboardCurrentAssignment(dashboard.todayAssignments);
  }, [dashboard]);

  const primaryAction = useMemo(
    () => (currentAssignment ? resolvePrimaryAction(currentAssignment) : null),
    [currentAssignment],
  );

  const workStatus = useMemo(
    () => resolveWorkStatus(dashboard?.todayAssignments ?? []),
    [dashboard?.todayAssignments],
  );

  const dayStats = useMemo(() => {
    if (!dashboard) {
      return {
        assignments: 0,
        hoursLabel: '0 Std.',
        openDocs: 0,
        messages: 0,
        trips: 0,
      };
    }
    const minutes = dashboard.todayAssignments.reduce((sum, item) => {
      const start = new Date(item.plannedStartAt).getTime();
      const end = new Date(item.plannedEndAt).getTime();
      return sum + Math.max(0, Math.round((end - start) / 60000));
    }, 0);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return {
      assignments: dashboard.todayAssignments.length,
      hoursLabel: mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`,
      openDocs: dashboard.openDocumentationCount,
      messages: dashboard.messageCount,
      trips: 0,
    };
  }, [dashboard]);

  if (!isReady || (loading && !dashboard)) {
    return <LoadingState message="Übersicht wird geladen…" />;
  }

  if (!dashboard) {
    return (
      <ErrorState
        title="Übersicht nicht geladen"
        message={error ?? 'Mitarbeiterprofil konnte nicht geladen werden.'}
        onRetry={() => void handleRefresh()}
      />
    );
  }

  const data = dashboard;

  const quickActions = [
    { key: 'assignments', label: 'Einsätze', icon: '📅', href: '/portal/employee/assignments' },
    { key: 'schedule', label: 'Dienstplan', icon: '🗓️', href: '/portal/employee/schedule' },
    { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/employee/messages' },
    { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/employee/profile' },
  ] as const;

  return (
    <View style={styles.container}>
      {showSuccess ? <SuccessState message="Daten erfolgreich aktualisiert." /> : null}

      <GlassCard style={heroStyle} glow accentColor={accent}>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={[type.caption, { color: text.muted }]}>MITARBEITERPORTAL</Text>
            <Text style={[type.cardTitle, { color: text.primary }]}>
              {greeting}, {displayName}
            </Text>
            <Text style={[type.body, { color: text.secondary, fontWeight: '700' }]}>{tenantName}</Text>
            <Text style={[type.caption, { color: text.muted }]}>
              {roleLabel ?? 'Mitarbeiter:in'} · {workStatus}
            </Text>
          </View>
          <TopbarProfileAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            avatarVersion={avatarVersion}
            accentColor={accent}
            size="md"
          />
        </View>
      </GlassCard>

      <Text style={[type.label, { color: text.primary, marginTop: careSpacing.xs }]}>Aktueller Einsatz</Text>
      {currentAssignment ? (
        <AssignmentCard
          item={currentAssignment}
          accentColor={accent}
          primaryActionLabel={primaryAction?.label}
          onOpen={() =>
            router.push(`/portal/employee/assignments/${currentAssignment.assignmentId}` as never)
          }
          onNavigate={
            isActiveEmployeeAssignment(currentAssignment.status) && currentAssignment.locationAddress
              ? () =>
                  router.push(
                    `/portal/employee/assignments/${currentAssignment.assignmentId}/execute` as never,
                  )
              : undefined
          }
          onStart={
            primaryAction
              ? () => router.push(primaryAction.route as never)
              : undefined
          }
        />
      ) : (
        <EmptyState
          title={
            data.todayAssignments.length > 0 ? 'Kein laufender Einsatz' : 'Keine Einsätze geplant'
          }
          message={
            data.todayAssignments.length > 0
              ? 'Alle heutigen Einsätze sind abgeschlossen. Offene Dokumentation findest du unter Einsätze.'
              : 'Für heute sind keine Einsätze eingetragen.'
          }
          actionLabel={data.todayAssignments.length > 0 ? 'Einsätze ansehen' : 'Dienstplan ansehen'}
          onAction={() =>
            router.push(
              (data.todayAssignments.length > 0
                ? '/portal/employee/assignments'
                : '/portal/employee/schedule') as never,
            )
          }
        />
      )}

      <Text style={[type.label, { color: text.primary, marginTop: careSpacing.sm }]}>Tagesübersicht</Text>
      <View style={styles.statsGrid}>
        <GlassCard style={[heroStyle, styles.statTile, isPhone && styles.statTilePhone]}>
          <Text style={[type.caption, { color: text.muted }]} {...noBreakTextProps}>
            Einsätze heute
          </Text>
          <Text style={[type.h2, { color: text.primary }]}>{dayStats.assignments}</Text>
        </GlassCard>
        <GlassCard style={[heroStyle, styles.statTile, isPhone && styles.statTilePhone]}>
          <Text style={[type.caption, { color: text.muted }]} {...noBreakTextProps}>
            Geplante Stunden
          </Text>
          <Text style={[type.h2, { color: text.primary }]} {...noBreakTextProps}>
            {dayStats.hoursLabel}
          </Text>
        </GlassCard>
        <GlassCard style={[heroStyle, styles.statTile, isPhone && styles.statTilePhone]}>
          <Text style={[type.caption, { color: text.muted }]} {...noBreakTextProps}>
            Offene Dokumentation
          </Text>
          <Text style={[type.h2, { color: text.primary }]}>{dayStats.openDocs}</Text>
        </GlassCard>
        <GlassCard style={[heroStyle, styles.statTile, isPhone && styles.statTilePhone]}>
          <Text style={[type.caption, { color: text.muted }]} {...noBreakTextProps}>
            Nachrichten
          </Text>
          <Text style={[type.h2, { color: text.primary }]}>{dayStats.messages}</Text>
        </GlassCard>
      </View>

      <Text style={[type.label, { color: text.primary }]}>Schnellzugriff</Text>
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => router.push(action.href as never)}
            style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <GlassCard glow accentColor={accent} style={styles.quickCard}>
              <Text style={styles.quickIcon}>{action.icon}</Text>
              <Text style={[type.caption, { color: text.primary, fontWeight: '700' }]}>
                {action.label}
              </Text>
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <Text style={[type.label, { color: text.primary }]}>Benachrichtigungen</Text>
      <GlassCard style={heroStyle}>
        {data.openDocumentationCount + data.missingSignatureCount + data.messageCount === 0 ? (
          <View style={styles.notificationEmpty}>
            <Feather name="bell" size={20} color={text.muted} />
            <Text style={[type.body, { color: text.secondary }]}>Keine neuen Hinweise.</Text>
          </View>
        ) : (
          <View style={styles.notificationList}>
            {data.openDocumentationCount > 0 ? (
              <Text style={[type.body, { color: text.primary }]}>
                {data.openDocumentationCount} offene Dokumentation
                {data.openDocumentationCount === 1 ? '' : 'en'}
              </Text>
            ) : null}
            {data.missingSignatureCount > 0 ? (
              <Text style={[type.body, { color: text.primary }]}>
                {data.missingSignatureCount} fehlende Unterschrift
                {data.missingSignatureCount === 1 ? '' : 'en'}
              </Text>
            ) : null}
            {data.messageCount > 0 ? (
              <Pressable onPress={() => router.push('/portal/employee/messages' as never)}>
                <Text style={[type.body, { color: accent, fontWeight: '700' }]}>
                  {data.messageCount} neue Nachricht{data.messageCount === 1 ? '' : 'en'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    width: '100%',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.md,
  },
  heroText: {
    flex: 1,
    gap: careSpacing.xs,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
    marginBottom: careSpacing.xs,
  },
  assignmentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    marginTop: careSpacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    width: '100%',
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 152,
    maxWidth: '100%',
    minHeight: 96,
    paddingVertical: careSpacing.sm,
  },
  statTilePhone: {
    minHeight: 104,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    width: '100%',
  },
  quickTile: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 152,
    maxWidth: '100%',
    minHeight: 88,
  },
  quickCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: careSpacing.xs,
    minHeight: 88,
    paddingVertical: careSpacing.md,
  },
  quickIcon: {
    fontSize: 24,
  },
  pressed: {
    opacity: 0.9,
  },
  notificationEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  notificationList: {
    gap: careSpacing.xs,
  },
});
