import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { CarePlanningTemplatePicker, type PlanningTemplateTarget } from '@/components/pflege/CarePlanningTemplatePicker';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { createCarePlan, fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { fetchCarePlanDetail } from '@/lib/pflege/carePlanDetailService';
import { carePlanningCategory, carePlanningModels, type CarePlanningModel } from '@/lib/pflege/carePlanningModels';
import { appendPlanningText, type CarePlanningTemplate, type PlanningTemplateKind } from '@/lib/pflege/carePlanningTemplates';
import { hasPermission } from '@/lib/permissions';
import type { LiveCarePlanInput } from '@/lib/pflege/carePlanRepository.supabase';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { matchesSearchQuery } from '@/lib/search/tenantSearchMatch';
import { colors, radius, spacing, typography } from '@/theme';

type MeasureInput = LiveCarePlanInput['items'][number];
const measureFields = [
  { field: 'title', label: 'Maßnahme *' },
  { field: 'description', label: 'Pflegeproblem oder konkreter Unterstützungsbedarf', multiline: true },
  { field: 'personContribution', label: 'Was kann die Person selbst beitragen?', multiline: true },
  { field: 'goal', label: 'Pflegeziel für diese Maßnahme *', multiline: true },
  { field: 'intervention', label: 'Wie wird die Maßnahme durchgeführt? *', multiline: true },
  { field: 'frequency', label: 'Wann und wie oft? *' },
  { field: 'responsibleRole', label: 'Zuständige Person oder Rolle' },
  { field: 'relativesContribution', label: 'Vereinbarte Unterstützung durch Angehörige', multiline: true },
  { field: 'warningSigns', label: 'Warn- und Abbruchkriterien', multiline: true },
  { field: 'escalationPath', label: 'Eskalationsweg', multiline: true },
  { field: 'evaluationCriteria', label: 'Woran wird die Wirkung erkannt?', multiline: true },
  { field: 'notes', label: 'Individuelle Bemerkungen', multiline: true },
] as const satisfies readonly { field: keyof MeasureInput; label: string; multiline?: boolean }[];


export function CarePlanCreateScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const clients = useAsyncQuery(
    () => tenantId
      ? fetchEligibleCareClients(tenantId, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey],
    { enabled: Boolean(tenantId) },
  );
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [model, setModel] = useState<CarePlanningModel | null>(null);
  const [templateTarget, setTemplateTarget] = useState<PlanningTemplateTarget | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [copyId, setCopyId] = useState('');
  const [copiedFrom, setCopiedFrom] = useState('');
  const [caseBound, setCaseBound] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [resources, setResources] = useState('');
  const [risks, setRisks] = useState('');
  const [validFrom, setValidFrom] = useState(() => berlinCalendarDate(new Date()));
  const [validUntil, setValidUntil] = useState('');
  const nextMeasureKey = useRef(1);
  const saveFlight = useRef(false);
  const [measures, setMeasures] = useState<{ key: number; input: MeasureInput }[]>([{ key: 0, input: { title: '' } }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const clientList = clients.data ?? [];
  const selectedClient = clientList.find(client => client.id === clientId);
  const person = selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}`.trim() : '';
  const owner = `${tenantId ?? ''}:${profile?.id ?? ''}:${profile?.roleKey ?? ''}:${clientId}`;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const savedPlans = useAsyncQuery(
    async () => {
      if (!tenantId || !selectedClient) return { ok: false as const, error: 'Pflegefall auswählen.' };
      const result = await fetchCarePlanList(tenantId, profile?.roleKey);
      return result.ok ? { ok: true as const, data: result.data.filter(plan => plan.clientId === clientId) } : result;
    },
    [tenantId, profile?.id, profile?.roleKey, clientId],
    { enabled: showCopy && !!selectedClient, queryKey: `pflegeplan-kopieren:${owner}` },
  );
  const terms = clientSearch.trim().split(/[\s,]+/).filter(Boolean);
  const clientOptions = clientList.filter(client => client.id === clientId || terms.every(
    term => matchesSearchQuery(term, client.firstName, client.lastName),
  )).map(client => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` }));

  function addMeasure() {
    const key = nextMeasureKey.current++;
    setMeasures(current => [...current, { key, input: { title: '' } }]);
  }

  function editMeasure(key: number, patch: Partial<MeasureInput>) {
    setMeasures(current => current.map(measure => measure.key === key
      ? { ...measure, input: { ...measure.input, ...patch } }
      : measure));
  }

  function changeClient(next: string) {
    if (busy || copyBusy || caseBound || !clientList.some(client => client.id === next)) return;
    setCopyId('');
    setClientId(next);
  }

  function templateButton(label: string, kinds: readonly PlanningTemplateKind[], onInsert: (template: CarePlanningTemplate) => void) {
    if (!model || !selectedClient) return undefined;
    return <PremiumButton title="Textbausteine" accessibilityLabel={`Textbausteine für ${label}`} size="sm"
      variant="secondary" disabled={busy || copyBusy} onPress={() => setTemplateTarget({ label, kinds, onInsert: template => {
        if (currentOwner.current !== owner) return;
        setCaseBound(true);
        onInsert(template);
      } })} />;
  }

  function insertMeasureText(key: number, field: 'description' | 'personContribution' | 'goal' | 'intervention', template: CarePlanningTemplate) {
    setMeasures(current => current.map(measure => measure.key !== key ? measure : {
      ...measure,
      input: {
        ...measure.input,
        category: model ? carePlanningCategory(model, template.domain) : measure.input.category,
        [field]: appendPlanningText(measure.input[field] ?? '', template, person),
      },
    }));
  }

  async function importPlan() {
    if (!tenantId || copyBusy || busy || !copyId || !savedPlans.data?.some(plan => plan.id === copyId && plan.clientId === clientId)) return;
    setCopyBusy(true);
    setError(null);
    try {
      const result = await fetchCarePlanDetail(copyId, tenantId, profile?.roleKey);
      if (currentOwner.current !== owner) return;
      if (!result.ok) return setError(result.error);
      const plan = result.data;
      if (plan.tenantId !== tenantId || plan.clientId !== clientId || plan.id !== copyId) return setError('Die Planung gehört zu einer anderen Akte.');
      setTitle(plan.title);
      setDescription(plan.summary);
      setGoals(plan.goals ?? '');
      setResources(plan.resources ?? '');
      setRisks(plan.risks ?? '');
      setMeasures(plan.tasks.length ? plan.tasks.map(task => ({ key: nextMeasureKey.current++, input: {
        title: task.label, category: task.category, description: task.description, goal: task.goal,
        intervention: task.intervention, frequency: task.frequency, timing: task.timing,
        responsibleRole: task.responsibleRole, personContribution: task.personContribution,
        relativesContribution: task.relativesContribution, warningSigns: task.warningSigns,
        escalationPath: task.escalationPath, evaluationCriteria: task.evaluationCriteria, notes: task.notes,
      } })) : [{ key: nextMeasureKey.current++, input: { title: '' } }]);
      const priorModel = carePlanningModels.find(candidate => plan.tasks.some(task => task.category?.startsWith(candidate.label)));
      if (priorModel) setModel(priorModel.key);
      setCopiedFrom(plan.title);
      setValidUntil('');
      setCaseBound(true);
      setShowCopy(false);
    } catch {
      if (currentOwner.current === owner) setError('Die vorhandene Planung konnte nicht gelesen werden.');
    } finally {
      if (currentOwner.current === owner) setCopyBusy(false);
    }
  }

  const save = async () => {
    if (saveFlight.current) return;
    setError(null);
    if (!tenantId) return setError('Kein Mandant verfügbar.');
    if (!clientList.some(client => client.id === clientId) || !title.trim() || !description.trim() || !goals.trim() || !validFrom) {
      return setError('Bitte Pflegefall, Bezeichnung, Pflegebedarf, Pflegeziele und Gültigkeitsbeginn angeben.');
    }
    if (validUntil && validUntil < validFrom) return setError('Das Gültigkeitsende liegt vor dem Beginn.');
    const incomplete = measures.findIndex(({ input }) => !input.title.trim() || !input.goal?.trim() || !input.intervention?.trim() || !input.frequency?.trim());
    if (incomplete >= 0) return setError(`Maßnahme ${incomplete + 1} braucht eine Bezeichnung, ein Ziel, eine Durchführung und eine Häufigkeit.`);

    saveFlight.current = true;
    setBusy(true);
    try {
      const result = await createCarePlan(tenantId, profile?.roleKey, {
        clientId,
        title,
        description,
        goals,
        resources,
        risks,
        validFrom,
        validUntil: validUntil || null,
        sourceAssessmentId: null,
        primaryNurseId: null,
        actorName: profile?.displayName ?? 'Pflegefachperson',
        items: measures.map(({ input }, sortOrder) => ({
          ...input,
          category: input.category || carePlanningModels.find(option => option.key === model)?.label,
          status: 'active', sortOrder,
        })),
      });
      if (currentOwner.current !== owner) return;
      if (!result.ok) setError(result.error);
      else setCreatedId(result.data.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Speicherstand konnte nicht bestätigt werden.');
    } finally {
      saveFlight.current = false;
      setBusy(false);
    }
  };

  if (clients.loading) {
    return <ScreenShell title="Pflegeplan anlegen"><LoadingState message="Aktive Pflegefälle werden geladen…" /></ScreenShell>;
  }
  if (createdId) {
    return (
      <ScreenShell title="Pflegeplan angelegt" showBack={false}>
        <SuccessState message="Der Pflegeplan und seine Maßnahmen wurden als Entwurf gespeichert." />
        <PremiumButton title="Pflegeplan öffnen" fullWidth onPress={() => router.replace(`/pflege/plans/${createdId}` as never)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Pflegeplan anlegen" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="PFLEGEPLANUNG"
          title="Individuellen Pflegeplan erstellen"
          meta="Pflegebedarf, vorhandene Fähigkeiten und vereinbarte Unterstützung"
          icon="📋"
          formMode="create"
          accentColor={colors.cyan}
        />
        <SectionPanel title="Pflegefall">
          {clients.error ? <ErrorState message={clients.error} onRetry={clients.refresh} /> : null}
          {clientList.length ? (
            <>
              <PremiumInput label="Pflegeklient:innen suchen" value={clientSearch} onChangeText={setClientSearch} editable={!busy} />
              <FilterChipGroup wrap options={clientOptions} value={clientId} onChange={busy || copyBusy || caseBound ? undefined : changeClient} />
              {!clientOptions.length ? <Text style={styles.hint}>Keine passenden Pflegefälle.</Text> : null}
            </>
          ) : !clients.error ? <Text style={styles.hint}>Für die Pflegeplanung muss ein aktiver Pflegefall vorhanden sein.</Text> : null}
        </SectionPanel>
        <SectionPanel title="Pflegemodell" subtitle="Ambulante Pflege">
          <FilterChipGroup wrap options={carePlanningModels.map(item => ({ ...item }))} value={model ?? undefined}
            onChange={busy || copyBusy ? undefined : key => setModel(key)} />
          {selectedClient ? <PremiumButton title={showCopy ? 'Übernahme schließen' : 'Vorhandene Planung übernehmen'}
            variant="secondary" disabled={busy || copyBusy} onPress={() => setShowCopy(value => !value)} /> : null}
          {showCopy ? <>
            {savedPlans.loading ? <LoadingState message="Planungen dieses Pflegefalls werden geladen…" /> : null}
            {savedPlans.error ? <ErrorState message={savedPlans.error} onRetry={savedPlans.refresh} /> : null}
            {savedPlans.data?.length ? <FilterChipGroup wrap options={savedPlans.data.map(plan => ({ key: plan.id, label: `${plan.title} · ${plan.validFrom.slice(0, 10)}` }))}
              value={copyId} onChange={copyBusy ? undefined : setCopyId} /> : null}
            {!savedPlans.loading && !savedPlans.error && !savedPlans.data?.length ? <Text style={styles.hint}>In dieser Akte liegt keine Planung zum Übernehmen vor.</Text> : null}
            {copyId ? <>
              <Text style={styles.hint}>Die ausgewählte Planung ersetzt die Eingaben in diesem Entwurf. Termine für die nächste Evaluation werden neu festgelegt.</Text>
              <PremiumButton title="In neuen Entwurf übernehmen" loading={copyBusy} disabled={copyBusy || busy} onPress={importPlan} />
            </> : null}
          </> : null}
          {copiedFrom ? <Text style={styles.hint}>Übernommen aus „{copiedFrom}“. Bitte die Angaben für die aktuelle Situation prüfen.</Text> : null}
        </SectionPanel>
        <SectionPanel title="Pflegebedarf, Ressourcen und Ziele">
          <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} editable={!busy} />
          <PremiumInput label="Pflegeprobleme und Unterstützungsbedarf *" value={description} onChangeText={setDescription} multiline editable={!busy} labelAccessory={templateButton("Pflegeprobleme und Unterstützungsbedarf *", ['problem', 'cause'], item => setDescription(current => appendPlanningText(current, item, person)))} />
          <PremiumInput label="Fähigkeiten und Ressourcen" value={resources} onChangeText={setResources} multiline editable={!busy} labelAccessory={templateButton("Fähigkeiten und Ressourcen", ['resource'], item => setResources(current => appendPlanningText(current, item, person)))} />
          <PremiumInput label="Risiken und besondere Anforderungen" value={risks} onChangeText={setRisks} multiline editable={!busy} />
          <PremiumInput label="Übergreifende Pflegeziele *" value={goals} onChangeText={setGoals} multiline editable={!busy} labelAccessory={templateButton("Übergreifende Pflegeziele *", ['goal'], item => setGoals(current => appendPlanningText(current, item, person)))} />
          <View style={styles.row}>
            <View style={styles.column}><CareDateInput label="Gültig ab *" value={validFrom} onChange={value => { if (!busy) setValidFrom(value); }} showFormatHint={false} /></View>
            <View style={styles.column}><CareDateInput label="Gültig bis" value={validUntil} onChange={value => { if (!busy) setValidUntil(value); }} showFormatHint={false} /></View>
          </View>
        </SectionPanel>
        <SectionPanel title="Individuelle Maßnahmen">
          {measures.map(({ key, input }, index) => (
            <View key={key} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.measureTitle}>{input.title.trim() || `Maßnahme ${index + 1}`}</Text>
                {measures.length > 1 ? <PremiumButton title="Entfernen" size="sm" variant="ghost" disabled={busy} onPress={() => setMeasures(current => current.filter(measure => measure.key !== key))} /> : null}
              </View>
              {input.category ? <Text style={styles.hint}>{input.category}</Text> : null}
              {measureFields.map(({ field, label, ...options }) => {
                const kinds = field === 'description' ? ['problem', 'cause'] as const
                  : field === 'personContribution' ? ['resource'] as const
                  : field === 'goal' ? ['goal'] as const
                  : field === 'intervention' ? ['measure', 'standard'] as const : null;
                const accessory = kinds ? templateButton(label, kinds, item => {
                  if (field === 'description' || field === 'personContribution' || field === 'goal' || field === 'intervention') {
                    insertMeasureText(key, field, item);
                  }
                }) : undefined;
                return <PremiumInput key={field} label={label} value={input[field] ?? ''} onChangeText={value => editMeasure(key, { [field]: value })}
                  editable={!busy} labelAccessory={accessory} {...options} />;
              })}
              <CareDateInput label="Nächste Evaluation" value={input.nextEvaluationAt ?? ''} onChange={value => { if (!busy) editMeasure(key, { nextEvaluationAt: value || null }); }} showFormatHint={false} />
            </View>
          ))}
          <PremiumButton title="Weitere Maßnahme hinzufügen" variant="secondary" disabled={busy} onPress={addMeasure} />
        </SectionPanel>
        {error ? <ErrorState title="Pflegeplan nicht gespeichert" message={error} /> : null}
        <PremiumButton title="Pflegeplan speichern" fullWidth loading={busy} disabled={busy || copyBusy || !clientList.length || Boolean(clients.error)} onPress={save} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth disabled={busy} onPress={() => router.back()} />
      </ScrollView>
      {templateTarget && model && tenantId && selectedClient ? <CarePlanningTemplatePicker
        key={`${owner}:${model}:${templateTarget.label}`} model={model} target={templateTarget} setting="ambulant"
        tenantId={tenantId} role={profile?.roleKey} actorId={profile?.id} clientName={person}
        canEditLibrary={hasPermission(profile?.roleKey, 'pflege.plans.manage')} onClose={() => setTemplateTarget(null)}
      /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexBasis: 200, flexGrow: 1 },
  card: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  measureTitle: { ...typography.h3, flexShrink: 1, color: colors.textPrimary },
  hint: { ...typography.body, color: colors.textSecondary },
});
