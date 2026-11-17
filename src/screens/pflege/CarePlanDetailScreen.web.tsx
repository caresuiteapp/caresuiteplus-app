import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import { SavedCarePlanActivityPanel } from '@/components/pflege/CarePlanActivityPanel';
import { CarePlanRespiratoryPanel } from '@/components/pflege/CarePlanRespiratoryPanel';
import { CareWorkspaceColumns, CareWorkspaceHeader, CareWorkspaceTabs, type CareWorkspaceTab } from '@/components/pflege/CareWorkspaceLayout';
import { NativeCarePlanSourcePanel } from '@/components/pflege/NativeCarePlanSourcePanel.web';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useCarePlanDetail } from '@/hooks/useCarePlanDetail.web';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { storedCalendarDay } from '@/lib/pflege/carePlanDailyWorklist';
import { buildCarePlanDocument } from '@/lib/pflege/carePlanDocument';
import { carePlanningModels } from '@/lib/pflege/carePlanningModels';
import { printCarePlan } from '@/lib/pflege/printCarePlan';
import { stageVitalCaptureClient } from '@/lib/pflege/vitalCaptureHandoff';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import type { CarePlanTask } from '@/types/modules/pflege';
import { spacing, typography } from '@/theme';

type DetailTab = 'overview' | 'measures' | 'drinking' | 'positioning' | 'respiratory' | 'evaluation' | 'links';
const tabOptions: CareWorkspaceTab<DetailTab>[] = [
  { key: 'overview', label: 'Übersicht', icon: 'file-text' },
  { key: 'measures', label: 'Maßnahmen', icon: 'list' },
  { key: 'drinking', label: 'Trinkplan', icon: 'droplet' },
  { key: 'positioning', label: 'Lagerung', icon: 'layers' },
  { key: 'respiratory', label: 'Atemskala', icon: 'activity' },
  { key: 'evaluation', label: 'Evaluation', icon: 'check-square' },
  { key: 'links', label: 'Fachbereiche', icon: 'grid' },
];
const formatDate = (input: string) => storedCalendarDay(input)?.split('-').reverse().join('.') ?? '—';

