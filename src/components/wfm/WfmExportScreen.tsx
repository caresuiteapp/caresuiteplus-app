import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { triggerCsvDownload } from '@/lib/csv/csvDownload';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createWfmExportJob, type WfmExportFormat } from '@/lib/wfm/wfmExportService';
import { getWfmOfficeExportWarnings } from '@/lib/wfm/wfmOfficeTimekeepingService';
import {
  buildInternalCsv,
  createExportDraft,
  finalizeExportBatch,
  validateExportBatch,
  type WfmTimeExportItem,
  type WfmTimeExportJob,
  type WfmTimeExportReviewRow,
  type WfmTimeExportValidationResult,
} from '@/lib/wfm/wfmTimeExportService';
import {
  draftReviewedTimeCorrectionExport,
  exportJobTypeLabel,
  finalizeReviewedTimeCorrectionExport,
  getExportItemTimeline,
  getReviewExportState,
  listReviewedTimeCorrectionCandidates,
  listReviewedTimeExports,
  previewChangedAfterExport,
  reviewExportBadgeLabel,
  validateCorrectionExportDraft,
  type WfmReviewDriftPreview,
  type WfmReviewExportState,
} from '@/lib/wfm/wfmTimeCorrectionExportService';
import { WFM_CORRECTION_REASON_MIN_LENGTH } from '@/lib/wfm/wfmTimeExportPolicy';
import type { WfmTimeExportPeriod } from '@/lib/wfm/wfmTimeExportPolicy';
import { listReviewActionsForReviews, type WfmTimeReviewAction } from '@/lib/wfm/wfmTimeReviewService';

function triggerWebFileDownload(content: string, mimeType: string, fileName: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  try {
    if (content.startsWith('data:')) {
      const anchor = document.createElement('a');
      anchor.href = content;
      anchor.download = fileName;
      anchor.click();
      return;
    }

    if (mimeType.includes('csv') || mimeType.includes('text/plain')) {
      triggerCsvDownload(content, fileName);
      return;
    }

    if (typeof Blob !== 'undefined' && typeof URL?.createObjectURL === 'function') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  } catch {
    // Headless or restricted browser — UI preview remains available.
  }
}

function monthPeriod(year: number, month: number): WfmTimeExportPeriod {
  const endDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  };
}

function formatPeriodLabel(period: WfmTimeExportPeriod): string {
  if (period.startDate === period.endDate) {
    return new Date(`${period.startDate}T12:00:00`).toLocaleDateString('de-DE');
  }
  const start = new Date(`${period.startDate}T12:00:00`).toLocaleDateString('de-DE');
  const end = new Date(`${period.endDate}T12:00:00`).toLocaleDateString('de-DE');
  return `${start} – ${end}`;
}

function jobStatusLabel(status: WfmTimeExportJob['status']): string {
  const labels: Record<WfmTimeExportJob['status'], string> = {
    draft: 'Entwurf',
    validated: 'Validiert',
    finalized: 'Finalisiert',
    canceled: 'Abgebrochen',
    pending: 'Ausstehend',
    processing: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    failed: 'Fehlgeschlagen',
  };
  return labels[status] ?? status;
}

function itemStatusLabel(status: WfmTimeExportItem['itemStatus'] | undefined): string {
  switch (status) {
    case 'active':
      return 'Aktiv';
    case 'superseded':
      return 'Superseded';
    case 'voided':
      return 'Voided';
    default:
      return status ?? '—';
  }
}

function formatDriftPreview(preview: WfmReviewDriftPreview | null): string {
  if (!preview) return 'Keine Drift-Daten.';
  if (!preview.changed) return 'Keine exportrelevante Änderung erkannt.';
  const deltaFields = preview.delta?.changedFields?.join(', ') ?? '—';
  const deltaMinutes =
    preview.delta?.deltaMinutes != null ? String(preview.delta.deltaMinutes) : '—';
  return `Geändert: ${preview.previousHash} → ${preview.currentHash} · Felder: ${deltaFields} · Δ Minuten: ${deltaMinutes}`;
}

