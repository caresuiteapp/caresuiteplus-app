import { useMemo } from 'react';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { PORTAL_EMPLOYEE_LABEL } from '@/lib/portal/portalDisplayLabels';

import type { PortalAppointmentDetail } from '@/types/portal/employee';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing } from '@/theme';

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

function resolveStatusLabel(assignment: PortalAppointmentDetail): string {
  if (assignment.assignmentStatus) {
    return ASSIGNMENT_STATUS_LABELS[assignment.assignmentStatus] ?? assignment.assignmentStatus;
  }
  return WORKFLOW_STATUS_LABELS[assignment.status] ?? assignment.status;
}

function statusVariant(assignment: PortalAppointmentDetail) {
  if (assignment.assignmentStatus) {
    switch (assignment.assignmentStatus) {
      case 'gestartet':
      case 'abgeschlossen':
        return 'green' as const;
      case 'storniert':
      case 'nicht_erschienen':
        return 'red' as const;
      case 'dokumentation_offen':
      case 'unterschrift_offen':
      case 'beendet':
      case 'pausiert':
      case 'unterwegs':
      case 'angekommen':
        return 'orange' as const;
      default:
        return 'muted' as const;
    }
  }
  switch (assignment.status) {
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
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        healthCard: {
          padding: spacing.lg, gap: spacing.md, borderRadius: 22, borderWidth: 1,
          borderColor: 'rgba(15, 143, 138, 0.20)', backgroundColor: 'rgba(255,255,255,0.94)',
          shadowColor: '#0F766E', shadowOpacity: 0.08, shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
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
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: 'rgba(13, 148, 136, 0.09)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(13, 148, 136, 0.20)',
        },
        iconText: {
          fontSize: 22,
        },
        badges: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        fact: {
          flexGrow: 1, flexBasis: 150, padding: spacing.md, borderRadius: 16,
          backgroundColor: 'rgba(241, 245, 249, 0.75)', borderWidth: 1,
          borderColor: 'rgba(148, 163, 184, 0.20)', gap: 3,
        },
        factLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
        factValue: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
        factMeta: { fontSize: 12, color: '#475569' },
      }),
    [heroText],
  );

  const duration = durationMinutes(assignment.startsAt, assignment.endsAt);
  const taskCount = assignment.tasks.length;

  return (
    <View style={styles.healthCard}>
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
          label={resolveStatusLabel(assignment)}
          variant={statusVariant(assignment)}
          dot
        />
        <PremiumBadge label={PORTAL_EMPLOYEE_LABEL} variant="cyan" />
        {assignment.canOpenExecution ? (
          <PremiumBadge
            label={assignment.canStartExecution ? 'Durchführung möglich' : 'Dokumentation offen'}
            variant="green"
          />
        ) : null}
      </View>
      <View style={styles.facts}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Einsatzzeit</Text>
          <Text style={styles.factValue}>{formatShortDate(assignment.startsAt, true)}</Text>
          <Text style={styles.factMeta}>{formatTime(assignment.startsAt)} – {formatTime(assignment.endsAt)}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Geplante Dauer</Text>
          <Text style={styles.factValue}>{duration} Min.</Text>
          <Text style={styles.factMeta}>Arbeitszeit laut Planung</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Aufgaben</Text>
          <Text style={styles.factValue}>{taskCount}</Text>
          <Text style={styles.factMeta}>{taskCount === 1 ? 'Aufgabe' : 'Aufgaben'} vorgesehen</Text>
        </View>
      </View>
    </View>
  );
}
