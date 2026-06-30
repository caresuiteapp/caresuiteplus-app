import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  SegmentedTabs,
  SuccessState,
  type TabOption,
} from '@/components/ui';
import { VisitProofPreviewPanel } from '@/components/assist/VisitProofPreviewPanel';
import { VisitTasksPanel } from '@/components/assist/VisitTasksPanel';
import { useVisitDispositionDetail } from '@/hooks/useVisitDispositionDetail';
import { useAsyncQuery } from '@/hooks/core';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import {
  buildVisitProofPreview,
  deleteVisitDisposition,
  fetchVisitStatusHistory,
  updateVisitTaskStatus,
} from '@/lib/assist';
import type { VisitTaskStatus } from '@/lib/assist/visitTypes';
import { VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  VISIT_BILLING_STATUS_LABELS,
  VISIT_EXECUTION_STATUS_LABELS,
  VISIT_PLANNING_STATUS_LABELS,
  VISIT_PORTAL_STATUS_LABELS,
  VISIT_PROOF_STATUS_LABELS,
} from '@/lib/assist/visitTypes';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing, typography } from '@/theme';

const DETAIL_TABS: TabOption[] = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'planning', label: 'Planung' },
  { key: 'tasks', label: 'Aufgaben' },
  { key: 'budget', label: 'Budget & Abrechnung' },
  { key: 'execution', label: 'Durchführung' },
  { key: 'proof', label: 'Nachweis' },
  { key: 'history', label: 'Verlauf' },
];

const FORM_CTX = { viewContext: 'form' as const };

type AssignmentDetailTabsPanelProps = {
  assignmentId: string;
  mode?: 'preview' | 'full';
  /** Modal shell uses sticky toolbar actions on desktop instead of a stacked sheet. */
  layout?: 'page' | 'modal';
  onOpenFullRecord?: () => void;
  onClose?: () => void;
  onDeleted?: () => void;
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  return `${h} Std. ${m} Min.`;
}

function formatBudget(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100);
}

function StatusBadgeRow({
  planningLabel,
  proofLabel,
  budgetLabel,
  isAtRisk,
  isIncomplete,
}: {
  planningLabel: string;
  proofLabel: string;
  budgetLabel: string;
  isAtRisk?: boolean;
  isIncomplete?: boolean;
}) {
  return (
    <View style={statusBadgeStyles.row}>
      <PremiumBadge label={planningLabel} variant="cyan" dot />
      <PremiumBadge label={proofLabel} variant="purple" dot />
      <PremiumBadge label={budgetLabel} variant="orange" dot />
      {isAtRisk ? <PremiumBadge label="Gefährdet" variant="red" dot /> : null}
      {isIncomplete ? <PremiumBadge label="Unvollständig" variant="orange" dot /> : null}
    </View>
  );
}

const statusBadgeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});

function formatHistoryEntry(
  dimensionLabel: string,
  fromLabel: string | null,
  toLabel: string,
  changedAt: string,
): string {
  const when = formatDateTime(changedAt);
  if (fromLabel) {
    return `${dimensionLabel}: ${fromLabel} → ${toLabel} · ${when}`;
  }
  return `${dimensionLabel}: ${toLabel} · ${when}`;
}

