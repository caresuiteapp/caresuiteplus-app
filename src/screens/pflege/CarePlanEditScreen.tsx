import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchCarePlanDetail } from '@/lib/pflege/carePlanDetailService';
import { updateCarePlan } from '@/lib/pflege/carePlanListService';
import type { CarePlanDetail } from '@/types/modules/pflege';
import { colors, spacing } from '@/theme';

export function CarePlanEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [plan, setPlan] = useState<CarePlanDetail | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [goals, setGoals] = useState('');
  const [resources, setResources] = useState('');
  const [risks, setRisks] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id || !tenantId) return;
    void fetchCarePlanDetail(id, tenantId, profile?.roleKey).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) return setError(result.error);
      setPlan(result.data);
      setTitle(result.data.title);
      setSummary(result.data.summary);
      setGoals(result.data.goals ?? '');
      setResources(result.data.resources ?? '');
      setRisks(result.data.risks ?? '');
      setValidUntil(result.data.validUntil ?? '');
    });
    return () => { active = false; };
  }, [id, tenantId, profile?.roleKey]);

  const save = async () => {
    if (!tenantId || !plan) return;
    setError(null);
    setBusy(true);
    const result = await updateCarePlan(tenantId, profile?.roleKey, {
      id: plan.id,
      clientId: plan.clientId,
      title,
      description: summary,
      goals,
      resources,
      risks,
      validFrom: plan.validFrom.slice(0, 10),
      validUntil: validUntil || null,
      sourceAssessmentId: plan.assessmentId ?? null,
      primaryNurseId: plan.primaryNurseId,
      actorName: profile?.displayName ?? 'Pflegefachperson',
      items: plan.tasks.map((task, index) => ({
        title: task.label,
        category: task.category,
        goal: task.goal,
        intervention: task.intervention,
        frequency: task.frequency,
        timing: task.timing,
        responsibleRole: task.responsibleRole,
        warningSigns: task.warningSigns,
        escalationPath: task.escalationPath,
        evaluationCriteria: task.evaluationCriteria,
        nextEvaluationAt: task.nextEvaluationAt,
        status: task.status === 'abgeschlossen' ? 'completed' : 'active',
        sortOrder: index,
      })),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSaved(true);
  };

  if (loading) return <ScreenShell title="Pflegeplan bearbeiten"><LoadingState message="Live-Pflegeplan wird geladen…" /></ScreenShell>;
  if (saved) {
    return (
      <ScreenShell title="Pflegeplan fortgeschrieben" showBack={false}>
        <SuccessState message="Die neue Version wurde live gespeichert und in der Änderungshistorie gesichert." />
        <PremiumButton title="Pflegeplan öffnen" fullWidth onPress={() => router.replace(`/pflege/plans/${id}` as never)} />
      </ScreenShell>
    );
  }
  if (!plan || error) {
    return <ScreenShell title="Pflegeplan bearbeiten"><ErrorState message={error ?? 'Pflegeplan nicht gefunden.'} /></ScreenShell>;
  }
  return (
    <ScreenShell title="Pflegeplan bearbeiten" subtitle={`Version ${plan.version} · ${plan.clientName}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero eyebrow="PFLEGE · FORTSCHREIBUNG" title="Pflegeplan fachlich fortschreiben" meta="Jedes Speichern erzeugt eine neue unveränderbare Version" icon="✏️" formMode="edit" accentColor={colors.cyan} />
        <SectionPanel title="Pflegefachliche Planung">
          <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} />
          <PremiumInput label="Versorgungssituation *" value={summary} onChangeText={setSummary} multiline />
          <PremiumInput label="Ressourcen" value={resources} onChangeText={setResources} multiline />
          <PremiumInput label="Risiken" value={risks} onChangeText={setRisks} multiline />
          <PremiumInput label="Pflegeziele *" value={goals} onChangeText={setGoals} multiline />
          <PremiumInput label="Gültig bis (optional)" value={validUntil} onChangeText={setValidUntil} />
        </SectionPanel>
        {error ? <ErrorState message={error} /> : null}
        <PremiumButton title="Neue Version live speichern" fullWidth loading={busy} disabled={busy || !title.trim() || !summary.trim() || !goals.trim()} onPress={save} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl, gap: spacing.md } });
