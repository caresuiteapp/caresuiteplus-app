import { StyleSheet, Text, View } from 'react-native';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  buildVisitProofPreview,
  deleteVisitDisposition,
  updateVisitTaskStatus,
} from '@/lib/assist';
import type { VisitTaskStatus } from '@/lib/assist/visitTypes';
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

export function AssignmentDetailTabsPanel({
  assignmentId,
  mode = 'full',
  onOpenFullRecord,
  onClose,
  onDeleted,
}: AssignmentDetailTabsPanelProps) {
  const router = useRouter();
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

  const isPreview = mode === 'preview';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          flex: 1,
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
          gap: spacing.sm,
          paddingTop: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: 'rgba(15,23,42,0.08)',
        },
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
      }),
    [text, isPreview],
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
            <Text style={styles.hint}>
              Abrechnungs-Snapshots werden nach Migration 0116 verfügbar.
            </Text>
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
            <Text style={styles.hint}>
              Statusverlauf wird aus assist_visit_status_history geladen.
            </Text>
          </SectionPanel>
        );
      default:
        return (
          <>
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

            {visit.errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Fehlerhaft</Text>
                <Text style={styles.errorText}>{visit.errorMessage}</Text>
                {visit.errorCode ? (
                  <Text style={styles.hint}>Code: {visit.errorCode}</Text>
                ) : null}
              </View>
            ) : null}

            <SectionPanel {...FORM_CTX} title="Zeit & Ort">
              <DetailInfoRow label="Beginn" value={formatDateTime(visit.scheduledStart)} />
              <DetailInfoRow label="Ende" value={formatDateTime(visit.scheduledEnd)} />
              <DetailInfoRow label="Dauer" value={formatDuration(visit.durationMinutes)} />
              <DetailInfoRow label="Ort" value={visit.location} />
              <DetailInfoRow label="Aufgaben" value={String(visit.tasks.length)} />
            </SectionPanel>

            {visit.budget ? (
              <SectionPanel {...FORM_CTX} title="Budget">
                <DetailInfoRow
                  label="Betrag"
                  value={formatBudget(visit.budget.budgetAmountCents, visit.budget.currency)}
                />
                {visit.budget.warning ? (
                  <Text style={styles.hint}>{visit.budget.warning}</Text>
                ) : null}
              </SectionPanel>
            ) : null}

            {visit.notes ? (
              <SectionPanel {...FORM_CTX} title="Notizen">
                <Text style={styles.noteText}>{visit.notes}</Text>
              </SectionPanel>
            ) : null}
          </>
        );
    }
  };

  return (
    <View style={styles.panel}>
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

      <View style={styles.actions}>
        {isPreview && onOpenFullRecord ? (
          <PremiumButton title="Vollständig öffnen" fullWidth onPress={onOpenFullRecord} />
        ) : null}
        {can('assist.assignments.manage') && !isReadOnly ? (
          <PremiumButton
            title="Bearbeiten"
            variant="secondary"
            fullWidth
            onPress={() => router.push(`/assist/einsaetze/${visit.id}/edit` as never)}
          />
        ) : null}
        {can('assist.assignments.manage') &&
        visit.allowedStatusTransitions.includes('bestaetigt') ? (
          <PremiumButton
            title="Freigeben"
            variant="secondary"
            fullWidth
            loading={actionLoading}
            onPress={() => changeStatus('bestaetigt')}
          />
        ) : null}
        {can('assist.execution.view') ? (
          <PremiumButton
            title="Durchführen"
            variant="secondary"
            fullWidth
            onPress={() => router.push(`/assist/assignments/${visit.id}/execute` as never)}
          />
        ) : null}
        {can('assist.assignments.manage') &&
        visit.allowedStatusTransitions.includes('storniert') ? (
          <PremiumButton
            title="Absagen"
            variant="secondary"
            fullWidth
            loading={actionLoading}
            onPress={() => changeStatus('storniert')}
          />
        ) : null}
        {can('assist.assignments.manage') && !isReadOnly ? (
          <OfficeRecordDeleteButton
            recordLabel="Einsatz"
            displayName={displayName}
            onDelete={handleDelete}
            onDeleted={onDeleted}
            confirmTitle="Einsatz löschen?"
            buttonTitle="Löschen"
          />
        ) : null}
        {onClose ? (
          <PremiumButton title="Schließen" variant="ghost" fullWidth onPress={onClose} />
        ) : null}
      </View>

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
    </View>
  );
}
