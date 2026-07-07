import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PremiumButton, PremiumKpiCard, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { formatWfmDurationMinutes, formatWfmPlanTimeRange, formatWfmActualTimeRange, formatWfmAmpelLabel } from '@/lib/wfm/wfmDisplayHelpers';
import { listWfmOfficeAuditForEntry } from '@/lib/wfm/wfmOfficeAuditService';
import {
  applyWfmOfficeTimeCorrection,
  getWfmOfficeTimeOverview,
  reviewWfmOfficeTimeEntry,
} from '@/lib/wfm/wfmOfficeTimekeepingService';
import type {
  WfmOfficePeriodPreset,
  WfmOfficeTimeEntry,
  WfmOfficeTimeFilters,
} from '@/types/modules/wfmOfficeTimekeeping';
import {
  WFM_DEVIATION_AMPEL_LABELS,
  WFM_OFFICE_PERIOD_PRESET_LABELS,
  WFM_OFFICE_TIME_STATUS_LABELS,
} from '@/types/modules/wfmOfficeTimekeeping';
import { WfmOfficeTimeEntryTable } from './WfmOfficeTimeEntryTable';
import { typography } from '@/theme';

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
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const [preset, setPreset] = useState<WfmOfficePeriodPreset>(reviewQueueMode ? 'today' : 'today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterAmpel, setFilterAmpel] = useState<string | null>(initialFilterAmpel);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const filters: Partial<WfmOfficeTimeFilters> = {};
  if (filterAmpel === 'rot_blau') filters.onlyRotBlau = true;
  if (filterAmpel === 'pending') filters.onlyPendingReview = true;
  if (filterAmpel === 'office_msg') filters.onlyOfficeMessages = true;
  if (filterEmployeeId) filters.employeeIds = [filterEmployeeId];

  const historyQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId) return { ok: true as const, data: null };
      return getWfmOfficeTimeOverview(tenantId, roleKey, {
        preset,
        fromDate: preset === 'custom' ? customFrom : null,
        toDate: preset === 'custom' ? customTo : null,
        filters,
      });
    }, [tenantId, roleKey, preset, customFrom, customTo, filterAmpel, filterEmployeeId]),
    [tenantId, roleKey, preset, customFrom, customTo, filterAmpel, filterEmployeeId],
    { enabled: !!tenantId },
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

  const runReview = async (decision: 'approved' | 'rejected' | 'exported' | 'locked') => {
    if (!selectedId) return;
    setActionMessage(null);
    const result = await reviewWfmOfficeTimeEntry(
      tenantId,
      reviewerId,
      roleKey,
      selectedId,
      decision,
      reviewNote,
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
    });
    if (!result.ok) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage('Korrektur gespeichert.');
    setCorrectionReason('');
    void historyQuery.refresh();
    void auditQuery.refresh();
  };

  return (
    <SectionPanel
      title={reviewQueueMode ? 'Offene Prüfungen' : 'Arbeitszeit-Historie'}
      subtitle={overview ? `${overview.period.fromDate} – ${overview.period.toDate}` : undefined}
    >
      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <PremiumButton
            key={p}
            title={WFM_OFFICE_PERIOD_PRESET_LABELS[p]}
            variant={preset === p ? 'primary' : 'ghost'}
            onPress={() => setPreset(p)}
          />
        ))}
        <PremiumButton
          title="Freier Zeitraum"
          variant={preset === 'custom' ? 'primary' : 'ghost'}
          onPress={() => setPreset('custom')}
        />
      </View>

      {preset === 'custom' ? (
        <View style={styles.customRow}>
          <TextInput
            value={customFrom}
            onChangeText={setCustomFrom}
            placeholder="Von (YYYY-MM-DD)"
            placeholderTextColor={text.muted}
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
          />
          <TextInput
            value={customTo}
            onChangeText={setCustomTo}
            placeholder="Bis (YYYY-MM-DD)"
            placeholderTextColor={text.muted}
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
          />
          <PremiumButton title="Anwenden" variant="secondary" onPress={() => void historyQuery.refresh()} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        <PremiumButton
          title="Alle MA"
          variant={!filterEmployeeId ? 'secondary' : 'ghost'}
          onPress={() => setFilterEmployeeId(null)}
        />
        {(overview?.employees ?? []).slice(0, 8).map((emp) => (
          <PremiumButton
            key={emp.id}
            title={emp.name.split(' ')[0] ?? emp.name}
            variant={filterEmployeeId === emp.id ? 'secondary' : 'ghost'}
            onPress={() => setFilterEmployeeId(emp.id)}
          />
        ))}
      </View>

      <View style={styles.filterRow}>
        <PremiumButton
          title="Nur Rot/Blau"
          variant={filterAmpel === 'rot_blau' ? 'secondary' : 'ghost'}
          onPress={() => setFilterAmpel((v) => (v === 'rot_blau' ? null : 'rot_blau'))}
        />
        <PremiumButton
          title="Offene Prüfungen"
          variant={filterAmpel === 'pending' ? 'secondary' : 'ghost'}
          onPress={() => setFilterAmpel((v) => (v === 'pending' ? null : 'pending'))}
        />
        <PremiumButton
          title="Office-Meldungen"
          variant={filterAmpel === 'office_msg' ? 'secondary' : 'ghost'}
          onPress={() => setFilterAmpel((v) => (v === 'office_msg' ? null : 'office_msg'))}
        />
      </View>

      {kpis ? (
        <View style={styles.kpiRow}>
          <PremiumKpiCard label="Geplante Einsätze" value={String(kpis.plannedVisits ?? 0)} accentColor={accent} />
          <PremiumKpiCard label="Erfasste Einsätze" value={String(kpis.recordedVisits ?? 0)} accentColor={accent} />
          <PremiumKpiCard label="Fehlende Buchungen" value={String(kpis.missingBookings ?? 0)} accentColor={accent} />
          <PremiumKpiCard label="Ungeplante Buchungen" value={String(kpis.unplannedBookings ?? 0)} accentColor={accent} />
          <PremiumKpiCard label="Gesamtstunden" value={String(kpis.totalHours)} accentColor={accent} />
          <PremiumKpiCard label="Offene Prüfungen" value={String(kpis.pendingReviewCount)} accentColor={accent} />
          <PremiumKpiCard label="Abweichungen" value={String(kpis.planningDeviations)} accentColor={accent} />
          <PremiumKpiCard label="MA mit Arbeitszeit" value={String(kpis.employeesWithTime ?? 0)} accentColor={accent} />
          <PremiumKpiCard label="MA geplant" value={String(kpis.employeesPlanned ?? 0)} accentColor={accent} />
          <PremiumKpiCard label="Exportiert" value={String(kpis.exportedCount)} accentColor={accent} />
        </View>
      ) : null}

      <WfmOfficeTimeEntryTable
        entries={overview?.entries ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {selected ? (
        <View style={[styles.detail, { borderColor: text.border }]}>
          <Text style={{ color: text.primary, ...typography.h3 }}>
            {selected.employeeName} — {selected.workDate}
          </Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            {selected.clientLabel ?? selected.assignmentTitle ?? '—'} · Status{' '}
            {WFM_OFFICE_TIME_STATUS_LABELS[selected.reviewStatus]}
            {selected.rowKind ? ` · ${selected.rowKind}` : ''}
          </Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            Plan: {formatWfmPlanTimeRange(selected.plannedStartAt, selected.plannedEndAt, selected.planDisplayStatus)}
          </Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            Ist: {formatWfmActualTimeRange(selected.actualStartAt, selected.actualEndAt, selected.actualDisplayStatus)}
          </Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            {formatWfmAmpelLabel(selected.startAmpel, 'start')} · {formatWfmAmpelLabel(selected.endAmpel, 'end')} ·{' '}
            {selected.overallAmpel
              ? `Gesamt (${WFM_DEVIATION_AMPEL_LABELS[selected.overallAmpel]})`
              : 'Gesamt: nicht berechnet'}
          </Text>
          {selected.flags.includes('missing_booking') ? (
            <Text style={{ color: text.secondary, ...typography.caption }}>
              Hinweis: Fehlende Buchung — geplanter Einsatz ohne Ist-Zeit.
            </Text>
          ) : null}
          {selected.flags.includes('unplanned') ? (
            <Text style={{ color: text.secondary, ...typography.caption }}>
              Hinweis: Ungeplante Arbeitszeit — Zuordnung prüfen.
            </Text>
          ) : null}
          {selected.startJustification ? (
            <Text style={{ color: text.secondary, ...typography.caption }}>
              Start-Begründung: {selected.startJustification}
            </Text>
          ) : null}
          {selected.endJustification ? (
            <Text style={{ color: text.secondary, ...typography.caption }}>
              Ende-Begründung: {selected.endJustification}
            </Text>
          ) : null}
          <Text style={{ color: text.secondary, ...typography.caption }}>
            Netto {formatWfmDurationMinutes(selected.netMinutes)} · Pause{' '}
            {formatWfmDurationMinutes(selected.pauseMinutes)}
          </Text>

          {canCorrect ? (
            <View style={styles.actions}>
              <TextInput
                value={reviewNote}
                onChangeText={setReviewNote}
                placeholder="Office-Kommentar / Ablehnungsgrund"
                placeholderTextColor={text.muted}
                style={[styles.input, { color: text.primary, borderColor: text.border }]}
              />
              <View style={styles.actionRow}>
                <PremiumButton title="Freigeben" variant="secondary" onPress={() => void runReview('approved')} />
                <PremiumButton title="Ablehnen" variant="ghost" onPress={() => void runReview('rejected')} />
                <PremiumButton title="Exportieren" variant="ghost" onPress={() => void runReview('exported')} />
                <PremiumButton title="Sperren" variant="ghost" onPress={() => void runReview('locked')} />
              </View>
              <TextInput
                value={correctionReason}
                onChangeText={setCorrectionReason}
                placeholder="Korrektur-Begründung (Pflicht)"
                placeholderTextColor={text.muted}
                style={[styles.input, { color: text.primary, borderColor: text.border }]}
              />
              <PremiumButton title="Korrektur erfassen" onPress={() => void runCorrection()} />
            </View>
          ) : null}

          <Text style={{ color: text.primary, ...typography.bodyMedium, marginTop: careSpacing.sm }}>
            Audit-Trail
          </Text>
          {(auditQuery.data ?? []).map((a) => (
            <Text key={a.id} style={{ color: text.secondary, ...typography.caption }}>
              {a.createdAt.slice(0, 16)} · {a.summary}
              {a.reason ? ` — ${a.reason}` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {actionMessage ? (
        <Text style={{ color: text.secondary, ...typography.caption, marginTop: careSpacing.sm }}>
          {actionMessage}
        </Text>
      ) : null}

      <PremiumButton title="Historie aktualisieren" variant="ghost" onPress={() => void historyQuery.refresh()} />
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs, marginBottom: careSpacing.sm },
  customRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs, marginBottom: careSpacing.md },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.md },
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
});
