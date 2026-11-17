import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { CarePlanActivityFields } from '@/components/pflege/CarePlanActivityPanel';
import { CarePlanningTemplatePicker, type PlanningTemplateTarget } from '@/components/pflege/CarePlanningTemplatePicker';
import { CareWorkspaceColumns, CareWorkspaceHeader, CareWorkspaceTabs, type CareWorkspaceTab } from '@/components/pflege/CareWorkspaceLayout';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { createCarePlan, fetchCarePlanAssessmentSources, fetchCarePlanList, updateCarePlan } from '@/lib/pflege/carePlanListService';
import { fetchCarePlanDetail } from '@/lib/pflege/carePlanDetailService';
import { carePlanningCategory, carePlanningModels, type CarePlanningModel } from '@/lib/pflege/carePlanningModels';
import { appendPlanningText, type CarePlanningTemplate, type PlanningTemplateKind } from '@/lib/pflege/carePlanningTemplates';
import { carePlanActivityLabels, newPlanActivity, parsePlanActivity, planActivityDraft, planActivityFrequency, type CarePlanActivityDraft, type CarePlanActivityKind } from '@/lib/pflege/carePlanActivities';
import type { LiveCarePlanInput } from '@/lib/pflege/carePlanRepository.supabase';
import { isCalendarDate } from '@/lib/pflege/ambulatoryOperationsDomain';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { matchesSearchQuery } from '@/lib/search/tenantSearchMatch';
import { spacing, typography } from '@/theme';
import type { CarePlanDetail, CarePlanTask } from '@/types/modules/pflege';

type Item = LiveCarePlanInput['items'][number];
type DraftMeasure = { key: number; item: Item; activity?: CarePlanActivityDraft };
type EditorTab = 'general' | 'measures' | CarePlanActivityKind;

const tabs: CareWorkspaceTab<EditorTab>[] = [
  { key: 'general', label: 'Pflegebedarf', icon: 'clipboard' },
  { key: 'measures', label: 'Maßnahmen', icon: 'list' },
  { key: 'drinking', label: 'Trinkplan', icon: 'droplet' },
  { key: 'positioning', label: 'Lagerung', icon: 'layers' },
];
const labels = carePlanningModels.map(model => ({ key: model.key, label: model.label }));
const basicFields = [
  { field: 'title', label: 'Maßnahme *' },
  { field: 'description', label: 'Pflegeproblem oder konkreter Unterstützungsbedarf', multiline: true },
  { field: 'personContribution', label: 'Was kann die Person selbst beitragen?', multiline: true },
  { field: 'goal', label: 'Pflegeziel für diese Maßnahme *', multiline: true },
  { field: 'intervention', label: 'Wie wird die Maßnahme durchgeführt? *', multiline: true },
] as const;
const detailedFields = [
  { field: 'responsibleRole', label: 'Zuständige Person oder Rolle' },
  { field: 'relativesContribution', label: 'Vereinbarte Unterstützung durch Angehörige' },
  { field: 'warningSigns', label: 'Warn- und Abbruchkriterien' },
  { field: 'escalationPath', label: 'Eskalationsweg' },
  { field: 'evaluationCriteria', label: 'Woran wird die Wirkung erkannt?' },
  { field: 'notes', label: 'Individuelle Bemerkungen' },
] as const;

const templateKinds: Partial<Record<keyof Item, readonly PlanningTemplateKind[]>> = {
  description: ['problem', 'cause'], personContribution: ['resource'], goal: ['goal'], intervention: ['measure', 'standard'],
};

function draftMeasure(task: CarePlanTask, key: number, copy: boolean): DraftMeasure {
  return {
    key,
    activity: task.activity ? planActivityDraft(task.activity) : undefined,
    item: {
      ...(copy ? {} : { id: task.id, status: task.itemState ?? 'active', nextEvaluationAt: task.nextEvaluationAt }),
      title: task.label, category: task.category, description: task.description, goal: task.goal, intervention: task.intervention,
      frequency: task.frequency, timing: task.timing, responsibleRole: task.responsibleRole, personContribution: task.personContribution,
      relativesContribution: task.relativesContribution, warningSigns: task.warningSigns, escalationPath: task.escalationPath,
      evaluationCriteria: task.evaluationCriteria, evaluationIntervalDays: task.evaluationIntervalDays, notes: task.notes,
    },
  };
}

