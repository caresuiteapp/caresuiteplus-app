import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import { VisitDispositionBadge } from '@/components/assist/VisitDispositionBadge';
import type { AssignmentListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  VISIT_BILLING_STATUS_LABELS,
  VISIT_PLANNING_STATUS_LABELS,
  VISIT_PROOF_STATUS_LABELS,
  type VisitBillingStatus,
  type VisitPlanningStatus,
  type VisitProofStatus,
} from '@/lib/assist/visitTypes';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';

type AssignmentsListTableProps = {
  assignments: AssignmentListItem[];
  selectedId?: string | null;
  onAssignmentPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: AssignmentListItem['status']) {
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

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const datePart = startDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const startTime = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${startTime}–${endTime}`;
}

export function AssignmentsListTable({
  assignments,
  selectedId = null,
  onAssignmentPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: AssignmentsListTableProps) {
  const text = useAuroraAdaptiveText();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        name: { color: text.primary, fontWeight: '600' as const },
        meta: { color: text.secondary, fontSize: 13 },
        badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
      }),
    [text],
  );

  return (
    <PremiumDataTable
      data={assignments}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onAssignmentPress ? (item) => onAssignmentPress(item.id) : undefined}
      columns={[
        {
          key: 'service',
          label: 'Leistung',
          flex: 2,
          render: (item) => (
            <View>
              <Text style={styles.name}>{item.serviceName ?? item.title}</Text>
              {item.serviceName && item.serviceName !== item.title ? (
                <Text style={styles.meta}>{item.title}</Text>
              ) : null}
            </View>
          ),
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.5,
          sortable: true,
          render: (item) => <Text style={styles.meta}>{item.clientName}</Text>,
        },
        {
          key: 'employee',
          label: 'Mitarbeitende:r',
          flex: 1.5,
          render: (item) => <Text style={styles.meta}>{item.employeeName}</Text>,
        },
        {
          key: 'time',
          label: 'Zeit',
          flex: 1.5,
          sortable: true,
          render: (item) => (
            <Text style={styles.meta}>
              {formatTimeRange(item.scheduledStart, item.scheduledEnd)}
              {item.durationMinutes ? ` (${item.durationMinutes} Min.)` : ''}
            </Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 2,
          render: (item) => {
            const planning = (item.planningStatus as VisitPlanningStatus) ?? 'scheduled';
            const proof = (item.proofStatus as VisitProofStatus) ?? 'none';
            const billing = (item.billingStatus as VisitBillingStatus) ?? 'none';
            return (
              <View style={styles.badgeRow}>
                <PremiumBadge
                  label={WORKFLOW_STATUS_LABELS[item.status]}
                  variant={statusVariant(item.status)}
                  dot
                />
                <VisitDispositionBadge
                  label={VISIT_PLANNING_STATUS_LABELS[planning]}
                  variant="cyan"
                  compact
                />
                <VisitDispositionBadge
                  label={VISIT_PROOF_STATUS_LABELS[proof]}
                  variant="purple"
                  compact
                />
                <VisitDispositionBadge
                  label={VISIT_BILLING_STATUS_LABELS[billing]}
                  variant="orange"
                  compact
                />
              </View>
            );
          },
        },
        {
          key: 'actions',
          label: '',
          flex: 0.8,
          render: (item) =>
            onOpenDetail ? (
              <PremiumButton
                title="Öffnen"
                variant="secondary"
                size="sm"
                onPress={() => onOpenDetail(item.id)}
              />
            ) : null,
        },
      ]}
    />
  );
}
