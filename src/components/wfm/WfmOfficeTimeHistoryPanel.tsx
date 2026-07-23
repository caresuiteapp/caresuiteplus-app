import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CareDateInput } from '@/components/inputs';
import { PremiumButton } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  applyWfmOfficeTimeCorrection,
  adoptWfmAssignmentActualToBooking,
  getWfmOfficeTimeOverview,
  reviewWfmOfficeTimeEntry,
} from '@/lib/wfm/wfmOfficeTimekeepingService';
import { listWfmOfficeAuditForEntry } from '@/lib/wfm/wfmOfficeAuditService';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import type {
  WfmOfficePeriodPreset,
  WfmOfficeTimeEntry,
  WfmOfficeTimeFilters,
} from '@/types/modules/wfmOfficeTimekeeping';
import { WFM_OFFICE_PERIOD_PRESET_LABELS, WFM_OFFICE_TIME_STATUS_LABELS } from '@/types/modules/wfmOfficeTimekeeping';
import {
  WfmOfficeCompactKpiStrip,
  WfmOfficeFilterBar,
  WfmOfficePeriodChips,
  WfmOfficeSectionHeading,
  WfmOfficeSplitWorkArea,
  WfmOfficeStatusChip,
} from './WfmOfficeTimekeepingLayout';
import { WfmOfficeTimeEntryTable } from './WfmOfficeTimeEntryTable';
import { WfmOfficeTimeReviewDetailPanel } from './WfmOfficeTimeReviewDetailPanel';

type Props = {
  tenantId: string;
  reviewerId: string;
  roleKey: import('@/types').RoleKey | null;
  canCorrect: boolean;
  initialFilterAmpel?: string | null;
  reviewQueueMode?: boolean;
};

const PRESETS: WfmOfficePeriodPreset[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'last_7_days',
  'last_30_days',
];

