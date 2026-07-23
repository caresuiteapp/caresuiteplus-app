import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CareTimeInput } from '@/components/inputs';
import { ListFilterSelect, PremiumButton } from '@/components/ui';
import { lightSurfaceText, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatWfmDurationMinutes,
  formatWfmPlanTimeRange,
  formatWfmReviewQueueGesamtLabel,
  formatWfmReviewQueuePlannedDuration,
  formatWfmReviewQueueStartLabel,
  formatWfmReviewQueueEndLabel,
} from '@/lib/wfm/wfmDisplayHelpers';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import type { WfmOfficeAuditEntry } from '@/types/modules/wfmOfficeTimekeeping';
import {
  WFM_OFFICE_TIME_STATUS_LABELS,
  WFM_OFFICE_WORK_KIND_LABELS,
} from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { typography } from '@/theme';

type Props = {
  entry: WfmOfficeTimeEntry;
  auditEntries: WfmOfficeAuditEntry[];
  canCorrect: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClarification: () => void;
  onAdoptAssignment: () => void;
  onSaveCorrection: () => void;
  onClose: () => void;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
  correctionReason: string;
  onCorrectionReasonChange: (value: string) => void;
  editStartAt: string;
  editEndAt: string;
  editPauseMinutes: string;
  onEditStartAtChange: (value: string) => void;
  onEditEndAtChange: (value: string) => void;
  onEditPauseMinutesChange: (value: string) => void;
  actionMessage: string | null;
  exportedWarning?: boolean;
};

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const text = useAuroraAdaptiveText();
  return (
    <View style={[styles.section, { borderColor: text.border }]}>
      <Text style={[styles.sectionTitle, { color: lightSurfaceText.primary }]}>{title}</Text>
      {children}
    </View>
  );
}