export function WfmExportScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [lastFormat, setLastFormat] = useState<WfmExportFormat>('csv');
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);

  const [p22Loading, setP22Loading] = useState(false);
  const [p22Error, setP22Error] = useState<string | null>(null);
  const [p22Message, setP22Message] = useState<string | null>(null);
  const [draftJob, setDraftJob] = useState<WfmTimeExportJob | null>(null);
  const [validation, setValidation] = useState<WfmTimeExportValidationResult | null>(null);
  const [history, setHistory] = useState<WfmTimeExportJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [p23Loading, setP23Loading] = useState(false);
  const [p23Error, setP23Error] = useState<string | null>(null);
  const [p23Message, setP23Message] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<WfmTimeExportReviewRow[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [driftPreview, setDriftPreview] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] = useState<WfmReviewExportState | null>(null);
  const [itemTimeline, setItemTimeline] = useState<WfmTimeExportItem[]>([]);
  const [reviewActions, setReviewActions] = useState<WfmTimeReviewAction[]>([]);
  const [correctionDraftJob, setCorrectionDraftJob] = useState<WfmTimeExportJob | null>(null);
  const [correctionPreviewItems, setCorrectionPreviewItems] = useState<WfmTimeExportItem[]>([]);
  const [correctionValidated, setCorrectionValidated] = useState(false);

  const canExport = can('time.tracking.admin.export');
  const exportReady = Boolean(tenantId && userId);
  const period = useMemo(() => monthPeriod(year, month), [year, month]);

  const loadHistory = useCallback(async () => {
    if (!tenantId || !canExport) return;
    setHistoryLoading(true);
    const result = await listReviewedTimeExports(tenantId, roleKey, 20);
    setHistoryLoading(false);
    if (result.ok) {
      setHistory(result.data);
    }
  }, [tenantId, roleKey, canExport]);

  const loadCorrectionCandidates = useCallback(async () => {
    if (!tenantId || !canExport) return;
    setP23Loading(true);
    setP23Error(null);
    const listed = await listReviewedTimeCorrectionCandidates(tenantId, roleKey);
    setP23Loading(false);
    if (!listed.ok) {
      setP23Error(listed.error);
      return;
    }
    setCandidates(listed.data);
  }, [tenantId, roleKey, canExport]);

  const loadReviewDetail = useCallback(
    async (reviewId: string) => {
      if (!tenantId || !canExport) return;
      setSelectedReviewId(reviewId);
      setCorrectionValidated(false);
      setCorrectionDraftJob(null);
      setCorrectionPreviewItems([]);
      setP23Error(null);

      const [state, preview, actions] = await Promise.all([
        getReviewExportState(tenantId, roleKey, reviewId),
        previewChangedAfterExport(tenantId, roleKey, reviewId),
        listReviewActionsForReviews(tenantId, [reviewId]),
      ]);

      if (!state.ok) {
        setP23Error(state.error);
        return;
      }
      if (!preview.ok) {
        setP23Error(preview.error);
        return;
      }
      if (!actions.ok) {
        setP23Error(actions.error);
        return;
      }

      setReviewDetail(state.data);
      setDriftPreview(formatDriftPreview(preview.data));
      setReviewActions(actions.data);

      const logicalKey =
        state.data?.activeItem?.logicalReferenceKey ??
        state.data?.activeItem?.referenceKey ??
        null;
      if (logicalKey) {
        const timeline = await getExportItemTimeline(tenantId, roleKey, logicalKey);
        if (timeline.ok) {
          setItemTimeline(timeline.data);
        }
      } else {
        setItemTimeline([]);
      }
    },
    [tenantId, roleKey, canExport],
  );

  useEffect(() => {
    void loadHistory();
    void loadCorrectionCandidates();
  }, [loadHistory, loadCorrectionCandidates]);

  useEffect(() => {
    setDraftJob(null);
    setValidation(null);
    setP22Error(null);
    setP22Message(null);
  }, [year, month]);

  const runExport = async (format: WfmExportFormat) => {
    if (!exportReady || !tenantId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setExportWarnings([]);

    const warnResult = await getWfmOfficeExportWarnings(tenantId, roleKey, 'this_month');
    if (warnResult.ok && warnResult.data.warnings.length) {
      setExportWarnings(warnResult.data.warnings);
    }

    const result = await createWfmExportJob(tenantId, userId, roleKey, year, month, format);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLastPreview(result.data.content);
    setLastFormat(format);
    triggerWebFileDownload(result.data.content, result.data.mimeType, result.data.fileName);

    const formatLabels: Record<WfmExportFormat, string> = {
      csv: 'CSV',
      pdf: 'PDF',
      datev: 'DATEV',
    };
    setMessage(
      `${formatLabels[format]}-Export erstellt: ${result.data.rowCount} Datensätze (Prüfsumme ${result.data.checksum}).`,
    );
  };

  const handlePrepareExport = async () => {
    if (!exportReady || !tenantId) return;
    setP22Loading(true);
    setP22Error(null);
    setP22Message(null);
    setDraftJob(null);
    setValidation(null);

    const draftResult = await createExportDraft(tenantId, userId, roleKey, period);
    if (!draftResult.ok) {
      setP22Loading(false);
      setP22Error(draftResult.error);
      return;
    }

    const validationResult = await validateExportBatch(tenantId, roleKey, draftResult.data.job.id);
    setP22Loading(false);

    if (!validationResult.ok) {
      setP22Error(validationResult.error);
      return;
    }

    setDraftJob(draftResult.data.job);
    setValidation(validationResult.data);
    setP22Message(
      `Export vorbereitet: ${draftResult.data.exportableCount} exportierbar, ${draftResult.data.blockedCount} blockiert.`,
    );
  };

  const handleFinalizeExport = async () => {
    if (!exportReady || !draftJob || !tenantId) return;
    setP22Loading(true);
    setP22Error(null);

    const result = await finalizeExportBatch(tenantId, userId, roleKey, draftJob.id);
    setP22Loading(false);

    if (!result.ok) {
      setP22Error(result.error);
      return;
    }

    setDraftJob(result.data.job);
    setValidation(null);
    setP22Message(
      `Export finalisiert: ${result.data.exportedCount} Einträge übernommen.`,
    );
    void loadHistory();
  };

  const handleDownloadInternalCsv = async (jobId: string, periodLabel: string) => {
    if (!exportReady || !tenantId) return;
    setP22Loading(true);
    setP22Error(null);

    const result = await buildInternalCsv(tenantId, roleKey, jobId);
    setP22Loading(false);

    if (!result.ok) {
      setP22Error(result.error);
      return;
    }

    const fileName = `wfm-review-export-${periodLabel.replace(/\./g, '-')}.csv`;
    triggerWebFileDownload(result.data.csv, 'text/csv', fileName);
    setP22Message(`Interner CSV-Download: ${result.data.rowCount} Zeilen.`);
  };

  const handlePreviewDrift = async (reviewId: string) => {
    await loadReviewDetail(reviewId);
  };

  const handleDraftCorrection = async () => {
    if (!exportReady || !tenantId || !selectedReviewId) return;
    if (correctionReason.trim().length < WFM_CORRECTION_REASON_MIN_LENGTH) {
      setP23Error(`Korrekturgrund erforderlich (min. ${WFM_CORRECTION_REASON_MIN_LENGTH} Zeichen).`);
      return;
    }
    const review = candidates.find((c) => c.id === selectedReviewId) ?? reviewDetail;
    if (!review?.lastExportJobId) {
      setP23Error('Ursprungs-Export-Job fehlt.');
      return;
    }

    setP23Loading(true);
    setP23Error(null);
    setCorrectionValidated(false);
    const result = await draftReviewedTimeCorrectionExport(tenantId, userId, roleKey, {
      reviewIds: [selectedReviewId],
      correctionOfExportJobId: review.lastExportJobId,
      reason: correctionReason.trim(),
    });
    setP23Loading(false);
    if (!result.ok) {
      setP23Error(result.error);
      return;
    }
    setCorrectionDraftJob(result.data.job);
    setCorrectionPreviewItems(result.data.previewItems);
    setP23Message(
      `Korrekturentwurf erstellt: ${result.data.previewItems.length} Item(s). Bitte Preview prüfen und validieren.`,
    );
  };

  const handleValidateCorrection = async () => {
    if (!exportReady || !tenantId || !correctionDraftJob) return;
    if (correctionReason.trim().length < WFM_CORRECTION_REASON_MIN_LENGTH) {
      setP23Error(`Korrekturgrund erforderlich (min. ${WFM_CORRECTION_REASON_MIN_LENGTH} Zeichen).`);
      return;
    }
    setP23Loading(true);
    setP23Error(null);
    const validation = await validateCorrectionExportDraft(
      tenantId,
      roleKey,
      correctionDraftJob.id,
      correctionReason.trim(),
    );
    setP23Loading(false);
    if (!validation.ok) {
      setP23Error(validation.error);
      return;
    }
    if (!validation.data.valid) {
      setP23Error(validation.data.reasonError ?? 'Korrekturentwurf ungültig.');
      setCorrectionValidated(false);
      return;
    }
    setCorrectionValidated(true);
    setP23Message('Korrekturentwurf validiert — Finalize freigegeben.');
  };

  const handleFinalizeCorrection = async () => {
    if (!exportReady || !tenantId || !correctionDraftJob) return;
    if (correctionReason.trim().length < WFM_CORRECTION_REASON_MIN_LENGTH) {
      setP23Error(`Korrekturgrund erforderlich (min. ${WFM_CORRECTION_REASON_MIN_LENGTH} Zeichen).`);
      return;
    }
    if (!correctionValidated || correctionPreviewItems.length === 0) {
      setP23Error('Finalize nur nach Preview und Validate möglich.');
      return;
    }

    setP23Loading(true);
    setP23Error(null);
    const result = await finalizeReviewedTimeCorrectionExport(
      tenantId,
      userId,
      roleKey,
      correctionDraftJob.id,
      correctionReason.trim(),
    );
    setP23Loading(false);
    if (!result.ok) {
      setP23Error(result.error);
      return;
    }
    setP23Message(
      'Korrekturexport finalisiert. Ursprünglicher Export bleibt unverändert; altes Item wurde superseded.',
    );
    setCorrectionDraftJob(null);
    setCorrectionPreviewItems([]);
    setCorrectionValidated(false);
    setSelectedReviewId(null);
    setReviewDetail(null);
    setItemTimeline([]);
    void loadHistory();
    void loadCorrectionCandidates();
  };

  const correctionReasonValid = useMemo(
    () => correctionReason.trim().length >= WFM_CORRECTION_REASON_MIN_LENGTH,
    [correctionReason],
  );

  if (!canExport) {
    return (
      <ScreenShell title="Arbeitszeit-Export">
        <View testID="wfm-export-screen" accessibilityLabel="Arbeitszeit-Export">
          <LockedActionBanner
            message={check('time.tracking.admin.export').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Arbeitszeit-Export"
      subtitle="Geprüfte Zeiten exportieren und Legacy-Formate"
      showBack={false}
      scroll
    >
      <View testID="wfm-export-screen" accessibilityLabel="Arbeitszeit-Export">
        <Text style={styles.periodLabel}>Zeitraum: {String(month).padStart(2, '0')}/{year}</Text>

        <SectionPanel title="Geprüfter Zeitenexport (P2.2)" subtitle="Freigegebene Reviews final exportieren">
          <SectionPanel title="Zeitraum">
            <Text style={styles.periodDetail}>{formatPeriodLabel(period)}</Text>
            <View style={styles.periodRow}>
              <PremiumButton
                title="◀ Monat"
                variant="ghost"
                testID="wfm-p22-period-prev"
                onPress={() => {
                  if (month === 1) {
                    setMonth(12);
                    setYear((y) => y - 1);
                  } else {
                    setMonth((m) => m - 1);
                  }
                }}
              />
              <PremiumButton
                title="Monat ▶"
                variant="ghost"
                testID="wfm-p22-period-next"
                onPress={() => {
                  if (month === 12) {
                    setMonth(1);
                    setYear((y) => y + 1);
                  } else {
                    setMonth((m) => m + 1);
                  }
                }}
              />
            </View>
          </SectionPanel>

          {!exportReady ? (
            <InfoBanner message="Sitzung wird geladen — Export starten, sobald Mandant und Benutzer bereit sind." />
          ) : null}

          {p22Loading ? <LoadingState message="Review-Export wird verarbeitet…" /> : null}

          <PremiumButton
            title="Export vorbereiten"
            testID="wfm-p22-prepare-export"
            onPress={() => void handlePrepareExport()}
            disabled={p22Loading || !exportReady}
          />

          {draftJob ? (
            <SectionPanel title="Export-Entwurf">
              <Text style={styles.metaLine}>
                Status: {jobStatusLabel(draftJob.status)} · {draftJob.rowCount} Zeilen
              </Text>
              <Text style={styles.metaLine} numberOfLines={1}>
                Batch: {draftJob.id}
              </Text>
            </SectionPanel>
          ) : (
            <EmptyState
              title="Kein Export-Entwurf"
              message="Wählen Sie einen Zeitraum und bereiten Sie den Export vor, um exportierbare und blockierte Einträge zu sehen."
            />
          )}

          {validation ? (
            <SectionPanel
              title="Exportierbare Einträge"
              subtitle={`${validation.exportableCount} freigegeben`}
            >
              {validation.exportableReviews.length === 0 ? (
                <EmptyState
                  title="Keine exportierbaren Einträge"
                  message="Im gewählten Zeitraum sind keine freigegebenen Reviews exportierbar."
                />
              ) : (
                validation.exportableReviews.map((review) => (
                  <Text key={review.id} style={styles.entryLine}>
                    {review.workDate} · {review.entryKind} · {review.referenceKey}
                  </Text>
                ))
              )}
            </SectionPanel>
          ) : null}

          {validation && validation.blockedCount > 0 ? (
            <SectionPanel
              title="Blockierte Einträge"
              subtitle={`${validation.blockedCount} mit Grund`}
            >
              {validation.blockedReviews.map((blocked) => (
                <Text key={blocked.reviewId} style={styles.blockedLine}>
                  {blocked.referenceKey}: {blocked.reasonLabel}
                </Text>
              ))}
            </SectionPanel>
          ) : null}

          {draftJob && draftJob.status !== 'finalized' && draftJob.status !== 'canceled' ? (
            <PremiumButton
              title="Export finalisieren"
              testID="wfm-p22-finalize-export"
              variant="secondary"
              onPress={() => void handleFinalizeExport()}
              disabled={
                p22Loading ||
                !exportReady ||
                !validation?.valid ||
                validation.exportableCount === 0
              }
            />
          ) : null}

          {draftJob?.status === 'finalized' ? (
            <PremiumButton
              title="Internen CSV herunterladen"
              testID="wfm-p22-download-csv"
              variant="secondary"
              onPress={() =>
                void handleDownloadInternalCsv(
                  draftJob.id,
                  formatPeriodLabel({
                    startDate: draftJob.periodStart ?? period.startDate,
                    endDate: draftJob.periodEnd ?? period.endDate,
                  }),
                )
              }
              disabled={p22Loading || !exportReady}
            />
          ) : null}

          <SectionPanel title="Export-Historie">
            {historyLoading ? <LoadingState message="Historie wird geladen…" /> : null}
            {!historyLoading && history.length === 0 ? (
              <EmptyState
                title="Keine Export-Batches"
                message="Finalisierte Review-Exports erscheinen hier."
              />
            ) : null}
            {history.map((job) => (
              <View key={job.id} style={styles.historyRow}>
                <Text style={styles.entryLine}>
                  {formatPeriodLabel({
                    startDate: job.periodStart ?? period.startDate,
                    endDate: job.periodEnd ?? period.endDate,
                  })}{' '}
                  · {exportJobTypeLabel(job.exportType)} · {jobStatusLabel(job.status)} · {job.rowCount} Zeilen
                  {job.correctionSequence ? ` · Korrektur #${job.correctionSequence}` : ''}
                </Text>
                {job.status === 'finalized' ? (
                  <PremiumButton
                    title="CSV"
                    variant="ghost"
                    testID={`wfm-p22-history-csv-${job.id}`}
                    onPress={() =>
                      void handleDownloadInternalCsv(
                        job.id,
                        formatPeriodLabel({
                          startDate: job.periodStart ?? period.startDate,
                          endDate: job.periodEnd ?? period.endDate,
                        }),
                      )
                    }
                    disabled={p22Loading || !exportReady}
                  />
                ) : null}
              </View>
            ))}
          </SectionPanel>

          {p22Message ? <SuccessState title="Review-Export" message={p22Message} /> : null}
          {p22Error ? (
            <ErrorState title="Review-Export Fehler" message={p22Error} onRetry={() => setP22Error(null)} />
          ) : null}
        </SectionPanel>

        <View testID="wfm-p23-section">
        <SectionPanel
          title="Korrektur & Re-Export (P2.3)"
          subtitle="Geänderte Reviews nach Export korrigierend re-exportieren"
        >
          <InfoBanner
            message="Dieser Vorgang erzeugt einen Korrekturexport. Der ursprüngliche Export bleibt unverändert und wird fachlich superseded."
          />

          {p23Loading ? <LoadingState message="Korrekturexport wird verarbeitet…" /> : null}

          <PremiumButton
            title="Kandidaten aktualisieren"
            testID="wfm-p23-refresh-candidates"
            variant="ghost"
            onPress={() => void loadCorrectionCandidates()}
            disabled={p23Loading || !exportReady}
          />

          <SectionPanel title="Reviews mit Korrekturbedarf" subtitle={`${candidates.length} Kandidat(en)`}>
            {candidates.length === 0 ? (
              <EmptyState
                title="Keine Korrekturkandidaten"
                message="Reviews mit changed_after_export erscheinen hier."
              />
            ) : (
              candidates.map((review) => (
                <View key={review.id} style={styles.historyRow}>
                  <Text style={styles.entryLine}>
                    {review.workDate} · {review.referenceKey} · {reviewExportBadgeLabel(review)} · v
                    {review.exportVersion ?? 1}
                    {review.pendingReexportJobId ? ` · Entwurf ${review.pendingReexportJobId.slice(0, 8)}…` : ''}
                  </Text>
                  <PremiumButton
                    title={selectedReviewId === review.id ? 'Ausgewählt' : 'Auswählen'}
                    testID={`wfm-p23-select-${review.id}`}
                    variant="ghost"
                    onPress={() => void loadReviewDetail(review.id)}
                    disabled={p23Loading || !exportReady}
                  />
                </View>
              ))
            )}
          </SectionPanel>

          {reviewDetail ? (
            <SectionPanel title="Review-Detail" subtitle={reviewDetail.referenceKey}>
              <Text style={styles.metaLine}>export_status: {reviewDetail.exportStatus}</Text>
              <Text style={styles.metaLine}>export_version: {reviewDetail.exportVersion ?? 1}</Text>
              <Text style={styles.metaLine}>
                changed_after_export: {reviewDetail.changedAfterExport ? 'ja' : 'nein'}
              </Text>
              {reviewDetail.changedAfterExportReason ? (
                <Text style={styles.metaLine}>Grund: {reviewDetail.changedAfterExportReason}</Text>
              ) : null}
              <Text style={styles.metaLine}>
                latest_export_item_id: {reviewDetail.latestExportItemId ?? '—'}
              </Text>
              <Text style={styles.metaLine}>
                pending_reexport_job_id: {reviewDetail.pendingReexportJobId ?? '—'}
              </Text>
              {reviewDetail.activeItem ? (
                <>
                  <Text style={styles.metaLine}>
                    logical_reference_key: {reviewDetail.activeItem.logicalReferenceKey ?? reviewDetail.activeItem.referenceKey}
                  </Text>
                  <Text style={styles.metaLine}>
                    export_sequence: {reviewDetail.activeItem.exportSequence ?? 1}
                  </Text>
                  <Text style={styles.metaLine}>
                    item_status: {itemStatusLabel(reviewDetail.activeItem.itemStatus)}
                  </Text>
                  <Text style={styles.metaLine}>payload_hash: {reviewDetail.activeItem.payloadHash}</Text>
                  {reviewDetail.activeItem.previousPayloadHash ? (
                    <Text style={styles.metaLine}>
                      previous_payload_hash: {reviewDetail.activeItem.previousPayloadHash}
                    </Text>
                  ) : null}
                </>
              ) : null}
              {driftPreview ? (
                <Text style={styles.metaLine} testID="wfm-p23-drift-preview">
                  {driftPreview}
                </Text>
              ) : null}
            </SectionPanel>
          ) : null}

          {itemTimeline.length > 0 ? (
            <SectionPanel title="Export-Item Timeline">
              {itemTimeline.map((item) => (
                <Text key={item.id} style={styles.entryLine}>
                  seq {item.exportSequence ?? 1} · {itemStatusLabel(item.itemStatus)} · {item.referenceKey} ·{' '}
                  {item.payloadHash}
                </Text>
              ))}
            </SectionPanel>
          ) : null}

          {reviewActions.length > 0 ? (
            <SectionPanel title="Action-Historie">
              {reviewActions.map((action) => (
                <Text key={action.id} style={styles.entryLine}>
                  {action.action}
                  {action.comment ? `: ${action.comment}` : ''}
                </Text>
              ))}
            </SectionPanel>
          ) : null}

          <SectionPanel title="Korrekturgrund" subtitle={`Mindestens ${WFM_CORRECTION_REASON_MIN_LENGTH} Zeichen`}>
            <TextInput
              testID="wfm-p23-correction-reason"
              value={correctionReason}
              onChangeText={setCorrectionReason}
              placeholder="Grund für Korrekturexport"
              style={styles.reasonInput}
              editable={!p23Loading && exportReady}
            />
          </SectionPanel>

          <PremiumButton
            title="Drift-Preview aktualisieren"
            testID="wfm-p23-preview-drift"
            variant="ghost"
            onPress={() => selectedReviewId && void handlePreviewDrift(selectedReviewId)}
            disabled={p23Loading || !exportReady || !selectedReviewId}
          />

          <PremiumButton
            title="Korrekturentwurf erstellen"
            testID="wfm-p23-draft-correction"
            onPress={() => void handleDraftCorrection()}
            disabled={p23Loading || !exportReady || !selectedReviewId || !correctionReasonValid}
          />

          {correctionPreviewItems.length > 0 ? (
            <SectionPanel title="Korrektur-Preview vor Finalize">
              <View testID="wfm-p23-correction-preview">
              {correctionPreviewItems.map((item) => (
                <Text key={item.id} style={styles.entryLine}>
                  seq {item.exportSequence} · {itemStatusLabel(item.itemStatus)} · {item.referenceKey} · hash{' '}
                  {item.payloadHash}
                  {item.previousPayloadHash ? ` · prev ${item.previousPayloadHash}` : ''}
                </Text>
              ))}
              </View>
            </SectionPanel>
          ) : null}

          {correctionDraftJob ? (
            <>
              <PremiumButton
                title="Korrekturentwurf validieren"
                testID="wfm-p23-validate-correction"
                variant="secondary"
                onPress={() => void handleValidateCorrection()}
                disabled={p23Loading || !exportReady || !correctionReasonValid}
              />
              <PremiumButton
                title="Korrekturexport finalisieren (RPC)"
                testID="wfm-p23-finalize-correction"
                variant="secondary"
                onPress={() => void handleFinalizeCorrection()}
                disabled={
                  p23Loading ||
                  !exportReady ||
                  !correctionReasonValid ||
                  !correctionValidated ||
                  correctionPreviewItems.length === 0
                }
              />
            </>
          ) : null}

          {p23Message ? <SuccessState title="Korrekturexport" message={p23Message} /> : null}
          {p23Error ? (
            <ErrorState title="Korrekturexport Fehler" message={p23Error} onRetry={() => setP23Error(null)} />
          ) : null}
        </SectionPanel>
        </View>

        <SectionPanel title="Legacy-Export" subtitle="CSV, PDF und DATEV für Lohnbuchhaltung">
          <SectionPanel title="Zeitraum">
            <View style={styles.periodRow}>
              <PremiumButton
                title="◀ Monat"
                variant="ghost"
                onPress={() => {
                  if (month === 1) {
                    setMonth(12);
                    setYear((y) => y - 1);
                  } else {
                    setMonth((m) => m - 1);
                  }
                }}
              />
              <PremiumButton
                title="Monat ▶"
                variant="ghost"
                onPress={() => {
                  if (month === 12) {
                    setMonth(1);
                    setYear((y) => y + 1);
                  } else {
                    setMonth((m) => m + 1);
                  }
                }}
              />
            </View>
          </SectionPanel>

          <SectionPanel title="Export starten">
            {loading ? <LoadingState message="Export wird erstellt…" /> : null}
            {exportWarnings.map((w) => (
              <InfoBanner key={w} variant="warning" message={w} />
            ))}
            <PremiumButton
              title="CSV exportieren"
              testID="wfm-export-csv"
              onPress={() => void runExport('csv')}
              disabled={loading || !exportReady}
            />
            <PremiumButton
              title="PDF exportieren"
              variant="secondary"
              onPress={() => void runExport('pdf')}
              disabled={loading || !exportReady}
            />
            <PremiumButton
              title="DATEV LOHN exportieren"
              variant="secondary"
              onPress={() => void runExport('datev')}
              disabled={loading || !exportReady}
            />
          </SectionPanel>

          {lastPreview ? (
            <SectionPanel title="Export-Vorschau" subtitle={`Format: ${lastFormat.toUpperCase()}`}>
              <Text style={styles.preview} numberOfLines={12}>
                {lastFormat === 'pdf' && lastPreview.startsWith('data:')
                  ? '[PDF-Datei erzeugt — Download im Browser verfügbar]'
                  : lastPreview.split('\n').slice(0, 8).join('\n')}
              </Text>
            </SectionPanel>
          ) : null}

          {message ? <SuccessState title="Erfolg" message={message} /> : null}
          {error ? <ErrorState title="Fehler" message={error} onRetry={() => setError(null)} /> : null}
        </SectionPanel>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  periodLabel: { marginBottom: careSpacing.md, fontWeight: '600' },
  periodDetail: { marginBottom: careSpacing.sm },
  periodRow: { flexDirection: 'row', gap: careSpacing.sm },
  preview: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  metaLine: { marginBottom: careSpacing.xs, fontSize: 13 },
  entryLine: { marginBottom: careSpacing.xs, fontSize: 13 },
  blockedLine: { marginBottom: careSpacing.xs, fontSize: 13, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
    marginBottom: careSpacing.xs,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: careSpacing.sm,
    minHeight: 44,
  },
});
