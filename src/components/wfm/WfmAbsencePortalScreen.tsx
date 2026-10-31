import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  InfoBanner,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium } from '@/design/tokens/portalPremium';
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
import type { RoleKey } from '@/types';

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

export function WfmAbsencePortalScreen(props: WfmAbsencePortalScreenProps) {
  const { profile, user } = useAuth();
  const { employeeId: portalEmployeeId, actorId, roleKey } = usePortalActor();
  const tenantId = useServiceTenantId();
  const userId = actorId ?? user?.id ?? profile?.id ?? '';
  const employeeId = portalEmployeeId ?? profile?.employeeId ?? null;
  const scope = JSON.stringify([tenantId, userId, employeeId, roleKey, props.defaultType ?? 'vacation']);
  return <WfmAbsencePortalContent key={scope} {...props} tenantId={tenantId} userId={userId} employeeId={employeeId} roleKey={roleKey} />;
}

function WfmAbsencePortalContent({ defaultType = 'vacation', title = 'Abwesenheiten', tenantId, userId, employeeId, roleKey }:
  WfmAbsencePortalScreenProps & { tenantId: string | null; userId: string; employeeId: string | null; roleKey: RoleKey | null }) {
  const router = useRouter();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
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
  const mutationLock = useRef(false);

  const canView = can('portal.employee.absences.view');
  const canRequest = can('portal.employee.absences.request');

  const listQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView || !userId) return { ok: true as const, data: [] };
      return listWfmAbsencesForEmployee(tenantId, userId, roleKey, { employeeId });
    }, [tenantId, userId, roleKey, canView, employeeId]),
    [tenantId, userId, roleKey, canView, employeeId],
    { enabled: !!tenantId && !!userId && canView, queryKey: `absence:${tenantId}:${userId}:${employeeId ?? ''}:${roleKey ?? ''}` },
  );

  const visibleAbsences = useMemo(
    () => filterAbsencesForMode(listQuery.data ?? [], mode),
    [listQuery.data, mode],
  );

  const handleSubmit = async () => {
    if (!tenantId || !userId || !canRequest || mutationLock.current) return;
    setError(null); setMessage(null);
    const parsed = parseWfmAbsenceDateRange(startsAt, endsAt);
    if (!parsed.ok) { setError(parsed.error); return; }
    mutationLock.current = true; setSubmitting(true);
    try {
      const result = await requestWfmAbsence(tenantId, userId, roleKey, {
        absenceType: selectedType, startsAt: parsed.startsAt, endsAt: parsed.endsAt,
        employeeNote: note, employeeId,
      });
      if (!active.current) return;
      if (!result.ok) { setError(result.error); return; }
      setStartsAt(''); setEndsAt(''); setNote('');
      const refreshed = await listQuery.refreshWithResult();
      if (!active.current) return;
      setMessage(refreshed === false
        ? 'Antrag wurde eingereicht. Die Übersicht konnte noch nicht aktualisiert werden.'
        : 'Antrag wurde eingereicht und zur Genehmigung weitergeleitet.');
    } catch (cause) { if (!active.current) return; setError(cause instanceof Error ? cause.message : 'Antrag konnte nicht eingereicht werden. Bitte erneut versuchen.'); }
    finally { if (active.current) { mutationLock.current = false; setSubmitting(false); } }
  };

  const handleWithdraw = async (absenceId: string) => {
    if (!tenantId || !userId || !canRequest || mutationLock.current) return;
    mutationLock.current = true; setWithdrawingId(absenceId); setError(null); setMessage(null);
    try {
      const result = await withdrawWfmAbsenceRequest(tenantId, userId, roleKey, absenceId, employeeId);
      if (!active.current) return;
      if (!result.ok) { setError(result.error); return; }
      const refreshed = await listQuery.refreshWithResult();
      if (!active.current) return;
      setMessage(refreshed === false ? 'Antrag wurde zurückgezogen. Die Übersicht konnte noch nicht aktualisiert werden.' : 'Antrag wurde zurückgezogen.');
    } catch (cause) { if (!active.current) return; setError(cause instanceof Error ? cause.message : 'Antrag konnte nicht zurückgezogen werden. Bitte erneut versuchen.'); }
    finally { if (active.current) { mutationLock.current = false; setWithdrawingId(null); } }
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
          <PremiumButton title="Antrag einreichen" onPress={() => void handleSubmit()} loading={submitting} disabled={submitting || Boolean(withdrawingId)} />
        </SectionPanel>
      ) : null}

      <SectionPanel title={mode === 'vacation' ? 'Meine Urlaubsanträge' : 'Meine Abwesenheiten'}>
        {listQuery.loading && !listQuery.data ? (
          <LoadingState message="Abwesenheiten werden geladen…" />
        ) : null}
        {listQuery.error || listQuery.refreshError ? <ErrorState title="Abwesenheiten nicht aktuell" message={listQuery.error ?? listQuery.refreshError!} onRetry={() => void listQuery.refresh()} /> : null}
        {visibleAbsences.length === 0 && !listQuery.loading && !listQuery.error ? (
          <EmptyState title="Keine Einträge" message="Es liegen keine Anträge vor." />
        ) : visibleAbsences.length ? (
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
                  loading={withdrawingId === absence.id}
                  disabled={submitting || Boolean(withdrawingId)}
                />
              ) : null}
            </View>
          ))
        ) : null}
      </SectionPanel>

      <WorkflowToast message={message} onDismiss={() => setMessage(null)} />
      {error ? <InfoBanner title="Aktion fehlgeschlagen" message={error} variant="error" /> : null}
    </PortalTabScreen>
  );
}

const portalText = {
  primary: portalPremium.text.primary,
  secondary: portalPremium.text.secondary,
  muted: portalPremium.text.muted,
} as const;

const styles = StyleSheet.create({
  label: { ...typography.caption, marginTop: careSpacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    borderRadius: 8,
    padding: careSpacing.sm,
    backgroundColor: portalPremium.surfaceRaised,
    color: portalPremium.text.primary,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  row: { paddingVertical: careSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: portalPremium.borderSoft },
  rowHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: careSpacing.sm },
  rowTitle: { ...typography.body, fontWeight: '600', flexShrink: 1 },
});
