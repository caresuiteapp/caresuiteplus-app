import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CareDateInput } from '@/components/inputs';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton, ErrorState, LoadingState, InfoBanner, useWorkflowFeedback } from '@/components/ui';
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
  WfmOfficeTimePeriod,
  WfmOfficeTimeEntry,
  WfmOfficeTimeFilters,
} from '@/types/modules/wfmOfficeTimekeeping';
import {
  WFM_OFFICE_PERIOD_PRESET_LABELS,
  WFM_OFFICE_TIME_STATUS_LABELS,
  WFM_OFFICE_WORK_KIND_LABELS,
} from '@/types/modules/wfmOfficeTimekeeping';
import {
  WfmOfficeCompactKpiStrip,
  WfmOfficeFilterBar,
  WfmOfficePeriodChips,
  WfmOfficeSectionHeading,
  WfmOfficeStatusChip,
  WORKTIME_SURFACE,
} from './WfmOfficeTimekeepingLayout';
import { officePeriodLabel } from '@/lib/wfm/wfmOfficeMonth';
import { confirmAction } from '@/lib/platform/confirmAction';
import { approveWfmOfficeTimeSelection, canApproveWfmOfficeTimeEntry, selectedWfmApprovalEntries } from '@/lib/wfm/wfmOfficeTimeApproval';
import { WfmOfficeTimeEntryTable } from './WfmOfficeTimeEntryTable';
import { WfmOfficeTimeReviewDetailPanel } from './WfmOfficeTimeReviewDetailPanel';

export type WfmEditorState = { dirty: boolean; busy: boolean; childOpen: boolean };

