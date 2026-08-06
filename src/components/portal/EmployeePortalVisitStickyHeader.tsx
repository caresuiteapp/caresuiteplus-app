import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARESUITE_VISIT_GUIDE_MASCOT } from '@/components/brand/brandassets';
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
  tasksComplete?: boolean;
  documentationComplete?: boolean;
  serviceEnded?: boolean;
  showProgress?: boolean;
  onExit?: () => void;
  guideMessage?: string;
  guideTone?: 'info' | 'warning' | 'error' | 'success';
  guideActionLabel?: string;
  onGuideAction?: () => void;
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
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} (Std:Min:Sek)`;
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
  tasksComplete = false,
  documentationComplete = false,
  serviceEnded = false,
  showProgress = true,
  onExit,
  guideMessage,
  guideTone = 'info',
  guideActionLabel,
  onGuideAction,
}: EmployeePortalVisitStickyHeaderProps) {
  const text = employeePortalExecutionText;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const guidePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(guidePulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(guidePulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [guidePulse]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: employeePortalExecutionSurface.background,
          borderBottomWidth: 1,
          borderBottomColor: employeePortalExecutionSurface.border,
          paddingHorizontal: spacing.lg,
          paddingTop: Platform.OS === 'web' ? spacing.sm : Math.max(insets.top, spacing.sm),
          paddingBottom: spacing.sm,
          gap: spacing.xs,
          ...employeePortalExecutionShadow,
          ...(Platform.OS === 'web'
            ? compact
              ? ({ position: 'relative', zIndex: 1 } as unknown as ViewStyle)
              : ({ position: 'sticky', top: 0, zIndex: 20 } as unknown as ViewStyle)
            : null),
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        topRowCompact: { alignItems: 'center' },
        clientName: { ...typography.h3, color: text.primary, flex: 1 },
        exitButton: {
          minHeight: 42,
          paddingHorizontal: compact ? spacing.sm : spacing.md,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.border,
          backgroundColor: employeePortalExecutionSurface.background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        exitLabel: { ...typography.bodyStrong, color: text.primary },
        timeRange: { ...typography.caption, color: text.secondary },
        statusRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          flexWrap: 'wrap',
        },
        liveTimer: { ...typography.bodyStrong, color: text.secondary, fontVariant: ['tabular-nums'] },
        guideRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.xs,
        },
        guideAvatar: {
          width: compact ? 66 : 76,
          height: compact ? 66 : 76,
          alignItems: 'center',
          justifyContent: 'center',
        },
        guideAvatarImage: { width: '100%', height: '100%' },
        guideBubble: {
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: 1,
          borderRadius: 14,
          justifyContent: 'center',
          backgroundColor: '#EFF7FF',
          borderColor: '#8BC2FF',
        },
        guideBubbleWarning: { backgroundColor: '#FFF8E8', borderColor: '#E4AD42' },
        guideBubbleError: { backgroundColor: '#FFF0F1', borderColor: '#E15B64' },
        guideBubbleSuccess: { backgroundColor: '#EDFFF5', borderColor: '#42AF78' },
        guideText: { ...typography.bodyStrong, color: '#10233E' },
        guideAction: {
          alignSelf: 'flex-start',
          marginTop: spacing.xs,
          minHeight: 38,
          paddingHorizontal: spacing.md,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#056CE8',
        },
        guideActionText: { ...typography.caption, color: '#FFFFFF', fontWeight: '800' },
      }),
    [compact, insets.top, text],
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
  const badgeVariant =
    effectiveStatus === 'nicht_erschienen' || effectiveStatus === 'storniert'
      ? 'red'
      : effectiveStatus === 'abgeschlossen'
        ? 'green'
        : isLive
          ? 'orange'
          : 'muted';

  return (
    <View style={styles.root}>
      <View style={[styles.topRow, compact ? styles.topRowCompact : null]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.clientName} numberOfLines={compact ? 2 : 1}>
            {clientName}
          </Text>
          <Text style={styles.timeRange}>{formatTimeRange(plannedStartAt, plannedEndAt)}</Text>
        </View>
        {onExit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Einsatz-Arbeitsfläche verlassen"
            onPress={onExit}
            style={styles.exitButton}
          >
            <Text style={styles.exitLabel}>{compact ? '← Zurück' : '← Übersicht'}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.statusRow}>
        <PremiumBadge
          label={liveStatusLabel(effectiveStatus, timers)}
          variant={badgeVariant}
          dot
        />
        {liveTimer ? <Text style={styles.liveTimer}>· {liveTimer}</Text> : null}
      </View>
      {showProgress ? (
        <EmployeePortalVisitProgressSteps
          status={effectiveStatus}
          requiresSignature={requiresSignature}
          signatureCaptured={signatureCaptured}
          tasksComplete={tasksComplete}
          documentationComplete={documentationComplete}
          serviceEnded={serviceEnded}
        />
      ) : null}
      {guideMessage ? (
        <View style={styles.guideRow} accessibilityLiveRegion={guideTone === 'error' ? 'assertive' : 'polite'}>
          <Animated.View
            accessibilityLabel="Animierter Einsatzbegleiter"
            style={[
              styles.guideAvatar,
              {
                transform: [
                  { translateY: guidePulse.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
                  { scale: guidePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
                ],
              },
            ]}
          >
            <Image
              source={CARESUITE_VISIT_GUIDE_MASCOT}
              resizeMode="contain"
              style={styles.guideAvatarImage}
            />
          </Animated.View>
          <View
            style={[
              styles.guideBubble,
              guideTone === 'warning' ? styles.guideBubbleWarning : null,
              guideTone === 'error' ? styles.guideBubbleError : null,
              guideTone === 'success' ? styles.guideBubbleSuccess : null,
            ]}
          >
            <Text style={styles.guideText}>{guideMessage}</Text>
            {guideActionLabel && onGuideAction ? (
              <Pressable
                accessibilityRole="button"
                onPress={onGuideAction}
                style={styles.guideAction}
              >
                <Text style={styles.guideActionText}>{guideActionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
