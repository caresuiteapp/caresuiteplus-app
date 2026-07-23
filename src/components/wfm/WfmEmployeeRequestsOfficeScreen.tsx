import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { AuroraSegmentedControl } from '@/components/aurora';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  InfoBanner,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  listWfmAbsenceApprovalDetails,
  listWfmAbsenceOverviewDetails,
  reviewWfmAbsenceRequest,
  type WfmAbsenceApprovalDetail,
  type WfmAbsenceOverviewDetail,
} from '@/lib/wfm';
import {
  WFM_ABSENCE_STATUS_LABELS,
  WFM_ABSENCE_TYPE_LABELS,
  WFM_APPROVAL_TYPE_LABELS,
  type WfmApprovalType,
  type WfmAbsenceStatus,
} from '@/types/modules/wfm';
import { typography } from '@/theme';

type FilterKey = 'all' | WfmApprovalType;

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'vacation', label: 'Urlaub' },
  { key: 'absence', label: 'Abwesenheit' },
];

type AbsenceStatusFilter = 'all' | WfmAbsenceStatus;
const STATUS_OPTIONS: { key: AbsenceStatusFilter; label: string }[] = [
  { key: 'all', label: 'Alle Status' },
  { key: 'requested', label: 'Beantragt' },
  { key: 'approved', label: 'Genehmigt' },
  { key: 'active', label: 'Aktiv' },
  { key: 'completed', label: 'Abgeschlossen' },
  { key: 'rejected', label: 'Abgelehnt' },
];

function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt).toLocaleDateString('de-DE');
  const end = new Date(endsAt).toLocaleDateString('de-DE');
  return `${start} – ${end}`;
}

export function WfmEmployeeRequestsOfficeScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const text = useAuroraAdaptiveText();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [absenceStatus, setAbsenceStatus] = useState<AbsenceStatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [calendarSyncWarning, setCalendarSyncWarning] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const canApprove = can('office.employees.absences.approve');

  const listQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canApprove) return { ok: true as const, data: [] };
      return listWfmAbsenceApprovalDetails(tenantId, roleKey, {
        approvalType: filter === 'all' ? undefined : filter,
      });
    }, [tenantId, canApprove, roleKey, filter]),
    [tenantId, canApprove, roleKey, filter],
  );
  const overviewQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canApprove) return { ok: true as const, data: [] };
      return listWfmAbsenceOverviewDetails(tenantId, roleKey);
    }, [tenantId, canApprove, roleKey]),
    [tenantId, canApprove, roleKey],
  );

  const visibleAbsences = useMemo(
    () =>
      (overviewQuery.data ?? []).filter((detail) => {
        const typeMatches =
          filter === 'all' ||
          (filter === 'vacation'
            ? detail.absence.absenceType === 'vacation'
            : detail.absence.absenceType !== 'vacation');
        const statusMatches =
          absenceStatus === 'all' || detail.absence.status === absenceStatus;
        return typeMatches && statusMatches;
      }),
    [overviewQuery.data, filter, absenceStatus],
  );

  const selected = (listQuery.data ?? []).find((d) => d.approval.id === selectedId) ?? null;

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!tenantId || !selected) return;
    setActionError(null);
    setCalendarSyncWarning(null);
    setActing(true);

    const result = await reviewWfmAbsenceRequest(
      tenantId,
      reviewerId,
      roleKey,
      selected.approval.id,
      decision,
      {
        rejectionReason: decision === 'rejected' ? rejectionReason : undefined,
        approvalComment: decision === 'approved' ? approvalComment : undefined,
      },
    );

    setActing(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setSelectedId(null);
    setRejectionReason('');
    setApprovalComment('');
    if (result.data.calendarSyncWarning) {
      setCalendarSyncWarning(result.data.calendarSyncWarning);
    }
    await listQuery.refresh();
  };

  if (!canApprove) {
    return (
      <ScreenShell title="Mitarbeitenden Anträge">
        <LockedActionBanner
          message={check('office.employees.absences.approve').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Abwesenheiten" subtitle="Urlaub und Abwesenheiten" showBack={false} scroll>
      <AuroraSegmentedControl
        options={FILTER_OPTIONS}
        value={filter}
        onChange={(key) => {
          setFilter(key as FilterKey);
          setSelectedId(null);
        }}
      />

      <AuroraSegmentedControl
        options={STATUS_OPTIONS}
        value={absenceStatus}
        onChange={(key) => setAbsenceStatus(key as AbsenceStatusFilter)}
      />

      <SectionPanel title="Offene Anträge">
        {listQuery.loading && !listQuery.data ? (
          <LoadingState message="Anträge werden geladen…" />
        ) : null}
        {(listQuery.data ?? []).length === 0 ? (
          <EmptyState title="Keine offenen Anträge" message="Alle Urlaubs- und Abwesenheitsanträge sind bearbeitet." />
        ) : (
          (listQuery.data ?? []).map((detail) => (
            <RequestRow
              key={detail.approval.id}
              detail={detail}
              selected={selectedId === detail.approval.id}
              onSelect={() => setSelectedId(detail.approval.id)}
              textPrimary={text.primary}
              textSecondary={text.secondary}
            />
          ))
        )}
      </SectionPanel>

      <SectionPanel
        title="Alle Abwesenheiten"
        subtitle="Beantragte, genehmigte, aktive, abgeschlossene und abgelehnte Abwesenheiten"
      >
        {overviewQuery.loading && !overviewQuery.data ? (
          <LoadingState message="Abwesenheiten werden geladen…" />
        ) : null}
        {overviewQuery.error ? (
          <ErrorState
            title="Abwesenheiten nicht verfügbar"
            message={overviewQuery.error}
            onRetry={() => void overviewQuery.refresh()}
          />
        ) : null}
        {!overviewQuery.loading && visibleAbsences.length === 0 ? (
          <EmptyState
            title="Keine Abwesenheiten"
            message="Für die gewählte Kombination liegen keine Einträge vor."
          />
        ) : (
          visibleAbsences.map((detail) => (
            <AbsenceOverviewRow key={detail.absence.id} detail={detail} />
          ))
        )}
      </SectionPanel>

      {selected ? (
        <SectionPanel title="Antrag bearbeiten">
          <Text style={[styles.detailTitle, { color: text.primary }]}>
            {selected.employeeName} · {WFM_APPROVAL_TYPE_LABELS[selected.approval.approvalType]}
          </Text>
          {selected.absence ? (
            <Text style={{ color: text.secondary, ...typography.caption }}>
              {WFM_ABSENCE_TYPE_LABELS[selected.absence.absenceType]} ·{' '}
              {formatRange(selected.absence.startsAt, selected.absence.endsAt)}
            </Text>
          ) : null}
          {selected.absence?.employeeNote ? (
            <Text style={{ color: text.secondary, ...typography.caption, marginTop: 4 }}>
              Anmerkung: {selected.absence.employeeNote}
            </Text>
          ) : null}

          {selected.conflicts.length > 0 ? (
            <View style={styles.conflicts}>
              <Text style={[styles.conflictHeading, { color: text.primary }]}>Hinweise</Text>
              {selected.conflicts.map((conflict, index) => (
                <Text
                  key={`${conflict.code}-${index}`}
                  style={{
                    color: conflict.severity === 'error' ? '#b42318' : text.secondary,
                    ...typography.caption,
                  }}
                >
                  {conflict.message}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={[styles.label, { color: text.secondary }]}>Kommentar bei Genehmigung (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Interner Kommentar"
            value={approvalComment}
            onChangeText={setApprovalComment}
          />
          <Text style={[styles.label, { color: text.secondary }]}>Ablehnungsgrund (bei Ablehnung Pflicht)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Begründung für die Ablehnung"
            value={rejectionReason}
            onChangeText={setRejectionReason}
            multiline
          />

          <View style={styles.actions}>
            <PremiumButton
              title="Genehmigen"
              onPress={() => void handleDecision('approved')}
              disabled={acting}
            />
            <PremiumButton
              title="Ablehnen"
              variant="secondary"
              onPress={() => void handleDecision('rejected')}
              disabled={acting}
            />
          </View>
        </SectionPanel>
      ) : null}

      {actionError ? <ErrorState title="Fehler" message={actionError} onRetry={() => setActionError(null)} /> : null}
      {calendarSyncWarning ? (
        <InfoBanner
          variant="warning"
          title="Kalender-Synchronisation"
          message={calendarSyncWarning}
        />
      ) : null}
    </ScreenShell>
  );
}

function AbsenceOverviewRow({ detail }: { detail: WfmAbsenceOverviewDetail }) {
  const text = useAuroraAdaptiveText();
  const status = detail.absence.status;
  const variant =
    status === 'approved' || status === 'active' || status === 'completed'
      ? 'green'
      : status === 'rejected' || status === 'cancelled'
        ? 'muted'
        : 'orange';
  return (
    <View style={[styles.row, { borderColor: text.border }]}>
      <View style={styles.rowHeader}>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, { color: text.primary }]}>{detail.employeeName}</Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            {WFM_ABSENCE_TYPE_LABELS[detail.absence.absenceType]} ·{' '}
            {formatRange(detail.absence.startsAt, detail.absence.endsAt)}
          </Text>
        </View>
        <PremiumBadge
          label={WFM_ABSENCE_STATUS_LABELS[status]}
          variant={variant}
        />
      </View>
      {detail.absence.employeeNote ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {detail.absence.employeeNote}
        </Text>
      ) : null}
    </View>
  );
}

function RequestRow({
  detail,
  selected,
  onSelect,
  textPrimary,
  textSecondary,
}: {
  detail: WfmAbsenceApprovalDetail;
  selected: boolean;
  onSelect: () => void;
  textPrimary: string;
  textSecondary: string;
}) {
  const conflictCount = detail.conflicts.length;
  return (
    <View style={[styles.row, selected ? styles.rowSelected : null]}>
      <View style={styles.rowHeader}>
        <Text style={[styles.rowTitle, { color: textPrimary }]}>
          {detail.employeeName}
        </Text>
        <PremiumBadge label={WFM_APPROVAL_TYPE_LABELS[detail.approval.approvalType]} variant="orange" />
      </View>
      {detail.absence ? (
        <Text style={{ color: textSecondary, ...typography.caption }}>
          {WFM_ABSENCE_TYPE_LABELS[detail.absence.absenceType]} ·{' '}
          {formatRange(detail.absence.startsAt, detail.absence.endsAt)}
        </Text>
      ) : null}
      {conflictCount > 0 ? (
        <Text style={{ color: '#b54708', ...typography.caption, marginTop: 4 }}>
          {conflictCount} Hinweis{conflictCount === 1 ? '' : 'e'}
        </Text>
      ) : null}
      <PremiumButton title="Details & Entscheidung" variant="ghost" onPress={onSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: careSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  rowSelected: { backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8, paddingHorizontal: careSpacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: careSpacing.sm },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  detailTitle: { ...typography.body, fontWeight: '700', marginBottom: careSpacing.xs },
  label: { ...typography.caption, marginTop: careSpacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    padding: careSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  conflicts: { marginTop: careSpacing.sm, gap: 4 },
  conflictHeading: { ...typography.caption, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginTop: careSpacing.md },
});