type Props = {
  tenantId: string;
  reviewerId: string;
  roleKey: import('@/types').RoleKey | null;
  canCorrect: boolean;
  initialFilterAmpel?: string | null;
  reviewQueueMode?: boolean;
  initialEmployeeId?: string | null;
  initialEmployeeName?: string | null;
  initialPreset?: WfmOfficePeriodPreset;
  lockEmployeeFilter?: boolean;
  period?: WfmOfficeTimePeriod;
  onChanged?: () => Promise<void>;
  onEditorStateChange?: (state: WfmEditorState) => void;
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
  initialEmployeeId = null,
  initialEmployeeName = null,
  initialPreset,
  lockEmployeeFilter = false,
  period, onChanged, onEditorStateChange,
}: Props) {
  const feedback = useWorkflowFeedback();
  const accent = moduleColor('office');
  const [preset, setPreset] = useState<WfmOfficePeriodPreset>(
    initialPreset ?? (reviewQueueMode ? 'last_30_days' : 'today'),
  );
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selected, setSelected] = useState<WfmOfficeTimeEntry | null>(null);
  const selectedId = selected?.id ?? null;
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [approvalProgress, setApprovalProgress] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState({ scope: '', selectedIds: new Set<string>() });
  const [filterAmpel, setFilterAmpel] = useState<string | null>(initialFilterAmpel);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(initialEmployeeId);
  const [employeeOptions, setEmployeeOptions] = useState<{ id: string; name: string }[]>([]);
  const [correctionReason, setCorrectionReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editPauseMinutes, setEditPauseMinutes] = useState('0');

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
        preset: period ? 'custom' : preset,
        fromDate: period?.fromDate ?? (preset === 'custom' ? customFrom : null),
        toDate: period?.toDate ?? (preset === 'custom' ? customTo : null),
        filters,
      });
    }, [tenantId, roleKey, preset, customFrom, customTo, filters, period?.fromDate, period?.toDate]),
    [tenantId, roleKey, preset, customFrom, customTo, filters, period?.fromDate, period?.toDate],
    {
      enabled: !!tenantId,
      queryKey: `wfm-history:${tenantId}:${period?.fromDate ?? preset}:${period?.toDate ?? customFrom}:${customTo}:${filterEmployeeId}:${filterAmpel}`,
      live: {
        enabled: !selectedId && !saving,
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
      return listWfmOfficeAuditForEntry(tenantId, roleKey, selectedId, selected);
    }, [tenantId, roleKey, selectedId]),
    [tenantId, roleKey, selectedId],
    { enabled: !!tenantId && !!selectedId, queryKey: `audit:${tenantId}:${selectedId}` },
  );

  const overview = historyQuery.data;
  const canQuickApprove = Platform.OS === 'web' && canCorrect && Boolean(reviewerId);
  const approvalScope = JSON.stringify([tenantId, roleKey, reviewerId, filterEmployeeId, filterAmpel, preset, customFrom, customTo, period?.fromDate, period?.toDate]);
  const scopeRef = useRef(approvalScope);
  scopeRef.current = approvalScope;
  const currentApproval = approvalState.scope === approvalScope ? approvalState : null;
  const entries = overview?.entries ?? [];
  const approvalEntries = entries.filter(entry => entry.tenantId === tenantId && canApproveWfmOfficeTimeEntry(entry));
  const selectedApprovalEntries = selectedWfmApprovalEntries(approvalEntries, currentApproval?.selectedIds ?? new Set<string>());
  const selectedApprovalIds = new Set(selectedApprovalEntries.map(entry => entry.id));
  const allApprovalSelected = approvalEntries.length > 0 && selectedApprovalEntries.length === approvalEntries.length;
  const selectEntry = (id: string | null) => {
    if (!savingRef.current) setSelected(entries.find(entry => entry.id === id) ?? null);
  };
  const changeApprovalSelection = (entryId?: string) => {
    if (!canQuickApprove || savingRef.current || historyQuery.loading || historyQuery.error) return;
    const nextIds = new Set(selectedApprovalIds);
    if (entryId) {
      if (!approvalEntries.some(entry => entry.id === entryId)) return;
      if (nextIds.has(entryId)) nextIds.delete(entryId); else nextIds.add(entryId);
    } else {
      nextIds.clear();
      if (!allApprovalSelected) approvalEntries.forEach(entry => nextIds.add(entry.id));
    }
    setApprovalState({ scope: approvalScope, selectedIds: nextIds });
  };
  const kpis = overview?.kpis;

  useEffect(() => {
    setApprovalState(current => current.scope === approvalScope ? current : { scope: approvalScope, selectedIds: new Set<string>() });
  }, [approvalScope]);

  useEffect(() => {
    if (!filterEmployeeId && overview?.employees) {
      setEmployeeOptions(overview.employees);
    }
  }, [filterEmployeeId, overview?.employees]);

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
  // Keep a stable draft while background data refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const closeReviewDetail = () => {
    if (savingRef.current) return;
    setSelected(null);
    setReviewNote('');
    setCorrectionReason('');
  };

  const dirty = Boolean(selected && (reviewNote.trim() || correctionReason.trim()
    || editStartAt !== (selected.actualStartAt ?? selected.assignmentActualStartAt ?? '')
    || editEndAt !== (selected.actualEndAt ?? selected.assignmentActualEndAt ?? '')
    || editPauseMinutes !== String(selected.pauseMinutes ?? 0)));
  useEffect(() => { onEditorStateChange?.({ dirty, busy: saving, childOpen: Boolean(selectedId) }); }, [dirty, saving, selectedId, onEditorStateChange]);
  useEffect(() => () => onEditorStateChange?.({ dirty: false, busy: false, childOpen: false }), [onEditorStateChange]);
  const beginSave = () => { if (savingRef.current || !canCorrect) return false; savingRef.current = true; setSaving(true); return true; };
  const finishSave = () => { savingRef.current = false; setSaving(false); };
  const refreshSavedData = async () => { await Promise.all([historyQuery.refresh(), auditQuery.refresh(), onChanged?.()]); };

  const runQuickApproval = async (requestedEntries: WfmOfficeTimeEntry[]) => {
    if (!canQuickApprove || selectedId || historyQuery.loading || historyQuery.error) return;
    const requestedIds = new Set(requestedEntries.map(entry => entry.id));
    const targets = selectedWfmApprovalEntries(approvalEntries, requestedIds);
    if (!targets.length || !beginSave()) return;
    const scope = approvalScope;
    let loadingId: ReturnType<typeof feedback.showLoading> | undefined;
    try {
      const deviations = targets.filter(entry => entry.overallAmpel === 'red' || entry.overallAmpel === 'blue').length;
      const scopeLabel = overview ? officePeriodLabel(overview.period) : '';
      const confirmed = await confirmAction({
        title: targets.length === 1 ? 'Arbeitszeit genehmigen' : `${targets.length} Arbeitszeiten genehmigen`,
        message: `${targets.length === 1 ? `${targets[0].employeeName} · ${targets[0].workDate}` : `${targets.length} ausgewählte Einträge · ${scopeLabel}`}\nDie erfassten Ist-Zeiten werden genehmigt.${deviations ? `\nDavon ${deviations} mit roten oder blauen Abweichungen. Bitte diese Abweichungen vor der Genehmigung prüfen.` : ''}`,
        confirmLabel: 'Genehmigen',
      });
      if (!confirmed || scopeRef.current !== scope) return;
      loadingId = feedback.showLoading('Arbeitszeiten werden genehmigt…');
      setApprovalProgress(`0 von ${targets.length} bearbeitet`);
      const confirmedEntries = new Map<string, WfmOfficeTimeEntry>();
      const outcome = await approveWfmOfficeTimeSelection(targets, async entry => {
        if (scopeRef.current !== scope || entry.tenantId !== tenantId) {
          return { ok: false as const, error: 'Die Ansicht wurde gewechselt. Bitte erneut auswählen.' };
        }
        const result = await reviewWfmOfficeTimeEntry(tenantId, reviewerId, roleKey, entry.id, 'approved', undefined, entry);
        if (result.ok && result.data.id === entry.id && result.data.reviewStatus === 'approved') {
          confirmedEntries.set(entry.id, result.data);
        }
        return result;
      }, (done, total) => setApprovalProgress(`${done} von ${total} bearbeitet`));
      if (scopeRef.current === scope) {
        historyQuery.setData(current => current ? {
          ...current,
          entries: current.entries.map(entry => confirmedEntries.get(entry.id) ?? entry),
        } : current);
        setApprovalState(current => {
          const selectedIds = new Set(current.scope === scope ? current.selectedIds : []);
          outcome.approvedIds.forEach(id => selectedIds.delete(id));
          outcome.failed.forEach(({ entry }) => selectedIds.add(entry.id));
          return { scope, selectedIds };
        });
      }
      if (outcome.failed.length) {
        feedback.showWarning(`${outcome.approvedIds.length} genehmigt, ${outcome.failed.length} nicht genehmigt. Nicht genehmigte Einträge bleiben ausgewählt.\n${outcome.failed.slice(0, 3).map(({ entry, error }) => `${entry.employeeName} · ${entry.workDate}: ${error}`).join('\n')}`, 'Genehmigung prüfen');
      } else {
        feedback.showSuccess(`${outcome.approvedIds.length} ${outcome.approvedIds.length === 1 ? 'Arbeitszeit wurde' : 'Arbeitszeiten wurden'} genehmigt.`, 'Genehmigung gespeichert');
      }
      try { if (scopeRef.current === scope) await refreshSavedData(); }
      catch { feedback.showWarning('Die Genehmigungen wurden verarbeitet. Die Übersicht konnte nicht vollständig aktualisiert werden. Bitte aktualisieren.', 'Übersicht aktualisieren'); }
    } catch (error) {
      feedback.showError(error instanceof Error ? error.message : 'Die Genehmigung konnte nicht gespeichert werden.', 'Genehmigung nicht abgeschlossen');
    } finally {
      if (loadingId !== undefined) feedback.dismiss(loadingId);
      setApprovalProgress(null);
      finishSave();
    }
  };

  const runReview = async (
    decision: 'approved' | 'rejected' | 'exported' | 'locked' | 'needs_clarification',
  ) => {
    if (!selectedId || !beginSave()) return;
    const loadingId = feedback.showLoading('Prüfung wird gespeichert…');
    try {
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
        feedback.showError(result.error, 'Prüfung nicht gespeichert');
        return;
      }
      feedback.showSuccess(
        `Status: ${WFM_OFFICE_TIME_STATUS_LABELS[result.data.reviewStatus]}`,
        'Prüfung gespeichert',
      );
      setReviewNote('');
      await refreshSavedData();
      setSelected(null);
    } catch (error) {
      feedback.showError(
        error instanceof Error ? error.message : 'Die Prüfung konnte nicht gespeichert werden.',
        'Prüfung nicht gespeichert',
      );
    } finally {
      feedback.dismiss(loadingId);
      finishSave();
    }
  };

  const runCorrection = async () => {
    if (!selectedId || !correctionReason.trim()) {
      feedback.showWarning(
        'Bitte geben Sie eine Korrekturbegründung ein.',
        'Begründung erforderlich',
      );
      return;
    }
    if (!beginSave()) return;
    const loadingId = feedback.showLoading('Arbeitszeitkorrektur wird gespeichert…');
    try {
      const result = await applyWfmOfficeTimeCorrection(
        tenantId,
        reviewerId,
        roleKey,
        {
          entryId: selectedId,
          reason: correctionReason,
          actualStartAt: editStartAt || null,
          actualEndAt: editEndAt || null,
          pauseMinutes: Number(editPauseMinutes),
        },
        selected,
      );
      if (!result.ok) {
        feedback.showError(result.error, 'Korrektur nicht gespeichert');
        return;
      }
      feedback.showSuccess('Die Arbeitszeitkorrektur wurde gespeichert.', 'Korrektur gespeichert');
      setCorrectionReason('');
      setSelected(result.data);
      await refreshSavedData();
    } catch (error) {
      feedback.showError(
        error instanceof Error ? error.message : 'Die Korrektur konnte nicht gespeichert werden.',
        'Korrektur nicht gespeichert',
      );
    } finally {
      feedback.dismiss(loadingId);
      finishSave();
    }
  };

  const runAdoptAssignment = async () => {
    if (!selectedId || !beginSave()) return;
    const reason = correctionReason.trim() || reviewNote.trim() || 'Übernahme aus Einsatz-Ist';
    const loadingId = feedback.showLoading('Einsatz-Ist wird als Buchung übernommen…');
    try {
      const result = await adoptWfmAssignmentActualToBooking(
        tenantId,
        reviewerId,
        roleKey,
        selectedId,
        reason,
        selected,
      );
      if (!result.ok) {
        feedback.showError(result.error, 'Übernahme nicht möglich');
        return;
      }
      feedback.showSuccess('Einsatz-Ist wurde als Buchung übernommen.', 'Übernahme gespeichert');
      setSelected(result.data);
      setEditStartAt(result.data.actualStartAt ?? '');
      setEditEndAt(result.data.actualEndAt ?? '');
      setEditPauseMinutes(String(result.data.pauseMinutes));
      setCorrectionReason('');
      await refreshSavedData();
    } catch (error) {
      feedback.showError(
        error instanceof Error ? error.message : 'Einsatz-Ist konnte nicht übernommen werden.',
        'Übernahme nicht möglich',
      );
    } finally {
      feedback.dismiss(loadingId);
      finishSave();
    }
  };

  const kpiItems = reviewQueueMode
    ? [
        {
          key: 'pending',
          label: 'Offen',
          value: String(kpis?.pendingReviewCount ?? 0),
          accent,
        },
        {
          key: 'missing',
          label: 'Fehlende Buchung',
          value: String(kpis?.missingBookings ?? 0),
        },
        {
          key: 'unplanned',
          label: 'Ungeplant',
          value: String(kpis?.unplannedBookings ?? 0),
        },
        {
          key: 'deviation',
          label: 'Abweichungen',
          value: String(kpis?.planningDeviations ?? 0),
        },
        {
          key: 'planned',
          label: 'Geplant',
          value: String(kpis?.plannedVisits ?? 0),
        },
        {
          key: 'recorded',
          label: 'Erfasst',
          value: String(kpis?.recordedVisits ?? 0),
        },
      ]
    : [
        {
          key: 'planned',
          label: 'Geplant',
          value: String(kpis?.plannedVisits ?? 0),
          accent,
        },
        {
          key: 'recorded',
          label: 'Erfasst',
          value: String(kpis?.recordedVisits ?? 0),
        },
        {
          key: 'missing',
          label: 'Fehlende Buchung',
          value: String(kpis?.missingBookings ?? 0),
        },
        {
          key: 'hours',
          label: 'Std. gesamt',
          value: String(kpis?.totalHours ?? 0),
        },
        {
          key: 'pending',
          label: 'Offen',
          value: String(kpis?.pendingReviewCount ?? 0),
        },
        {
          key: 'exported',
          label: 'Exportiert',
          value: String(kpis?.exportedCount ?? 0),
        },
      ];

  const periodOptions = [
    ...PRESETS.map((p) => ({
      key: p,
      label: WFM_OFFICE_PERIOD_PRESET_LABELS[p],
    })),
    { key: 'custom' as const, label: 'Freier Zeitraum' },
  ];

  const mainContent = (
    <>
      <WfmOfficeSectionHeading
        title={reviewQueueMode ? 'Offene Prüfungen' : 'Arbeitszeit-Historie'}
        subtitle={period ? officePeriodLabel(period) : overview ? officePeriodLabel(overview.period) : undefined}
      />

      <WfmOfficeFilterBar
        periodSlot={period ? <WfmOfficeStatusChip label={officePeriodLabel(period)} selected /> :
          <WfmOfficePeriodChips
            options={periodOptions}
            value={preset}
            onChange={(p) => { if (!savingRef.current) setPreset(p); }}
          />
        }
        secondarySlot={
          lockEmployeeFilter ? (
            <WfmOfficeStatusChip
              label={initialEmployeeName ?? 'Ausgewählte Person'}
              selected
            />
          ) : <>
            <WfmOfficeStatusChip
              label="Alle MA"
              selected={!filterEmployeeId}
              onPress={() => { if (!savingRef.current) setFilterEmployeeId(null); }}
            />
            {employeeOptions.map((emp) => (
              <WfmOfficeStatusChip
                key={emp.id}
                label={emp.name}
                selected={filterEmployeeId === emp.id}
                onPress={() => { if (!savingRef.current) setFilterEmployeeId(emp.id); }}
              />
            ))}
          </>
        }
        statusSlot={
          <>
            <WfmOfficeStatusChip
              label="Rot/Blau"
              selected={filterAmpel === 'rot_blau'}
              onPress={() => { if (!savingRef.current) setFilterAmpel((v) => (v === 'rot_blau' ? null : 'rot_blau')); }}
            />
            <WfmOfficeStatusChip
              label="Offen"
              selected={filterAmpel === 'pending'}
              onPress={() => { if (!savingRef.current) setFilterAmpel((v) => (v === 'pending' ? null : 'pending')); }}
            />
            <WfmOfficeStatusChip
              label="Office-Meldungen"
              selected={filterAmpel === 'office_msg'}
              onPress={() => { if (!savingRef.current) setFilterAmpel((v) => (v === 'office_msg' ? null : 'office_msg')); }}
            />
          </>
        }
      />

      {!period && preset === 'custom' ? (
        <View style={styles.customRow}>
          <View style={styles.dateField}>
            <CareDateInput
              label="Von"
              value={customFrom}
              onChange={value => { if (!savingRef.current) setCustomFrom(value); }}
              showFormatHint={false}
            />
          </View>
          <View style={styles.dateField}>
            <CareDateInput
              label="Bis"
              value={customTo}
              onChange={value => { if (!savingRef.current) setCustomTo(value); }}
              showFormatHint={false}
            />
          </View>
          <PremiumButton
            title="Anwenden"
            disabled={saving}
            variant="secondary"
            onPress={() => void historyQuery.refresh()}
            onDarkSurface
          />
        </View>
      ) : null}

      {kpis ? <WfmOfficeCompactKpiStrip items={kpiItems} maxVisible={6} /> : null}

      {historyQuery.loading ? <LoadingState message="Zeitbuchungen werden geladen…" presentation="inline" /> : null}
      {historyQuery.error ? <ErrorState title="Zeitbuchungen nicht verfügbar" message={historyQuery.error} onRetry={() => void historyQuery.refresh()} /> : null}
      {historyQuery.refreshError ? <InfoBanner message={historyQuery.refreshError} variant="warning" /> : null}
      {canQuickApprove ? (
        <View style={styles.approvalToolbar} testID="wfm-time-approval-toolbar">
          <Text style={styles.approvalTitle}>Arbeitszeiten genehmigen</Text>
          <Text style={styles.approvalHint}>Die Auswahl gilt für die angezeigten Personen, Filter und den gewählten Zeitraum. Nur offene Einträge mit vollständigen Ist-Zeiten sind auswählbar.</Text>
          <View style={styles.approvalActions}>
            <View style={styles.approvalAction}>
              <PremiumButton title={allApprovalSelected ? 'Auswahl aufheben' : 'Alle auswählen'} variant="secondary" fullWidth
                disabled={saving || historyQuery.loading || Boolean(historyQuery.error) || !approvalEntries.length}
                onPress={() => changeApprovalSelection()} />
            </View>
            <View style={styles.approvalAction}>
              <PremiumButton title={`Auswahl genehmigen (${selectedApprovalEntries.length})`} fullWidth
                disabled={saving || historyQuery.loading || Boolean(historyQuery.error) || !selectedApprovalEntries.length}
                onPress={() => void runQuickApproval(selectedApprovalEntries)} />
            </View>
            <View style={styles.approvalAction}>
              <PremiumButton title={`Alle genehmigen (${approvalEntries.length})`} variant="secondary" fullWidth
                disabled={saving || historyQuery.loading || Boolean(historyQuery.error) || !approvalEntries.length}
                onPress={() => void runQuickApproval(approvalEntries)} />
            </View>
          </View>
          <Text style={styles.approvalHint} accessibilityLiveRegion="polite">{approvalProgress ?? `${selectedApprovalEntries.length} von ${approvalEntries.length} genehmigungsfähigen Einträgen ausgewählt`}</Text>
        </View>
      ) : null}
      <WfmOfficeTimeEntryTable
        entries={entries}
        selectedId={selectedId}
        onSelect={selectEntry}
        reviewQueueMode={reviewQueueMode}
        approval={canQuickApprove ? {
          selectedIds: selectedApprovalIds,
          onToggle: changeApprovalSelection,
          onApprove: entry => void runQuickApproval([entry]),
          busy: saving || historyQuery.loading || Boolean(historyQuery.error),
        } : undefined}
      />

      <PremiumButton
        title="Aktualisieren"
        disabled={saving}
        variant="ghost"
        onPress={() => void historyQuery.refresh()}
        onDarkSurface
      />
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
      onClose={closeReviewDetail}
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
      exportedWarning={selected.exportStatus === 'exported'}
      embedded
      saving={saving}
    />
  ) : null;

  return (
    <View
      style={styles.root}
      testID={reviewQueueMode ? 'wfm-offene-pruefungen' : 'wfm-arbeitszeit-historie'}
    >
      <View style={styles.reviewQueueMain}>{mainContent}</View>
      <PlatformModal visible={Boolean(selected)} title={selected ? `Arbeitszeit bearbeiten · ${selected.employeeName}` : 'Arbeitszeit bearbeiten'}
        subtitle={selected ? `${selected.workDate} · ${WFM_OFFICE_WORK_KIND_LABELS[selected.workKind]}` : undefined}
        onClose={closeReviewDetail} variant="center" maxWidth={980} minWidth={300} maxHeightRatio={0.94}
        dismissOnBackdrop={!saving} bodyStyle={styles.reviewModalBody} isDirty={dirty}
        dirtyCloseMessage="Ungespeicherte Änderungen verwerfen und Buchung schließen?">
        {detailPanel}
      </PlatformModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', flexShrink: 0, gap: careSpacing.sm },
  approvalToolbar: { gap: 10, padding: 16, borderWidth: 1, borderColor: '#B8D1EA', borderRadius: 16, backgroundColor: '#F4F9FF' },
  approvalTitle: { color: '#0B2342', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  approvalHint: { color: '#31597F', fontSize: 13, lineHeight: 19 },
  approvalActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  approvalAction: { flexBasis: 220, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  reviewQueueMain: { flex: 1, minWidth: 0, gap: careSpacing.sm },
  reviewModalBody: {
    padding: careSpacing.sm,
    backgroundColor: WORKTIME_SURFACE.panel,
  },
  customRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginBottom: careSpacing.sm,
  },
  dateField: { minWidth: 180, flex: 1 },
});
