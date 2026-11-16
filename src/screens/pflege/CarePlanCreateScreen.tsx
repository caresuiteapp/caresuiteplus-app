import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CareDateInput } from '@/components/inputs/CareDateInput';
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
import { createCarePlan } from '@/lib/pflege/carePlanListService';
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
        items: measures.map(({ input }, sortOrder) => ({ ...input, status: 'active', sortOrder })),
      });
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
              <FilterChipGroup wrap options={clientOptions} value={clientId} onChange={busy ? undefined : setClientId} />
              {!clientOptions.length ? <Text style={styles.hint}>Keine passenden Pflegefälle.</Text> : null}
            </>
          ) : !clients.error ? <Text style={styles.hint}>Für die Pflegeplanung muss ein aktiver Pflegefall vorhanden sein.</Text> : null}
        </SectionPanel>
        <SectionPanel title="Pflegebedarf, Ressourcen und Ziele">
          <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} editable={!busy} />
          <PremiumInput label="Pflegeprobleme und Unterstützungsbedarf *" value={description} onChangeText={setDescription} multiline editable={!busy} />
          <PremiumInput label="Fähigkeiten und Ressourcen" value={resources} onChangeText={setResources} multiline editable={!busy} />
          <PremiumInput label="Risiken und besondere Anforderungen" value={risks} onChangeText={setRisks} multiline editable={!busy} />
          <PremiumInput label="Übergreifende Pflegeziele *" value={goals} onChangeText={setGoals} multiline editable={!busy} />
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
              {measureFields.map(({ field, label, ...options }) => (
                <PremiumInput key={field} label={label} value={input[field] ?? ''} onChangeText={value => editMeasure(key, { [field]: value })} editable={!busy} {...options} />
              ))}
              <CareDateInput label="Nächste Evaluation" value={input.nextEvaluationAt ?? ''} onChange={value => { if (!busy) editMeasure(key, { nextEvaluationAt: value || null }); }} showFormatHint={false} />
            </View>
          ))}
          <PremiumButton title="Weitere Maßnahme hinzufügen" variant="secondary" disabled={busy} onPress={addMeasure} />
        </SectionPanel>
        {error ? <ErrorState title="Pflegeplan nicht gespeichert" message={error} /> : null}
        <PremiumButton title="Pflegeplan speichern" fullWidth loading={busy} disabled={busy || !clientList.length || Boolean(clients.error)} onPress={save} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth disabled={busy} onPress={() => router.back()} />
      </ScrollView>
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
