import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientAssignments } from '@/lib/assist/assignmentListService';
import { formatDate, formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { ClientFullDetail } from '@/types/modules/client';
import { ClientProofBillingStatusPanel } from '@/components/office/ClientProofBillingStatusPanel';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type ClientRecordShiftsPanelProps = {
  clientId: string;
  fullClient?: ClientFullDetail | null;
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

function formatDurationMinutes(start: string, end: string): string {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} Std. ${remainder} Min.` : `${hours} Std.`;
}

function formatShiftSchedule(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const datePart = formatDate(start);
  const startTime = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${startTime}–${endTime}`;
}

function sortAssignments(items: AssignmentListItem[]): AssignmentListItem[] {
  const now = Date.now();
  const upcoming = items
    .filter((item) => new Date(item.scheduledStart).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
  const past = items
    .filter((item) => new Date(item.scheduledStart).getTime() < now)
    .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime());
  return [...upcoming, ...past];
}

function ClientShiftCard({ assignment }: { assignment: AssignmentListItem }) {
  return (
    <PremiumCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{assignment.title}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[assignment.status]}
          variant={statusVariant(assignment.status)}
          dot
        />
      </View>
      <Text style={styles.meta}>{formatShiftSchedule(assignment.scheduledStart, assignment.scheduledEnd)}</Text>
      <Text style={styles.meta}>
        {assignment.employeeName || 'Noch nicht zugewiesen'}
        {' · '}
        {formatDurationMinutes(assignment.scheduledStart, assignment.scheduledEnd)}
      </Text>
      {assignment.location ? <Text style={styles.secondary}>{assignment.location}</Text> : null}
      <Text style={styles.updated}>Aktualisiert {formatDateTime(assignment.updatedAt)}</Text>
    </PremiumCard>
  );
}

export function ClientRecordShiftsPanel({ clientId, fullClient }: ClientRecordShiftsPanelProps) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientAssignments(tenantId, clientId, profile?.roleKey, {
        userId: profile?.id ?? null,
        employeeId: profile?.employeeId ?? null,
      });
    },
    [tenantId, clientId, profile?.roleKey, profile?.id, profile?.employeeId],
    { enabled: Boolean(tenantId && clientId) },
  );

  const assignments = useMemo(() => sortAssignments(query.data ?? []), [query.data]);
  const upcomingCount = useMemo(
    () => assignments.filter((item) => new Date(item.scheduledStart).getTime() >= Date.now()).length,
    [assignments],
  );

  if (query.loading && !query.data) {
    return <LoadingState message="Einsätze werden geladen…" />;
  }

  if (query.error && !query.data) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  return (
    <View style={styles.panel}>
      <SectionPanel
        title="Einsätze"
        subtitle={
          assignments.length > 0
            ? `${assignments.length} Einsatz${assignments.length === 1 ? '' : 'e'}${upcomingCount > 0 ? ` · ${upcomingCount} geplant` : ''}`
            : undefined
        }
      >
        {assignments.length === 0 ? (
          <EmptyState
            title="Keine Einsätze"
            message="Noch keine Einsätze geplant. Geplante und vergangene Einsätze erscheinen hier mit Status, Termin und zuständiger Person."
          />
        ) : (
          assignments.map((assignment) => <ClientShiftCard key={assignment.id} assignment={assignment} />)
        )}
      </SectionPanel>

      {fullClient?.preferences ? (
        <SectionPanel title="Einsatzpräferenzen">
          <DetailInfoRow
            label="Bevorzugte Zeiten"
            value={fullClient.preferences.preferredShifts.join(', ') || null}
          />
          <DetailInfoRow label="Mobilität" value={fullClient.preferences.mobilityNotes} />
          <DetailInfoRow label="Zugang" value={fullClient.preferences.accessInstructions} />
        </SectionPanel>
      ) : null}

      <ClientProofBillingStatusPanel clientId={clientId} />

      {!isReadOnly ? (
        <SectionPanel title="Planung">
          <Text style={styles.hint}>
            Neue Einsätze planen Sie in CareSuite+ Assist unter Einsätze. Aufgaben und Wünsche pflegen Sie im Tab
            „Aufgaben & Wünsche“.
          </Text>
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: { ...typography.label, flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  secondary: { ...typography.caption, marginTop: spacing.xs },
  updated: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
