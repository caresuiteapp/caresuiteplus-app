import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid, type KpiGridItem } from '@/components/adaptive';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { PORTAL_EMPLOYEE_LABEL } from '@/lib/portal/portalDisplayLabels';

import type { PortalAppointmentDetail } from '@/types/portal/employee';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type PortalEmployeeAssignmentDetailHeroProps = {
  assignment: PortalAppointmentDetail;
};

function formatShortDate(iso: string, compact = false): string {
  if (compact) {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
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
  const { colors } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
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
          minWidth: 0,
        },
        title: heroText.title,
        meta: heroText.subtitle,
        subtitle: heroText.subtitle,
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
      }),
    [colors, heroText],
  );

  const duration = durationMinutes(assignment.startsAt, assignment.endsAt);
  const taskCount = assignment.tasks.length;

  const kpiItems: KpiGridItem[] = [
    {
      id: 'beginn',
      node: (
        <PremiumKpiCard
          label="Beginn"
          value={formatShortDate(assignment.startsAt, true)}
          subValue={`${formatTime(assignment.startsAt)} – ${formatTime(assignment.endsAt)}`}
          icon="🗓️"
          accentColor={colors.amber}
        />
      ),
    },
    {
      id: 'dauer',
      node: (
        <PremiumKpiCard
          label="Dauer"
          value={String(duration)}
          subValue={duration === 1 ? 'Minute' : 'Minuten'}
          icon="⏱️"
          accentColor={colors.violet}
        />
      ),
    },
    {
      id: 'klient',
      node: (
        <PremiumKpiCard
          label="Klient:in"
          value={assignment.clientName}
          subValue={assignment.clientPhone ?? undefined}
          icon="👤"
          accentColor={colors.orange}
        />
      ),
    },
    {
      id: 'aufgaben',
      node: (
        <PremiumKpiCard
          label="Aufgaben"
          value={String(taskCount)}
          subValue={taskCount === 1 ? 'Aufgabe' : 'Aufgaben'}
          icon="✅"
          accentColor={colors.cyan}
        />
      ),
    },
  ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
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
        <PremiumBadge label={PORTAL_EMPLOYEE_LABEL} variant="cyan" />
        {assignment.canStartExecution ? (
          <PremiumBadge label="Durchführung möglich" variant="green" />
        ) : null}
      </View>
      <AdaptiveKpiGrid columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }} items={kpiItems} />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