function TaskCard({ task }: { task: CarePlanTask }) {
  const { c } = useCareLightPalette();
  const state = task.itemState === 'cancelled' ? 'Aus dem Plan genommen' : task.itemState === 'paused' ? 'Pausiert' : WORKFLOW_STATUS_LABELS[task.status];
  const facts = [
    ['Pflegeproblem', task.description !== task.intervention ? task.description : ''],
    ['Pflegeziel', task.goal], ['Durchführung', task.intervention], ['Eigenbeitrag', task.personContribution],
    ['Zuständigkeit', task.responsibleRole], ['Unterstützung durch Angehörige', task.relativesContribution],
    ['Warn- und Abbruchkriterien', task.warningSigns], ['Eskalationsweg', task.escalationPath],
    ['Kriterium für die Evaluation', task.evaluationCriteria], ['Nächste Evaluation', task.nextEvaluationAt ? formatDate(task.nextEvaluationAt) : ''],
    ['Individuelle Bemerkungen', task.notes],
  ] as const;
  return <View style={[styles.measure, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
    <View style={styles.measureHeading}>
      <View style={styles.grow}>
        <Text accessibilityRole="header" style={[typography.h3, { color: c.text }]}>{task.label}</Text>
        {task.category ? <Text style={[typography.caption, { color: c.muted }]}>{task.category}</Text> : null}
      </View>
      <PremiumBadge label={state} variant={task.itemState === 'active' ? 'green' : 'muted'} dot />
    </View>
    {[...facts, ['Häufigkeit', task.frequency] as const].map(([label, value]) => value ?
      <DetailInfoRow key={label} label={label} value={value} /> : null)}
  </View>;
}

export function CarePlanDetailScreen() {
  const { id, area } = useLocalSearchParams<{ id: string; area?: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const rights = useCareRuntimePermissions();
  const tenantId = useServiceTenantId();
  const { data: plan, loading, error, refresh, notFound, isCurrent } = useCarePlanDetail(id);
  const [tab, setTab] = useState<DetailTab>(() => tabOptions.find(entry => entry.key === area)?.key ?? 'overview');
  const [printError, setPrintError] = useState('');
  const [printing, setPrinting] = useState(false);

  if (loading || rights.loading) return <ScreenShell title="Pflegeplanung"><LoadingState message="Pflegeplan wird geladen…" /></ScreenShell>;
  if (!rights.can('pflege.plans.view')) {
    return <ScreenShell title="Pflegeplanung"><ErrorState message={rights.error ?? 'Das Leserecht für Pflegepläne fehlt.'} onRetry={rights.refreshPermissions} /></ScreenShell>;
  }
  if (notFound || error || !plan || plan.id !== id || plan.tenantId !== tenantId) {
    return <ScreenShell title="Pflegeplanung"><ErrorState message={error ?? 'Die ausgewählte Pflegeplanung ist nicht verfügbar.'} onRetry={refresh} /></ScreenShell>;
  }

  const canEdit = rights.can('pflege.plans.manage') && plan.status !== 'archiviert';
  const canEvaluate = rights.can('pflege.evaluations.view');
  const canAtem = rights.can('pflege.vitals.view');
  const canRecordFluid = rights.canAll(['pflege.vitals.view', 'pflege.vitals.manage']);
  const measures = plan.tasks.filter(entry => !entry.activity);
  const evaluable = plan.tasks.filter(entry => entry.itemState !== 'cancelled' && entry.itemState !== 'completed');
  const items = tabOptions.filter(entry => (entry.key !== 'evaluation' || canEvaluate) && (entry.key !== 'respiratory' || canAtem));
  const active = items.some(entry => entry.key === tab) ? tab : 'overview';
  const open = (path: string) => { if (isCurrent()) router.push(path as never); };
  const edit = (target?: 'drinking' | 'positioning') => open(`/pflege/planung/${plan.id}/edit${target ? `?area=${target}` : ''}`);
  const status = WORKFLOW_STATUS_LABELS[plan.status];
  const displayModel = carePlanningModels.find(model => model.key === plan.planningModel)?.label;

  function recordFluidBalance() {
    if (!plan || !profile?.id || !rights.roleKey || !canRecordFluid || !isCurrent()) return;
    stageVitalCaptureClient({ tenantId: plan.tenantId, profileId: profile.id, roleKey: rights.roleKey }, plan.clientId);
    open('/pflege/vitalwerte/create');
  }

  async function print() {
    if (!plan || !isCurrent() || !rights.can('pflege.plans.view') || printing) return;
    setPrintError('');
    setPrinting(true);
    try {
      await printCarePlan(buildCarePlanDocument(plan));
    } catch (problem) {
      setPrintError(problem instanceof Error ? problem.message : 'Der Dokumentationsbogen konnte nicht geöffnet werden.');
    } finally {
      setPrinting(false);
    }
  }

  return <ScreenShell title="Pflegeplanung" compactHeader>
    <CareWorkspaceHeader title={plan.clientName} subtitle={plan.title} icon="clipboard"
      status={`${status} · Version ${plan.version ?? 1}`} />
    <View style={styles.actions}>
      {canEdit ? <PremiumButton title="Pflegeplan fortschreiben" size="sm" onPress={() => edit()} /> : null}
      <PremiumButton title="Dokumentationsbogen drucken" size="sm" variant="secondary" loading={printing} disabled={printing} onPress={print} />
    </View>
    {printError ? <ErrorState presentation="inline" message={printError} /> : null}
    <CareWorkspaceTabs label="Bereiche der Pflegeplanung" value={active} onChange={setTab} tabs={items.map(entry => ({
      ...entry, count: entry.key === 'measures' ? measures.filter(task => task.itemState !== 'cancelled').length
        : entry.key === 'drinking' || entry.key === 'positioning' ? plan.tasks.filter(task => task.activity?.kind === entry.key && task.itemState !== 'cancelled').length : undefined,
    }))} />
    <CareWorkspaceColumns aside={<SectionPanel title="Zur Pflegeplanung">
      {displayModel ? <DetailInfoRow label="Pflegemodell" value={displayModel} /> : null}
      <DetailInfoRow label="Gültig ab" value={formatDate(plan.validFrom)} />
      <DetailInfoRow label="Gültig bis" value={plan.validUntil ? formatDate(plan.validUntil) : 'Unbefristet'} />
      {plan.careLevel ? <DetailInfoRow label="Pflegegrad" value={formatCareLevel(plan.careLevel)} /> : null}
      {plan.employeeName && plan.employeeName !== '—' ? <DetailInfoRow label="Zuständige Pflegekraft" value={plan.employeeName} /> : null}
      {rights.can('pflege.documentation.view') ? <PremiumButton title="Berichteblatt" size="sm" variant="secondary"
        onPress={() => open(`/pflege/dokumentation?clientId=${encodeURIComponent(plan.clientId)}`)} /> : null}
      {rights.can('pflege.wounds.view') ? <PremiumButton title="Wundfälle zur Person" size="sm" variant="secondary"
        onPress={() => open(`/pflege/wunddokumentation?clientId=${encodeURIComponent(plan.clientId)}`)} /> : null}
    </SectionPanel>}>
      {active === 'overview' ? <>
        <SectionPanel title="Pflegebedarf und Ziele">
          <DetailInfoRow label="Pflegeprobleme und Unterstützungsbedarf" value={plan.summary || '—'} />
          {plan.resources ? <DetailInfoRow label="Fähigkeiten und Ressourcen" value={plan.resources} /> : null}
          {plan.goals ? <DetailInfoRow label="Pflegeziele" value={plan.goals} /> : null}
          {plan.risks ? <DetailInfoRow label="Risiken und Einflussfaktoren" value={plan.risks} /> : null}
        </SectionPanel>
        <NativeCarePlanSourcePanel key={`${id}:${plan.clientId}:${plan.assessmentId ?? 'unlinked'}`}
          planId={id} clientId={plan.clientId} sourceAssessmentId={plan.assessmentId ?? null} />
      </> : null}
      {active === 'measures' ? <SectionPanel title="Individuelle Maßnahmen">
        {measures.length ? measures.map(task => <TaskCard key={task.id} task={task} />) :
          <EmptyState title="Keine allgemeinen Maßnahmen" message="Individuelle Trink- und Lagerungstermine erscheinen in den jeweiligen Bereichen." />}
      </SectionPanel> : null}
      {active === 'drinking' || active === 'positioning' ? <SavedCarePlanActivityPanel tasks={plan.tasks} kind={active}
        key={active} onEdit={canEdit ? () => edit(active) : undefined}
        onFluidBalance={active === 'drinking' && canRecordFluid ? recordFluidBalance : undefined} /> : null}
      {active === 'respiratory' && canAtem ? <CarePlanRespiratoryPanel key={`${plan.id}:${profile?.id}`}
        scope={{ tenantId: plan.tenantId, planId: plan.id }} actorId={profile?.id}
        isCurrent={() => isCurrent() && rights.can('pflege.vitals.view')}
        canWrite={rights.can('pflege.vitals.manage') && plan.status !== 'archiviert' && plan.status !== 'abgeschlossen'} /> : null}
      {active === 'evaluation' && canEvaluate ? <SectionPanel title="Evaluation und Prüftermine">
        {evaluable.some(item => item.nextEvaluationAt || item.evaluationCriteria) ? evaluable.filter(item => item.nextEvaluationAt || item.evaluationCriteria)
          .map(task => <View key={task.id} style={[styles.measure, { borderColor: '#ACC5D9' }]}>
            <DetailInfoRow label={task.label} value={task.nextEvaluationAt ? formatDate(task.nextEvaluationAt) : 'Prüftermin offen'} />
            {task.evaluationCriteria ? <DetailInfoRow label="Woran wird die Wirkung erkannt?" value={task.evaluationCriteria} /> : null}
          </View>) : <EmptyState title="Prüftermine noch offen" message="Die Termine und Kriterien lassen sich in den zugehörigen Maßnahmen festlegen." />}
        <PremiumButton title="Evaluationen zu diesem Pflegeplan" onPress={() => open(`/pflege/evaluation?carePlanId=${encodeURIComponent(plan.id)}`)} />
      </SectionPanel> : null}
      {active === 'links' ? <PflegeCrossModuleLinksPanel context="care-plan" title="Leistungsübersicht"
        scope={{ clientId: plan.clientId, carePlanId: plan.id, can: permission => isCurrent() && rights.can(permission) }} /> : null}
    </CareWorkspaceColumns>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  measure: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: 16, minWidth: 0 },
  measureHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1, minWidth: 130, gap: spacing.xs },
});
