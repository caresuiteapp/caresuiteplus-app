import { StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SegmentedTabs,
  SuccessState,
  type TabOption,
} from '@/components/ui';
import { VisitDispositionBadge, VisitDispositionBadgeRow } from '@/components/assist/VisitDispositionBadge';
import { useVisitDispositionDetail } from '@/hooks/useVisitDispositionDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  VISIT_BILLING_STATUS_LABELS,
  VISIT_DOCUMENTATION_STATUS_LABELS,
  VISIT_EXECUTION_STATUS_LABELS,
  VISIT_PLANNING_STATUS_LABELS,
  VISIT_PORTAL_STATUS_LABELS,
  VISIT_PROOF_STATUS_LABELS,
  VISIT_TASK_STATUS_LABELS,
} from '@/lib/assist/visitTypes';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
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

type AssignmentDetailTabsPanelProps = {
  assignmentId: string;
  mode?: 'preview' | 'full';
  onOpenFullRecord?: () => void;
  onClose?: () => void;
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

export function AssignmentDetailTabsPanel({
  assignmentId,
  mode = 'full',
  onOpenFullRecord,
  onClose,
}: AssignmentDetailTabsPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel, can } = usePermissions();
  const [activeTab, setActiveTab] = useState('overview');
  const text = useAuroraAdaptiveText();
  const assistAccent = moduleColor('assist');
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          flex: 1,
          padding: spacing.md,
          gap: spacing.md,
          backgroundColor: auroraGlass.modal,
        },
        title: { ...typography.h2, color: text.primary },
        meta: { ...typography.caption, color: text.secondary },
        errorCard: {
          backgroundColor: 'rgba(255,107,107,0.12)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,107,107,0.35)',
          padding: spacing.md,
          gap: spacing.xs,
        },
        errorTitle: { ...typography.bodyStrong, color: '#FF6B6B' },
        errorText: { ...typography.body, color: text.primary },
        actions: { gap: spacing.sm },
        actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        taskRow: {
          paddingVertical: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: auroraGlass.innerBorder,
        },
        taskTitle: { ...typography.body, color: text.primary },
        hint: { ...typography.caption, color: text.muted, fontStyle: 'italic' },
        tabs: { marginBottom: spacing.sm },
      }),
    [text],
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

  const isPreview = mode === 'preview';
  const visibleTabs = isPreview
    ? DETAIL_TABS.filter((t) => t.key === 'overview')
    : DETAIL_TABS;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'planning':
        return (
          <SectionPanel title="Planung" subtitle="Disposition & Termin">
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
          <SectionPanel title="Aufgaben" subtitle={`${visit.tasks.length} Aufgaben`}>
            {visit.tasks.length === 0 ? (
              <EmptyState title="Keine Aufgaben" message="Für diesen Einsatz sind keine Aufgaben hinterlegt." />
            ) : (
              visit.tasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <VisitDispositionBadge
                    label={VISIT_TASK_STATUS_LABELS[task.status]}
                    variant={task.status === 'done' ? 'green' : 'orange'}
                    compact
                  />
                </View>
              ))
            )}
          </SectionPanel>
        );
      case 'budget':
        return (
          <SectionPanel title="Budget & Abrechnung">
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
              {/* TODO: Billing snapshot history from assist_visit_billing_snapshots */}
              Abrechnungs-Snapshots werden nach Migration 0116 verfügbar.
            </Text>
          </SectionPanel>
        );
      case 'execution':
        return (
          <SectionPanel title="Durchführung">
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
        return (
          <SectionPanel title="Nachweis">
            <DetailInfoRow label="Nachweisstatus" value={VISIT_PROOF_STATUS_LABELS[visit.proofStatus]} />
            <DetailInfoRow
              label="Dokumentation"
              value={VISIT_DOCUMENTATION_STATUS_LABELS[visit.documentationStatus]}
            />
            <Text style={styles.hint}>
              {/* TODO: Service proof generation stub — Phase 2 */}
              Leistungsnachweis-Generierung folgt in Phase 2.
            </Text>
          </SectionPanel>
        );
      case 'history':
        return (
          <SectionPanel title="Verlauf">
            <DetailInfoRow label="Erstellt" value={formatDateTime(visit.createdAt)} />
            <DetailInfoRow label="Aktualisiert" value={formatDateTime(visit.updatedAt)} />
            <DetailInfoRow label="Portal" value={VISIT_PORTAL_STATUS_LABELS[visit.portalStatus]} />
            <Text style={styles.hint}>
              {/* TODO: Load assist_visit_status_history + audit_logs */}
              Statusverlauf wird aus assist_visit_status_history geladen.
            </Text>
          </SectionPanel>
        );
      default:
        return (
          <>
            <PremiumCard accentColor={assistAccent} style={{ backgroundColor: auroraGlass.card }}>
              <Text style={styles.title}>{visit.serviceName ?? visit.title}</Text>
              <Text style={styles.meta}>
                {visit.clientName} · {visit.employeeName}
              </Text>
              <VisitDispositionBadgeRow
                planningLabel={VISIT_PLANNING_STATUS_LABELS[visit.planningStatus]}
                proofLabel={VISIT_PROOF_STATUS_LABELS[visit.proofStatus]}
                budgetLabel={VISIT_BILLING_STATUS_LABELS[visit.billingStatus]}
                isAtRisk={visit.isAtRisk}
                isIncomplete={visit.isIncomplete}
              />
            </PremiumCard>

            {visit.errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Fehlerhaft</Text>
                <Text style={styles.errorText}>{visit.errorMessage}</Text>
                {visit.errorCode ? (
                  <Text style={styles.hint}>Code: {visit.errorCode}</Text>
                ) : null}
              </View>
            ) : null}

            <SectionPanel title="Zeit & Ort">
              <DetailInfoRow label="Beginn" value={formatDateTime(visit.scheduledStart)} />
              <DetailInfoRow label="Ende" value={formatDateTime(visit.scheduledEnd)} />
              <DetailInfoRow label="Dauer" value={formatDuration(visit.durationMinutes)} />
              <DetailInfoRow label="Ort" value={visit.location} />
              <DetailInfoRow label="Aufgaben" value={String(visit.tasks.length)} />
            </SectionPanel>

            {visit.budget ? (
              <SectionPanel title="Budget-Vorschau">
                <DetailInfoRow
                  label="Betrag"
                  value={formatBudget(visit.budget.budgetAmountCents, visit.budget.currency)}
                />
              </SectionPanel>
            ) : null}

            {visit.notes ? (
              <SectionPanel title="Notizen">
                <Text style={{ ...typography.body, color: text.primary }}>{visit.notes}</Text>
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
            variant="ghost"
            fullWidth
            loading={actionLoading}
            onPress={() => changeStatus('storniert')}
          />
        ) : null}
        {onClose ? (
          <PremiumButton title="Schließen" variant="ghost" fullWidth onPress={onClose} />
        ) : null}
      </View>

      {!isPreview && can('assist.assignments.manage') ? (
        <SectionPanel title="Status ändern" subtitle="Erlaubte Workflow-Übergänge">
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
