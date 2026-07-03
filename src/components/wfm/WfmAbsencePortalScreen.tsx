import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  SuccessState,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAuth } from '@/lib/auth/context';
import {
  listWfmAbsencesForEmployee,
  requestWfmAbsence,
} from '@/lib/wfm';
import {
  WFM_ABSENCE_STATUS_LABELS,
  WFM_ABSENCE_TYPE_LABELS,
  type WfmAbsenceType,
} from '@/types/modules/wfm';
import { typography } from '@/theme';

const REQUEST_TYPES: WfmAbsenceType[] = ['vacation', 'sick_leave', 'training', 'special_leave', 'other'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE');
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
  const text = useAuroraAdaptiveText();

  const [selectedType, setSelectedType] = useState<WfmAbsenceType>(defaultType);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canView = can('portal.employee.absences.view');
  const canRequest = can('portal.employee.absences.request');

  const listQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView || !userId) return { ok: true as const, data: [] };
      return listWfmAbsencesForEmployee(tenantId, userId, roleKey, { employeeId });
    }, [tenantId, userId, roleKey, canView, employeeId]),
    [tenantId, userId, roleKey, canView, employeeId],
  );

  const handleSubmit = async () => {
    if (!tenantId || !userId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const startIso = startsAt ? new Date(startsAt).toISOString() : '';
    const endIso = endsAt ? new Date(endsAt).toISOString() : '';
    if (!startIso || !endIso) {
      setError('Bitte Start- und Enddatum angeben.');
      setSubmitting(false);
      return;
    }

    const result = await requestWfmAbsence(tenantId, userId, roleKey, {
      absenceType: selectedType,
      startsAt: startIso,
      endsAt: endIso,
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

  if (!canView) {
    return (
      <ScreenShell title={title}>
        <LockedActionBanner
          message={check('portal.employee.absences.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={title} subtitle="Anträge und Übersicht" scroll>
      <PremiumButton
        title="← Zurück zur Arbeitszeit"
        variant="ghost"
        onPress={() => router.push('/portal/employee/arbeitszeit' as never)}
      />

      {canRequest ? (
        <SectionPanel title="Neuer Antrag">
          <AuroraSegmentedControl
            options={REQUEST_TYPES.map((t) => ({
              key: t,
              label: WFM_ABSENCE_TYPE_LABELS[t],
            }))}
            value={selectedType}
            onChange={(key) => setSelectedType(key as WfmAbsenceType)}
          />
          <Text style={[styles.label, { color: text.secondary }]}>Von (TT.MM.JJJJ)</Text>
          <TextInput
            style={styles.input}
            placeholder="01.07.2026"
            value={startsAt}
            onChangeText={setStartsAt}
          />
          <Text style={[styles.label, { color: text.secondary }]}>Bis (TT.MM.JJJJ)</Text>
          <TextInput
            style={styles.input}
            placeholder="05.07.2026"
            value={endsAt}
            onChangeText={setEndsAt}
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

      <SectionPanel title="Meine Abwesenheiten">
        {listQuery.loading && !listQuery.data ? (
          <LoadingState message="Abwesenheiten werden geladen…" />
        ) : null}
        {(listQuery.data ?? []).length === 0 ? (
          <EmptyState title="Keine Einträge" message="Es liegen keine Abwesenheiten vor." />
        ) : (
          (listQuery.data ?? []).map((absence) => (
            <View key={absence.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, { color: text.primary }]}>
                  {WFM_ABSENCE_TYPE_LABELS[absence.absenceType]}
                </Text>
                <PremiumBadge
                  label={WFM_ABSENCE_STATUS_LABELS[absence.status]}
                  variant={absence.status === 'approved' ? 'green' : absence.status === 'rejected' ? 'red' : 'orange'}
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
            </View>
          ))
        )}
      </SectionPanel>

      {message ? <SuccessState title="Erfolg" message={message} /> : null}
      {error ? <ErrorState title="Fehler" message={error} onRetry={() => setError(null)} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, marginTop: careSpacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    padding: careSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  row: { paddingVertical: careSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: careSpacing.sm },
  rowTitle: { ...typography.body, fontWeight: '600' },
});