function modelOf(plan: CarePlanDetail | undefined) {
  return plan?.planningModel ?? carePlanningModels.find(model => plan?.tasks.some(task => task.category === model.label ||
    task.category?.startsWith(`${model.label} · `)))?.key ?? null;
}

export function CarePlanCreateScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  return <CarePlanEditor key={`${tenantId}:${profile?.id}`} />;
}

export function CarePlanEditor({ plan }: { plan?: CarePlanDetail }) {
  const router = useRouter();
  const { area, clientId: requestedClient } = useLocalSearchParams<{ area?: string; clientId?: string }>();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const rights = useCareRuntimePermissions();
  const { c } = useCareLightPalette();
  const canEdit = rights.canAll(['pflege.plans.view', 'pflege.plans.manage']);
  const editing = plan !== undefined;
  const role = rights.roleKey ?? profile?.roleKey;
  const clients = useAsyncQuery(
    () => fetchEligibleCareClients(tenantId!, role, { effectivePermissions: rights.permissions }),
    [tenantId, profile?.id, role, rights.permissions],
    { enabled: Boolean(tenantId && canEdit && !editing), queryKey: `pflegeplan-klient:innen:${tenantId}:${profile?.id}` },
  );
  const [clientId, setClientId] = useState(plan?.clientId ?? (typeof requestedClient === 'string' ? requestedClient : ''));
  const [clientSearch, setClientSearch] = useState('');
  const [shownClients, setShownClients] = useState(10);
  const [planTitle, setPlanTitle] = useState(plan?.title ?? '');
  const [description, setDescription] = useState(plan?.summary ?? '');
  const [goals, setGoals] = useState(plan?.goals ?? '');
  const [resources, setResources] = useState(plan?.resources ?? '');
  const [risks, setRisks] = useState(plan?.risks ?? '');
  const [validFrom, setValidFrom] = useState(() => plan?.validFrom.slice(0, 10) ?? berlinCalendarDate());
  const [validUntil, setValidUntil] = useState(plan?.validUntil?.slice(0, 10) ?? '');
  const [model, setModel] = useState<CarePlanningModel | null>(() => modelOf(plan));
  const [tab, setTab] = useState<EditorTab>(() => tabs.find(entry => entry.key === area)?.key ?? 'general');
  const [measures, setMeasures] = useState<DraftMeasure[]>(() => plan ?
    plan.tasks.filter(task => task.itemState !== 'cancelled').map((task, index) => draftMeasure(task, index, false)) :
    []);
  const nextMeasureKey = useRef(measures.length);
  const [templateTarget, setTemplateTarget] = useState<PlanningTemplateTarget | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [sourceAssessmentId, setSourceAssessmentId] = useState(plan?.assessmentId ?? null);
  const [copyId, setCopyId] = useState('');
  const [copiedFrom, setCopiedFrom] = useState('');
  const [caseBound, setCaseBound] = useState(false);
  const [busy, setBusy] = useState<'copy' | 'save' | null>(null);
  const inFlight = useRef<boolean>(false);
  const receiptRef = useRef<{ requestId: string; contents: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const own = useRef({ tenantId, actor: profile?.id, clientId });
  own.current = { tenantId, actor: profile?.id, clientId };
  const authorised = () => canEdit && rights.canAll(['pflege.plans.view', 'pflege.plans.manage']) &&
    own.current.tenantId === tenantId && own.current.actor === profile?.id && own.current.clientId === clientId;
  const permission = { effectivePermissions: rights.permissions };
  const clientList = canEdit && !clients.error && !clients.refreshError ? clients.data ?? [] : [];
  const selected = clientList.find(person => person.id === clientId);
  const subjectName = plan?.clientName ?? (selected ? [selected.firstName, selected.lastName].filter(Boolean).join(' ') : '');
  const isCaseSelected = editing || Boolean(selected);
  const ownPlans = useAsyncQuery(async () => {
    const result = await fetchCarePlanList(tenantId!, role, permission, clientId);
    return result;
  }, [tenantId, profile?.id, clientId, rights.permissions, role], {
    enabled: Boolean(tenantId && !editing && showCopy && selected && canEdit),
    queryKey: `pflegeplan-kopie:${tenantId}:${profile?.id}:${clientId}`,
  });
  const assessments = useAsyncQuery(() => fetchCarePlanAssessmentSources(tenantId!, clientId, role, permission),
    [tenantId, clientId, profile?.id, role, rights.permissions], {
      enabled: Boolean(tenantId && clientId && canEdit && showSources && isCaseSelected),
      queryKey: `pflegeplan-quellen:${tenantId}:${clientId}:${profile?.id}`,
    });
  const search = clientSearch.trim().split(/[\s,]+/).filter(Boolean);
  const matchingClients = clientList.filter(entry => search.every(word => matchesSearchQuery(word, entry.firstName, entry.lastName)));
  const caseOptions = matchingClients.slice(0, shownClients);
  if (selected && !caseOptions.some(option => option.id === selected.id)) caseOptions.unshift(selected);
  const changePossible = !editing && !busy && !caseBound && !planTitle.trim() && !description.trim() &&
    !goals.trim() && !resources.trim() && !risks.trim() && !measures.some(entry => entry.item.title.trim() || entry.activity);
  const tabMeasures = measures.filter(measure => tab === 'measures' ? !measure.activity : measure.activity?.kind === tab);

  function changePerson(id: string) {
    if (!changePossible || !clientList.some(person => person.id === id)) return;
    setCopyId('');
    setSourceAssessmentId(null);
    setShowSources(false);
    receiptRef.current = null;
    setClientId(id);
  }

  function patchMeasure(key: number, patch: Partial<DraftMeasure>) {
    setMeasures(current => current.map(measure => measure.key === key ? { ...measure, ...patch } : measure));
  }

  function changeMeasureItem(key: number, patch: Partial<Item>) {
    setMeasures(current => current.map(measure => measure.key === key ? { ...measure, item: { ...measure.item, ...patch } } : measure));
  }

  function addMeasure(kind?: CarePlanActivityKind) {
    const key = nextMeasureKey.current++;
    setMeasures(current => [...current, { key, item: { title: '' }, activity: kind ? newPlanActivity(kind) : undefined }]);
  }

  async function importPlan() {
    if (!tenantId || inFlight.current || !authorised() || !selected || !ownPlans.data?.some(row => row.id === copyId && row.clientId === clientId)) return;
    inFlight.current = true;
    setBusy('copy');
    setError(null);
    try {
      const result = await fetchCarePlanDetail(copyId, tenantId, role, permission);
      if (!authorised()) return;
      if (!result.ok) return setError(result.error);
      const candidate = result.data;
      if (candidate.clientId !== clientId || candidate.tenantId !== tenantId || candidate.id !== copyId) {
        return setError('Die ausgewählte Planung gehört zu einer anderen Akte.');
      }
      setPlanTitle(candidate.title);
      setDescription(candidate.summary);
      setGoals(candidate.goals ?? '');
      setResources(candidate.resources ?? '');
      setRisks(candidate.risks ?? '');
      setModel(modelOf(candidate));
      setMeasures(candidate.tasks.filter(task => task.itemState !== 'cancelled')
        .map(task => draftMeasure(task, nextMeasureKey.current++, true)));
      setCopiedFrom(candidate.title);
      setCaseBound(true);
      setValidUntil('');
      setShowCopy(false);
    } catch {
      if (authorised()) setError('Die vorhandene Planung konnte nicht übernommen werden.');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  function openTemplates(label: string, kinds: readonly PlanningTemplateKind[], insert: (item: CarePlanningTemplate) => void) {
    if (!model || !isCaseSelected || busy) return undefined;
    const onPress = () => setTemplateTarget({ label, kinds, onInsert: template => {
      if (!authorised()) return;
      setCaseBound(true);
      insert(template);
    } });
    return <PremiumButton title="Textbausteine" accessibilityLabel={`Textbausteine für ${label}`} size="sm" variant="secondary"
      disabled={Boolean(busy)} onPress={onPress} />;
  }

  async function save() {
    if (!tenantId || inFlight.current || !authorised()) return;
    setError(null);
    if (!isCaseSelected || !planTitle.trim() || !description.trim() || !goals.trim() || !isCalendarDate(validFrom)
      || (validUntil && (!isCalendarDate(validUntil) || validUntil < validFrom))) {
      setTab('general');
      return setError('Ergänzen Sie Pflegefall, Bezeichnung, Pflegebedarf, Ziele und einen gültigen Zeitraum.');
    }
    const items: Item[] = [];
    for (const entry of measures) {
      const item = entry.item;
      const activity = entry.activity ? parsePlanActivity(entry.activity) : null;
      const frequency = activity ? planActivityFrequency(activity) : item.frequency;
      if (entry.activity && !activity) {
        setTab(entry.activity.kind);
        return setError('Ergänzen Sie Wochentage, gültige Uhrzeiten und das individuelle Angebot oder die Position.');
      }
      if (!item.title.trim() || (!item.id && (!item.goal?.trim() || !item.intervention?.trim() || !frequency?.trim())) ||
        (item.nextEvaluationAt && !isCalendarDate(item.nextEvaluationAt))) {
        setTab(entry.activity?.kind ?? 'measures');
        return setError('Ergänzen Sie Bezeichnung, Ziel, Durchführung und Häufigkeit der neuen Maßnahmen. Prüfen Sie die Evaluationstermine.');
      }
      items.push({ ...item, frequency, activity, category: item.category || labels.find(option => option.key === model)?.label,
        status: item.status ?? 'active', sortOrder: items.length });
    }
    if (!items.length && !editing) {
      setTab('measures');
      return setError('Legen Sie mindestens eine individuelle Maßnahme an.');
    }
    const payload: LiveCarePlanInput = {
      id: plan?.id, expectedVersion: editing ? plan.version ?? 1 : null, planningModel: model, clientId, title: planTitle,
      description, resources, goals, risks, validFrom, validUntil: validUntil || null, sourceAssessmentId,
      primaryNurseId: plan?.primaryNurseId ?? null, actorName: profile?.displayName ?? 'Pflegefachperson', items,
    };
    const contents = JSON.stringify(payload);
    if (!receiptRef.current || (editing && receiptRef.current.contents !== contents)) {
      receiptRef.current = { requestId: randomUUID(), contents };
    }
    payload.requestId = receiptRef.current.requestId;
    inFlight.current = true;
    setBusy('save');
    try {
      const result = plan ? await updateCarePlan(tenantId, role, { ...payload, id: plan.id }, permission) :
        await createCarePlan(tenantId, role, payload, permission);
      if (!authorised()) return;
      if (result.ok) setSavedId(result.data.id);
      else setError(result.error);
    } catch {
      if (authorised()) setError('Der Speicherbeleg konnte nicht gelesen werden. Sie können denselben Entwurf erneut speichern.');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  const screenTitle = editing ? 'Pflegeplan bearbeiten' : 'Pflegeplan anlegen';
  if (rights.loading || (clients.loading && !editing)) return <ScreenShell title={screenTitle}><LoadingState message="Pflegefall und Berechtigungen werden geladen…" /></ScreenShell>;
  if (!canEdit) return <ScreenShell title={screenTitle}><ErrorState message={rights.error ?? 'Das Recht zur Bearbeitung von Pflegeplänen fehlt.'} onRetry={rights.refreshPermissions} /></ScreenShell>;
  if (savedId) return <ScreenShell title={editing ? 'Pflegeplan fortgeschrieben' : 'Pflegeplan angelegt'} showBack={false}>
    <SuccessState message={editing ? 'Die neue Planversion wurde gespeichert.' : 'Der Pflegeplan wurde als Entwurf gespeichert.'} />
    <PremiumButton title="Pflegeplan öffnen" onPress={() => router.replace(`/pflege/plans/${savedId}` as never)} />
  </ScreenShell>;

  const action = <PremiumButton title={editing ? 'Neue Planversion speichern' : 'Pflegeplan speichern'}
    loading={busy === 'save'} disabled={Boolean(busy) || !isCaseSelected} onPress={save} />;
  const available = clients.error ?? clients.refreshError;

  return <ScreenShell title={screenTitle} compactHeader onBack={() => router.back()}>
    <CareWorkspaceHeader icon="clipboard" title={subjectName || 'Individuelle Pflegeplanung'}
      subtitle={planTitle.trim() || 'Ambulante Pflege'} status={editing ? `Version ${plan.version ?? 1}` : 'Neuer Entwurf'} />
    <CareWorkspaceTabs label="Pflegeplanung" tabs={tabs.map(entry => ({
      ...entry, count: entry.key === 'general' ? undefined : measures.filter(measure => entry.key === 'measures'
        ? !measure.activity : measure.activity?.kind === entry.key).length,
    }))} value={tab} onChange={busy ? undefined : setTab} />
    {error ? <ErrorState presentation="inline" title="Pflegeplan prüfen" message={error} /> : null}
    <CareWorkspaceColumns aside={<SectionPanel title="Planübersicht">
      <Text style={[typography.bodyStrong, { color: c.text }]}>{subjectName || 'Pflegefall auswählen'}</Text>
      <Text style={[typography.body, { color: c.muted }]}>{labels.find(option => option.key === model)?.label ?? 'Pflegemodell offen'}</Text>
      <Text style={[typography.caption, { color: c.muted }]}>{measures.length} {measures.length === 1 ? 'Maßnahme' : 'Maßnahmen'}</Text>
      {action}
      <PremiumButton title="Abbrechen" variant="ghost" disabled={Boolean(busy)} onPress={() => router.back()} />
    </SectionPanel>}>
      {tab === 'general' ? <>
        <SectionPanel title="Pflegefall und Modell">
          {!editing ? <>
            {available ? <ErrorState presentation="inline" message={available} onRetry={clients.refresh} /> : null}
            <PremiumInput label="Pflegeklient:innen suchen" value={clientSearch} onChangeText={value => { setClientSearch(value); setShownClients(10); }}
              editable={changePossible} />
            <FilterChipGroup wrap options={caseOptions.map(person => ({ key: person.id, label: `${person.lastName}, ${person.firstName}` }))}
              value={clientId} onChange={changePossible ? changePerson : undefined} />
            {!caseOptions.length && !available ? <Text style={[typography.body, { color: c.muted }]}>
              {clientList.length ? 'Keine passenden Pflegefälle.' : 'Für einen Pflegeplan ist ein aktiver ambulanter Pflegefall erforderlich.'}
            </Text> : null}
            {shownClients < matchingClients.length ? <PremiumButton title="Weitere Pflegefälle" variant="secondary" size="sm"
              disabled={!changePossible} onPress={() => setShownClients(count => count + 10)} /> : null}
          </> : null}
          <FilterChipGroup wrap options={labels} value={model ?? undefined} onChange={busy ? undefined : setModel} />
          {isCaseSelected ? <PremiumButton title={showSources ? 'SIS®-Auswahl schließen' : 'Freigegebene SIS® zuordnen'}
            size="sm" variant="secondary" disabled={Boolean(busy)} onPress={() => setShowSources(open => !open)} /> : null}
          {sourceAssessmentId ? <Text style={[typography.caption, { color: c.muted }]}>Eine Informationssammlung ist zugeordnet.</Text> : null}
          {showSources ? <>
            {assessments.loading ? <LoadingState presentation="inline" message="Freigegebene Informationssammlungen werden geladen…" /> : null}
            {assessments.error || assessments.refreshError ? <ErrorState presentation="inline"
              message={assessments.error ?? assessments.refreshError ?? ''} onRetry={assessments.refresh} /> : null}
            {!assessments.loading && !assessments.error && !assessments.refreshError && !assessments.data?.length ?
              <Text style={[typography.body, { color: c.muted }]}>In dieser Akte ist keine freigegebene ambulante Informationssammlung verfügbar.</Text> : null}
            {!assessments.error && !assessments.refreshError && assessments.data?.length ? <FilterChipGroup wrap
              options={assessments.data.map(row => ({ key: row.id, label: `Version ${row.version}${row.approvedAt ? ' · ' + row.approvedAt.slice(0, 10).split('-').reverse().join('.') : ''}` }))}
              value={sourceAssessmentId ?? undefined} onChange={busy ? undefined : id => { if (authorised()) setSourceAssessmentId(id); }} /> : null}
            {sourceAssessmentId ? <PremiumButton title="Zuordnung lösen" size="sm" variant="ghost" disabled={Boolean(busy)}
              onPress={() => setSourceAssessmentId(null)} /> : null}
          </> : null}
          {!editing && selected ? <PremiumButton title={showCopy ? 'Übernahme schließen' : 'Vorhandene Planung übernehmen'}
            variant="secondary" size="sm" disabled={Boolean(busy)} onPress={() => setShowCopy(open => !open)} /> : null}
          {showCopy ? <>
            {ownPlans.loading ? <LoadingState presentation="inline" message="Planungen dieses Pflegefalls werden geladen…" /> : null}
            {ownPlans.error ? <ErrorState presentation="inline" message={ownPlans.error} onRetry={ownPlans.refresh} /> : null}
            {ownPlans.data?.length ? <FilterChipGroup wrap options={ownPlans.data.map(row => ({
              key: row.id, label: `${row.title} · ${row.validFrom.slice(0, 10)}`,
            }))} value={copyId} onChange={busy ? undefined : setCopyId} /> : null}
            {!ownPlans.loading && !ownPlans.error && !ownPlans.data?.length ? <Text style={[typography.body, { color: c.muted }]}>In dieser Akte liegt keine Planung zum Übernehmen vor.</Text> : null}
            {copyId ? <>
              <Text style={[typography.caption, { color: c.muted }]}>Die ausgewählte Planung ersetzt die Eingaben in diesem Entwurf. Die nächsten Evaluationstermine werden neu festgelegt.</Text>
              <PremiumButton title="In neuen Entwurf übernehmen" loading={busy === 'copy'} disabled={Boolean(busy)} onPress={importPlan} />
            </> : null}
          </> : null}
          {copiedFrom ? <Text style={[typography.caption, { color: c.muted }]}>{`Übernommen aus „${copiedFrom}“. Angaben für die aktuelle Situation prüfen.`}</Text> : null}
        </SectionPanel>
        <SectionPanel title="Pflegebedarf, Ressourcen und Ziele">
          <PremiumInput label="Bezeichnung *" value={planTitle} onChangeText={setPlanTitle} editable={isCaseSelected && !busy} />
          <PremiumInput label="Pflegeprobleme und Unterstützungsbedarf *" value={description} onChangeText={setDescription} multiline editable={isCaseSelected && !busy}
            labelAccessory={openTemplates('Pflegeprobleme und Unterstützungsbedarf *', ['problem', 'cause'], item => setDescription(current => appendPlanningText(current, item, subjectName)))} />
          <PremiumInput label="Fähigkeiten und Ressourcen" value={resources} onChangeText={setResources} multiline editable={isCaseSelected && !busy}
            labelAccessory={openTemplates('Fähigkeiten und Ressourcen', ['resource'], item => setResources(current => appendPlanningText(current, item, subjectName)))} />
          <PremiumInput label="Risiken und besondere Anforderungen" value={risks} onChangeText={setRisks} multiline editable={isCaseSelected && !busy} />
          <PremiumInput label="Übergreifende Pflegeziele *" value={goals} onChangeText={setGoals} multiline editable={isCaseSelected && !busy}
            labelAccessory={openTemplates('Übergreifende Pflegeziele *', ['goal'], item => setGoals(current => appendPlanningText(current, item, subjectName)))} />
          <View style={styles.row}>
            <View style={styles.field}><CareDateInput label="Gültig ab *" value={validFrom} onChange={value => { if (!busy) setValidFrom(value); }} showFormatHint={false} /></View>
            <View style={styles.field}><CareDateInput label="Gültig bis" value={validUntil} onChange={value => { if (!busy) setValidUntil(value); }} showFormatHint={false} /></View>
          </View>
          <PremiumButton size="sm" title="Zu den Maßnahmen" variant="secondary" disabled={Boolean(busy)} onPress={() => setTab('measures')} />
        </SectionPanel>
      </> : <SectionPanel title={tab === 'measures' ? 'Individuelle Maßnahmen' : carePlanActivityLabels[tab]}>
        {tab === 'drinking' ? <InfoBanner presentation="inline" variant="info" message="Wochentage, Uhrzeit und vereinbarte Unterstützung für jedes Trinkangebot erfassen." /> : null}
        {tab === 'positioning' ? <InfoBanner presentation="inline" variant="info" message="Die individuell vereinbarte Position oder Bewegung, Zeiten und Hilfsmittel erfassen." /> : null}
        {!tabMeasures.length ? <EmptyState title="Noch keine Maßnahme" message="Mit der Schaltfläche unten können Sie eine Maßnahme hinzufügen." /> : null}
        {tabMeasures.map((measure, index) => {
          const { key, item, activity } = measure;
          const editable = !busy && isCaseSelected;
          return <View key={key} style={[styles.measure, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.measureHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text accessibilityRole="header" style={[typography.h3, { color: c.text }]}>{item.title.trim() || `Maßnahme ${index + 1}`}</Text>
                {item.category ? <Text style={[typography.caption, { color: c.muted }]}>{item.category}</Text> : null}
              </View>
              <PremiumButton title={item.id ? 'Aus dem Plan nehmen' : 'Entfernen'} size="sm" variant="ghost" disabled={!editable}
                onPress={() => setMeasures(current => current.filter(entry => entry.key !== key))} />
            </View>
            {basicFields.map(({ field, label, ...inputProps }) => <PremiumInput key={field} label={label} value={item[field] ?? ''}
              onChangeText={value => changeMeasureItem(key, { [field]: value })} editable={editable} {...inputProps}
              labelAccessory={templateKinds[field] ? openTemplates(label, templateKinds[field]!, template => {
                setMeasures(current => current.map(entry => entry.key !== key ? entry : ({
                  ...entry, item: { ...entry.item, [field]: appendPlanningText(entry.item[field] ?? '', template, subjectName),
                    category: model ? carePlanningCategory(model, template.domain) : entry.item.category },
                })));
              }) : undefined} />)}
            {activity ? <CarePlanActivityFields value={activity} editable={editable} onChange={value => patchMeasure(key, { activity: value })} /> :
              <PremiumInput label="Wann und wie oft? *" value={item.frequency ?? ''} editable={editable}
                onChangeText={frequency => changeMeasureItem(key, { frequency })} />}
            <PremiumInput label="Zuständige Person oder Rolle" value={item.responsibleRole ?? ''} editable={editable}
              onChangeText={responsibleRole => changeMeasureItem(key, { responsibleRole })} />
            <CareDateInput label="Nächste Evaluation" value={item.nextEvaluationAt ?? ''} onChange={value => {
              if (editable) changeMeasureItem(key, { nextEvaluationAt: value || null });
            }} showFormatHint={false} />
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded.includes(key) }}
              onPress={() => setExpanded(current => current.includes(key) ? current.filter(entry => entry !== key) : [...current, key])}
              style={[styles.more, { borderColor: c.border }]}>
              <Text style={[typography.bodyStrong, { color: c.text }]}>{expanded.includes(key) ? 'Weitere Angaben einklappen' : 'Weitere Angaben und Evaluation'}</Text>
            </Pressable>
            {expanded.includes(key) ? detailedFields.filter(entry => entry.field !== 'responsibleRole').map(({ field, label }) =>
              <PremiumInput key={field} label={label} value={item[field] ?? ''} multiline editable={editable}
                onChangeText={value => changeMeasureItem(key, { [field]: value })} />) : null}
          </View>;
        })}
        <PremiumButton title={tab === 'measures' ? 'Weitere Maßnahme hinzufügen' : tab === 'drinking' ? 'Trinkangebot hinzufügen' : 'Lagerung hinzufügen'}
          variant="secondary" disabled={Boolean(busy) || !isCaseSelected} onPress={() => addMeasure(tab === 'measures' ? undefined : tab)} />
      </SectionPanel>}
    </CareWorkspaceColumns>
    {templateTarget && model && tenantId && isCaseSelected ? <CarePlanningTemplatePicker key={`${tenantId}:${clientId}:${model}:${templateTarget.label}`}
      model={model} target={templateTarget} setting="ambulant" tenantId={tenantId} role={role} actorId={profile?.id} clientName={subjectName}
      effectivePermissions={rights.permissions} canEditLibrary={canEdit} onClose={() => setTemplateTarget(null)} /> : null}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  measure: { gap: spacing.md, padding: spacing.md, borderWidth: 1, borderRadius: 17, minWidth: 0 },
  measureHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, minWidth: 0 },
  field: { flexGrow: 1, flexShrink: 1, flexBasis: 205, minWidth: 0 },
  more: { minHeight: 44, borderTopWidth: 1, justifyContent: 'center', paddingVertical: spacing.sm },
});
