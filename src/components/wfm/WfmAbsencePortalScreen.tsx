import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { CareDateInput } from '@/components/inputs';
import { WorkflowToast } from '@/components/ui/WorkflowToast';
import { AuroraSegmentedControl } from '@/components/aurora';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAuth } from '@/lib/auth/context';
import {
  listWfmAbsencesForEmployee,
  requestWfmAbsence,
  withdrawWfmAbsenceRequest,
} from '@/lib/wfm';
import {
  WFM_ABSENCE_TYPE_LABELS,
  WFM_PORTAL_ABSENCE_STATUS_LABELS,
  type WfmAbsence,
  type WfmAbsenceStatus,
  type WfmAbsenceType,
} from '@/types/modules/wfm';
import { parseWfmAbsenceDateRange } from '@/lib/formatters/dateTimeFormatters';
import { typography } from '@/theme';

const VACATION_TYPES: WfmAbsenceType[] = ['vacation'];
const GENERAL_ABSENCE_TYPES: WfmAbsenceType[] = [
  'sick_leave',
  'blocked_time',
  'training',
  'special_leave',
  'other',
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE');
}

function statusBadgeVariant(status: WfmAbsenceStatus): 'green' | 'red' | 'orange' | 'muted' {
  if (status === 'approved' || status === 'active') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'cancelled') return 'muted';
  return 'orange';
}

function filterAbsencesForMode(
  absences: WfmAbsence[],
  mode: 'vacation' | 'general',
): WfmAbsence[] {
  if (mode === 'vacation') {
    return absences.filter((a) => a.absenceType === 'vacation');
  }
  return absences.filter((a) => a.absenceType !== 'vacation');
}

type WfmAbsencePortalScreenProps = {
  defaultType?: WfmAbsenceType;
  title?: string;
};

