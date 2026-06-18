import { StyleSheet, Text, View } from 'react-native';
import type { CarePlanListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { CareLightButton } from '@/components/ui/CareLightButton';
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

function statusColor(status: CarePlanListItem['status']): string {
  switch (status) {
    case 'aktiv':
      return careLightColors.green;
    case 'fehlerhaft':
    case 'gesperrt':
      return careLightColors.danger;
    case 'in_bearbeitung':
    case 'entwurf':
      return careLightColors.orange;
    default:
      return careLightColors.muted;
  }
}

export function CareLightCarePlanCard({
  plan,
  onOpen,
  accentColor = careLightColors.green,
}: CareLightCarePlanCardProps) {
  const statusTint = statusColor(plan.status);

  return (
    <CareLightCard accentColor={accentColor} style={styles.card}>
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
          <CareLightButton title="Öffnen" onPress={onOpen} accentColor={accentColor} variant="secondary" />
        </View>
      ) : null}
    </CareLightCard>
  );
}

const styles = StyleSheet.create({
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
    ...careTypography.bodyStrong,
    color: careLightColors.navy,
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
    ...careTypography.caption,
    color: careLightColors.muted,
    marginBottom: 2,
  },
  period: {
    ...careTypography.caption,
    color: careLightColors.cyan,
    marginBottom: careSpacing.xs,
  },
  alert: {
    ...careTypography.caption,
    color: careLightColors.warning,
    marginBottom: careSpacing.sm,
  },
  actions: {
    marginTop: careSpacing.xs,
  },
});
