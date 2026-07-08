import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
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

export function WfmOfficeTimeReviewDetailPanel({
  entry,
  auditEntries,
  canCorrect,
  onApprove,
  onReject,
  onClarification,
  onAdoptAssignment,
  onSaveCorrection,
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
  const display = resolveWfmOfficeTimeDisplay(entry);
  const [showHistory, setShowHistory] = useState(true);

  return (
    <View style={[styles.detail, { borderColor: text.border }]}>
      <Text style={{ color: text.primary, ...typography.h3 }}>
        {entry.employeeName} — {entry.workDate}
      </Text>

      <Text style={{ color: text.secondary, ...typography.caption }}>Stammdaten</Text>
      <Text style={{ color: text.secondary, ...typography.caption }}>
        {entry.clientLabel ?? entry.assignmentTitle ?? '—'} ·{' '}
        {WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]} · Status{' '}
        {WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus]}
      </Text>

      <Text style={{ color: text.secondary, ...typography.caption, marginTop: careSpacing.xs }}>
        Zeiten
      </Text>
      <Text style={{ color: text.secondary, ...typography.caption }}>
        {display.displayPrimaryTimeLabel}
      </Text>
      {display.displaySecondaryTimeLabel ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {display.displaySecondaryTimeLabel}
        </Text>
      ) : null}
      <Text style={{ color: text.secondary, ...typography.caption }}>
        Plan: {formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus)}
        {display.isPlannedOnly ? ` · Geplante Dauer: ${formatWfmReviewQueuePlannedDuration(entry)}` : ''}
      </Text>
      {display.hasAssignmentActual ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Einsatz-Ist: {formatWfmReviewQueueStartLabel(entry, null).replace('Start: ', '')} –{' '}
          {formatWfmReviewQueueEndLabel(entry, null).replace('Ende: ', '')}
        </Text>
      ) : null}
      {display.hasTimeEntry ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Buchung: Netto {formatWfmDurationMinutes(entry.netMinutes)} · Pause{' '}
          {formatWfmDurationMinutes(entry.pauseMinutes)}
        </Text>
      ) : null}
      {display.displaySource === 'approved_time_entry' ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Freigegeben: {formatWfmDurationMinutes(display.approvedDurationMinutes)}
        </Text>
      ) : null}
      <Text style={{ color: text.secondary, ...typography.caption }}>
        {formatWfmReviewQueueGesamtLabel(entry)} · Export: {entry.exportStatus}
      </Text>

      {entry.flags.includes('missing_booking') ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Hinweis: Fehlende Buchung — geplanter Einsatz ohne Ist-Zeit.
        </Text>
      ) : null}
      {exportedWarning ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Warnung: Eintrag wurde exportiert — Änderungen erfordern P2.3 Re-Export.
        </Text>
      ) : null}

      {canCorrect && entry.canEdit !== false ? (
        <View style={styles.actions}>
          <Text style={{ color: text.primary, ...typography.bodyMedium }}>Bearbeiten</Text>
          <TextInput
            value={editStartAt}
            onChangeText={onEditStartAtChange}
            placeholder="Start (ISO)"
            placeholderTextColor={text.muted}
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
          />
          <TextInput
            value={editEndAt}
            onChangeText={onEditEndAtChange}
            placeholder="Ende (ISO)"
            placeholderTextColor={text.muted}
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
          />
          <TextInput
            value={editPauseMinutes}
            onChangeText={onEditPauseMinutesChange}
            placeholder="Pause (Min.)"
            placeholderTextColor={text.muted}
            keyboardType="numeric"
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
          />
          <TextInput
            value={correctionReason}
            onChangeText={onCorrectionReasonChange}
            placeholder="Korrektur-Begründung (Pflicht)"
            placeholderTextColor={text.muted}
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
          />
          <View style={styles.actionRow}>
            {display.hasAssignmentActual ? (
              <PremiumButton title="Aus Einsatz übernehmen" variant="secondary" onPress={onAdoptAssignment} />
            ) : null}
            <PremiumButton title="Speichern" variant="secondary" onPress={onSaveCorrection} />
          </View>

          <TextInput
            value={reviewNote}
            onChangeText={onReviewNoteChange}
            placeholder="Kommentar / Ablehnungsgrund / Rückfrage"
            placeholderTextColor={text.muted}
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
          />
          <View style={styles.actionRow}>
            {entry.canApprove !== false ? (
              <PremiumButton title="Freigeben" variant="secondary" onPress={onApprove} />
            ) : null}
            {entry.canRequestClarification !== false ? (
              <PremiumButton title="Rückfrage" variant="ghost" onPress={onClarification} />
            ) : null}
            {entry.canReject !== false ? (
              <PremiumButton title="Ablehnen" variant="ghost" onPress={onReject} />
            ) : null}
          </View>
        </View>
      ) : null}

      <PremiumButton
        title={showHistory ? 'Historie ausblenden' : 'Historie anzeigen'}
        variant="ghost"
        onPress={() => setShowHistory((v) => !v)}
      />
      {showHistory ? (
        <View style={styles.history}>
          {auditEntries.length === 0 ? (
            <Text style={{ color: text.secondary, ...typography.caption }}>Keine Audit-Einträge.</Text>
          ) : (
            auditEntries.map((a) => (
              <Text key={a.id} style={{ color: text.secondary, ...typography.caption }}>
                {a.createdAt.slice(0, 16)} · {a.summary}
                {a.reason ? ` — ${a.reason}` : ''}
              </Text>
            ))
          )}
        </View>
      ) : null}

      {actionMessage ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>{actionMessage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { marginTop: careSpacing.md, padding: careSpacing.md, borderWidth: 1, borderRadius: 10, gap: 6 },
  actions: { marginTop: careSpacing.sm, gap: careSpacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: careSpacing.sm,
    minWidth: 160,
    flex: 1,
  },
  history: { gap: 4 },
});