function localTime(iso: string): string {
  if (!iso) return '';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function isoAtWorkDate(workDate: string, time: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${workDate}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function WfmOfficeTimeReviewDetailPanel({
  entry,
  auditEntries,
  canCorrect,
  onApprove,
  onReject,
  onClarification,
  onAdoptAssignment,
  onSaveCorrection,
  onClose,
  reviewNote,
  onReviewNoteChange,
  correctionReason,
  onCorrectionReasonChange,
  editStartAt,
  editEndAt,
  editPauseMinutes,
  onEditStartAtChange,
  onEditEndAtChange,
  onEditPauseMinutesChange,
  actionMessage,
  exportedWarning = false,
}: Props) {
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const display = resolveWfmOfficeTimeDisplay(entry);
  const [showHistory, setShowHistory] = useState(false);
  const [startTime, setStartTime] = useState(localTime(editStartAt));
  const [endTime, setEndTime] = useState(localTime(editEndAt));

  useEffect(() => setStartTime(localTime(editStartAt)), [editStartAt, entry.id]);
  useEffect(() => setEndTime(localTime(editEndAt)), [editEndAt, entry.id]);

  return (
    <View style={[styles.panel, { borderColor: accent }]} testID="wfm-office-review-detail-panel">
      <View style={styles.panelHeader}>
        <View style={styles.panelHeaderText}>
          <Text style={[styles.panelTitle, { color: lightSurfaceText.primary }]}>
            {entry.employeeName}
          </Text>
          <Text style={[styles.panelSubtitle, { color: lightSurfaceText.secondary }]}>
            {entry.workDate} · {WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]}
          </Text>
        </View>
        <PremiumButton title="Schließen" variant="ghost" onPress={onClose} onDarkSurface={false} />
      </View>

      <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelBody}>
        <SectionBlock title="Einsatz">
          <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
            {entry.clientLabel ?? entry.assignmentTitle ?? '—'}
          </Text>
          <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
            Status: {WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus]}
          </Text>
          {entry.flags.includes('missing_booking') ? (
            <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
              Fehlende Buchung — geplanter Einsatz ohne Ist-Zeit.
            </Text>
          ) : null}
        </SectionBlock>

        <SectionBlock title="Zeiten">
          <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>{display.displayPrimaryTimeLabel}</Text>
          {display.displaySecondaryTimeLabel ? (
            <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>{display.displaySecondaryTimeLabel}</Text>
          ) : null}
          <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
            Plan: {formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus)}
            {display.isPlannedOnly ? ` · ${formatWfmReviewQueuePlannedDuration(entry)}` : ''}
          </Text>
          {display.hasAssignmentActual ? (
            <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
              Einsatz-Ist: {formatWfmReviewQueueStartLabel(entry, null).replace('Start: ', '')} –{' '}
              {formatWfmReviewQueueEndLabel(entry, null).replace('Ende: ', '')}
            </Text>
          ) : null}
          {display.hasTimeEntry ? (
            <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
              Buchung: Netto {formatWfmDurationMinutes(entry.netMinutes)} · Pause{' '}
              {formatWfmDurationMinutes(entry.pauseMinutes)}
            </Text>
          ) : null}
          <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
            {formatWfmReviewQueueGesamtLabel(entry)} · Export: {entry.exportStatus}
          </Text>
        </SectionBlock>

        <SectionBlock title="Prüfung">
          {exportedWarning ? (
            <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>
              Warnung: Eintrag exportiert — Änderungen erfordern P2.3 Re-Export.
            </Text>
          ) : null}
          <TextInput
            value={reviewNote}
            onChangeText={onReviewNoteChange}
            placeholder="Kommentar / Ablehnungsgrund / Rückfrage"
            placeholderTextColor={lightSurfaceText.muted}
            style={[styles.input, { color: lightSurfaceText.primary, borderColor: text.border }]}
            multiline
          />
        </SectionBlock>

        {canCorrect && entry.canEdit !== false ? (
          <SectionBlock title="Aktionen">
            <View style={styles.structuredRow}>
              <View style={styles.structuredField}><CareTimeInput
                label="Beginn"
                value={startTime}
                onChange={(value) => {
                  setStartTime(value);
                  if (!value) onEditStartAtChange('');
                  const iso = isoAtWorkDate(entry.workDate, value);
                  if (iso) onEditStartAtChange(iso);
                }}
                showFormatHint={false}
              /></View>
              <View style={styles.structuredField}><CareTimeInput
                label="Ende"
                value={endTime}
                onChange={(value) => {
                  setEndTime(value);
                  if (!value) onEditEndAtChange('');
                  const iso = isoAtWorkDate(entry.workDate, value);
                  if (iso) onEditEndAtChange(iso);
                }}
                showFormatHint={false}
              /></View>
            </View>
            <ListFilterSelect
              label="Pause"
              value={editPauseMinutes}
              onChange={onEditPauseMinutesChange}
              options={[0, 5, 10, 15, 20, 30, 45, 60, 90, 120].map((minutes) => ({ key: String(minutes), label: `${minutes} Minuten` }))}
            />
            <TextInput
              value={correctionReason}
              onChangeText={onCorrectionReasonChange}
              placeholder="Korrektur-Begründung (Pflicht)"
              placeholderTextColor={lightSurfaceText.muted}
              style={[styles.input, { color: lightSurfaceText.primary, borderColor: text.border }]}
            />
            <View style={styles.actionRow}>
              {display.hasAssignmentActual ? (
                <PremiumButton title="Aus Einsatz übernehmen" variant="secondary" onPress={onAdoptAssignment} onDarkSurface={false} />
              ) : null}
              <PremiumButton title="Speichern" variant="secondary" onPress={onSaveCorrection} onDarkSurface={false} />
            </View>
            <View style={styles.actionRow}>
              {entry.canApprove !== false ? (
                <PremiumButton title="Freigeben" variant="secondary" onPress={onApprove} onDarkSurface={false} />
              ) : null}
              {entry.canRequestClarification !== false ? (
                <PremiumButton title="Rückfrage" variant="ghost" onPress={onClarification} onDarkSurface={false} />
              ) : null}
              {entry.canReject !== false ? (
                <PremiumButton title="Ablehnen" variant="ghost" onPress={onReject} onDarkSurface={false} />
              ) : null}
            </View>
          </SectionBlock>
        ) : null}

        <SectionBlock title="Historie">
          <PremiumButton
            title={showHistory ? 'Historie ausblenden' : 'Historie anzeigen'}
            variant="ghost"
            onPress={() => setShowHistory((v) => !v)}
            onDarkSurface={false}
          />
          {showHistory ? (
            <View style={styles.history}>
              {auditEntries.length === 0 ? (
                <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>Keine Audit-Einträge.</Text>
              ) : (
                auditEntries.map((a) => (
                  <Text key={a.id} style={[styles.line, { color: lightSurfaceText.secondary }]}>
                    {a.createdAt.slice(0, 16)} · {a.summary}
                    {a.reason ? ` — ${a.reason}` : ''}
                  </Text>
                ))
              )}
            </View>
          ) : null}
        </SectionBlock>

        {actionMessage ? (
          <Text style={[styles.line, { color: lightSurfaceText.secondary }]}>{actionMessage}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: 760,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#173B70',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  panelHeaderText: { flex: 1, gap: 2 },
  panelTitle: { ...typography.h3, fontWeight: '800' },
  panelSubtitle: { ...typography.body, fontSize: 12 },
  panelScroll: { flex: 1 },
  panelBody: { padding: careSpacing.md, gap: careSpacing.sm },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: careSpacing.md,
    gap: 6,
    backgroundColor: 'rgba(248,250,252,0.86)',
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  line: { ...typography.body, fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs, marginTop: 4 },
  structuredRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  structuredField: { minWidth: 130, flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: careSpacing.xs,
    minHeight: 36,
    ...typography.caption,
  },
  history: { gap: 4, marginTop: 4 },
});
