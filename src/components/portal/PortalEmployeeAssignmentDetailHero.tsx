import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';

import type { PortalAppointmentDetail } from '@/types/portal/employee';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type PortalEmployeeAssignmentDetailHeroProps = {
  assignment: PortalAppointmentDetail;
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function durationMinutes(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function PortalEmployeeAssignmentDetailHero({
  assignment,
}: PortalEmployeeAssignmentDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.amber,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  const duration = durationMinutes(assignment.startsAt, assignment.endsAt);
  const taskCount = assignment.tasks.length;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>MITARBEITERPORTAL · EINSATZ</Text>
          <Text style={styles.title}>{assignment.title}</Text>
          <Text style={styles.meta}>{assignment.clientName}</Text>
          {assignment.location ? <Text style={styles.subtitle}>{assignment.location}</Text> : null}
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📋</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[assignment.status]}
          variant={statusVariant(assignment.status)}
          dot
        />
        <PremiumBadge label="Portal-Sicht" variant="cyan" />
        {assignment.canStartExecution ? (
          <PremiumBadge label="Durchführung möglich" variant="green" />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Beginn"
          value={formatShortDate(assignment.startsAt)}
          subValue={`${formatTime(assignment.startsAt)} – ${formatTime(assignment.endsAt)}`}
          icon="🗓️"
          accentColor={colors.amber}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Dauer"
          value={String(duration)}
          subValue={duration === 1 ? 'Minute' : 'Minuten'}
          icon="⏱️"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Klient:in"
          value={assignment.clientName}
          subValue={assignment.clientPhone ?? undefined}
          icon="👤"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Aufgaben"
          value={String(taskCount)}
          subValue={taskCount === 1 ? 'Aufgabe' : 'Aufgaben'}
          icon="✅"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

