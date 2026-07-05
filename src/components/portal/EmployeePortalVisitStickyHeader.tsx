import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumBadge } from '@/components/ui';
import {
  employeePortalExecutionShadow,
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import type { EmployeePortalLiveTimers } from '@/types/modules/employeePortalTracking';
import { spacing, typography } from '@/theme';
import { EmployeePortalVisitProgressSteps } from './EmployeePortalVisitProgressSteps';

type EmployeePortalVisitStickyHeaderProps = {
  clientName: string;
  plannedStartAt: string;
  plannedEndAt: string;
  effectiveStatus: AssignmentStatus;
  timers: EmployeePortalLiveTimers | null;
  requiresSignature?: boolean;
  signatureCaptured?: boolean;
  showProgress?: boolean;
};

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(startIso)}–${fmt(endIso)}`;
}

function formatLiveTimer(seconds: number | null): string | null {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} Std.`;
  }
  return `${m}:${String(s).padStart(2, '0')} Std.`;
}

function liveStatusLabel(status: AssignmentStatus, timers: EmployeePortalLiveTimers | null): string {
  if (status === 'unterwegs') return 'UNTERWEGS';
  if (status === 'gestartet') return 'LIVE';
  if (status === 'pausiert') return 'PAUSE';
  if (status === 'angekommen') return 'ANGEKOMMEN';
  if (timers?.activeTimer === 'drive') return 'UNTERWEGS';
  if (timers?.activeTimer === 'service') return 'LIVE';
  if (timers?.activeTimer === 'pause') return 'PAUSE';
  return ASSIGNMENT_STATUS_LABELS[status]?.toUpperCase() ?? status.toUpperCase();
}

export function EmployeePortalVisitStickyHeader({
  clientName,
  plannedStartAt,
  plannedEndAt,
  effectiveStatus,
  timers,
  requiresSignature = true,
  signatureCaptured = false,
  showProgress = true,
}: EmployeePortalVisitStickyHeaderProps) {
  const text = employeePortalExecutionText;
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: employeePortalExecutionSurface.background,
          borderBottomWidth: 1,
          borderBottomColor: employeePortalExecutionSurface.border,
          paddingHorizontal: spacing.md,
          paddingTop: Platform.OS === 'web' ? spacing.sm : Math.max(insets.top, spacing.sm),
          paddingBottom: spacing.sm,
          gap: spacing.xs,
          ...employeePortalExecutionShadow,
          ...(Platform.OS === 'web'
            ? ({ position: 'sticky', top: 0, zIndex: 20 } as ViewStyle)
            : null),
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        clientName: { ...typography.bodyStrong, color: text.primary, flex: 1 },
        timeRange: { ...typography.caption, color: text.secondary },
        statusRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          flexWrap: 'wrap',
        },
        liveTimer: { ...typography.caption, color: text.secondary },
      }),
    [insets.top, text],
  );

  const activeSeconds =
    timers?.activeTimer === 'drive'
      ? timers.driveSeconds
      : timers?.activeTimer === 'service'
        ? timers.serviceSeconds
        : timers?.activeTimer === 'pause'
          ? timers.pauseSeconds
          : null;
  const liveTimer = formatLiveTimer(activeSeconds);
  const isLive =
    effectiveStatus === 'unterwegs' ||
    effectiveStatus === 'gestartet' ||
    effectiveStatus === 'pausiert' ||
    Boolean(timers?.activeTimer);

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Text style={styles.clientName} numberOfLines={1}>
          {clientName}
        </Text>
        <Text style={styles.timeRange}>{formatTimeRange(plannedStartAt, plannedEndAt)}</Text>
      </View>
      <View style={styles.statusRow}>
        <PremiumBadge
          label={liveStatusLabel(effectiveStatus, timers)}
          variant={isLive ? 'orange' : 'muted'}
          dot
        />
        {liveTimer ? <Text style={styles.liveTimer}>· {liveTimer}</Text> : null}
      </View>
      {showProgress ? (
        <EmployeePortalVisitProgressSteps
          status={effectiveStatus}
          requiresSignature={requiresSignature}
          signatureCaptured={signatureCaptured}
        />
      ) : null}
    </View>
  );
}
