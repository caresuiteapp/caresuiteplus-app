import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
  listExportBatches,
  validateExportBatch,
  type WfmTimeExportJob,
  type WfmTimeExportValidationResult,
} from '@/lib/wfm/wfmTimeExportService';
import type { WfmTimeExportPeriod } from '@/lib/wfm/wfmTimeExportPolicy';

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

  const canExport = can('time.tracking.admin.export');
  const exportReady = Boolean(tenantId && userId);
  const period = useMemo(() => monthPeriod(year, month), [year, month]);

  const loadHistory = useCallback(async () => {
    if (!tenantId || !canExport) return;
    setHistoryLoading(true);
    const result = await listExportBatches(tenantId, roleKey, { limit: 20 });
    setHistoryLoading(false);
    if (result.ok) {
      setHistory(result.data);
    }
  }, [tenantId, roleKey, canExport]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setDraftJob(null);
    setValidation(null);
    setP22Error(null);
    setP22Message(null);
  }, [year, month]);

  const runExport = async (format: WfmExportFormat) => {
    if (!exportReady) return;
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
    if (!exportReady) return;
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
    if (!exportReady || !draftJob) return;
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
    if (!exportReady) return;
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
                  · {jobStatusLabel(job.status)} · {job.rowCount} Zeilen
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
});