export function WfmAbsencePortalScreen({
  defaultType = 'vacation',
  title = 'Abwesenheiten',
}: WfmAbsencePortalScreenProps) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { employeeId: portalEmployeeId } = usePortalActor();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? '';
  const employeeId = portalEmployeeId ?? profile?.employeeId ?? null;
  const roleKey = profile?.roleKey ?? null;
  const { can, check, roleLabel } = usePermissions();
  const text = portalText;

  const mode: 'vacation' | 'general' = defaultType === 'vacation' ? 'vacation' : 'general';
  const requestTypes = mode === 'vacation' ? VACATION_TYPES : GENERAL_ABSENCE_TYPES;

  const [selectedType, setSelectedType] = useState<WfmAbsenceType>(
    requestTypes.includes(defaultType) ? defaultType : requestTypes[0]!,
  );
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const canView = can('portal.employee.absences.view');
  const canRequest = can('portal.employee.absences.request');

  const listQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView || !userId) return { ok: true as const, data: [] };
      return listWfmAbsencesForEmployee(tenantId, userId, roleKey, { employeeId });
    }, [tenantId, userId, roleKey, canView, employeeId]),
    [tenantId, userId, roleKey, canView, employeeId],
  );

  const visibleAbsences = useMemo(
    () => filterAbsencesForMode(listQuery.data ?? [], mode),
    [listQuery.data, mode],
  );

  const handleSubmit = async () => {
    if (!tenantId || !userId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    if (!startsAt.trim() || !endsAt.trim()) {
      setError('Bitte Start- und Enddatum angeben.');
      setSubmitting(false);
      return;
    }

    const parsed = parseWfmAbsenceDateRange(startsAt, endsAt);
    if (!parsed.ok) {
      setError(parsed.error);
      setSubmitting(false);
      return;
    }

    const result = await requestWfmAbsence(tenantId, userId, roleKey, {
      absenceType: selectedType,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      employeeNote: note,
      employeeId,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage('Antrag wurde eingereicht und zur Genehmigung weitergeleitet.');
    setStartsAt('');
    setEndsAt('');
    setNote('');
    await listQuery.refresh();
  };

  const handleWithdraw = async (absenceId: string) => {
    if (!tenantId || !userId) return;
    setWithdrawingId(absenceId);
    setError(null);
    const result = await withdrawWfmAbsenceRequest(
      tenantId,
      userId,
      roleKey,
      absenceId,
      employeeId,
    );
    setWithdrawingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage('Antrag wurde zurückgezogen.');
    await listQuery.refresh();
  };

  if (!canView) {
    return (
      <PortalTabScreen title={title}>
        <LockedActionBanner
          message={check('portal.employee.absences.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title={title} subtitle="Anträge und Übersicht" scroll>
      <PremiumButton
        title="← Zurück zur Arbeitszeit"
        variant="ghost"
        onPress={() => router.push('/portal/employee/arbeitszeit' as never)}
      />

      {canRequest ? (
        <SectionPanel title="Neuer Antrag">
          {requestTypes.length > 1 ? (
            <AuroraSegmentedControl
              options={requestTypes.map((t) => ({
                key: t,
                label: WFM_ABSENCE_TYPE_LABELS[t],
              }))}
              value={selectedType}
              onChange={(key) => setSelectedType(key as WfmAbsenceType)}
            />
          ) : (
            <Text style={[styles.label, { color: text.secondary }]}>
              Art: {WFM_ABSENCE_TYPE_LABELS[selectedType]}
            </Text>
          )}
          <CareDateInput
            label="Von"
            value={startsAt}
            onChange={setStartsAt}
          />
          <CareDateInput
            label="Bis"
            value={endsAt}
            onChange={setEndsAt}
          />
          <Text style={[styles.label, { color: text.secondary }]}>Anmerkung (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Kurze Begründung"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <PremiumButton title="Antrag einreichen" onPress={() => void handleSubmit()} disabled={submitting} />
        </SectionPanel>
      ) : null}

      <SectionPanel title={mode === 'vacation' ? 'Meine Urlaubsanträge' : 'Meine Abwesenheiten'}>
        {listQuery.loading && !listQuery.data ? (
          <LoadingState message="Abwesenheiten werden geladen…" />
        ) : null}
        {visibleAbsences.length === 0 ? (
          <EmptyState title="Keine Einträge" message="Es liegen keine Anträge vor." />
        ) : (
          visibleAbsences.map((absence) => (
            <View key={absence.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, { color: text.primary }]}>
                  {WFM_ABSENCE_TYPE_LABELS[absence.absenceType]}
                </Text>
                <PremiumBadge
                  label={WFM_PORTAL_ABSENCE_STATUS_LABELS[absence.status]}
                  variant={statusBadgeVariant(absence.status)}
                />
              </View>
              <Text style={{ color: text.secondary, ...typography.caption }}>
                {formatDate(absence.startsAt)} – {formatDate(absence.endsAt)}
              </Text>
              {absence.employeeNote ? (
                <Text style={{ color: text.secondary, ...typography.caption, marginTop: 4 }}>
                  {absence.employeeNote}
                </Text>
              ) : null}
              {absence.status === 'rejected' &&
              (absence.portalRejectionReason?.trim() || absence.internalNote.trim()) ? (
                <Text style={{ color: text.secondary, ...typography.caption, marginTop: 4 }}>
                  Ablehnungsgrund:{' '}
                  {(absence.portalRejectionReason?.trim() || absence.internalNote.trim())}
                </Text>
              ) : null}
              {absence.status === 'requested' && canRequest ? (
                <PremiumButton
                  title="Zurückziehen"
                  variant="ghost"
                  onPress={() => void handleWithdraw(absence.id)}
                  disabled={withdrawingId === absence.id}
                />
              ) : null}
            </View>
          ))
        )}
      </SectionPanel>

      <WorkflowToast message={message} onDismiss={() => setMessage(null)} />
      {error ? <ErrorState title="Fehler" message={error} onRetry={() => setError(null)} /> : null}
    </PortalTabScreen>
  );
}

const portalText = {
  primary: spatialCare.textOnNight,
  secondary: spatialCare.textOnNightMuted,
  muted: spatialCare.textOnNightMuted,
} as const;

const styles = StyleSheet.create({
  label: { ...typography.caption, marginTop: careSpacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: spatialCare.border,
    borderRadius: 8,
    padding: careSpacing.sm,
    backgroundColor: spatialCare.input,
    color: spatialCare.textOnNight,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  row: { paddingVertical: careSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: spatialCare.borderDark },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: careSpacing.sm },
  rowTitle: { ...typography.body, fontWeight: '600' },
});