export function AssignmentDetailTabsPanel({
  assignmentId,
  mode = 'full',
  layout = 'page',
  onOpenFullRecord,
  onClose,
  onDeleted,
}: AssignmentDetailTabsPanelProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isWideOverview = isDesktopClass(deviceClass);
  const { isReadOnly, roleLabel, can } = usePermissions();
  const [activeTab, setActiveTab] = useState('overview');
  const text = useAuroraAdaptiveText();
  const assistAccent = moduleColor('assist');
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const {
    data: visit,
    loading,
    error,
    actionLoading,
    successMessage,
    refresh,
    changeStatus,
    notFound,
  } = useVisitDispositionDetail(assignmentId);
  const [taskLoading, setTaskLoading] = useState(false);

  const historyQuery = useAsyncQuery(
    () => {
      if (!tenantId || !assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchVisitStatusHistory(assignmentId, tenantId, profile?.roleKey);
    },
    [tenantId, assignmentId, profile?.roleKey],
    { enabled: activeTab === 'history' && Boolean(tenantId) && Boolean(assignmentId) },
  );

  const isPreview = mode === 'preview';
  const isModalLayout = layout === 'modal';
  const useActionToolbar = isModalLayout && isWideOverview;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          ...(isModalLayout
            ? { flex: 1, minHeight: 0, flexDirection: 'column' as const, padding: 0, gap: 0 }
            : { flex: 1 }),
          ...(!isModalLayout ? { padding: careSpacing.md, gap: careSpacing.md } : {}),
        },
        contentScroll: {
          flex: 1,
          minHeight: 0,
        },
        contentInner: {
          padding: careSpacing.md,
          gap: careSpacing.md,
        },
        title: { ...typography.h3, color: text.primary, fontWeight: '600' },
        meta: { ...typography.body, color: text.secondary, marginTop: 4 },
        errorCard: {
          backgroundColor: 'rgba(239,68,68,0.08)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.25)',
          padding: spacing.md,
          gap: spacing.xs,
        },
        errorTitle: { ...typography.bodyStrong, color: '#DC2626' },
        errorText: { ...typography.body, color: text.primary },
        actions: {
          flexDirection: useActionToolbar ? 'row' : 'column',
          flexWrap: useActionToolbar ? 'wrap' : 'nowrap',
          alignItems: useActionToolbar ? 'center' : 'stretch',
          gap: spacing.sm,
          paddingTop: spacing.sm,
          paddingHorizontal: isModalLayout ? careSpacing.md : 0,
          paddingBottom: isModalLayout ? careSpacing.md : 0,
          borderTopWidth: 1,
          borderTopColor: 'rgba(15,23,42,0.08)',
          flexShrink: 0,
        },
        actionBtn: useActionToolbar
          ? { flexGrow: 1, flexBasis: '30%', minWidth: 132, maxWidth: '100%' as const }
          : { width: '100%' as const },
        actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        taskRow: {
          paddingVertical: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(15,23,42,0.08)',
        },
        taskTitle: { ...typography.body, color: text.primary },
        hint: { ...typography.caption, color: text.muted, fontStyle: 'italic' },
        tabs: { marginBottom: spacing.sm },
        noteText: { ...typography.body, color: text.primary },
        overviewGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: careSpacing.md,
          alignItems: 'flex-start',
        },
        overviewStack: { gap: careSpacing.md },
        overviewCell: {
          flexGrow: 1,
          flexBasis: isWideOverview ? '48%' : '100%',
          minWidth: isWideOverview ? 280 : undefined,
        },
        overviewCellFull: {
          flexBasis: '100%',
          width: '100%',
        },
        taskChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs },
        taskChip: {
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.12)',
          borderRadius: 16,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
        },
        taskChipTitle: { ...typography.caption, color: text.primary },
        taskChipMeta: { ...typography.caption, color: text.muted, fontSize: 11 },
        historyItem: {
          ...typography.body,
          color: text.primary,
          paddingVertical: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(15,23,42,0.08)',
        },
      }),
    [text, isModalLayout, isPreview, isWideOverview, useActionToolbar],
  );

  if (loading) return <LoadingState message="Einsatz wird geladen…" />;

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!visit) return null;

  const handleUpdateTask = async (
    taskId: string,
    status: VisitTaskStatus,
    notDoneReason?: string,
  ) => {
    if (!tenantId) return;
    setTaskLoading(true);
    await updateVisitTaskStatus(
      assignmentId,
      taskId,
      tenantId,
      status,
      profile?.roleKey,
      notDoneReason,
    );
    setTaskLoading(false);
    await refresh();
  };

  const handleDelete = async () => {
    if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
    return deleteVisitDisposition(assignmentId, tenantId, profile?.roleKey);
  };

  const proofPreview = buildVisitProofPreview(visit, visit.employeeNotes ?? visit.notes);

  const visibleTabs = isPreview
    ? DETAIL_TABS.filter((t) => t.key === 'overview')
    : DETAIL_TABS;

  const displayName = `${visit.serviceName ?? visit.title} · ${visit.clientName}`;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'planning':
        return (
          <SectionPanel {...FORM_CTX} title="Planung" subtitle="Disposition & Termin">
            <DetailInfoRow label="Planungsstatus" value={VISIT_PLANNING_STATUS_LABELS[visit.planningStatus]} />
            <DetailInfoRow label="Leistung" value={visit.serviceName ?? visit.title} />
            <DetailInfoRow label="Datum" value={formatDateTime(visit.scheduledStart)} />
            <DetailInfoRow label="Dauer" value={formatDuration(visit.durationMinutes)} />
            <DetailInfoRow label="Klient:in" value={visit.clientName} />
            <DetailInfoRow label="Mitarbeitende:r" value={visit.employeeName} />
            <DetailInfoRow
              label="Ort"
              value={visit.location === '—' ? 'Noch kein Ort hinterlegt' : visit.location}
            />
          </SectionPanel>
        );
      case 'tasks':
        return (
          <VisitTasksPanel
            visit={visit}
            disabled={isReadOnly || !can('assist.execution.manage')}
            actionLoading={taskLoading || actionLoading}
            onUpdateTask={handleUpdateTask}
          />
        );
      case 'budget':
        return (
          <SectionPanel {...FORM_CTX} title="Budget & Abrechnung">
            <DetailInfoRow
              label="Abrechnungsstatus"
              value={VISIT_BILLING_STATUS_LABELS[visit.billingStatus]}
            />
            <DetailInfoRow
              label="Budget-Vorschau"
              value={formatBudget(visit.budget?.budgetAmountCents, visit.budget?.currency)}
            />
            {visit.budget?.warning ? (
              <Text style={styles.hint}>{visit.budget.warning}</Text>
            ) : null}
            {visit.budget?.budgetAmountCents == null ? (
              <Text style={styles.hint}>Noch keine Abrechnungsdaten</Text>
            ) : null}
          </SectionPanel>
        );
      case 'execution':
        return (
          <SectionPanel {...FORM_CTX} title="Durchführung">
            <DetailInfoRow
              label="Ausführungsstatus"
              value={VISIT_EXECUTION_STATUS_LABELS[visit.executionStatus]}
            />
            <DetailInfoRow label="Unterwegs ab" value={formatDateTime(visit.onTheWayAt)} />
            <DetailInfoRow label="Angekommen" value={formatDateTime(visit.arrivedAt)} />
            <DetailInfoRow label="Gestartet" value={formatDateTime(visit.actualStartAt)} />
            <DetailInfoRow label="Beendet" value={formatDateTime(visit.actualEndAt)} />
            {can('assist.execution.view') ? (
              <PremiumButton
                title="Einsatz durchführen"
                fullWidth
                onPress={() => router.push(`/assist/assignments/${visit.id}/execute` as never)}
              />
            ) : null}
          </SectionPanel>
        );
      case 'proof':
        return <VisitProofPreviewPanel preview={proofPreview} />;
      case 'history':
        return (
          <SectionPanel {...FORM_CTX} title="Verlauf">
            <DetailInfoRow label="Erstellt" value={formatDateTime(visit.createdAt)} />
            <DetailInfoRow label="Aktualisiert" value={formatDateTime(visit.updatedAt)} />
            <DetailInfoRow label="Portal" value={VISIT_PORTAL_STATUS_LABELS[visit.portalStatus]} />
            {historyQuery.loading ? (
              <LoadingState message="Statusverlauf wird geladen…" />
            ) : historyQuery.error ? (
              <Text style={styles.hint}>{historyQuery.error}</Text>
            ) : (historyQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Kein Statusverlauf"
                message="Für diesen Einsatz sind noch keine Statusänderungen protokolliert."
              />
            ) : (
              historyQuery.data?.map((entry) => (
                <Text key={entry.id} style={styles.historyItem}>
                  {formatHistoryEntry(
                    entry.dimensionLabel,
                    entry.fromStatusLabel,
                    entry.toStatusLabel,
                    entry.changedAt,
                  )}
                  {entry.note ? `\n${entry.note}` : ''}
                </Text>
              ))
            )}
          </SectionPanel>
        );
      default:
        return (
          <View style={isWideOverview ? styles.overviewGrid : styles.overviewStack}>
            <View style={styles.overviewCellFull}>
              <SectionPanel
                {...FORM_CTX}
                title="Einsatz"
                subtitle={visit.clientName}
                accentColor={assistAccent}
              >
                <Text style={styles.title}>{visit.serviceName ?? visit.title}</Text>
                <Text style={styles.meta}>
                  {visit.clientName} · {visit.employeeName}
                </Text>
              </SectionPanel>
            </View>

            <View style={styles.overviewCell}>
              <SectionPanel {...FORM_CTX} title="Status" subtitle="Planung · Nachweis · Budget">
                <StatusBadgeRow
                  planningLabel={VISIT_PLANNING_STATUS_LABELS[visit.planningStatus]}
                  proofLabel={VISIT_PROOF_STATUS_LABELS[visit.proofStatus]}
                  budgetLabel={VISIT_BILLING_STATUS_LABELS[visit.billingStatus]}
                  isAtRisk={visit.isAtRisk}
                  isIncomplete={visit.isIncomplete}
                />
                <DetailInfoRow
                  label="Workflow"
                  value={ASSIGNMENT_STATUS_LABELS[visit.assignmentStatus]}
                />
              </SectionPanel>
            </View>

            <View style={styles.overviewCell}>
              <SectionPanel {...FORM_CTX} title="Zeit & Ort">
                <DetailInfoRow label="Beginn" value={formatDateTime(visit.scheduledStart)} />
                <DetailInfoRow label="Ende" value={formatDateTime(visit.scheduledEnd)} />
                <DetailInfoRow label="Dauer" value={formatDuration(visit.durationMinutes)} />
                <DetailInfoRow
                  label="Ort"
                  value={visit.location === '—' ? 'Noch kein Ort hinterlegt' : visit.location}
                />
                {visit.tasks.length > 0 ? (
                  <View style={styles.taskChips}>
                    {visit.tasks.map((task) => (
                      <View key={task.id} style={styles.taskChip}>
                        <Text style={styles.taskChipTitle}>{task.title}</Text>
                        <Text style={styles.taskChipMeta}>
                          {VISIT_TASK_STATUS_LABELS[task.status]}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <DetailInfoRow label="Aufgaben" value="Keine hinterlegt" />
                )}
              </SectionPanel>
            </View>

            {visit.budget ? (
              <View style={styles.overviewCell}>
                <SectionPanel {...FORM_CTX} title="Budget">
                  <DetailInfoRow
                    label="Betrag"
                    value={formatBudget(visit.budget.budgetAmountCents, visit.budget.currency)}
                  />
                  {visit.budget.warning ? (
                    <Text style={styles.hint}>{visit.budget.warning}</Text>
                  ) : null}
                </SectionPanel>
              </View>
            ) : null}

            {visit.errorMessage ? (
              <View style={[styles.overviewCellFull, styles.errorCard]}>
                <Text style={styles.errorTitle}>Fehlerhaft</Text>
                <Text style={styles.errorText}>{visit.errorMessage}</Text>
                {visit.errorCode ? (
                  <Text style={styles.hint}>Code: {visit.errorCode}</Text>
                ) : null}
              </View>
            ) : null}

            {visit.notes ? (
              <View style={styles.overviewCellFull}>
                <SectionPanel {...FORM_CTX} title="Notizen">
                  <Text style={styles.noteText}>{visit.notes}</Text>
                </SectionPanel>
              </View>
            ) : null}
          </View>
        );
    }
  };

  const renderMainContent = () => (
    <>
      {successMessage ? <SuccessState message={successMessage} /> : null}

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Einsätze einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      {!isPreview ? (
        <SegmentedTabs
          tabs={visibleTabs}
          activeKey={activeTab}
          onSelect={setActiveTab}
          style={styles.tabs}
        />
      ) : null}

      {renderTabContent()}

      {!isPreview && can('assist.assignments.manage') ? (
        <SectionPanel {...FORM_CTX} title="Status ändern" subtitle="Erlaubte Workflow-Übergänge">
          {(visit.allowedStatusTransitions?.length ?? 0) === 0 ? (
            <EmptyState
              title="Keine Aktionen"
              message="Für diesen Status sind keine Wechsel möglich."
            />
          ) : (
            <View style={styles.actionGrid}>
              {visit.allowedStatusTransitions.map((status) => (
                <PremiumButton
                  key={status}
                  title={ASSIGNMENT_STATUS_LABELS[status]}
                  variant="secondary"
                  size="sm"
                  loading={actionLoading}
                  onPress={() => changeStatus(status)}
                />
              ))}
            </View>
          )}
        </SectionPanel>
      ) : null}
    </>
  );

  const renderActions = () => (
    <View style={styles.actions}>
      {isPreview && onOpenFullRecord ? (
        <PremiumButton
          title="Vollständig öffnen"
          size={useActionToolbar ? 'sm' : 'md'}
          fullWidth={!useActionToolbar}
          onPress={onOpenFullRecord}
          style={useActionToolbar ? styles.actionBtn : undefined}
        />
      ) : null}
      {can('assist.assignments.manage') && !isReadOnly ? (
        <PremiumButton
          title="Bearbeiten"
          variant="secondary"
          size={useActionToolbar ? 'sm' : 'md'}
          fullWidth={!useActionToolbar}
          onPress={() => router.push(`/assist/einsaetze/${visit.id}/edit` as never)}
          style={useActionToolbar ? styles.actionBtn : undefined}
        />
      ) : null}
      {can('assist.assignments.manage') &&
      visit.allowedStatusTransitions.includes('bestaetigt') ? (
        <PremiumButton
          title="Freigeben"
          variant="secondary"
          size={useActionToolbar ? 'sm' : 'md'}
          fullWidth={!useActionToolbar}
          loading={actionLoading}
          onPress={() => changeStatus('bestaetigt')}
          style={useActionToolbar ? styles.actionBtn : undefined}
        />
      ) : null}
      {can('assist.execution.view') ? (
        <PremiumButton
          title="Durchführen"
          variant="secondary"
          size={useActionToolbar ? 'sm' : 'md'}
          fullWidth={!useActionToolbar}
          onPress={() => router.push(`/assist/assignments/${visit.id}/execute` as never)}
          style={useActionToolbar ? styles.actionBtn : undefined}
        />
      ) : null}
      {can('assist.assignments.manage') &&
      visit.allowedStatusTransitions.includes('storniert') ? (
        <PremiumButton
          title="Absagen"
          variant="secondary"
          size={useActionToolbar ? 'sm' : 'md'}
          fullWidth={!useActionToolbar}
          loading={actionLoading}
          onPress={() => changeStatus('storniert')}
          style={useActionToolbar ? styles.actionBtn : undefined}
        />
      ) : null}
      {can('assist.assignments.manage') && !isReadOnly ? (
        <View style={useActionToolbar ? styles.actionBtn : undefined}>
          <OfficeRecordDeleteButton
            recordLabel="Einsatz"
            displayName={displayName}
            onDelete={handleDelete}
            onDeleted={onDeleted}
            confirmTitle="Einsatz löschen?"
            buttonTitle="Löschen"
            fullWidth={!useActionToolbar}
          />
        </View>
      ) : null}
      {onClose ? (
        <PremiumButton
          title="Schließen"
          variant="ghost"
          size={useActionToolbar ? 'sm' : 'md'}
          fullWidth={!useActionToolbar}
          onPress={onClose}
          style={useActionToolbar ? styles.actionBtn : undefined}
        />
      ) : null}
    </View>
  );

  if (isModalLayout) {
    return (
      <View style={styles.panel}>
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {renderMainContent()}
        </ScrollView>
        {renderActions()}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      {renderMainContent()}
      {renderActions()}
    </View>
  );
}
