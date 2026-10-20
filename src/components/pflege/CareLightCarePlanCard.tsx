import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CarePlanListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { careLightColors } from '@/design/tokens/lightTheme';
import {
  createCareLightContentStyles,
  useCareLightPalette,
  type CareLightResolved,
} from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { CareLightCard } from '@/components/ui/CareLightCard';

type CareLightCarePlanCardProps = {
  plan: CarePlanListItem;
  onOpen?: () => void;
  accentColor?: string;
};

function formatDateRange(from: string, until: string | null): string {
  const fromDate = new Date(from).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (!until) return `ab ${fromDate}`;
  const untilDate = new Date(until).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${fromDate} – ${untilDate}`;
}

function statusColor(status: CarePlanListItem['status'], c: CareLightResolved): string {
  switch (status) {
    case 'aktiv':
      return c.green;
    case 'fehlerhaft':
    case 'gesperrt':
      return c.danger;
    case 'in_bearbeitung':
    case 'entwurf':
      return c.orange;
    default:
      return c.muted;
  }
}

export function CareLightCarePlanCard({
  plan,
  onOpen,
  accentColor = careLightColors.green,
}: CareLightCarePlanCardProps) {
  const { c } = useCareLightPalette();
  const styles = useMemo(() => makeStyles(c), [c]);
  const statusTint = statusColor(plan.status, c);

  return (
    <CareLightCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{plan.title}</Text>
        <View style={[styles.statusPill, { backgroundColor: `${statusTint}18` }]}>
          <Text style={[styles.statusText, { color: statusTint }]}>
            {WORKFLOW_STATUS_LABELS[plan.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {plan.clientName}
        {plan.careLevel ? ` · Pflegegrad ${plan.careLevel}` : ''}
      </Text>
      <Text style={styles.period}>{formatDateRange(plan.validFrom, plan.validUntil)}</Text>
      {plan.alertCount > 0 ? (
        <Text style={styles.alert}>{plan.alertCount} Hinweis(e) / Risiko</Text>
      ) : null}
      {onOpen ? (
        <View style={styles.actions}>
          <PremiumButton title="Öffnen" onPress={onOpen} variant="secondary" />
        </View>
      ) : null}
    </CareLightCard>
  );
}

function makeStyles(c: CareLightResolved) {
  const text = createCareLightContentStyles(c);

  return StyleSheet.create({
    card: {
      marginBottom: careSpacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: careSpacing.sm,
      marginBottom: careSpacing.xs,
    },
    title: {
      ...text.bodyStrong,
      flex: 1,
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: careSpacing.sm,
      paddingVertical: 2,
    },
    statusText: {
      ...careTypography.caption,
      fontWeight: '700',
    },
    meta: {
      ...text.caption,
      marginBottom: 2,
    },
    period: {
      ...text.caption,
      color: c.cyan,
      marginBottom: careSpacing.xs,
    },
    alert: {
      ...text.caption,
      color: c.warning,
      marginBottom: careSpacing.sm,
    },
    actions: {
      marginTop: careSpacing.xs,
    },
  });
}