export function WfmOfficeTimeHistoryPanel({
  tenantId,
  reviewerId,
  roleKey,
  canCorrect,
  initialFilterAmpel = null,
  reviewQueueMode = false,
}: Props) {
  const accent = moduleColor('office');
  const [preset, setPreset] = useState<WfmOfficePeriodPreset>(reviewQueueMode ? 'last_30_days' : 'today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterAmpel, setFilterAmpel] = useState<string | null>(initialFilterAmpel);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [correctionReason, setCorrectionReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editPauseMinutes, setEditPauseMinutes] = useState('0');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const filters = useMemo<Partial<WfmOfficeTimeFilters>>(() => {
    const next: Partial<WfmOfficeTimeFilters> = {};
    if (filterAmpel === 'rot_blau') next.onlyRotBlau = true;
    if (filterAmpel === 'pending') next.onlyPendingReview = true;
    if (filterAmpel === 'office_msg') next.onlyOfficeMessages = true;
    if (filterEmployeeId) next.employeeIds = [filterEmployeeId];
    return next;
  }, [filterAmpel, filterEmployeeId]);

  const historyQuery = useAsyncQuery(
    useCallback(async () => {
      return getWfmOfficeTimeOverview(tenantId, roleKey, {
        preset,
        fromDate: preset === 'custom' ? customFrom : null,
        toDate: preset === 'custom' ? customTo : null,
        filters,
      });
    }, [tenantId, roleKey, preset, customFrom, customTo, filters]),
    [tenantId, roleKey, preset, customFrom, customTo, filters],
    {
      enabled: !!tenantId,
      live: {
        tenantId,
        subscribe: subscribeToWfmLiveChanges,
        pollMs: 10_000,
        refreshOnFocus: true,
      },
    },
  );

  const auditQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !selectedId) return { ok: true as const, data: [] };
      return listWfmOfficeAuditForEntry(tenantId, roleKey, selectedId);
    }, [tenantId, roleKey, selectedId]),
    [tenantId, roleKey, selectedId],
    { enabled: !!tenantId && !!selectedId },
  );

  const overview = historyQuery.data;
  const selected: WfmOfficeTimeEntry | null =
    overview?.entries.find((e) => e.id === selectedId) ?? null;
  const kpis = overview?.kpis;

  useEffect(() => {
    if (!filterEmployeeId && overview?.employees) {
      setEmployeeOptions(overview.employees);
    }
  }, [filterEmployeeId, overview?.employees]);

  useEffect(() => {
    if (selectedId && overview && !overview.entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [overview, selectedId]);

  useEffect(() => {
    if (!selected) {
      setEditStartAt('');
      setEditEndAt('');
      setEditPauseMinutes('0');
      return;
    }
    setEditStartAt(selected.actualStartAt ?? selected.assignmentActualStartAt ?? '');
    setEditEndAt(selected.actualEndAt ?? selected.assignmentActualEndAt ?? '');
    setEditPauseMinutes(String(selected.pauseMinutes ?? 0));
  }, [selected]);

  const runReview = async (
    decision: 'approved' | 'rejected' | 'exported' | 'locked' | 'needs_clarification',
  ) => {
    if (!selectedId) return;
    setActionMessage(null);
    const result = await reviewWfmOfficeTimeEntry(
      tenantId,
      reviewerId,
      roleKey,
      selectedId,
      decision,
      reviewNote,
      selected,
    );
    if (!result.ok) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage(`Status: ${WFM_OFFICE_TIME_STATUS_LABELS[result.data.reviewStatus]}`);
    setReviewNote('');
    void historyQuery.refresh();
  };

  const runCorrection = async () => {
    if (!selectedId || !correctionReason.trim()) {
      setActionMessage('Korrektur ohne Begründung blockiert.');
      return;
    }
    const result = await applyWfmOfficeTimeCorrection(tenantId, reviewerId, roleKey, {
      entryId: selectedId,
      reason: correctionReason,
      actualStartAt: editStartAt || null,
      actualEndAt: editEndAt || null,
      pauseMinutes: Number(editPauseMinutes) || 0,
    }, selected);
    if (!result.ok) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage('Korrektur gespeichert.');
    setCorrectionReason('');
    void historyQuery.refresh();
    void auditQuery.refresh();
  };

  const runAdoptAssignment = async () => {
    if (!selectedId) return;
    const reason = correctionReason.trim() || reviewNote.trim() || 'Übernahme aus Einsatz-Ist';
    const result = await adoptWfmAssignmentActualToBooking(tenantId, reviewerId, roleKey, selectedId, reason);
    if (!result.ok) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage('Einsatz-Ist als Buchung übernommen.');
    void historyQuery.refresh();
    void auditQuery.refresh();
  };

  const kpiItems = reviewQueueMode
    ? [
        { key: 'pending', label: 'Offen', value: String(kpis?.pendingReviewCount ?? 0), accent },
        { key: 'missing', label: 'Fehlende Buchung', value: String(kpis?.missingBookings ?? 0) },
        { key: 'unplanned', label: 'Ungeplant', value: String(kpis?.unplannedBookings ?? 0) },
        { key: 'deviation', label: 'Abweichungen', value: String(kpis?.planningDeviations ?? 0) },
        { key: 'planned', label: 'Geplant', value: String(kpis?.plannedVisits ?? 0) },
        { key: 'recorded', label: 'Erfasst', value: String(kpis?.recordedVisits ?? 0) },
      ]
    : [
        { key: 'planned', label: 'Geplant', value: String(kpis?.plannedVisits ?? 0), accent },
        { key: 'recorded', label: 'Erfasst', value: String(kpis?.recordedVisits ?? 0) },
        { key: 'missing', label: 'Fehlende Buchung', value: String(kpis?.missingBookings ?? 0) },
        { key: 'hours', label: 'Std. gesamt', value: String(kpis?.totalHours ?? 0) },
        { key: 'pending', label: 'Offen', value: String(kpis?.pendingReviewCount ?? 0) },
        { key: 'exported', label: 'Exportiert', value: String(kpis?.exportedCount ?? 0) },
      ];

  const periodOptions = [
    ...PRESETS.map((p) => ({ key: p, label: WFM_OFFICE_PERIOD_PRESET_LABELS[p] })),
    { key: 'custom' as const, label: 'Freier Zeitraum' },
  ];

  const mainContent = (
    <>
      <WfmOfficeSectionHeading
        title={reviewQueueMode ? 'Offene Prüfungen' : 'Arbeitszeit-Historie'}
        subtitle={overview ? `${overview.period.fromDate} – ${overview.period.toDate}` : undefined}
      />

      <WfmOfficeFilterBar
        periodSlot={
          <WfmOfficePeriodChips
            options={periodOptions}
            value={preset}
            onChange={(p) => setPreset(p)}
          />
        }
        secondarySlot={
          <>
            <WfmOfficeStatusChip
              label="Alle MA"
              selected={!filterEmployeeId}
              onPress={() => setFilterEmployeeId(null)}
            />
            {employeeOptions.map((emp) => (
              <WfmOfficeStatusChip
                key={emp.id}
                label={emp.name}
                selected={filterEmployeeId === emp.id}
                onPress={() => setFilterEmployeeId(emp.id)}
              />
            ))}
          </>
        }
        statusSlot={
          <>
            <WfmOfficeStatusChip
              label="Rot/Blau"
              selected={filterAmpel === 'rot_blau'}
              onPress={() => setFilterAmpel((v) => (v === 'rot_blau' ? null : 'rot_blau'))}
            />
            <WfmOfficeStatusChip
              label="Offen"
              selected={filterAmpel === 'pending'}
              onPress={() => setFilterAmpel((v) => (v === 'pending' ? null : 'pending'))}
            />
            <WfmOfficeStatusChip
              label="Office-Meldungen"
              selected={filterAmpel === 'office_msg'}
              onPress={() => setFilterAmpel((v) => (v === 'office_msg' ? null : 'office_msg'))}
            />
          </>
        }
      />

      {preset === 'custom' ? (
        <View style={styles.customRow}>
          <View style={styles.dateField}><CareDateInput
            label="Von"
            value={customFrom}
            onChange={setCustomFrom}
            showFormatHint={false}
          /></View>
          <View style={styles.dateField}><CareDateInput
            label="Bis"
            value={customTo}
            onChange={setCustomTo}
            showFormatHint={false}
          /></View>
          <PremiumButton title="Anwenden" variant="secondary" onPress={() => void historyQuery.refresh()} onDarkSurface={false} />
        </View>
      ) : null}

      {kpis ? <WfmOfficeCompactKpiStrip items={kpiItems} maxVisible={6} /> : null}

      <WfmOfficeTimeEntryTable
        entries={overview?.entries ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
        reviewQueueMode={reviewQueueMode}
      />

      <PremiumButton title="Aktualisieren" variant="ghost" onPress={() => void historyQuery.refresh()} onDarkSurface={false} />
    </>
  );

  const detailPanel = selected ? (
    <WfmOfficeTimeReviewDetailPanel
      entry={selected}
      auditEntries={auditQuery.data ?? []}
      canCorrect={canCorrect}
      onApprove={() => void runReview('approved')}
      onReject={() => void runReview('rejected')}
      onClarification={() => void runReview('needs_clarification')}
      onAdoptAssignment={() => void runAdoptAssignment()}
      onSaveCorrection={() => void runCorrection()}
      onClose={() => setSelectedId(null)}
      reviewNote={reviewNote}
      onReviewNoteChange={setReviewNote}
      correctionReason={correctionReason}
      onCorrectionReasonChange={setCorrectionReason}
      editStartAt={editStartAt}
      editEndAt={editEndAt}
      editPauseMinutes={editPauseMinutes}
      onEditStartAtChange={setEditStartAt}
      onEditEndAtChange={setEditEndAt}
      onEditPauseMinutesChange={setEditPauseMinutes}
      actionMessage={actionMessage}
      exportedWarning={selected.exportStatus === 'exported'}
    />
  ) : null;

  return (
    <View style={styles.root} testID={reviewQueueMode ? 'wfm-offene-pruefungen' : 'wfm-arbeitszeit-historie'}>
      <WfmOfficeSplitWorkArea
        main={mainContent}
        detail={detailPanel}
        detailOpen={Boolean(selected)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: careSpacing.sm },
  customRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.sm },
  dateField: { minWidth: 180, flex: 1 },
});
